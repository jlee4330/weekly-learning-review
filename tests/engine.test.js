import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, appendAnswer, advance } from "../shared/engine.js";
import { reviewConfig } from "../shared/config.js";
import { demoDecision } from "../src/services/demo.js";
test("follow-up belongs to core question and never changes progress count", () => {
  let s = createSession(1, "ko", "student", "session");
  s = advance(appendAnswer(s, "잘 모르겠어요"), {
    action: "followup",
    question: "예시를 말해 주세요",
  });
  assert.equal(s.index, 0);
  s = advance(appendAnswer(s, "확률적으로 다음 출력을 예측해요"), {
    action: "followup",
    question: "반복",
  });
  assert.equal(s.index, 1);
  assert.equal(s.turns[1].parentId, "w1-q1");
  assert.equal(s.turns[1].kind, "followup");
  assert.equal(s.questions.length, 4);
});
test("configurable cap allows two follow-ups", () => {
  const old = reviewConfig.maxFollowUps;
  reviewConfig.maxFollowUps = 2;
  try {
    let s = createSession(1, "en", "a", "b");
    s = advance(appendAnswer(s, "x"), { action: "followup", question: "one" });
    s = advance(appendAnswer(s, "y"), { action: "followup", question: "two" });
    assert.equal(s.index, 0);
    s = advance(appendAnswer(s, "z"), {
      action: "followup",
      question: "three",
    });
    assert.equal(s.index, 1);
  } finally {
    reviewConfig.maxFollowUps = old;
  }
});
test("completion preserves language, versions, and timestamps", () => {
  let s = createSession(4, "ko", "a", "b");
  for (let i = 0; i < 4; i++)
    s = advance(appendAnswer(s, "개념 설명"), { action: "next" });
  assert.equal(s.status, "completed");
  assert.equal(s.language, "ko");
  assert.equal(s.evaluationStatus, "pending");
  assert.ok(s.completedAt);
  assert.ok(s.questionVersion);
  assert.ok(s.turns.every((t) => t.askedAt && t.answeredAt));
  assert.throws(() => appendAnswer(s, "extra"));
});
test("no-class weeks cannot start and blank answers cannot progress", () => {
  assert.throws(() => createSession(8, "en", "a", "b"));
  assert.throws(() => createSession(16, "en", "a", "b"));
  assert.throws(() => appendAnswer(createSession(1, "en", "a", "b"), "  "));
});
test("demo distinguishes ambiguity, misconception and concise explanations", () => {
  const base = createSession(1, "en", "a", "b");
  assert.equal(demoDecision(appendAnswer(base, "not sure")).action, "followup");
  assert.equal(
    demoDecision(appendAnswer(base, "It is always correct.")).action,
    "followup",
  );
  assert.equal(
    demoDecision(appendAnswer(base, "A pretrained model adapted to tasks."))
      .action,
    "next",
  );
});
