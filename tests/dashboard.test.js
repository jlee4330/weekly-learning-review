import test from "node:test";
import assert from "node:assert/strict";
import { summarize, dashboardKeyMatches } from "../server/dashboard.js";

const at = (s) => new Date(Date.UTC(2026, 9, 7, 12, 0, s)).toISOString();
const content = {
  questions: [{ topic: "A", question: "How is A different from B?" }, { topic: "C", question: "What else does C need?" }],
  closing: "That's the end of today's review. Nice work.",
};
const session = (texts, extra = {}) => ({
  id: "kim~Week1", studentId: "uid-1", weekId: 1, status: "completed", createdAt: at(0), completedAt: at(90), ...extra,
  messages: texts.map(([role, text], i) => ({ role, text, order: i, createdAt: at(i * 10) })),
});

test("dashboard finds each question, the closing line, and time per question", () => {
  const s = summarize(session([
    ["assistant", "Hi! Welcome. How is A different from B?"],
    ["student", "A follows written rules"],
    ["assistant", "Good. Can it vary?"],
    ["student", "  "],
    ["student", "B can vary between runs"],
    ["assistant", "Nice. Let’s now move on to the next question. What else does C need?"],
    ["student", "Data and an interface"],
    ["assistant", "That’s the end of today’s review. Nice work."],
  ]), content);
  assert.equal(s.studentId, "kim");
  assert.deepEqual(s.transcript.map((m) => m.question), [1, null, null, null, 2, null, null]);
  assert.equal(s.transcript.at(-1).closing, true);
  const p = s.progress;
  assert.equal(p.finished, true);
  assert.equal(p.closed, true);
  assert.deepEqual(p.perQuestion.map((q) => [q.n, q.ms, q.studentTurns, q.answered]), [[1, 50000, 2, true], [2, 20000, 1, true]]);
  assert.equal(s.talkMs, 70000);
  assert.equal(s.talkMs, p.perQuestion.reduce((sum, q) => sum + q.ms, 0));
  assert.equal(s.studentSentences, 3);
});

test("dashboard marks a review ended partway, counting only real answers", () => {
  const early = summarize(session([
    ["assistant", "How is A different from B?"],
    ["student", "Rules are fixed but models learn"],
    ["assistant", "Let's now move on to the next question."],
    ["assistant", "Besides that, what does C need?"],
    ["student", "Hmm."],
  ]), content).progress;
  assert.deepEqual([early.reached, early.answered, early.finished], [2, 1, false]);
  assert.equal(early.perQuestion[1].answered, false);
  const none = summarize(session([["assistant", "How is A different from B?"]]), content).progress;
  assert.deepEqual([none.reached, none.answered, none.finished], [1, 0, false]);
  assert.equal(summarize(session([["assistant", "Hello"]]), null).progress.total, 0);
});

test("dashboard leaves a long idle gap out of the time and marks it", () => {
  const msgs = [["assistant", "How is A different from B?"], ["student", "Rules are fixed but models learn"]];
  const s = summarize({ ...session(msgs), messages: [
    { role: "assistant", text: msgs[0][1], order: 0, createdAt: at(0) },
    { role: "assistant", text: "Take your time.", order: 1, createdAt: new Date(Date.parse(at(0)) + 62 * 3600_000).toISOString() },
    { role: "student", text: msgs[1][1], order: 2, createdAt: new Date(Date.parse(at(0)) + 62 * 3600_000 + 20_000).toISOString() },
  ] }, content);
  assert.equal(s.talkMs, 20000);
  assert.equal(s.progress.perQuestion[0].ms, 20000);
  assert.deepEqual(s.transcript.map((m) => m.idleBefore), [null, 62 * 3600_000, null]);
});

test("dashboard key must match and be long enough", () => {
  const key = "a".repeat(32);
  assert.equal(dashboardKeyMatches(key, key), true);
  assert.equal(dashboardKeyMatches("b".repeat(32), key), false);
  assert.equal(dashboardKeyMatches(undefined, key), false);
  assert.equal(dashboardKeyMatches("short", "short"), false);
  assert.equal(dashboardKeyMatches(key, undefined), false);
});
