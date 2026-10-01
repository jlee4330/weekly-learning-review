import { reviewConfig } from "./config.js";
import { questionsFor } from "./questions.js";
export function createSession(weekId, language, studentId, id) {
  const questions = questionsFor(weekId, language);
  if (!questions.length) throw Error("No review for this week");
  const now = new Date().toISOString();
  return {
    id,
    studentId,
    courseId: reviewConfig.courseId,
    weekId,
    language,
    questionVersion: reviewConfig.questionVersion,
    rubricVersion: reviewConfig.rubricVersion,
    questions,
    index: 0,
    followUp: null,
    turns: [],
    draft: "",
    status: "in_progress",
    evaluationStatus: "not_started",
    createdAt: now,
    updatedAt: now,
    questionAskedAt: now,
  };
}
export function currentQuestion(s) {
  return s.followUp || s.questions[s.index];
}
export function followUpCount(s) {
  return s.turns.filter((t) => t.parentId === s.questions[s.index].id).length;
}
export function appendAnswer(s, text) {
  if (s.status !== "in_progress" || !text.trim())
    throw Error("Answer required");
  const now = new Date().toISOString(),
    q = currentQuestion(s);
  return {
    ...s,
    draft: "",
    updatedAt: now,
    turns: [
      ...s.turns,
      {
        id: `${s.id}-t${s.turns.length + 1}`,
        questionId: q.id,
        parentId: s.followUp ? s.questions[s.index].id : null,
        kind: s.followUp ? "followup" : "core",
        question: q.text,
        answer: text.trim(),
        askedAt: s.questionAskedAt,
        answeredAt: now,
      },
    ],
  };
}
export function advance(s, decision) {
  const now = new Date().toISOString();
  if (
    decision.action === "followup" &&
    followUpCount(s) < reviewConfig.maxFollowUps
  ) {
    return {
      ...s,
      questionAskedAt: now,
      followUp: {
        id: `${s.questions[s.index].id}-f${followUpCount(s) + 1}`,
        text: decision.question,
      },
    };
  }
  const index = s.index + 1,
    complete = index === s.questions.length;
  return {
    ...s,
    index,
    followUp: null,
    questionAskedAt: now,
    status: complete ? "completed" : "in_progress",
    completedAt: complete ? now : null,
    evaluationStatus: complete ? "pending" : "not_started",
  };
}
