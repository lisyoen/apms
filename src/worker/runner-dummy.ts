import type { RunContext, RunResult, TaskSpec, WorkerRunner } from "./types";

export class DummyRunner implements WorkerRunner {
  readonly type = "dummy" as const;
  async available() { return true; }
  async run(task: TaskSpec, ctx: RunContext): Promise<RunResult> {
    await ctx.onSpawn?.(process.pid);
    const sleepMatch = task.body.match(/sleep:(\d+(?:\.\d+)?)/);
    const sleepMs = Number(sleepMatch?.[1] ?? 0) * 1000;
    const timeoutMs = task.timeoutMin * 60_000;
    const timedOut = sleepMs > timeoutMs;
    await new Promise((resolve) => setTimeout(resolve, Math.min(sleepMs, timeoutMs)));
    if (timedOut) return { exitCode: null, pid: process.pid, stdout: "", stderr: "dummy runner timed out", timedOut: true, failureReason: "timeout" };
    const failed = task.body.includes("exit:1");
    return { exitCode: failed ? 1 : 0, pid: process.pid, stdout: `dummy runner\n## 결과 보고\n${failed ? "실패" : "완료"}`, stderr: "", timedOut: false };
  }
}
