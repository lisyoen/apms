import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export type Frontmatter = Record<string, string>;

export function parseMarkdown(source: string) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta: Frontmatter = {};
  if (!match) return { meta, body: source };
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    meta[key] = value;
  }
  return { meta, body: match[2] };
}

export async function readTaskFile(path: string) {
  const source = await readFile(path, "utf8");
  return { source, ...parseMarkdown(source), filename: basename(path) };
}

export function nullable(value?: string) {
  return !value || value === "null" || value === "~" ? null : value;
}

export function reportFilename(taskFilename: string) {
  return taskFilename.replace(/-task\.md$/, "-report.md");
}

export function yamlString(value: string | number | null) {
  if (value === null) return "null";
  return JSON.stringify(String(value));
}
