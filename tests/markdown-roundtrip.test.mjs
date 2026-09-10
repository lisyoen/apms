import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ARROW_PATTERNS, markdownForEditor, markdownForSave } from "../src/components/md/editor-utils.ts";

const fixture=`# Heading

- bullet
- [x] checked

| A | B |
|---|---|
| 1 | 2 |

\`\`\`typescript
const answer: number = 42
\`\`\`

[link](https://example.com)

![diagram](../images/diagram.png)
`;

test("editor image rewriting preserves representative Markdown on save",()=>{const rendered=markdownForEditor(fixture,"demo","docs/demo.guide.md");assert.match(rendered,/\/api\/projects\/demo\/files\?path=images%2Fdiagram\.png/);assert.equal(markdownForSave(rendered,"demo","docs/demo.guide.md"),fixture)});
test("arrow input rule keeps longest pattern first and all mappings",()=>{assert.deepEqual(ARROW_PATTERNS,[["<->","↔"],["->","→"],["<-","←"],["=>","⇒"],["<=","⇐"]])});
test("WYSIWYG config includes loss-sensitive extensions and exclusions",async()=>{const source=await readFile(new URL("../src/components/md/WysiwygEditor.tsx",import.meta.url),"utf8");for(const token of ["TaskList","TableHeader","CodeBlockLowlight","Markdown.configure","language","parent.type.name===\"codeBlock\"","m.type.name===\"code\""])assert.ok(source.includes(token),token)});
