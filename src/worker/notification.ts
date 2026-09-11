import nodemailer from "nodemailer";
import type { Pool } from "pg";

type CompletionRow = { id: string; name: string; slug: string; email: string; owner_id?: string };

export async function notifyIfComplete(db: Pool, project: CompletionRow) {
  const owner = project.owner_id ? await db.query<{email:string;preferences:Record<string,unknown>}>("SELECT email,preferences FROM users WHERE id=$1",[project.owner_id]) : await db.query<{email:string;preferences:Record<string,unknown>}>("SELECT email,preferences FROM users WHERE lower(email)=lower($1)",[project.email]);
  const preferences=owner.rows[0]?.preferences||{};if(preferences.email_notifications===false)return false;
  const recipient=typeof preferences.notification_email==="string"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(preferences.notification_email)?preferences.notification_email:owner.rows[0]?.email||project.email;
  const counts = await db.query<{ pending: string; running: string; done: string; failed: string; newest: string | null }>(`SELECT
    count(*) FILTER (WHERE status='pending') pending,
    count(*) FILTER (WHERE status='in-progress') running,
    count(*) FILTER (WHERE status='done') done,
    count(*) FILTER (WHERE status='failed') failed,
    max(created_at)::text newest FROM tasks WHERE project_id=$1`, [project.id]);
  const count = counts.rows[0];
  if (Number(count.pending) + Number(count.running) !== 0 || !count.newest) return false;
  const tasks = await db.query<{ title: string; filename: string; status: string; log_path: string | null }>(`SELECT coalesce(t.title,t.filename) title,t.filename,t.status,
    (SELECT log_path FROM task_runs r WHERE r.task_id=t.id ORDER BY attempt DESC LIMIT 1) log_path
    FROM tasks t WHERE project_id=$1 ORDER BY filename`, [project.id]);
  const reportUrl = `https://dirigo.craftbay.io/p/${encodeURIComponent(project.slug)}?tab=reports`;
  const subject = `[APMS] ${project.name} 작업 완료`;
  const lines = tasks.rows.map((task) => `- [${task.status}] ${task.title} — ${reportUrl}`);
  const body = `${project.name} 프로젝트의 발주 작업이 모두 처리되었습니다.\n\n완료 ${count.done}건 / 실패 ${count.failed}건\n\n${lines.join("\n")}`;
  const key = `project-complete:${project.id}:${count.newest}`;
  const inserted = await db.query<{ id: string }>(`INSERT INTO notifications(project_id,recipient,subject,body,idempotency_key,status)
    VALUES($1,$2,$3,$4,$5,'pending') ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`, [project.id, recipient, subject, body, key]);
  if (!inserted.rowCount) return false;
  if (!process.env.DIRIGO_SMTP_URL) {
    console.warn(`[scheduler] SMTP 미설정: notification ${inserted.rows[0].id} 기록`);
    return true;
  }
  try {
    const transport = nodemailer.createTransport(process.env.DIRIGO_SMTP_URL);
    const info = await transport.sendMail({ from: process.env.DIRIGO_SMTP_FROM || project.email, to: recipient, subject, text: body });
    await db.query("UPDATE notifications SET status='sent',provider_id=$1,sent_at=now() WHERE id=$2", [info.messageId, inserted.rows[0].id]);
    console.log(`[scheduler] completion email sent for ${project.slug}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.query("UPDATE notifications SET status='failed',error=$1 WHERE id=$2", [message.slice(0, 500), inserted.rows[0].id]);
    console.error(`[scheduler] email failed for ${project.slug}: ${message}`);
  }
  return true;
}
