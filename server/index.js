import { verifyCourseLogin } from "./firebase-admin.js";
import { weekContent } from "./course-content.js";
import { createTranscriptStore, studentIdOf } from "./transcript-store.js";
import { evaluation, validateEvidence } from "./evaluation.js";
import express from "express";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "node:url";
import { createLocalStore, createCloudStore } from "./storage.js";
import { allowLocalRequest } from "./local-access.js";
import { createRealtimeToken } from "./realtime.js";
import { asConversation, mergeMessages, completeConversation } from "../shared/conversation.js";
import { conversationJudgeInstructions } from "../shared/conversation-config.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  createSession,
  appendAnswer,
  advance,
  followUpCount,
} from "../shared/engine.js";
import {
  isWeekUnlocked,
  reviewConfig,
  dialogueInstructions,
  judgeInstructions,
  rubricLevels,
} from "../shared/config.js";
const local = process.env.REVIEW_STORAGE === "local";
if (local && process.env.NODE_ENV === "production") throw Error("Local storage is for loopback development only. Configure Firebase for deployment.");
// Local development can skip sign-in; every other setup verifies the student's course-website login.
const localFirebaseAuth = local && process.env.REVIEW_AUTH === "firebase";
// Any signed-in course account may use the review unless REQUIRE_ENROLLMENT=true (then courses/{id}/members/{uid} must exist).
const requireEnrollment = process.env.REQUIRE_ENROLLMENT === "true";
// A misconfigured deployment answers every request with the reason instead of crashing on load.
let store, transcripts, setupError;
try {
  store = local
    ? createLocalStore(process.env.REVIEW_DATA_FILE || fileURLToPath(new URL("../.data/reviews.json", import.meta.url)))
    : await createCloudStore(reviewConfig.courseId);
  transcripts = await createTranscriptStore();
} catch (error) {
  setupError = error;
  console.error("SERVER_SETUP_FAILED", error.message);
}
const patch = (id, fields) => store.mutate(id, s => ({ ...s, ...fields }));
// Student key used in session IDs and Firestore paths: the login email before "@" (falls back to the uid).
const studentKey = (user) => studentIdOf(user, user.uid);
// Best-effort copy of a finished conversation to the per-student transcript database.
// Written when the student presses End; removed when that week is restarted or reset.
function mirror(session, user) {
  if (!transcripts || !session) return;
  transcripts.save(session, user).catch((error) => console.error("TRANSCRIPT_MIRROR_FAILED", error.message));
}
// Restarting or resetting a week also removes its transcript from Firestore.
function unmirror(session, user) {
  if (!transcripts || !session) return;
  transcripts.clear(session, user).catch((error) => console.error("TRANSCRIPT_CLEAR_FAILED", error.message));
}
const app = express();
if (process.env.VERCEL) app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use("/api", (req, res, next) => setupError ? res.status(500).json({ error: "SERVER_SETUP_FAILED", detail: setupError.message }) : next());
app.use("/api", async (req, res, next) => {
  if (local) {
    if (!allowLocalRequest(req)) return res.status(403).json({ error: "LOCAL_ACCESS_ONLY" });
    if (!localFirebaseAuth) { req.user = { uid: "local-student" }; return next(); }
  }
  try {
    req.user = await verifyCourseLogin(req.headers.authorization?.replace(/^Bearer /, ""));
    next();
  } catch {
    res.status(401).json({ error: "AUTH_REQUIRED" });
  }
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 80,
    keyGenerator: (req) => req.user.uid,
  }),
);
const isStaff = (u) =>
  Array.isArray(u.instructorCourses) &&
  u.instructorCourses.includes(reviewConfig.courseId);
