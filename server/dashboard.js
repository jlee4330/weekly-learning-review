import { createHash, timingSafeEqual } from "node:crypto";
import { sessionKey } from "./storage.js";
import { weekContent } from "./course-content.js";

// Instructor dashboard: every student's weekly transcripts with time spent and how far through the questions they got.
// It has no login; it opens from a secret link, /#/dash/<key>, and the page sends the key in a header.
// The key is in the URL fragment, so it never reaches server or proxy logs. The repository is public, so only the
// SHA-256 of the key is kept here: the key is 32 random characters and cannot be recovered from it.
// To change the link, put the hash of a new key here (or set DASHBOARD_KEY on the server to override it):
//   node -e 'const k=require("crypto").randomBytes(24).toString("base64url");console.log(k, require("crypto").createHash("sha256").update(k).digest("hex"))'
const DASHBOARD_KEY_SHA256 = "125dd0a704ec6c4c5c5ad8e1530e3faf275408540993ca788df04cd02b5f797c";

const digest = (value) => createHash("sha256").update(String(value)).digest();
export function dashboardKeyMatches(given, expectedHash = process.env.DASHBOARD_KEY?.trim() ? digest(process.env.DASHBOARD_KEY.trim()).toString("hex") : DASHBOARD_KEY_SHA256) {
  if (!given || given.length < 24) return false;
  return timingSafeEqual(digest(given.trim()), Buffer.from(expectedHash, "hex"));
}

const ms = (a, b) => (a && b ? Math.max(0, Date.parse(b) - Date.parse(a)) : null);
// A silence longer than this means the student stepped away with the tab open (one left it for 62 hours);
// it is left out of talking and per-question time and shown as a break in the transcript instead.
export const IDLE_MS = 10 * 60_000;
// Time across these messages, without idle gaps.
const activeMs = (list) => {
  if (!list.length || !list[0]?.createdAt) return null;
  let total = 0;
  for (let i = 1; i < list.length; i++) {
    const gap = ms(list[i - 1].createdAt, list[i].createdAt) ?? 0;
    if (gap <= IDLE_MS) total += gap;
  }
  return total;
};
const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;
// Spoken sentences in a transcript line; fillers such as "Hmm." or "Okay." are not counted.
const sentences = (text) => text.split(/[.!?…]+(?=\s|$)/).filter((part) => words(part) >= MIN_ANSWER_WORDS).length;
const norm = (text) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
// The agent is told to use this exact sentence between questions (shared/conversation-config.js).
const TRANSITION = "move on to the next question";
// A reply this short ("Hmm.", "I don't know") is not counted as answering a question.
const MIN_ANSWER_WORDS = 3;

// Where each fixed question was asked, from the agent's wording: the question text itself (asked verbatim),
// or the transition sentence before it; the closing line marks that the last question was finished.
export function progressOf(messages, content) {
  const questions = content?.questions?.filter((q) => q.question) || [];
  const closeKey = content?.closing ? norm(content.closing.split(/[.!?]/)[0]) : null;
  const starts = [];
  let closedAt = -1;
  messages.forEach((m, i) => {
    if (m.role !== "assistant" || closedAt >= 0) return;
    const text = norm(m.text);
    if (closeKey && text.includes(closeKey)) { closedAt = i; return; }
    let n = questions.findIndex((q) => text.includes(norm(q.question))) + 1;
    if (!n && text.includes(TRANSITION)) n = starts.length + 1;
    if (n > starts.length && n <= questions.length) starts.push({ n, i });
  });
  // Q1 runs from the very first message (a greeting may come separately before it); the last question ends at the
  // closing line, so the question times add up to the total and talk after the closing is not counted.
  const perQuestion = starts.map(({ n, i }, k) => {
    const end = starts[k + 1]?.i ?? (closedAt >= 0 ? closedAt : messages.length);
    const from = k === 0 ? 0 : i;
    const replies = messages.slice(from + 1, end).filter((m) => m.role === "student");
    const answerWords = replies.reduce((sum, m) => sum + words(m.text), 0);
    const answerSentences = replies.reduce((sum, m) => sum + sentences(m.text), 0);
    return {
      n,
      topic: questions[n - 1].topic,
      askedAt: messages[i].createdAt,
      ms: activeMs(messages.slice(from, end + 1)),
      studentTurns: replies.length,
      sentences: answerSentences,
      answered: answerWords >= MIN_ANSWER_WORDS,
    };
  });
  const answered = perQuestion.filter((q) => q.answered).length;
  return {
    total: questions.length,
    reached: starts.length,
    answered,
    closed: closedAt >= 0,
    // Finished = the agent closed the review, or every question got an answer before End was pressed.
    finished: questions.length > 0 && (closedAt >= 0 || answered === questions.length),
    perQuestion,
    marks: { starts: Object.fromEntries(starts.map(({ n, i }) => [i, n])), closedAt },
  };
}

function contentFor(weekId) {
  try { return weekContent(weekId); } catch { return null; }
}

export function summarize(session, content = contentFor(session.weekId)) {
  const messages = (session.messages || []).filter((m) => m.text?.trim()).sort((a, b) => a.order - b.order);
  const { marks, ...progress } = progressOf(messages, content);
  const transcript = messages.map((m, i) => ({
    role: m.role, text: m.text, at: m.createdAt,
    idleBefore: i > 0 && ms(messages[i - 1].createdAt, m.createdAt) > IDLE_MS ? ms(messages[i - 1].createdAt, m.createdAt) : null,
    question: marks.starts[i] || null,
    closing: i === marks.closedAt,
  }));
  const student = messages.filter((m) => m.role === "student");
  return {
    id: session.id,
    studentId: sessionKey(session.id) || session.studentId,
    weekId: session.weekId,
    status: session.status,
    createdAt: session.createdAt || null,
    completedAt: session.completedAt || null,
    // Time taken: the question times added up (idle gaps left out); without fixed questions, first to last message.
    // Session time: opening the week to pressing End.
    talkMs: progress.perQuestion.length ? progress.perQuestion.reduce((sum, q) => sum + q.ms, 0) : activeMs(messages),
    sessionMs: ms(session.createdAt, session.completedAt),
    progress,
    studentTurns: student.length,
    studentSentences: student.reduce((n, m) => n + sentences(m.text), 0),
    transcript,
  };
}

export async function dashboardData(store) {
  const sessions = (await store.list()).filter((s) => s.mode === "conversation");
  return { generatedAt: new Date().toISOString(), sessions: sessions.map((s) => summarize(s)) };
}
