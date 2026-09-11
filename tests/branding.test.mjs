import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function filesUnder(relativePath) {
  const directory = new URL(relativePath, root);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = new URL(entry.name, directory.href.endsWith("/") ? directory : new URL(`${directory.href}/`));
    return entry.isDirectory() ? filesUnder(`${relativePath}${entry.name}/`) : [path];
  }));
  return files.flat();
}

test("package and user-facing entry points use the Dirigo brand", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const loginPage = await readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");

  assert.equal(packageJson.name, "dirigo");
  assert.equal(readme.match(/^#\s+(.+)$/m)?.[1], "Dirigo");
  assert.doesNotMatch(loginPage, /APMS/);
});

test("legacy domain, environment prefix, and session cookie identifiers are retired", async () => {
  const files = [
    ...(await filesUnder("src/")),
    ...(await filesUnder("scripts/")),
    ...(await filesUnder("docs/")),
    ...(await filesUnder("tests/")),
    new URL(".env.example", root),
    new URL("ecosystem.config.js", root),
    new URL("README.md", root),
    new URL("README.ko.md", root),
  ];
  const forbidden = new RegExp([
    ["apms", "craftbay", "io"].join("\\."),
    ["APMS", "_"].join(""),
    ["apms", "session"].join("_"),
  ].join("|"));

  for (const file of files) {
    assert.doesNotMatch(await readFile(file, "utf8"), forbidden, file.pathname);
  }
});
