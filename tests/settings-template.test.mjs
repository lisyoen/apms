import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderSettingTemplate } from "../src/lib/storage/index.ts";
import { validateSetting } from "../src/lib/storage/setting.ts";
import { mergeSetting, needsSettingMigration } from "../scripts/migrate-settings.mjs";

test("setting 템플릿은 프로젝트와 생성일을 치환하고 검증을 통과한다", async () => {
  const rendered = await renderSettingTemplate("Sample Project", new Date("2026-09-11T00:00:00Z"));
  assert.doesNotMatch(rendered, /\{project\}|\{created_at\}/);
  assert.match(rendered, /# Sample Project 설정/);
  assert.match(rendered, /생성일: 2026-09-11/);
  assert.equal(validateSetting(rendered), null);
  assert.equal((rendered.match(/^## /gm) ?? []).length, 6);
});

test("마이그레이션 판정은 빈 파일과 제목 전용 파일만 보정한다", () => {
  assert.equal(needsSettingMigration(""), true);
  assert.equal(needsSettingMigration("# Sample 설정\n"), true);
  assert.equal(needsSettingMigration("---\nbranch: \"develop\"\n---\n\n# Sample 설정\n"), true);
  assert.equal(needsSettingMigration("# Sample 설정\n\n## 운영\n\n내용\n"), false);
});

test("마이그레이션 병합은 기존 frontmatter 값을 보존한다", async () => {
  const template = await readFile("src/lib/storage/templates/setting.md", "utf8");
  const merged = mergeSetting(template, "---\nbranch: \"develop\"\nmax_concurrent: 3\n---\n\n# 기존 설정\n", "sample", new Date("2026-09-11T00:00:00Z"));
  assert.match(merged, /branch: "develop"/);
  assert.match(merged, /max_concurrent: 3/);
  assert.equal(validateSetting(merged), null);
});
