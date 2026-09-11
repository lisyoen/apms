import test, { after } from "node:test";
import assert from "node:assert/strict";
import { lstat, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import bcrypt from "bcryptjs";
import "dotenv/config";
import pg from "pg";
import { buildRunEnv, resolveRunWorkdir } from "../src/worker/security.ts";
import { SCHEDULER_LOCK_KEY, trySchedulerLock } from "../src/worker/scheduler.ts";

const baseUrl = process.env.DIRIGO_BASE_URL ?? "http://127.0.0.1:9107";
const originalRoot = process.env.DIRIGO_DATA_ROOT;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const createdEmails = [];
after(async () => {
  if (createdEmails.length) {
    await pool.query("DELETE FROM login_attempts WHERE email = ANY($1)", [createdEmails]);
    await pool.query("DELETE FROM users WHERE email = ANY($1)", [createdEmails]);
  }
  process.env.DIRIGO_DATA_ROOT = originalRoot;
  delete process.env.OPENAI_API_KEY;
  await pool.end();
});

test("workdir traversal and symlink escape are rejected", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dirigo-security-root-"));
  const outside = await mkdtemp(path.join(tmpdir(), "dirigo-security-outside-"));
  process.env.DIRIGO_DATA_ROOT = root;
  delete process.env.DIRIGO_WORKDIR_ALLOWLIST;
  await assert.rejects(resolveRunWorkdir(path.join(root, "user", "project"), "project", outside), /outside/);
  const link = path.join(root, "escape-link");
  await symlink(outside, link, "dir");
  await assert.rejects(resolveRunWorkdir(path.join(root, "user", "project"), "project", link), /outside/);
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

test("run environment allowlist excludes server credentials and isolates HOME", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dirigo-security-env-"));
  process.env.DIRIGO_DATA_ROOT = root;
  process.env.OPENAI_API_KEY = "x";
  const env = await buildRunEnv("test-user", "test-project", "test-run");
  const child = spawnSync(process.execPath, ["-e", "process.stdout.write(process.env.OPENAI_API_KEY || '')"], { env, encoding: "utf8" });
  assert.equal(child.stdout, "");
  assert.deepEqual(Object.keys(env).filter((key) => !["PATH", "LANG", "TZ", "HOME", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "DIRIGO_USER", "DIRIGO_PROJECT", "DIRIGO_RUN"].includes(key)), []);
  assert.ok(env.HOME.startsWith(root + path.sep));
  for (const key of ["HOME", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME"]) assert.equal((await lstat(env[key])).mode & 0o777, 0o700);
  await rm(root, { recursive: true, force: true });
});

test("PostgreSQL advisory lock elects exactly one scheduler leader", async () => {
  const first = await pool.connect();
  const second = await pool.connect();
  const testLockKey = SCHEDULER_LOCK_KEY + (process.pid % 100_000) + 1;
  try {
    const elected = [await trySchedulerLock(first, testLockKey), await trySchedulerLock(second, testLockKey)];
    assert.equal(elected.filter(Boolean).length, 1);
  } finally {
    await first.query("SELECT pg_advisory_unlock($1)", [testLockKey]);
    first.release(); second.release();
  }
});

test("sixth failed login for the same IP and email is rate limited", async () => {
  const email = `security-lock-${Date.now()}@example.invalid`;
  createdEmails.push(email);
  await pool.query("INSERT INTO users(email,password_hash) VALUES($1,$2)", [email, await bcrypt.hash("correct-password", 4)]);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify({ email, password: "wrong-password" }) });
    assert.equal(response.status, 401);
  }
  const blocked = await fetch(`${baseUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify({ email, password: "wrong-password" }) });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
});

test("user slug is generated uniquely and remains immutable", async () => {
  const stamp = Date.now();
  const one = `security.slug+one-${stamp}@example.invalid`;
  const two = `security.slug+one-${stamp}@another.invalid`;
  createdEmails.push(one, two);
  const first = (await pool.query("INSERT INTO users(email,password_hash) VALUES($1,'x') RETURNING id,slug", [one])).rows[0];
  const second = (await pool.query("INSERT INTO users(email,password_hash) VALUES($1,'x') RETURNING id,slug", [two])).rows[0];
  assert.notEqual(first.slug, second.slug);
  await assert.rejects(pool.query("UPDATE users SET slug='changed-slug' WHERE id=$1", [first.id]), /immutable/);
  assert.equal((await pool.query("SELECT slug FROM users WHERE id=$1", [first.id])).rows[0].slug, first.slug);
});
