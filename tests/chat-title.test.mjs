import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTitlePrompt,
  fallbackTitle,
  isDefaultSessionTitle,
  sanitizeTitle,
} from "../src/lib/chat/title.ts";

test("buildTitlePrompt limits the source request to 2,000 characters", () => {
  const prompt = buildTitlePrompt("가".repeat(2100));
  assert.equal((prompt.match(/가/g) || []).length, 2000);
  assert.match(prompt, /25자 이내/);
});

test("sanitizeTitle removes prefixes, quotes, periods, and line breaks", () => {
  assert.equal(sanitizeTitle("제목: “세션 제목 요약.”\n"), "세션 제목 요약");
  assert.equal(sanitizeTitle("첫 줄\n둘째 줄."), "첫 줄 둘째 줄");
});

test("sanitizeTitle truncates after 30 characters with an ellipsis", () => {
  assert.equal(sanitizeTitle("가".repeat(31)), `${"가".repeat(30)}…`);
});

test("fallbackTitle uses only the first line and truncates after 30 characters", () => {
  assert.equal(fallbackTitle("  첫 번째 요청  \n두 번째 줄"), "첫 번째 요청");
  assert.equal(fallbackTitle("가".repeat(31)), `${"가".repeat(30)}…`);
  assert.equal(fallbackTitle("\n둘째 줄"), "새 대화");
});

test("default title detection covers empty and legacy defaults", () => {
  for (const title of [null, undefined, "", "  ", "새 채팅", "새 대화"])
    assert.equal(isDefaultSessionTitle(title), true);
  assert.equal(isDefaultSessionTitle("사용자가 정한 제목"), false);
});
