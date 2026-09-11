import test, { after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import "dotenv/config";
import pg from "pg";

const root = await mkdtemp(path.join(tmpdir(), "dirigo-scheduler-"));
process.env.DIRIGO_DATA_ROOT = root;
process.env.DIRIGO_WORKER_RUNNER = "dummy";
delete process.env.DIRIGO_SMTP_URL;
const { Scheduler } = await import("../src/worker/scheduler.ts");
const { DummyRunner } = await import("../src/worker/runner-dummy.ts");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let serial = 0;
let currentFixture;

before(async () => { await pool.query("SELECT 1"); });
after(async () => { await pool.query("DELETE FROM users WHERE email LIKE 'scheduler-test-%@example.invalid'"); await pool.end(); await rm(root, { recursive: true, force: true }); });
afterEach(async () => { if (currentFixture) { await currentFixture.scheduler.stop(); await pool.query("DELETE FROM users WHERE id=$1", [currentFixture.user.id]); currentFixture = undefined; } });

async function fixture() {
  serial++;
  const email = `scheduler-test-${Date.now()}-${serial}@example.invalid`;
  const user = (await pool.query("INSERT INTO users(email,password_hash) VALUES($1,'test') RETURNING id,email,slug", [email])).rows[0];
  const slug = `project-${serial}`;
  const project = (await pool.query("INSERT INTO projects(owner_id,name,slug) VALUES($1,$2,$3) RETURNING id,name,slug", [user.id, `Project ${serial}`, slug])).rows[0];
  const storageUser = user.slug;
  const base = path.join(root, storageUser, slug);
  for (const dir of ["pending", "in-progress", "done", "failed", "reports"]) await mkdir(path.join(base, "tasks", dir), { recursive: true });
  await mkdir(path.join(base, "docs"), { recursive: true });
  await writeFile(path.join(base, "docs", `${slug}.guide.md`), "# Test guide\n");
  currentFixture = { user, project, base, scheduler: new Scheduler(pool, new DummyRunner(), { intervalMs: 100_000, maxWorkers: 2 }) };
  return currentFixture;
}

async function addTask(f, filename, body = "", options = {}) {
  const created = new Date().toISOString();
  const content = `---\ntitle: ${options.title || filename}\nproject: ${f.project.slug}\nuser: test\npre-task: ${options.pre || "null"}\nnext-task: ${options.next || "null"}\ntype: task\ncreated_at: ${created}\ntimeout_min: ${options.timeout ?? 20}\n---\n\n${body}\n`;
  await writeFile(path.join(f.base, "tasks", "pending", filename), content);
  await pool.query(`INSERT INTO tasks(project_id,filename,status,title,timeout_min,file_path,created_at) VALUES($1,$2,'pending',$3,$4,$2,$5)`, [f.project.id, filename, options.title || filename, Math.max(1, Math.ceil(options.timeout ?? 20)), created]);
}

async function waitFor(check, timeout = 4000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await new Promise((resolve) => setTimeout(resolve, 20)); }
  throw new Error("condition timed out");
}

test("pending 픽업 후 in-progress를 거쳐 done", { concurrency: false }, async () => {
  const f = await fixture(); const file = "20260909-001-task.md"; await addTask(f, file);
  await f.scheduler.tick();
  await waitFor(async () => (await pool.query("SELECT status FROM tasks WHERE project_id=$1 AND filename=$2", [f.project.id, file])).rows[0]?.status === "done");
  assert.match(await readFile(path.join(f.base, "tasks", "done", file), "utf8"), /title:/);
});

test("exit:1 작업은 failed와 report 생성", { concurrency: false }, async () => {
  const f = await fixture(); const file = "20260909-002-task.md"; await addTask(f, file, "exit:1"); await f.scheduler.tick();
  await waitFor(async () => (await pool.query("SELECT status FROM tasks WHERE project_id=$1 AND filename=$2", [f.project.id, file])).rows[0]?.status === "failed");
  const report = await readFile(path.join(f.base, "tasks", "reports", "20260909-002-report.md"), "utf8"); assert.match(report, /exit_code: 1/);
});

test("pre-task 미완료 작업은 픽업하지 않음", { concurrency: false }, async () => {
  const f = await fixture(); const file = "20260909-003-task.md"; await addTask(f, file, "", { pre: "20260909-001-task.md" }); await f.scheduler.tick();
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal((await pool.query("SELECT status FROM tasks WHERE project_id=$1 AND filename=$2", [f.project.id, file])).rows[0].status, "pending");
});

test("next-task는 성공 직후 최상위 priority", { concurrency: false }, async () => {
  const f = await fixture(); const first = "20260909-004-task.md"; const next = "20260909-005-task.md";
  await addTask(f, first, "", { next }); await addTask(f, next, "", { pre: first }); await f.scheduler.tick();
  await waitFor(async () => Number((await pool.query("SELECT priority FROM tasks WHERE project_id=$1 AND filename=$2", [f.project.id, next])).rows[0]?.priority) === 1000);
  assert.equal((await pool.query("SELECT status FROM tasks WHERE project_id=$1 AND filename=$2", [f.project.id, next])).rows[0].status, "pending");
});

test("timeout_min=0.05 초과는 failed", { concurrency: false }, async () => {
  const f = await fixture(); const file = "20260909-006-task.md"; await addTask(f, file, "sleep:4", { timeout: 0.05 }); await f.scheduler.tick();
  await waitFor(async () => (await pool.query("SELECT status FROM tasks WHERE project_id=$1 AND filename=$2", [f.project.id, file])).rows[0]?.status === "failed", 8000);
  assert.equal((await pool.query("SELECT r.status FROM task_runs r JOIN tasks t ON t.id=r.task_id WHERE t.project_id=$1 AND t.filename=$2", [f.project.id, file])).rows[0].status, "timed_out");
});

test("전 작업 완료 시 notifications 한 행만 기록", { concurrency: false }, async () => {
  const f = await fixture(); const file = "20260909-007-task.md"; await addTask(f, file); await f.scheduler.tick();
  await waitFor(async () => Number((await pool.query("SELECT count(*) count FROM notifications WHERE project_id=$1", [f.project.id])).rows[0].count) === 1);
  await f.scheduler.tick(); await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(Number((await pool.query("SELECT count(*) count FROM notifications WHERE project_id=$1", [f.project.id])).rows[0].count), 1);
});
