import "dotenv/config";
import { readFile, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { dataRoot, projectRoot } from "../lib/storage/index";
import { DummyRunner } from "./runner-dummy";
import { OpenCodeRunner } from "./runner-opencode";
import { nullable, readTaskFile, reportFilename } from "./task-file";
import { writeReport } from "./report";
import { notifyIfComplete } from "./notification";
import { buildRunEnv, resolveRunWorkdir } from "./security";
import type { RunResult, TaskSpec, WorkerRunner } from "./types";
import { runLlmHealthChecks } from "../lib/llm/health";

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  user_slug: string;
  email: string;
};
type Candidate = {
  project: ProjectRow;
  user: string;
  file: string;
  priority: number;
  task: Awaited<ReturnType<typeof readTaskFile>>;
};
const LEASE_SECONDS = 60;
const HEARTBEAT_MS = 30_000;
export const SCHEDULER_LOCK_KEY = 0x41504d53;

export async function trySchedulerLock(
  client: Pick<PoolClient, "query">,
  key = SCHEDULER_LOCK_KEY,
) {
  const result = await client.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock($1) locked",
    [key],
  );
  return result.rows[0]?.locked === true;
}

export class Scheduler {
  maxWorkers: number;
  private readonly intervalMs: number;
  private readonly active = new Map<string, Promise<void>>();
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private settingsLoadedAt = 0;
  private leader?: PoolClient;
  private recovered = false;
  private healthCheckedAt = 0;
  private healthEnabled = false;
  private readonly lockKey: number;

  constructor(
    readonly db: Pool,
    readonly runner: WorkerRunner,
    options: { maxWorkers?: number; intervalMs?: number } = {},
  ) {
    this.maxWorkers =
      options.maxWorkers ?? Number(process.env.APMS_MAX_WORKERS || 20);
    this.lockKey = this.runner.type === "dummy" ? SCHEDULER_LOCK_KEY + process.pid : SCHEDULER_LOCK_KEY;
    this.intervalMs =
      options.intervalMs ??
      Number(process.env.APMS_SCHEDULER_INTERVAL_MS || 10_000);
  }

  async start() {
    this.healthEnabled = true;
    if (!(await this.runner.available()))
      console.warn(
        `[scheduler] ${this.runner.type} runner executable is unavailable; tasks will fail explicitly`,
      );
    await this.tick();
    this.timer = setInterval(
      () =>
        void this.tick().catch((error) =>
          console.error("[scheduler] tick failed", error),
        ),
      this.intervalMs,
    );
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled(this.active.values());
    if (this.leader) {
      await this.leader
        .query("SELECT pg_advisory_unlock($1)", [this.lockKey])
        .catch(() => undefined);
      this.leader.release();
      this.leader = undefined;
    }
  }

