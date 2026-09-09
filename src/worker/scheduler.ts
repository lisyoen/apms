import "dotenv/config";
import { mkdir, readFile, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { dataRoot, projectRoot, userSlug } from "../lib/storage/index";
import { DummyRunner } from "./runner-dummy";
import { OpenCodeRunner } from "./runner-opencode";
import { nullable, readTaskFile, reportFilename } from "./task-file";
import { writeReport } from "./report";
import { notifyIfComplete } from "./notification";
import type { TaskSpec, WorkerRunner } from "./types";

type ProjectRow = { id: string; name: string; slug: string; owner_id: string; email: string };
type Candidate = { project: ProjectRow; user: string; file: string; priority: number; task: Awaited<ReturnType<typeof readTaskFile>> };

export class Scheduler {
  maxWorkers: number;
  private readonly intervalMs: number;
  private readonly active = new Map<string, Promise<void>>();
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private settingsLoadedAt = 0;

  constructor(readonly db: Pool, readonly runner: WorkerRunner, options: { maxWorkers?: number; intervalMs?: number } = {}) {
    this.maxWorkers = options.maxWorkers ?? Number(process.env.APMS_MAX_WORKERS || 20);
    this.intervalMs = options.intervalMs ?? Number(process.env.APMS_SCHEDULER_INTERVAL_MS || 10_000);
  }

  async start() {
    if (!(await this.runner.available())) console.warn(`[scheduler] ${this.runner.type} runner executable is unavailable; tasks will fail explicitly`);
    await this.recoverOrphans();
    await this.tick();
    this.timer = setInterval(() => void this.tick().catch((error) => console.error("[scheduler] tick failed", error)), this.intervalMs);
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled(this.active.values());
  }

  async tick() {
    if (this.stopped) return;
    if (Date.now() - this.settingsLoadedAt >= 30_000) await this.reloadSettings();
    await this.db.query(`INSERT INTO scheduler_state(singleton,heartbeat_at,max_workers,pid) VALUES(true,now(),$1,$2)
      ON CONFLICT(singleton) DO UPDATE SET heartbeat_at=now(),max_workers=excluded.max_workers,pid=excluded.pid`, [this.maxWorkers, process.pid]);
    const free = this.maxWorkers - this.active.size;
    if (free <= 0) return;
    const candidates = await this.scan();
    let started = 0;
    for (const candidate of candidates) {
      if (started >= free || this.active.has(candidate.project.id)) continue;
      const promise = this.execute(candidate).catch((error) => console.error(`[scheduler] ${candidate.file} failed to finalize`, error)).finally(() => this.active.delete(candidate.project.id));
      this.active.set(candidate.project.id, promise);
      started++;
    }
  }

  private async reloadSettings() {
    this.settingsLoadedAt = Date.now();
    const result = await this.db.query("SELECT value FROM settings WHERE scope='global' AND key='worker_settings'").catch(() => ({ rows: [] }));
    const value = result.rows[0]?.value;
    if (!value) return;
    const max = Number(value.max_workers);
    if (Number.isInteger(max) && max > 0 && max <= 100) this.maxWorkers = max;
    if (typeof value.opencode_path === "string" && value.opencode_path) process.env.APMS_OPENCODE_PATH = value.opencode_path;
    if (value.runner === "subprocess" || value.runner === "container") process.env.APMS_WORKER_RUNNER = value.runner;
  }

  private async projects() {
    return (await this.db.query<ProjectRow>(`SELECT p.id,p.name,p.slug,p.owner_id,u.email FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.archived_at IS NULL AND u.disabled_at IS NULL ORDER BY u.id,p.created_at`)).rows;
  }

  private async scan() {
    const candidates: Candidate[] = [];
    for (const project of await this.projects()) {
      const user = userSlug(project.email, project.owner_id);
      const pending = path.join(projectRoot(user, project.slug), "tasks", "pending");
      for (const file of (await readdir(pending).catch(() => [])).filter((name) => /^\d{8}-\d{3}-task\.md$/.test(name))) {
        try {
          const task = await readTaskFile(path.join(pending, file));
          const pre = nullable(task.meta["pre-task"]);
          if (pre && !(await fileExists(path.join(projectRoot(user, project.slug), "tasks", "done", pre)))) continue;
          const indexed = await this.db.query<{ priority: number }>("SELECT priority FROM tasks WHERE project_id=$1 AND filename=$2", [project.id, file]);
          candidates.push({ project, user, file, task, priority: indexed.rows[0]?.priority ?? 0 });
        } catch (error) { console.error(`[scheduler] invalid task ${file}`, error); }
      }
    }
    return candidates.sort((a, b) => b.priority - a.priority || a.file.localeCompare(b.file));
  }

  private async execute(candidate: Candidate) {
    const base = projectRoot(candidate.user, candidate.project.slug);
    const source = path.join(base, "tasks", "pending", candidate.file);
    const inProgress = path.join(base, "tasks", "in-progress", candidate.file);
    const meta = candidate.task.meta;
    const title = meta.title || candidate.file;
    const timeoutMin = positiveNumber(meta.timeout_min, 20);
    const taskRow = await this.db.query<{ id: string }>(`INSERT INTO tasks(project_id,filename,status,title,timeout_min,file_path,created_at)
      VALUES($1,$2,'pending',$3,$4,$5,coalesce($6::timestamptz,now())) ON CONFLICT(project_id,filename) DO UPDATE SET title=excluded.title,timeout_min=excluded.timeout_min RETURNING id`,
      [candidate.project.id, candidate.file, title, Math.max(1, Math.ceil(timeoutMin)), path.relative(dataRoot(), source), meta.created_at || null]);
    await rename(source, inProgress);
    const taskId = taskRow.rows[0].id;
    await this.db.query("UPDATE tasks SET status='in-progress',file_path=$1,updated_at=now() WHERE id=$2", [path.relative(dataRoot(), inProgress), taskId]);
    const run = await this.db.query<{ id: string }>(`INSERT INTO task_runs(task_id,attempt,runner_type,status,started_at)
      SELECT $1,coalesce(max(attempt),0)+1,$2,'running',now() FROM task_runs WHERE task_id=$1 RETURNING id`, [taskId, this.runner.type]);
    const runId = run.rows[0].id;
    const startedAt = new Date();
    const report = path.join(base, "tasks", "reports", reportFilename(candidate.file));
    const spec: TaskSpec = { id: taskId, projectId: candidate.project.id, userSlug: candidate.user, projectSlug: candidate.project.slug, projectName: candidate.project.name, filename: candidate.file, title, body: candidate.task.body, preTask: nullable(meta["pre-task"]), nextTask: nullable(meta["next-task"]), timeoutMin };
    let result;
    if (!(await this.runner.available())) result = { exitCode: 127, pid: null, stdout: "", stderr: "OpenCode executable is unavailable", timedOut: false, failureReason: "runner unavailable" };
    else result = await this.runner.run(spec, { cwd: await this.workdir(base, candidate.project.slug), guide: await readFile(path.join(base, "docs", `${candidate.project.slug}.guide.md`), "utf8").catch(() => ""), reportPath: report, startedAt, onSpawn: (pid) => this.db.query("UPDATE task_runs SET pid=$1 WHERE id=$2", [pid || null, runId]).then(() => undefined) });
    const endedAt = new Date();
    await writeReport(report, spec, result, startedAt, endedAt);
    const status = result.exitCode === 0 && !result.timedOut ? "done" : "failed";
    const destination = path.join(base, "tasks", status, candidate.file);
    await rename(inProgress, destination);
    await this.db.query("UPDATE task_runs SET status=$1,ended_at=$2,exit_code=$3,log_path=$4,failure_reason=$5 WHERE id=$6", [result.timedOut ? "timed_out" : status, endedAt, result.exitCode, path.relative(dataRoot(), report), result.failureReason ?? null, runId]);
    await this.db.query("UPDATE tasks SET status=$1,file_path=$2,updated_at=now() WHERE id=$3", [status, path.relative(dataRoot(), destination), taskId]);
    if (status === "done" && spec.nextTask && await fileExists(path.join(base, "tasks", "pending", spec.nextTask))) await this.db.query("UPDATE tasks SET priority=1000,updated_at=now() WHERE project_id=$1 AND filename=$2", [candidate.project.id, spec.nextTask]);
    await notifyIfComplete(this.db, candidate.project);
  }

  private async workdir(base: string, project: string) {
    const setting = await readFile(path.join(base, "docs", `${project}.setting.md`), "utf8").catch(() => "");
    const configured = setting.match(/^workdir:\s*(.+?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g, "");
    const dir = configured ? path.resolve(configured) : path.join(base, "workspace");
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async recoverOrphans() {
    for (const project of await this.projects()) {
      const user = userSlug(project.email, project.owner_id); const base = projectRoot(user, project.slug);
      const dir = path.join(base, "tasks", "in-progress");
      for (const file of (await readdir(dir).catch(() => [])).filter((name) => /^\d{8}-\d{3}-task\.md$/.test(name))) {
        const parsed = await readTaskFile(path.join(dir, file));
        const indexed = await this.db.query<{ id: string }>(`INSERT INTO tasks(project_id,filename,status,title,timeout_min,file_path,created_at) VALUES($1,$2,'in-progress',$3,$4,$5,coalesce($6::timestamptz,now())) ON CONFLICT(project_id,filename) DO UPDATE SET status='in-progress' RETURNING id`, [project.id, file, parsed.meta.title || file, Math.max(1, Math.ceil(positiveNumber(parsed.meta.timeout_min, 20))), path.relative(dataRoot(), path.join(dir, file)), parsed.meta.created_at || null]);
        const spec: TaskSpec = { id: indexed.rows[0].id, projectId: project.id, userSlug: user, projectSlug: project.slug, projectName: project.name, filename: file, title: parsed.meta.title || file, body: parsed.body, preTask: nullable(parsed.meta["pre-task"]), nextTask: nullable(parsed.meta["next-task"]), timeoutMin: positiveNumber(parsed.meta.timeout_min, 20) };
        const now = new Date(); const report = path.join(base, "tasks", "reports", reportFilename(file));
        await writeReport(report, spec, { exitCode: null, pid: null, stdout: "", stderr: "Scheduler startup recovered an orphaned task.", timedOut: false, failureReason: "orphaned after scheduler restart" }, now, now);
        await rename(path.join(dir, file), path.join(base, "tasks", "failed", file));
        await this.db.query("UPDATE tasks SET status='failed',file_path=$1,updated_at=now() WHERE id=$2", [path.relative(dataRoot(), path.join(base, "tasks", "failed", file)), spec.id]);
        await this.db.query(`UPDATE task_runs SET status='failed',ended_at=now(),failure_reason='orphaned after scheduler restart',log_path=$1 WHERE task_id=$2 AND status='running'`, [path.relative(dataRoot(), report), spec.id]);
      }
    }
  }
}

function positiveNumber(value: string | undefined, fallback: number) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }
async function fileExists(file: string) { return readFile(file).then(() => true, () => false); }

export function selectRunner(): WorkerRunner { return process.env.APMS_WORKER_RUNNER === "dummy" ? new DummyRunner() : new OpenCodeRunner(); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const scheduler = new Scheduler(pool, selectRunner());
  const shutdown = async () => { await scheduler.stop(); await pool.end(); process.exit(0); };
  process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
  scheduler.start().catch((error) => { console.error("[scheduler] startup failed", error); process.exitCode = 1; });
}
