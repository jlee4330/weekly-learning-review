import context from "./course-context.json" with { type: "json" };
import { openingFor } from "../shared/course-dialogue.js";
import { weeks } from "../shared/questions.js";
import { conversationConfig, conversationInstructions } from "../shared/conversation-config.js";
export function realtimeSession(language = "en", session) {
  language = "en";
  const conversational = session?.mode === "conversation";
  return {
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    instructions: conversational ? conversationInstructions(session, weeks.find(w => w.id === session.weekId), session.courseContext || context.weeks[session.weekId]) : `Read review questions exactly in ${language === "ko" ? "Korean" : "English"}. Do not answer, explain, evaluate, or ask independent questions.`,
    audio: {
      input: {
        turn_detection: conversational ? conversationConfig.turnDetection : null,
        transcription: { model: "gpt-4o-mini-transcribe", language },
      },
      output: { voice: "marin" },
    },
  };
}

export async function createRealtimeToken(language, session) {
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ session: realtimeSession(language, session) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`REALTIME_${response.status}`);
  const token = await response.json();
  if (!token.value) throw Error("REALTIME_TOKEN_MISSING");
  return { value: token.value, ...(session?.mode === "conversation" ? { opening: openingFor(weeks.find(w => w.id === session.weekId)) } : {}) };
}
