import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ImportedAppShell from "../src/components/AppShell.tsx";

const AppShell = ImportedAppShell.default;

function render(role, displayName = "테스트 사용자") {
  return renderToStaticMarkup(React.createElement(AppShell, { email: "user@example.invalid", displayName, role }, React.createElement("main", null, "content")));
}

test("account header gates the admin link by role", () => {
  assert.doesNotMatch(render("user"), /관리자/);
  assert.match(render("admin"), /href="\/admin"[^>]*>관리자</);
});

test("account header links the display name to settings without mailto", () => {
  const html = render("user");
  assert.match(html, /href="\/settings"/);
  assert.match(html, />테스트 사용자<\/a>/);
  assert.doesNotMatch(html, /href="mailto:/);
});

test("account header falls back to the email as its label", () => {
  assert.match(render("user", null), />user@example\.invalid<\/a>/);
});
