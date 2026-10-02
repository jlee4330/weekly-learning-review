import { weekQuestions } from "../content/weeks/index.js";
// Authored conversation openings live in content/weeks/week-NN/questions.json; they are prompts, not lecture quotations.
export const openingQuestions = Object.fromEntries(
  Object.entries(weekQuestions).filter(([, guide]) => guide.opening).map(([id, guide]) => [id, guide.opening]),
);
export function openingFor(week) {
  if (!week?.reviewAvailable || !openingQuestions[week.id]) throw Error('NO_REVIEW_CONTENT');
  return `Hi! Welcome to your Week ${week.id} learning review. This week, we’re reflecting on ${week.title}. Take your time; we’ll talk it through together. ${openingQuestions[week.id]}`;
}
