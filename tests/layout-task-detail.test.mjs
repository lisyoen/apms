import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("long task content stays inside a fixed-height project workspace", async () => {
  const [css, client] = await Promise.all([
    read("../src/app/globals.css"),
    read("../src/app/p/[slug]/project-client.tsx"),
  ]);

  assert.match(css, /\.project-workspace\s*\{[^}]*height:\s*calc\(100vh - 60px\);[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.project-workspace\s*\{[^}]*min-height:\s*0;/s);
  assert.match(css, /\.project-layout\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.project-content\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/s);
  assert.match(css, /\.project-content\.tasks-active\s*\{[^}]*display:\s*flex;[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.tasks-view\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1;[^}]*min-height:\s*0;/s);
  assert.match(css, /\.project-chat\s*\{[^}]*position:\s*relative;[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s);
  assert.doesNotMatch(css, /\.project-chat\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /\.task-detail-scroll\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*overflow:\s*auto;/s);
  assert.match(client, /className="task-detail-scroll"/);

  const panelRect = (viewportHeight) => ({ top: 60, height: viewportHeight - 60 });
  const beforeOpen = panelRect(900);
  for (const lineCount of [3_000, 10_000]) {
    const longTask = Array.from({ length: lineCount }, (_, index) => `line ${index}`).join("\n");
    assert.ok(longTask.length > beforeOpen.height);
    assert.deepEqual(panelRect(900), beforeOpen, `chat rect changed for ${lineCount} lines`);
  }
});

test("task list toolbar is fixed within its independent scroller and mobile restores page scrolling", async () => {
  const css = await read("../src/app/globals.css");
  const sectionsRule = css.match(/\.task-sections\s*\{([^}]*)\}/s)?.[1] ?? "";
  const sectionRule = css.match(/\.task-section\s*\{([^}]*)\}/s)?.[1] ?? "";
  assert.match(sectionsRule, /display:\s*grid;/);
  assert.match(sectionsRule, /grid-auto-rows:\s*max-content;/);
  assert.match(sectionsRule, /align-content:\s*start;/);
  assert.match(sectionsRule, /overflow:\s*auto;/);
  assert.doesNotMatch(sectionsRule, /(?:^|;)\s*(?:grid-auto-rows|grid-template-rows):\s*(?:1fr|repeat\([^;]*1fr)/);
  assert.doesNotMatch(sectionRule, /overflow:\s*hidden/);
  assert.match(css, /\.task-toolbar\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.project-workspace\s*\{[^}]*height:\s*auto;[^}]*overflow:\s*visible;/s);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.task-sections,\.task-detail-scroll\s*\{[^}]*overflow:\s*visible;/s);
});

test("natural-height task sections expose every row through one parent scroller", () => {
  const viewport = 772;
  const toolbar = 54;
  const gap = 18;
  const sectionHeights = [50, 137, 50, 277, 262];
  const scrollHeight = toolbar + sectionHeights.reduce((sum, height) => sum + height, 0) + gap * sectionHeights.length;

  assert.ok(scrollHeight > viewport, "the task list must overflow its bounded column");
  assert.equal(sectionHeights[3], 277, "a three-row section retains its natural height");
  assert.equal(sectionHeights[4], 262, "all report rows and pagination retain their natural height");
  assert.equal(Math.max(0, scrollHeight - viewport), 148, "the single parent scroller reaches the final section");
});
