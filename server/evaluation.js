import { z } from "zod";
const criterion = z.object({
  questionId: z.string(),
  criterion: z.enum(["accuracy", "reasoning", "application", "tradeoffs"]),
  status: z.enum(["assessed", "not_assessed", "insufficient_evidence"]),
  score: z.number().int().min(1).max(4).nullable(),
  evidence: z.array(z.object({ turnId: z.string(), quote: z.string().min(1) })),
  reason: z.string(),
});
export const evaluation = z.object({
  criteria: z.array(criterion),
  feedback: z.object({
    strengths: z.string(),
    revisit: z.string(),
    next: z.string(),
  }),
});
export function validateEvidence(result, s) {
  if (s.mode === "conversation") return validateConversationEvidence(result, s);
  for (const c of result.criteria) {
    const q = s.questions.find((q) => q.id === c.questionId);
    if (!q) throw Error("UNKNOWN_QUESTION");
    if (!q.criteria.includes(c.criterion) && c.status !== "not_assessed")
      throw Error("UNASKED_CRITERION");
    if (
      c.status === "assessed"
        ? c.score === null || !c.evidence.length
        : c.score !== null
    )
      throw Error("INVALID_SCORE");
    for (const e of c.evidence) {
      const turn = s.turns.find((t) => t.id === e.turnId);
      if (
        !turn ||
        !turn.answer.includes(e.quote) ||
        (turn.questionId !== q.id && turn.parentId !== q.id)
      )
        throw Error("INVALID_EVIDENCE");
    }
  }
  for (const q of s.questions)
    for (const c of q.criteria)
      if (
        result.criteria.filter(
          (x) => x.questionId === q.id && x.criterion === c,
        ).length !== 1
      )
        throw Error("MISSING_OR_DUPLICATE_CRITERION");
}

function validateConversationEvidence(result, session) {
  const criteria = ["accuracy", "reasoning", "application", "tradeoffs"];
  for (const name of criteria) if (result.criteria.filter(c => c.criterion === name).length !== 1) throw Error("MISSING_OR_DUPLICATE_CRITERION");
  for (const criterion of result.criteria) {
    if (criterion.questionId !== "conversation") throw Error("UNKNOWN_QUESTION");
    if (criterion.status === "assessed" ? criterion.score === null || !criterion.evidence.length : criterion.score !== null) throw Error("INVALID_SCORE");
    for (const evidence of criterion.evidence) {
      const message = session.messages.find(m => m.id === evidence.turnId);
      if (!message || message.role !== "student" || !message.complete || !message.text.includes(evidence.quote)) throw Error("INVALID_EVIDENCE");
    }
  }
}
