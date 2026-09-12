import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
const bin = path.resolve("bin/dirigo");
function run(root, args) { return spawnSync(bin, ["config", ...args, "--local", "--json"], { encoding: "utf8", env: { ...process.env, DIRIGO_DATA_ROOT: root } }); }
test("CLI init/get/validate/diff/apply dry-run and exit codes", async () => { const root = await mkdtemp(path.join(os.tmpdir(), "dirigo-cli-")); assert.equal(run(root, ["init"]).status, 0); const got = run(root, ["get", "worker.max_workers"]); assert.equal(got.status, 0); assert.equal(JSON.parse(got.stdout).value, 20); const bad = path.join(root, "bad.yaml"); await writeFile(bad, "worker:\n  max_workers: nope\n"); assert.equal(run(root, ["validate", bad]).status, 1); const good = path.join(root, "good.yaml"); await writeFile(good, "worker:\n  max_workers: 3\n"); assert.equal(run(root, ["diff", good]).status, 0); assert.equal(run(root, ["apply", good, "--dry-run"]).status, 0); assert.equal(run(root, ["apply", good]).status, 0); });