async function enrolled(req) {
  if (!requireEnrollment || isStaff(req.user)) return;
  if (!(await store.enrolled(req.user.uid)))
    throw Object.assign(Error("COURSE_ENROLLMENT_REQUIRED"), { status: 403 });
}
async function getSession(req, staff = false) {
  await enrolled(req);
  const s = await store.get(req.params.id || req.body.sessionId);
  if (!s) throw Object.assign(Error("NOT_FOUND"), { status: 404 });
  if (s.studentId !== req.user.uid && !(staff && isStaff(req.user)))
    throw Object.assign(Error("FORBIDDEN"), { status: 403 });
  return s;
}
// A conversation session stores only its state and messages: the week content is read fresh for every
// connection (only its version is recorded), and the old question-by-question fields are dropped.
const LEGACY_FIELDS = ["courseContext", "questions", "index", "followUp", "turns", "draft", "questionAskedAt", "pendingDecision", "questionVersion"];
function prepareConversation(s) {
  const content = weekContent(s.weekId);
  const conversation = { ...asConversation(s), language: "en", conversationVersion: "conversation-2", courseContextVersion: content.version };
  for (const field of LEGACY_FIELDS) delete conversation[field];
  return conversation;
}
const publicSession = (s) => {
  const { evaluationLease, ...rest } = s;
  return rest;
};
const handler = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    console.error(e.message);
    res
      .status(e.status || 400)
      .json({ error: e.status ? e.message : "REQUEST_FAILED" });
  }
};
async function modelJSON(instructions, input, schema) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_JUDGE_MODEL || "gpt-4.1",
      instructions,
      input: `Return JSON for this review data:\n${JSON.stringify(input)}`,
      text: { format: { type: "json_schema", name: "review_result", strict: true, schema: z.toJSONSchema(schema) } },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw Error(`MODEL_${r.status}`);
  const data = await r.json();
  const text = data.output
    ?.flatMap((x) => x.content || [])
    .filter((x) => x.type === "output_text")
    .map((x) => x.text)
    .join("");
  return schema.parse(JSON.parse(text));
}
app.get(
  "/api/sessions",
  handler(async (req, res) => {
    await enrolled(req);
    const sessions = await store.list(req.user.uid, studentKey(req.user));
    res.json(
      sessions
        .map(publicSession)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }),
);
app.post(
  "/api/sessions",
  handler(async (req, res) => {
    await enrolled(req);
    const { weekId, language } = z
      .object({
        weekId: z.number().int().min(1).max(16),
        language: z.literal("en").default("en"),
      })
      .parse(req.body);
    if (!isWeekUnlocked(weekId)) throw Object.assign(Error("WEEK_LOCKED"), { status: 403 });
    const s = prepareConversation(createSession(weekId, "en", req.user.uid, `${studentKey(req.user)}~${randomUUID()}`));
    await store.create(s);
    res.json(s);
  }),
);
app.post("/api/sessions/:id/conversation", handler(async (req, res) => {
  const s = await getSession(req);
  if (s.status !== "in_progress") throw Error("COMPLETE");
  res.json(publicSession(await store.mutate(s.id, prepareConversation)));
}));
const messageSchema = z.object({
  id: z.string().min(1).max(160), role: z.enum(["student", "assistant"]), text: z.string().max(20000),
  order: z.number().int().nonnegative(), revision: z.number().int().positive(), complete: z.boolean(),
  createdAt: z.string().datetime(), interrupted: z.boolean().optional(),
});
app.post("/api/sessions/:id/messages", handler(async (req, res) => {
  const s = await getSession(req);
  const { messages } = z.object({ messages: z.array(messageSchema).max(30) }).parse(req.body);
  await store.mutate(s.id, current => mergeMessages(current, messages));
  res.json({ ok: true });
}));
// TEMP: development reset — clears the transcript and any feedback so the week can be retried.
function resetConversation(current) {
  const { feedback, completedAt, evaluationLease, ...rest } = current;
  return { ...rest, messages: [], status: "in_progress", evaluationStatus: "not_started", updatedAt: new Date().toISOString() };
}
app.post("/api/sessions/:id/reset", handler(async (req, res) => {
  const s = await getSession(req);
  if (s.mode !== "conversation") throw Error("NOT_A_CONVERSATION");
  const reset = await store.mutate(s.id, resetConversation);
  unmirror(reset, req.user);
  res.json(publicSession(reset));
}));
// Resets every conversation of the signed-in student (local development storage only), including the transcript mirror.
app.post("/api/dev/reset-all", handler(async (req, res) => {
  if (!local) throw Object.assign(Error("FORBIDDEN"), { status: 403 });
  for (const s of await store.list(req.user.uid, studentKey(req.user)))
    if (s.mode === "conversation") unmirror(await store.mutate(s.id, resetConversation), req.user);
  const sessions = await store.list(req.user.uid, studentKey(req.user));
  res.json(sessions.map(publicSession).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}));
app.post("/api/sessions/:id/complete", handler(async (req, res) => {
  const s = await getSession(req);
  try { const done = await store.mutate(s.id, completeConversation); mirror(done, req.user); res.json(publicSession(done)); }
  catch (error) { if (error.message === "NO_STUDENT_SPEECH") error.status = 400; throw error; }
}));
app.post(
  "/api/sessions/:id/draft",
  handler(async (req, res) => {
    const s = await getSession(req);
    const { text } = z.object({ text: z.string().max(20000) }).parse(req.body);
    if (s.status !== "in_progress") throw Error("COMPLETE");
    await patch(s.id, {
      draft: text,
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  }),
);
// Persist accepted answers before asking the dialogue planner. A retry continues the
// pending decision without duplicating the student's answer.
app.post(
  "/api/sessions/:id/answer",
  handler(async (req, res) => {
    const original = await getSession(req);
    const { text, turnCount } = z
      .object({
        text: z.string().trim().min(1).max(20000),
        turnCount: z.number().int().nonnegative(),
      })
      .parse(req.body);
    let s = await store.mutate(original.id, (current) => {
      if (current.pendingDecision && current.turns.length === turnCount + 1)
        return current;
      if (
        current.turns.length !== turnCount ||
        current.status !== "in_progress"
      )
        throw Error("STALE_SESSION");
      const next = { ...appendAnswer(current, text), pendingDecision: true };
      return next;
    });
    let decision = { action: "next" };
    if (followUpCount(s) < reviewConfig.maxFollowUps) {
      decision = await modelJSON(
        dialogueInstructions +
          ' Return JSON: {"action":"next"|"followup","question":"..."}.',
        {
          language: s.language,
          question: s.questions[s.index],
          turns: s.turns.filter(
            (t) =>
              t.questionId === s.questions[s.index].id ||
              t.parentId === s.questions[s.index].id,
          ),
        },
        z.object({
          action: z.enum(["next", "followup"]),
          question: z.string().max(1200),
        }),
      );
      if (decision.action === "followup" && !decision.question.trim())
        throw Error("EMPTY_QUESTION");
    }
    s = await store.mutate(s.id, (current) => {
      if (!current.pendingDecision) return current;
      const next = { ...advance(current, decision), pendingDecision: false };
      return next;
    });
    res.json(publicSession(s));
  }),
);
app.post(
  "/api/realtime/token",
  handler(async (req, res) => {
    const s = await getSession(req);
    if (s.status !== "in_progress") throw Error("COMPLETE");
    if (!isWeekUnlocked(s.weekId)) throw Object.assign(Error("WEEK_LOCKED"), { status: 403 });
    res.set("Cache-Control", "no-store");
    res.json(await createRealtimeToken(s.language, s));
  }),
);
app.post(
  "/api/sessions/:id/evaluate",
  handler(async (req, res) => {
    const s = await getSession(req);
    if (s.status !== "completed") throw Error("INCOMPLETE");
    if (s.evaluationStatus === "ready" || s.evaluationStatus === "reviewed")
      return res.json(publicSession(s));
    await store.mutate(s.id, (current) => {
      if (current.evaluationLease > Date.now())
        throw Object.assign(Error("EVALUATION_IN_PROGRESS"), { status: 409 });
      return {
        ...current,
        evaluationStatus: "processing",
        evaluationLease: Date.now() + 150000,
      };
    });
    try {
      let result;
      let correction;
      for (let attempt = 0; attempt < 2; attempt++) {
        result = await modelJSON(
          s.mode === "conversation" ? conversationJudgeInstructions : judgeInstructions + " Return JSON. Every quote must be copied character-for-character from ONE turn.answer, including punctuation. Never join excerpts or add ellipses. Use the exact turn.id. Group follow-up evidence under its parent core questionId. Include exactly one entry for every applicable question/criterion pair.",
          { session: s, rubricLevels, ...(correction ? { correction } : {}) },
          evaluation,
        );
        try { validateEvidence(result, s); break; }
        catch (error) {
          if (attempt === 1) throw error;
          correction = { rejectedEvaluation: result, validationError: error.message, instruction: "Regenerate the evaluation with valid verbatim evidence. Do not infer or invent missing evidence." };
        }
      }
      await store.saveEvaluation(s.id, {
          original: result,
          rubricVersion: s.rubricVersion,
          questionVersion: s.questionVersion,
          model: process.env.OPENAI_JUDGE_MODEL || "gpt-4.1",
          status: "pending_instructor_review",
          createdAt: new Date().toISOString(),
        });
      await patch(s.id, {
        feedback: result.feedback,
        evaluationStatus: "ready",
        evaluationLease: 0,
      });
      res.json(
        publicSession({
          ...s,
          feedback: result.feedback,
          evaluationStatus: "ready",
        }),
      );
    } catch (e) {
      await patch(s.id, {
        evaluationStatus: "failed",
        evaluationLease: 0,
      });
      throw e;
    }
  }),
);
app.get(
  "/api/instructor/sessions",
  handler(async (req, res) => {
    if (!isStaff(req.user))
      throw Object.assign(Error("FORBIDDEN"), { status: 403 });
    res.json((await store.list()).map(publicSession));
  }),
);
app.get(
  "/api/instructor/sessions/:id/evaluation",
  handler(async (req, res) => {
    if (!isStaff(req.user))
      throw Object.assign(Error("FORBIDDEN"), { status: 403 });
    const s = await getSession(req, true);
    res.json(await store.getEvaluation(s.id));
  }),
);
app.post(
  "/api/instructor/sessions/:id/review",
  handler(async (req, res) => {
    if (!isStaff(req.user))
      throw Object.assign(Error("FORBIDDEN"), { status: 403 });
    const s = await getSession(req, true);
    const revision = evaluation.parse(req.body);
    validateEvidence(revision, s);
    const audit = {
      revision,
      reviewerId: req.user.uid,
      reviewedAt: new Date().toISOString(),
    };
    await store.saveReview(s.id, audit);
    res.json({ ok: true });
  }),
);
// On Vercel the app is served by api/index.js; locally `npm run server` listens on loopback.
if (!process.env.VERCEL)
  app.listen(process.env.PORT || 3001, "127.0.0.1", () =>
    console.log(`Review API on http://127.0.0.1:${process.env.PORT || 3001} (${local ? "local storage" : `Firestore ${process.env.FIREBASE_PROJECT_ID}`}, real OpenAI; transcripts → ${transcripts ? `Firestore ${transcripts.projectId}` : "not mirrored"})`),
  );
export default app;
