import test from "node:test";
import assert from "node:assert/strict";
import { buildNewTaskPayload } from "../src/app/p/[slug]/new-task-modal.tsx";

test("new task payload maps every form field", () => {
  assert.deepEqual(buildNewTaskPayload({
    title: "  Modal task  ",
    body: "# Instruction\n",
    "pre-task": "20260910-001-task.md",
    "next-task": "",
    timeout_min: "35",
  }), {
    title: "Modal task",
    body: "# Instruction\n",
    "pre-task": "20260910-001-task.md",
    "next-task": null,
    timeout_min: 35,
  });
});

for (const timeout of ["", "0", "1.5", "1441", "not-a-number"]) {
  test(`new task payload rejects invalid timeout: ${timeout || "empty"}`, () => {
    assert.throws(() => buildNewTaskPayload({ title: "Task", body: "Body", "pre-task": "", "next-task": "", timeout_min: timeout }), /1~1440/);
  });
}
