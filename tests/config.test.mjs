import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getConfig, validateYaml } from "../src/lib/config/loader.ts";
import { diffConfig } from "../src/lib/config/diff.ts";
import { applyConfig, ConfigConflictError } from "../src/lib/config/writer.ts";

const globalYaml = `worker:\n  max_workers: 7\nsearch:\n  searxng_url: \${env:TEST_SEARCH_URL}\n`;
async function root() { const value = await mkdtemp(path.join(os.tmpdir(), "dirigo-config-")); await mkdir(path.join(value, "config"), { recursive: true }); await writeFile(path.join(value, "config", "dirigo.yaml"), globalYaml); return value; }

test("layers defaults, yaml, project, and env while tracking sources", async () => { const data = await root(); await mkdir(path.join(data, "projects", "sample"), { recursive: true }); await writeFile(path.join(data, "projects", "sample", "project.yaml"), "search:\n  max_results: 9\n"); const loaded = getConfig({ root: data, project: "sample", env: { TEST_SEARCH_URL: "https://search.example.com", DIRIGO_MAX_WORKERS: "11" } }); assert.equal(loaded.config.worker.max_workers, 11); assert.equal(loaded.sources["worker.max_workers"], "env"); assert.equal(loaded.sources["search.max_results"], "project"); assert.equal(loaded.config.search.searxng_url, "https://search.example.com"); assert.equal(loaded.sources["fetch.timeout_ms"], "default"); });
test("reports missing env references as warnings", () => { const result = validateYaml(globalYaml, { env: {} }); assert.equal(result.valid, true); assert.match(result.warnings[0].message, /TEST_SEARCH_URL/); });
test("rejects plaintext secrets and reports exact paths", () => { const secret = validateYaml("llm:\n  providers:\n    - name: x\n      type: anthropic\n      base_url: not-a-url\n      api_key: plainly-secret\n      models: []\n"); assert.equal(secret.valid, false); assert.ok(secret.errors.some((item) => item.path === "llm.providers[0].base_url" && item.message === "invalid url")); assert.ok(secret.errors.some((item) => item.path === "llm.providers[0].api_key" && /plaintext secret/.test(item.message))); const unknown = validateYaml("worker:\n  surprise: true\n"); assert.ok(unknown.errors.some((item) => item.path === "worker")); });
test("produces leaf changes and atomically applies with hash protection and history", async () => { const data = await root(); const changes = diffConfig("worker:\n  max_workers: 8\n", { root: data, env: {} }); assert.deepEqual(changes.map((item) => item.key), ["worker.max_workers"]); const before = getConfig({ root: data, env: {} }); const result = await applyConfig("worker:\n  max_workers: 8\n", { root: data, ifMatch: before.hash, actor: "test" }); assert.equal(result.config.worker.max_workers, 8); assert.match(await readFile(path.join(data, "config", "history.log"), "utf8"), /test\tworker.max_workers/); await assert.rejects(() => applyConfig("worker:\n  max_workers: 9\n", { root: data, ifMatch: before.hash }), ConfigConflictError); });
