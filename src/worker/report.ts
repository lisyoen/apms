import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RunResult, TaskSpec } from "./types";
import { yamlString } from "./task-file";

const SECRET_PATTERNS = [
  /(?:sk|sk-proj)-[A-Za-z0-9_-]{16,}/g,
  /Authorization:\s*Bearer\s+\S+/gi,
  /(?:password|api[_-]?key)\s*[=:]\s*\S+/gi,
];

export function sanitizeLog(value: string) {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), value).slice(0, 1_000_000);
}

export function extractResult(stdout: string) {
  const matches = [...stdout.matchAll(/^## 결과 보고\s*$([\s\S]*?)(?=^##\s|\s*$)/gm)];
  return matches.at(-1)?.[0].trim() ?? "## 결과 보고\n결과 보고 섹션이 출력되지 않았습니다.";
}

export async function writeReport(path: string, task: TaskSpec, result: RunResult, startedAt: Date, endedAt: Date) {
  const duration = endedAt.getTime() - startedAt.getTime();
  const summary = extractResult(result.stdout);
  const content = `---\ntask: ${yamlString(task.filename)}\nexit_code: ${result.exitCode ?? "null"}\nstarted: ${yamlString(startedAt.toISOString())}\nended: ${yamlString(endedAt.toISOString())}\nduration_ms: ${duration}\ntimed_out: ${result.timedOut}\ntype: report\n---\n\n# ${task.title} 보고서\n\n## 워커 요약\n\n${summary}\n\n## 실행 로그\n\n### stdout\n\n\`\`\`text\n${sanitizeLog(result.stdout)}\n\`\`\`\n\n### stderr\n\n\`\`\`text\n${sanitizeLog(result.stderr)}\n\`\`\`\n`;
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, content, { encoding: "utf8", mode: 0o600 });
  await rename(temp, path);
}
