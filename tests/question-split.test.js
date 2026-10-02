import test from "node:test";
import assert from "node:assert/strict";
import { splitQuestion } from "../src/services/question-split.js";

const known = [
  "How is a probability-based system, like an AI model, different from a rules-based system?",
  "Besides the AI model itself, what other parts does an AI service need to work well?",
];

test("only the guide question itself is highlighted; what follows it becomes the tail", () => {
  assert.deepEqual(
    splitQuestion("Hi! Welcome to your Week 1 learning review. Take your time; we’ll talk it through together. How is a probability-based system, like an AI model, different from a rules-based system? Take your time—sounds like you were mid", known),
    [
      "Hi! Welcome to your Week 1 learning review. Take your time; we’ll talk it through together.",
      "How is a probability-based system, like an AI model, different from a rules-based system?",
      "Take your time—sounds like you were mid",
    ],
  );
});

test("a guide question is matched despite spoken punctuation differences, after a transition", () => {
  assert.deepEqual(
    splitQuestion("Nice contrast. Let's now move on to the next question. Besides the AI model itself — what other parts does an AI service need to work well?", known),
    ["Nice contrast. Let's now move on to the next question.", "Besides the AI model itself — what other parts does an AI service need to work well?", ""],
  );
});

test("without a guide question: last question sentence, short ones keep their setup, trailing words go to the tail", () => {
  assert.deepEqual(splitQuestion("Good start. Think about Netflix. What does it need to know?"), ["Good start.", "Think about Netflix. What does it need to know?", ""]);
  assert.deepEqual(splitQuestion("Good point. How could the design make it clearer what the chatbot is good for? No rush."), ["Good point.", "How could the design make it clearer what the chatbot is good for?", "No rush."]);
  assert.deepEqual(splitQuestion("Hi! Why is that?"), ["Hi!", "Why is that?", ""]);
  assert.deepEqual(splitQuestion("Take your time."), ["Take your time.", "", ""]);
});

import { reviewProgress } from "../src/services/question-split.js";
test("progress follows the furthest guide question the agent has asked, and finishes on the closing line", () => {
  const guide = {
    closing: "That's the end of today's review. Nice work. You can press End conversation whenever you're ready.",
    questions: [
      { type: "explain", question: "How is a probability-based system, like an AI model, different from a rules-based system?" },
      { type: "explain", question: "Besides the AI model itself, what other parts does an AI service need to work well?" },
      { type: "explain", question: "When we build a foundation model into an interactive service, what are some opportunities it opens up, and what challenges come with it?" },
    ],
  };
  const agent = (text) => ({ role: "assistant", text });
  const opening = agent("Hi! Welcome. How is a probability-based system, like an AI model, different from a rules-based system?");
  assert.deepEqual(reviewProgress([], guide), { total: 3, current: 1, done: false });
  assert.deepEqual(reviewProgress([opening, { role: "student", text: "It learns." }, agent("Can you say more?")], guide), { total: 3, current: 1, done: false });
  assert.deepEqual(reviewProgress([opening, agent("Nice. Let's now move on to the next question. Besides the AI model itself — what other parts does an AI service need to work well?")], guide), { total: 3, current: 2, done: false });
  assert.deepEqual(reviewProgress([opening, agent("That's the end of today's review! Nice work.")], guide), { total: 3, current: 3, done: true });
  assert.equal(reviewProgress([opening], { questions: [{ question: "No type here?" }] }), null);
});
