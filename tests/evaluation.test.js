import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEvidence } from "../server/evaluation.js";
const session = {
  questions: [{ id: "q1", criteria: ["accuracy"] }],
  turns: [
    { id: "t1", questionId: "q1", answer: "A model predicts tokens." },
    {
      id: "t2",
      questionId: "q1-f1",
      parentId: "q1",
      answer: "The result can be wrong.",
    },
  ],
};
const make = () => ({
  criteria: [
    {
      questionId: "q1",
      criterion: "accuracy",
      status: "assessed",
      score: 3,
      evidence: [{ turnId: "t1", quote: "predicts tokens" }],
    },
  ],
});
test("evidence must be from a student turn, including valid follow-up", () => {
  validateEvidence(make(), session);
  const valid = make();
  valid.criteria[0].evidence = [{ turnId: "t2", quote: "can be wrong" }];
  validateEvidence(valid, session);
  const bad = make();
  bad.criteria[0].evidence = [{ turnId: "t1", quote: "invented quote" }];
  assert.throws(() => validateEvidence(bad, session));
});
test("unasked criteria, missing criteria and unsupported scores are rejected", () => {
  const bad = make();
  bad.criteria[0].criterion = "tradeoffs";
  assert.throws(() => validateEvidence(bad, session));
  assert.throws(() => validateEvidence({ criteria: [] }, session));
  const insufficient = make();
  insufficient.criteria[0].status = "insufficient_evidence";
  assert.throws(() => validateEvidence(insufficient, session));
  insufficient.criteria[0].score = null;
  insufficient.criteria[0].evidence = [];
  validateEvidence(insufficient, session);
});
