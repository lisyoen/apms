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
  assert.match(css, /\.project-layout\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s);
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
  assert.match(css, /\.task-sections\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(css, /\.task-toolbar\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.project-workspace\s*\{[^}]*height:\s*auto;[^}]*overflow:\s*visible;/s);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.task-sections,\.task-detail-scroll\s*\{[^}]*overflow:\s*visible;/s);
});
