import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(directory).filter((name) => name.endsWith(".test.mjs")).sort().map((name) => path.join(directory, name));
const childEnv = { ...process.env };
delete childEnv.NODE_TEST_CONTEXT;
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "inherit", env: childEnv });
if (result.status !== 0) throw new Error(`test suite exited with status ${result.status}`);
