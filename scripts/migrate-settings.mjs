#!/usr/bin/env node
import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(repositoryRoot, "src/lib/storage/templates/setting.md");

export function splitSetting(source = "") {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return match ? { frontmatter: match[1], body: match[2] } : { frontmatter: "", body: source };
}

export function needsSettingMigration(source = "") {
  const { body } = splitSetting(source);
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return true;
  if (lines.length > 1 || !/^#\s+\S/.test(lines[0])) return false;
  const title = lines[0].replace(/^#\s+/, "").replace(/\s/g, "");
  return body.replace(/\s/g, "").length <= title.length + 1;
}

function frontmatterLines(value) {
  const entries = new Map();
  for (const line of value.split(/\r?\n/)) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) entries.set(match[1], line);
  }
  return entries;
}

export function mergeSetting(template, existing, project, now = new Date()) {
  const rendered = template.replaceAll("{project}", project).replaceAll("{created_at}", now.toISOString().slice(0, 10));
  const base = splitSetting(rendered);
  const current = splitSetting(existing);
  const preserved = frontmatterLines(current.frontmatter);
  const merged = base.frontmatter.split(/\r?\n/).map((line) => {
    const match = line.match(/^([a-z_]+):/);
    return match && preserved.has(match[1]) ? preserved.get(match[1]) : line;
  });
  for (const [key, line] of preserved) if (!merged.some((item) => item.startsWith(`${key}:`))) merged.push(line);
  return `---\n${merged.join("\n")}\n---\n${base.body}`;
}

export async function migrateSettings({ root, apply = false, now = new Date() }) {
  const template = await readFile(templatePath, "utf8");
  const changes = [];
  for (const user of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!user.isDirectory() || user.isSymbolicLink()) continue;
    const userRoot = path.join(root, user.name);
    for (const project of await readdir(userRoot, { withFileTypes: true })) {
      if (!project.isDirectory() || project.isSymbolicLink() || project.name === "docs" || project.name.startsWith(".")) continue;
      const docs = path.join(userRoot, project.name, "docs");
      const docsInfo = await readdir(docs).catch(() => null);
      if (docsInfo === null) continue;
      const file = path.join(docs, `${project.name}.setting.md`);
      const existing = await readFile(file, "utf8").catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
      if (existing !== null && !needsSettingMigration(existing)) continue;
      const reason = existing === null ? "missing" : "title-only";
      changes.push({ file: path.relative(root, file), reason });
      if (apply) {
        const content = mergeSetting(template, existing ?? "", project.name, now);
        const temporary = `${file}.${process.pid}.tmp`;
        await writeFile(temporary, content, "utf8");
        await rename(temporary, file);
      }
    }
  }
  return changes;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--dry-run") && args.has("--apply")) throw new Error("Use either --dry-run or --apply, not both.");
  const apply = args.has("--apply");
  const rootArg = process.argv.find((arg) => arg.startsWith("--root="));
  const root = path.resolve(rootArg?.slice(7) || process.env.DIRIGO_DATA_ROOT || path.join(repositoryRoot, "data"));
  const changes = await migrateSettings({ root, apply });
  console.log(`mode=${apply ? "apply" : "dry-run"} root=${root} changes=${changes.length}`);
  for (const item of changes) console.log(`${item.reason}\t${item.file}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
