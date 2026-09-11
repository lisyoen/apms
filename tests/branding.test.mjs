import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("package and user-facing entry points use the Dirigo brand", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const loginPage = await readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");

  assert.equal(packageJson.name, "dirigo");
  assert.equal(readme.match(/^#\s+(.+)$/m)?.[1], "Dirigo");
  assert.doesNotMatch(loginPage, /APMS/);
});
