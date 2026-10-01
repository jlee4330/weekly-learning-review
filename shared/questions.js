import course from "./course.json" with { type: "json" };
export const weeks = course;
const koTitles = [
  "수업 소개",
  "LLM과 프롬프트 엔지니어링 · 1",
  "LLM과 프롬프트 엔지니어링 · 2",
  "지식 증강 AI 시스템 · 1",
  "지식 증강 AI 시스템 · 2",
  "에이전트 AI 시스템 · 1",
  "에이전트 AI 시스템 · 2",
  "수업 없음",
  "지식 증강 AI · 3",
  "AI 시스템 평가 · 1",
  "AI 시스템 평가 · 2",
  "주도권과 이니셔티브",
  "책임과 안전",
  "AI 네이티브 인터페이스",
  "AI 연구 동향과 열린 과제",
  "마무리 및 쇼케이스",
];
const topics = [
  ["foundation models", "파운데이션 모델"],
  ["few-shot prompting", "퓨샷 프롬프팅"],
  ["multimodal prompting", "멀티모달 프롬프팅"],
  ["retrieval-augmented generation (RAG)", "검색 증강 생성(RAG)"],
  ["memory and tools", "메모리와 도구"],
  [
    "single-agent and multi-agent systems",
    "단일 에이전트와 멀티 에이전트 시스템",
  ],
  ["agent orchestration", "에이전트 오케스트레이션"],
  null,
  ["LLM wiki and Open Knowledge Format", "LLM 위키와 Open Knowledge Format"],
  ["LLM-as-a-Judge", "LLM-as-a-Judge"],
  ["qualitative and quantitative evaluation", "정성 평가와 정량 평가"],
  ["mixed-initiative systems", "혼합 주도 시스템"],
  ["AI guardrails", "AI 가드레일"],
  ["generative UI", "생성형 UI"],
  ["Sim2Real", "Sim2Real"],
  null,
];
const expected = [
  ["broad pretraining", "adaptation to tasks", "uncertain outputs"],
  ["examples in context", "no weight update", "example selection"],
  ["multiple input modalities", "alignment", "modality limitations"],
  ["retrieval before generation", "external sources", "retrieval errors"],
  ["persistent context", "external actions", "permissions"],
  ["division of work", "coordination cost", "single-agent baseline"],
  ["routing", "task dependencies", "failure handling"],
  [],
  ["organized knowledge", "provenance", "updates"],
  ["explicit criteria", "fallible judge", "human calibration"],
  ["task metrics", "user evidence", "complementary methods"],
  ["initiative allocation", "human verification", "control"],
  ["risk reduction", "residual risk", "testing"],
  ["dynamic interfaces", "predictability", "user control"],
  ["simulation gap", "real environment validation", "transfer limitations"],
  [],
];
export const titleOf = (w, lang) =>
  lang === "ko" ? koTitles[w.id - 1] : w.title;
export const objectiveOf = (w, lang) =>
  !w.reviewAvailable
    ? lang === "ko"
      ? "이 주차에는 리뷰가 없습니다."
      : "No oral review scheduled."
    : lang === "ko"
      ? `${topics[w.id - 1][1]}의 역할을 설명하고 서비스 설계 선택에 연결합니다.`
      : `Explain ${topics[w.id - 1][0]} and connect it to a service design choice.`;
export function questionsFor(weekId, lang) {
  const topic = topics[weekId - 1]?.[lang === "ko" ? 1 : 0];
  if (!topic) return [];
  const prompts =
    lang === "ko"
      ? [
          `${topic}의 역할은 무엇인가요? AI 서비스 안에서 어떻게 동작하는지 설명해 주세요.`,
          `${topic}을 사용하는 서비스와 사용하지 않는 서비스는 어떻게 다를까요? 자신의 말로 비교해 주세요.`,
          `${topic}을 활용할 AI 서비스를 하나 떠올려 보세요. 어떤 사용자 문제를 해결하고, 왜 이 선택이 적절할까요?`,
          `이 설계의 한계나 trade-off는 무엇일까요? 사용자 경험에 미치는 영향과 확인할 방법을 설명해 주세요.`,
        ]
      : [
          `What role does ${topic} play in an AI service? Explain how it works.`,
          `How would a service using ${topic} differ from one without it? Compare them in your own words.`,
          `Imagine an AI service using ${topic}. What user problem would it address, and why is this a suitable choice?`,
          `What limitations or trade-offs would this design introduce? Explain their effect on user experience and how you would check them.`,
        ];
  return prompts.map((text, i) => ({
    id: `w${weekId}-q${i + 1}`,
    text,
    objective: objectiveOf(weeks[weekId - 1], lang),
    criteria: [
      ["accuracy"],
      ["accuracy", "reasoning"],
      ["reasoning", "application"],
      ["reasoning", "tradeoffs"],
    ][i],
    expectedElements: expected[weekId - 1],
    draft: true,
  }));
}
