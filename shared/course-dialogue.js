// Authored conversation openings; these are prompts, not quotations from lectures.
export const openingQuestions = {
  1: 'What makes an AI service different from a system whose behavior is entirely defined by rules?',
  2: 'How do examples in a prompt help an LLM understand the task you want it to perform?',
  3: 'Why might designing an LLM interaction begin with the human outcome, rather than the answer you want the model to generate?',
  4: 'What role does retrieval play when an AI service needs information beyond its model?',
  5: 'How would you distinguish the roles of retrieval, memory, and tools in an AI service?',
  6: 'When might a service need multiple agents rather than a single agent?',
  7: 'What does orchestration do in an AI service with multiple agents?',
  9: 'What purpose could an LLM wiki serve in a knowledge-augmented AI service?',
  10: 'What would you want to evaluate to know whether an AI service is useful to its users?',
  11: 'How might qualitative and quantitative evaluation tell you different things about an AI service?',
  12: 'How would you decide when an AI system should take the initiative and when it should wait for the user?',
  13: 'What is one risk that a guardrail should address in an AI service?',
  14: 'How could an AI interface help users understand uncertainty in its outputs?',
  15: 'What do you understand by Sim2Real in the context of service design?',
};
export function openingFor(week) {
  if (!week?.reviewAvailable || !openingQuestions[week.id]) throw Error('NO_REVIEW_CONTENT');
  return `Hi! Welcome to your Week ${week.id} learning review. This week, we’re reflecting on ${week.title}. Take your time; we’ll talk it through together. ${openingQuestions[week.id]}`;
}
