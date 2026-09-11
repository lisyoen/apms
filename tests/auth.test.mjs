import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sessionCookie, sessionTtlSeconds } from "../src/lib/session.ts";

test("session defaults to 24 hours and emits a persistent cookie", () => {
  const configuredTtl = process.env.DIRIGO_SESSION_TTL_HOURS;
  delete process.env.DIRIGO_SESSION_TTL_HOURS;
  try {
    assert.equal(sessionTtlSeconds(), 86_400);
    assert.equal(sessionCookie("test-token", Date.UTC(2026, 8, 11)), "dirigo_session=test-token; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400; Expires=Sat, 12 Sep 2026 00:00:00 GMT");
  } finally {
    if (configuredTtl === undefined) delete process.env.DIRIGO_SESSION_TTL_HOURS;
    else process.env.DIRIGO_SESSION_TTL_HOURS = configuredTtl;
  }
});

test("login form keeps credential storage browser-only", async () => {
  const source = await readFile(new URL("../src/app/login/login-form.tsx", import.meta.url), "utf8");
  assert.match(source, /name="saveCredentials"/);
  assert.match(source, /localStorage\.getItem\(EMAIL_KEY\)/);
  assert.match(source, /localStorage\.getItem\(PASSWORD_KEY\)/);
  assert.match(source, /localStorage\.setItem\(EMAIL_KEY, email\)/);
  assert.match(source, /localStorage\.setItem\(PASSWORD_KEY, encodePassword\(password\)\)/);
  assert.match(source, /localStorage\.removeItem\(EMAIL_KEY\)/);
  assert.match(source, /localStorage\.removeItem\(PASSWORD_KEY\)/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{[^}]*saveCredentials/s);
  assert.match(source, /not encryption/);
  assert.match(source, /공용 PC 에서는 사용하지 마세요/);
});
