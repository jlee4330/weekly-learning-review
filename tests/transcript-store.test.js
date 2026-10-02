import test from "node:test";
import assert from "node:assert/strict";
import { weekEntry, weekKey, studentIdOf } from "../server/transcript-store.js";

test("students are keyed by student ID and weeks by WeekN", () => {
  assert.equal(studentIdOf({ email: "20261234@kaist.ac.kr" }, "uid-1"), "20261234");
  assert.equal(studentIdOf(null, "local-student"), "local-student");
  assert.equal(weekKey(1), "Week1");
  assert.equal(weekKey(12), "Week12");
});

test("a week is only its transcript: spoken messages in order as { role, text, at }", () => {
  const week = weekEntry({
    weekId: 1, status: "completed", feedback: { strengths: "x" },
    messages: [
      { id: "b", role: "student", text: "It learns from data.", order: 1, revision: 2, complete: true, createdAt: "t1" },
      { id: "a", role: "assistant", text: "How is it different?", order: 0, revision: 1, complete: true, createdAt: "t0" },
      { id: "c", role: "student", text: "", order: 2, complete: false, createdAt: "t2" },
    ],
  });
  assert.deepEqual(week, [
    { role: "assistant", text: "How is it different?", at: "t0" },
    { role: "student", text: "It learns from data.", at: "t1" },
  ]);
});

test("a reset week mirrors as an empty transcript", () => {
  assert.deepEqual(weekEntry({ weekId: 1, messages: [] }), []);
});
