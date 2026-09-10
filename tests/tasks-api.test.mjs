import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)]; }));
const base = process.env.APMS_BASE_URL ?? "http://127.0.0.1:9107";
const slug = `tasks-api-${Date.now()}`;
const client = new pg.Client({ connectionString: env.DATABASE_URL });
let cookie = "";
let projectId = "";
let reportsDirectory = "";

async function get(url) {
  const response = await fetch(`${base}${url}`, { headers: { cookie } });
  assert.equal(response.status, 200);
  return response.json();
}

before(async () => {
  await client.connect();
  const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: env.APMS_ADMIN_EMAIL, password: env.APMS_ADMIN_PASSWORD }) });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie");
  const created = await fetch(`${base}/api/projects`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ name: "Tasks API Test", slug }) });
  assert.equal(created.status, 201);
  projectId = (await created.json()).id;
  const storageSlug = (await client.query("SELECT slug FROM users WHERE lower(email)=lower($1)", [env.APMS_ADMIN_EMAIL])).rows[0].slug;
  for (const [status, count] of [["pending", 7], ["in-progress", 2], ["done", 2], ["failed", 1]]) {
    for (let index = 0; index < count; index += 1) {
      const filename = `20260910-${status.replace("in-progress", "run")}-${index}.md`;
      await client.query("INSERT INTO tasks(project_id,filename,status,title,created_at) VALUES($1,$2,$3,$4,now()-($5::int * interval '1 second'))", [projectId, filename, status, `${status} ${index}`, index]);
    }
  }
  reportsDirectory = path.join(env.APMS_DATA_ROOT, storageSlug, slug, "tasks", "reports");
  fs.writeFileSync(path.join(reportsDirectory, "20260910-901-report.md"), "# Report 1\n");
  fs.writeFileSync(path.join(reportsDirectory, "20260910-902-report.md"), "# Report 2\n");
});

after(async () => {
  if (projectId) await client.query("DELETE FROM projects WHERE id=$1", [projectId]);
  if (reportsDirectory) for (const name of ["20260910-901-report.md", "20260910-902-report.md"]) fs.rmSync(path.join(reportsDirectory, name), { force: true });
  await client.end();
});

test("task pagination returns default limit, offset, and total", async () => {
  const first = await get(`/api/projects/${slug}/tasks?status=pending`);
  assert.deepEqual({ length: first.items.length, total: first.total, limit: first.limit, offset: first.offset }, { length: 5, total: 7, limit: 5, offset: 0 });
  const second = await get(`/api/projects/${slug}/tasks?status=pending&limit=2&offset=5`);
  assert.deepEqual({ length: second.items.length, total: second.total, limit: second.limit, offset: second.offset }, { length: 2, total: 7, limit: 2, offset: 5 });
});

test("task pagination caps limit and retains multi-status behavior", async () => {
  const capped = await get(`/api/projects/${slug}/tasks?status=pending,done&limit=500&offset=0`);
  assert.equal(capped.limit, 50);
  assert.equal(capped.total, 9);
  assert.equal(capped.items.length, 9);
  const all = await get(`/api/projects/${slug}/tasks?limit=50`);
  assert.equal(all.total, 12);
});

test("reports use the same pagination envelope", async () => {
  const reports = await get(`/api/projects/${slug}/reports?limit=1&offset=1`);
  assert.deepEqual({ length: reports.items.length, total: reports.total, limit: reports.limit, offset: reports.offset }, { length: 1, total: 2, limit: 1, offset: 1 });
});

test("summary counts tasks and reports", async () => {
  assert.deepEqual(await get(`/api/projects/${slug}/tasks/summary`), { pending: 7, in_progress: 2, done: 2, failed: 1, reports: 2 });
});
