import test from "node:test";
import assert from "node:assert/strict";
import { formatKstShort, fullIso } from "../src/lib/format-time.ts";

test("formatKstShort renders today's KST time", () => {
  assert.equal(formatKstShort("2026-09-10T03:34:00.000Z", "2026-09-10T14:00:00.000Z"), "12:34");
});

test("formatKstShort renders a past KST date and time", () => {
  assert.equal(formatKstShort("2026-09-08T15:05:00.000Z", "2026-09-10T03:00:00.000Z"), "9/9 00:05");
  assert.equal(fullIso("2026-09-08T15:05:00Z"), "2026-09-08T15:05:00.000Z");
});
