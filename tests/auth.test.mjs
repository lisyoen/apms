import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decodeJwt } from "jose";
import { createSession, sessionCookie, sessionTtlSeconds } from "../src/lib/session.ts";
import { loginOptionState } from "../src/app/login/login-options.ts";

test("normal and remembered sessions use matching JWT and cookie TTLs", async () => {
  const configuredTtl = process.env.DIRIGO_SESSION_TTL_HOURS;
  const configuredRememberTtl = process.env.DIRIGO_REMEMBER_TTL_DAYS;
  const configuredSecret = process.env.AUTH_SECRET;
  delete process.env.DIRIGO_SESSION_TTL_HOURS;
  delete process.env.DIRIGO_REMEMBER_TTL_DAYS;
  process.env.AUTH_SECRET = "auth-test-secret-with-sufficient-length";
  try {
    assert.equal(sessionTtlSeconds(false), 86_400);
    assert.equal(sessionTtlSeconds(true), 2_592_000);
    assert.equal(sessionCookie("test-token", false, Date.UTC(2026, 8, 11)), "dirigo_session=test-token; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400; Expires=Sat, 12 Sep 2026 00:00:00 GMT");
    assert.equal(sessionCookie("test-token", true, Date.UTC(2026, 8, 11)), "dirigo_session=test-token; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000; Expires=Sun, 11 Oct 2026 00:00:00 GMT");
    const normal = decodeJwt(await createSession({ email: "test@example.com", role: "user" }, false));
    const remembered = decodeJwt(await createSession({ email: "test@example.com", role: "user" }, true));
    assert.equal(normal.remember, false);
    assert.equal(normal.exp - normal.iat, 86_400);
    assert.equal(remembered.remember, true);
    assert.equal(remembered.exp - remembered.iat, 2_592_000);
  } finally {
    if (configuredTtl === undefined) delete process.env.DIRIGO_SESSION_TTL_HOURS;
    else process.env.DIRIGO_SESSION_TTL_HOURS = configuredTtl;
    if (configuredRememberTtl === undefined) delete process.env.DIRIGO_REMEMBER_TTL_DAYS;
    else process.env.DIRIGO_REMEMBER_TTL_DAYS = configuredRememberTtl;
    if (configuredSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = configuredSecret;
  }
});

test("login option dependency transitions cover checked and unchecked combinations", () => {
  assert.deepEqual(loginOptionState(true, false, "saveCredentials"), { saveCredentials: true, remember: false });
  assert.deepEqual(loginOptionState(false, true, "saveCredentials"), { saveCredentials: false, remember: false });
  assert.deepEqual(loginOptionState(false, true, "remember"), { saveCredentials: true, remember: true });
  assert.deepEqual(loginOptionState(true, false, "remember"), { saveCredentials: true, remember: false });
});

test("login form keeps credential storage browser-only", async () => {
  const source = await readFile(new URL("../src/app/login/login-form.tsx", import.meta.url), "utf8");
  assert.match(source, /name="saveCredentials"/);
  assert.match(source, /name="remember"/);
  assert.match(source, /disabled={!saveCredentials}/);
  assert.match(source, /localStorage\.getItem\(EMAIL_KEY\)/);
  assert.match(source, /localStorage\.getItem\(PASSWORD_KEY\)/);
  assert.match(source, /localStorage\.setItem\(EMAIL_KEY, email\)/);
  assert.match(source, /localStorage\.setItem\(PASSWORD_KEY, encodePassword\(password\)\)/);
  assert.match(source, /localStorage\.removeItem\(EMAIL_KEY\)/);
  assert.match(source, /localStorage\.removeItem\(PASSWORD_KEY\)/);
  assert.match(source, /localStorage\.setItem\(REMEMBER_KEY, String\(remember\)\)/);
  assert.match(source, /JSON\.stringify\(\{ email, password, remember \}\)/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{[^}]*saveCredentials/s);
  assert.match(source, /not encryption/);
  assert.match(source, /공용 PC 사용 금지/);
});
