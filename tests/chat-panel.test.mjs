import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isNearBottom } from "../src/components/chat/scroll.ts";

test("near-bottom includes distances from zero through 80px", () => {
  assert.equal(
    isNearBottom({ scrollHeight: 1000, scrollTop: 500, clientHeight: 500 }),
    true,
  );
  assert.equal(
    isNearBottom({ scrollHeight: 1000, scrollTop: 420, clientHeight: 500 }),
    true,
  );
  assert.equal(
    isNearBottom({ scrollHeight: 1000, scrollTop: 419, clientHeight: 500 }),
    false,
  );
});

test("project panel creates and filters sessions with project_slug binding", async () => {
  const [panel, route] = await Promise.all([
    readFile(new URL("../src/components/chat/ChatPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/sessions/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /project_slug:projectSlug/);
  assert.match(panel, /project_slug=.*encodeURIComponent/);
  assert.match(route, /owner_id=\$2/);
  assert.match(route, /projectId\s*=\s*project\.rows\[0\]\.id/);
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

test("message copy uses raw content and fullscreen header stays fixed", async () => {
  const [panel, css] = await Promise.all([
    readFile(new URL("../src/components/chat/ChatPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/ChatPanel.css", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /copyMessage\(message\.content, messageKey\)/);
  assert.doesNotMatch(panel, /innerText|textContent/);
  assert.match(panel, /className="chat-sticky-header"/);
  assert.match(
    css,
    /\.chat-app \.chat-sticky-header\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*z-index:/s,
  );
});
