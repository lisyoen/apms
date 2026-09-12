import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter } from "node:path";
import { spawn } from "node:child_process";
import type { RunContext, RunResult, TaskSpec, WorkerRunner } from "./types";
import { getConfig } from "../lib/config/loader";

export class OpenCodeRunner implements WorkerRunner {
  readonly type = "opencode" as const;
  constructor(private readonly bin = getConfig().config.worker.opencode_bin) {}

  async available() {
    if (this.bin.includes("/")) return access(this.bin, constants.X_OK).then(() => true, () => false);
    for (const dir of (process.env.PATH ?? "").split(delimiter)) {
      if (await access(`${dir}/${this.bin}`, constants.X_OK).then(() => true, () => false)) return true;
    }
    return false;
  }

  async run(task: TaskSpec, ctx: RunContext): Promise<RunResult> {
    const prompt = `${ctx.guide}\n\n# 작업지시서\n\n${task.body}\n\n완료 시 \`## 결과 보고\` 섹션을 stdout 마지막에 출력하세요.`;
    return new Promise((resolve) => {
      let stdout = ""; let stderr = ""; let timedOut = false; let settled = false;
      const child = spawn(this.bin, ["-p", prompt, "-f", "text", "-q"], {
        cwd: ctx.cwd,
        detached: process.platform !== "win32",
        env: ctx.env as NodeJS.ProcessEnv,
        stdio: ["ignore", "pipe", "pipe"] as const,
      });
      ctx.onSpawn?.(child.pid ?? 0);
      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      const timeout = setTimeout(() => {
        timedOut = true;
        if (child.pid) process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM");
        setTimeout(() => { if (!settled && child.pid) { try { process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGKILL"); } catch {} } }, 10_000).unref();
      }, task.timeoutMin * 60_000);
      child.on("error", (error) => { stderr += error.message; });
      child.on("close", (code, signal) => {
        settled = true; clearTimeout(timeout);
        resolve({ exitCode: code, pid: child.pid ?? null, stdout, stderr, timedOut, failureReason: timedOut ? "timeout" : signal ? `signal:${signal}` : code === 0 ? undefined : "non-zero exit" });
      });
    });
  }
}
