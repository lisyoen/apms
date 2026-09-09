import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("project panel creates and filters sessions with project_slug binding", async () => {
  const [panel, route] = await Promise.all([
    readFile(new URL("../src/components/chat/ChatPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/chat/sessions/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /project_slug:projectSlug/);
  assert.match(panel, /project_slug=.*encodeURIComponent/);
  assert.match(route, /owner_id=\$2/);
  assert.match(route, /projectId=project\.rows\[0\]\.id/);
});

test("panel and fullscreen routes retain the same project session", async () => {
  const [panel, fullscreen] = await Promise.all([
    readFile(new URL("../src/components/chat/ChatPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/p/[slug]/chat/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /chatSessionStorageKey\(projectSlug\)/);
  assert.match(panel, /router\.push\(`\/p\/\$\{projectSlug\}\/chat`\)/);
  assert.match(fullscreen, /layout="fullscreen"/);
  assert.match(fullscreen, /projectSlug=\{slug\}/);
});
