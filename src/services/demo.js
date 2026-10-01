import { createSession, appendAnswer, advance } from "../../shared/engine.js";
const KEY = "wlr-demo-sessions-v1";
export function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function save(s) {
  const all = readAll();
  localStorage.setItem(
    KEY,
    JSON.stringify([s, ...all.filter((x) => x.id !== s.id)]),
  );
  return s;
}
export function demoDecision(s) {
  const answer = s.turns.at(-1).answer;
  // Deliberately simple demo branching; never represented as semantic assessment.
  if (s.followUp) return { action: "next" };
  if (
    /always correct|always accurate|항상 정확|절대.*틀리/.test(
      answer.toLowerCase(),
    )
  )
    return {
      action: "followup",
      question:
        s.language === "ko"
          ? "그 설명이 성립하지 않을 수 있는 상황은 무엇일까요?"
          : "In what situation might that explanation not hold?",
    };
  if (/모르|잘|좋|maybe|not sure|useful/i.test(answer) && answer.length < 65)
    return {
      action: "followup",
      question:
        s.language === "ko"
          ? "방금 설명한 역할이 드러나는 구체적인 서비스 예시를 들어 주시겠어요?"
          : "Could you give a specific service example that illustrates the role you described?",
    };
  if (s.index === 2)
    return {
      action: "followup",
      question:
        s.language === "ko"
          ? "그 선택이 적절하지 않을 수 있는 사용자 상황은 무엇일까요?"
          : "In what user situation might that choice be unsuitable?",
    };
  return { action: "next" };
}
export const demoRepository = {
  list: async () => readAll(),
  create: async (w, l) =>
    save(createSession(w, l, "demo-student", crypto.randomUUID())),
  draft: async (s, text) =>
    save({ ...s, draft: text, updatedAt: new Date().toISOString() }),
  answer: async (s, text) => {
    const answered = appendAnswer(s, text);
    save(answered);
    return save(advance(answered, demoDecision(answered)));
  },
  evaluate: async (s) =>
    save({
      ...s,
      evaluationStatus: "demo",
      feedback: {
        strengths:
          s.language === "ko"
            ? "개념을 실제 서비스와 연결하는 방식에 주목해 보세요."
            : "Notice how an explanation connects a concept to a real service.",
        revisit:
          s.language === "ko"
            ? "모델의 능력과 서비스가 보장하는 동작을 구분해 보세요."
            : "Distinguish model capabilities from behavior the service can guarantee.",
        next:
          s.language === "ko"
            ? "한 가지 설계 선택을 고르고, 대안과 사용자에게 미치는 영향을 비교해 보세요."
            : "Choose one design decision, compare an alternative, and describe its effect on users.",
      },
    }),
};