  private async becomeLeader() {
    if (this.leader) return true;
    const client = await this.db.connect();
    try {
      if (!(await trySchedulerLock(client, this.lockKey))) {
        client.release();
        return false;
      }
      this.leader = client;
      return true;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async tick() {
    if (this.stopped || !(await this.becomeLeader())) return;
    if (!this.recovered) {
      await this.recoverOrphans();
      this.recovered = true;
    }
    if (Date.now() - this.settingsLoadedAt >= 30_000)
      await this.reloadSettings();
    if (this.healthEnabled && Date.now() - this.healthCheckedAt >= 60_000) {
      this.healthCheckedAt = Date.now();
      void runLlmHealthChecks(this.db).catch((error) =>
        console.error("[scheduler] LLM health check failed", error),
      );
    }
    await this.db.query(
      `INSERT INTO scheduler_state(singleton,heartbeat_at,max_workers,pid,leader_pid) VALUES(true,now(),$1,$2,$2)
      ON CONFLICT(singleton) DO UPDATE SET heartbeat_at=now(),max_workers=excluded.max_workers,pid=excluded.pid,leader_pid=excluded.leader_pid`,
      [this.maxWorkers, process.pid],
    );
    const free = this.maxWorkers - this.active.size;
    if (free <= 0) return;
    const candidates = await this.scan();
    let started = 0;
    for (const candidate of candidates) {
      if (started >= free || this.active.has(candidate.project.id)) continue;
      const promise = this.execute(candidate)
        .catch((error) =>
          console.error(
            `[scheduler] ${candidate.file} failed to finalize`,
            error,
          ),
        )
        .finally(() => this.active.delete(candidate.project.id));
      this.active.set(candidate.project.id, promise);
      started++;
    }
  }

  private async reloadSettings() {
    this.settingsLoadedAt = Date.now();
    const result = await this.db
      .query(
        "SELECT value FROM settings WHERE scope='global' AND key='worker_settings'",
      )
      .catch(() => ({ rows: [] }));
    const value = result.rows[0]?.value;
    if (!value) return;
    const max = Number(value.max_workers);
    if (Number.isInteger(max) && max > 0 && max <= 100) this.maxWorkers = max;
    if (typeof value.opencode_path === "string" && value.opencode_path)
      process.env.APMS_OPENCODE_PATH = value.opencode_path;
    if (value.runner === "subprocess" || value.runner === "container")
      process.env.APMS_WORKER_RUNNER = value.runner;
  }

  private async projects() {
    return (
      await this.db.query<ProjectRow>(
        `SELECT p.id,p.name,p.slug,p.owner_id,u.slug user_slug,u.email FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.archived_at IS NULL AND u.disabled_at IS NULL ORDER BY u.id,p.created_at`,
      )
    ).rows;
  }

  private async scan() {
    const candidates: Candidate[] = [];
    for (const project of await this.projects()) {
      const user = project.user_slug;
      const pending = path.join(
        projectRoot(user, project.slug),
        "tasks",
        "pending",
      );
      for (const file of (await readdir(pending).catch(() => [])).filter(
        (name) => /^\d{8}-\d{3}-task\.md$/.test(name),
      )) {
        try {
          const task = await readTaskFile(path.join(pending, file));
          const pre = nullable(task.meta["pre-task"]);
          if (
            pre &&
            !(await fileExists(
              path.join(projectRoot(user, project.slug), "tasks", "done", pre),
            ))
          )
            continue;
          const indexed = await this.db.query<{ priority: number }>(
            "SELECT priority FROM tasks WHERE project_id=$1 AND filename=$2",
            [project.id, file],
          );
          candidates.push({
            project,
            user,
            file,
            task,
            priority: indexed.rows[0]?.priority ?? 0,
          });
        } catch (error) {
          console.error(`[scheduler] invalid task ${file}`, error);
        }
      }
    }
    return candidates.sort(
      (a, b) => b.priority - a.priority || a.file.localeCompare(b.file),
    );
  }

  private async claim(candidate: Candidate) {
    const base = projectRoot(candidate.user, candidate.project.slug);
    const source = path.join(base, "tasks", "pending", candidate.file);
    const inProgress = path.join(base, "tasks", "in-progress", candidate.file);
    const meta = candidate.task.meta;
    const client = await this.db.connect();
    let moved = false;
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO tasks(project_id,filename,status,title,timeout_min,file_path,created_at)
        VALUES($1,$2,'pending',$3,$4,$5,coalesce($6::timestamptz,now())) ON CONFLICT(project_id,filename) DO NOTHING`,
        [
          candidate.project.id,
          candidate.file,
          meta.title || candidate.file,
          Math.max(1, Math.ceil(positiveNumber(meta.timeout_min, 20))),
          path.relative(dataRoot(), source),
          meta.created_at || null,
        ],
      );
      const locked = await client.query<{ id: string }>(
        "SELECT id FROM tasks WHERE project_id=$1 AND filename=$2 AND status='pending' FOR UPDATE SKIP LOCKED",
        [candidate.project.id, candidate.file],
      );
      if (!locked.rowCount) {
        await client.query("ROLLBACK");
        return null;
      }
      await rename(source, inProgress);
      moved = true;
      const taskId = locked.rows[0].id;
      await client.query(
        "UPDATE tasks SET status='in-progress',file_path=$1,lease_until=now()+($2*interval '1 second'),updated_at=now() WHERE id=$3",
        [path.relative(dataRoot(), inProgress), LEASE_SECONDS, taskId],
      );
      const run = await client.query<{ id: string }>(
        `INSERT INTO task_runs(task_id,attempt,runner_type,status,started_at,heartbeat_at,lease_until)
        SELECT $1,coalesce(max(attempt),0)+1,$2,'running',now(),now(),now()+($3*interval '1 second') FROM task_runs WHERE task_id=$1 RETURNING id`,
        [taskId, this.runner.type, LEASE_SECONDS],
      );
      await client.query("COMMIT");
      return { taskId, runId: run.rows[0].id, base, inProgress };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (moved) await rename(inProgress, source).catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async execute(candidate: Candidate) {
    const claimed = await this.claim(candidate);
    if (!claimed) return;
    const { taskId, runId, base, inProgress } = claimed;
    const meta = candidate.task.meta;
    const title = meta.title || candidate.file;
    const timeoutMin = positiveNumber(meta.timeout_min, 20);
    const startedAt = new Date();
    const report = path.join(
      base,
      "tasks",
      "reports",
      reportFilename(candidate.file),
    );
    const spec: TaskSpec = {
      id: taskId,
      projectId: candidate.project.id,
      userSlug: candidate.user,
      projectSlug: candidate.project.slug,
      projectName: candidate.project.name,
      filename: candidate.file,
      title,
      body: candidate.task.body,
      preTask: nullable(meta["pre-task"]),
      nextTask: nullable(meta["next-task"]),
      timeoutMin,
    };
    const heartbeat = setInterval(
      () =>
        void this.db
          .query(
            "UPDATE task_runs SET heartbeat_at=now(),lease_until=now()+($1*interval '1 second') WHERE id=$2 AND status='running'; UPDATE tasks SET lease_until=now()+($1*interval '1 second') WHERE id=$3 AND status='in-progress'",
            [LEASE_SECONDS, runId, taskId],
          )
          .catch((error) =>
            console.error("[scheduler] heartbeat failed", error),
          ),
      HEARTBEAT_MS,
    );
    heartbeat.unref();
    let result: RunResult;
    try {
      const cwd = await this.workdir(base, candidate.project.slug);
      const env = await buildRunEnv(
        candidate.user,
        candidate.project.slug,
        runId,
      );
      if (!(await this.runner.available()))
        result = {
          exitCode: 127,
          pid: null,
          stdout: "",
          stderr: "OpenCode executable is unavailable",
          timedOut: false,
          failureReason: "runner unavailable",
        };
      else
        result = await this.runner.run(spec, {
          cwd,
          env,
          guide: await readFile(
            path.join(base, "docs", `${candidate.project.slug}.guide.md`),
            "utf8",
          ).catch(() => ""),
          reportPath: report,
          startedAt,
          onSpawn: (pid) =>
            this.db
              .query("UPDATE task_runs SET pid=$1 WHERE id=$2", [
                pid || null,
                runId,
              ])
              .then(() => undefined),
        });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "worker setup failed";
      result = {
        exitCode: 1,
        pid: null,
        stdout: "",
        stderr: reason,
        timedOut: false,
        failureReason: reason,
      };
    } finally {
      clearInterval(heartbeat);
    }
    const endedAt = new Date();
    await writeReport(report, spec, result, startedAt, endedAt);
    const status =
      result.exitCode === 0 && !result.timedOut ? "done" : "failed";
    const destination = path.join(base, "tasks", status, candidate.file);
    await rename(inProgress, destination);
    await this.db.query(
      "UPDATE task_runs SET status=$1,ended_at=$2,exit_code=$3,log_path=$4,failure_reason=$5,heartbeat_at=now(),lease_until=NULL WHERE id=$6",
      [
        result.timedOut ? "timed_out" : status,
        endedAt,
        result.exitCode,
        path.relative(dataRoot(), report),
        result.failureReason ?? null,
        runId,
      ],
    );
    await this.db.query(
      "UPDATE tasks SET status=$1,file_path=$2,lease_until=NULL,updated_at=now() WHERE id=$3",
      [status, path.relative(dataRoot(), destination), taskId],
    );
    if (
      status === "done" &&
      spec.nextTask &&
      (await fileExists(path.join(base, "tasks", "pending", spec.nextTask)))
    )
      await this.db.query(
        "UPDATE tasks SET priority=1000,updated_at=now() WHERE project_id=$1 AND filename=$2",
        [candidate.project.id, spec.nextTask],
      );
    await notifyIfComplete(this.db, candidate.project);
  }

  private async workdir(base: string, project: string) {
    const setting = await readFile(
      path.join(base, "docs", `${project}.setting.md`),
      "utf8",
    ).catch(() => "");
    const configured = setting
      .match(/^workdir:\s*(.+?)\s*$/m)?.[1]
      ?.replace(/^['"]|['"]$/g, "");
    return resolveRunWorkdir(base, project, configured);
  }

  async recoverOrphans() {
    for (const project of await this.projects()) {
      const user = project.user_slug;
      const base = projectRoot(user, project.slug);
      const dir = path.join(base, "tasks", "in-progress");
      for (const file of (await readdir(dir).catch(() => [])).filter((name) =>
        /^\d{8}-\d{3}-task\.md$/.test(name),
      )) {
        const row = await this.db.query<{ id: string }>(
          "SELECT id FROM tasks WHERE project_id=$1 AND filename=$2 AND status='in-progress' AND (lease_until IS NULL OR lease_until < now())",
          [project.id, file],
        );
        if (!row.rowCount) continue;
        const parsed = await readTaskFile(path.join(dir, file));
        const taskId = row.rows[0].id;
        const spec: TaskSpec = {
          id: taskId,
          projectId: project.id,
          userSlug: user,
          projectSlug: project.slug,
          projectName: project.name,
          filename: file,
          title: parsed.meta.title || file,
          body: parsed.body,
          preTask: nullable(parsed.meta["pre-task"]),
          nextTask: nullable(parsed.meta["next-task"]),
          timeoutMin: positiveNumber(parsed.meta.timeout_min, 20),
        };
        const now = new Date();
        const report = path.join(
          base,
          "tasks",
          "reports",
          reportFilename(file),
        );
        await writeReport(
          report,
          spec,
          {
            exitCode: null,
            pid: null,
            stdout: "",
            stderr: "Task lease expired.",
            timedOut: false,
            failureReason: "task lease expired",
          },
          now,
          now,
        );
        const failed = path.join(base, "tasks", "failed", file);
        await rename(path.join(dir, file), failed);
        await this.db.query(
          "UPDATE tasks SET status='failed',file_path=$1,lease_until=NULL,updated_at=now() WHERE id=$2",
          [path.relative(dataRoot(), failed), taskId],
        );
        await this.db.query(
          "UPDATE task_runs SET status='failed',ended_at=now(),failure_reason='task lease expired',log_path=$1,lease_until=NULL WHERE task_id=$2 AND status='running'",
          [path.relative(dataRoot(), report), taskId],
        );
      }
    }
  }
}

function positiveNumber(value: string | undefined, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
async function fileExists(file: string) {
  return readFile(file).then(
    () => true,
    () => false,
  );
}
export function selectRunner(): WorkerRunner {
  return process.env.APMS_WORKER_RUNNER === "dummy"
    ? new DummyRunner()
    : new OpenCodeRunner();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const scheduler = new Scheduler(pool, selectRunner());
  const shutdown = async () => {
    await scheduler.stop();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  scheduler.start().catch((error) => {
    console.error("[scheduler] startup failed", error);
    process.exitCode = 1;
  });
}
