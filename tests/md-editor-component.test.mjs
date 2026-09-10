import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("MdViewer keeps editable action inside toolbar",async()=>{const source=await readFile(new URL("../src/components/MdViewer/index.tsx",import.meta.url),"utf8");assert.match(source,/<div className="viewer-toolbar">[\s\S]*editable&&<button onClick=\{onEdit\}>편집<\/button>/);assert.match(source,/e\.key\.toLowerCase\(\)===\"e\"&&editable/)});
test("MdEditor disables save until content changes",async()=>{const source=await readFile(new URL("../src/components/md/MdEditor.tsx",import.meta.url),"utf8");assert.match(source,/const changed=content!==initialContent/);assert.match(source,/disabled=\{!changed\|\|saving\}/);assert.match(source,/beforeunload/);assert.match(source,/selectionStart/)});
