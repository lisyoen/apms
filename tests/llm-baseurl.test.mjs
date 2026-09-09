import test from "node:test";
import assert from "node:assert/strict";
import { finalLlmUrl, normalizeBaseUrl } from "../src/lib/llm/providers.ts";

for (const baseUrl of ["http://h", "http://h/", "http://h/v1", "http://h/v1/"]) {
  test(`normalizes ${baseUrl}`, () => {
    assert.equal(normalizeBaseUrl(baseUrl), "http://h");
    assert.equal(finalLlmUrl("compatible", baseUrl), "http://h/v1/chat/completions");
  });
}
