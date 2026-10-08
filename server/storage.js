import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";

// Single-process, single-user storage for the loopback-only development server.
// Keep private evaluation evidence outside the student-facing session object.
export function createLocalStore(filename) {
  let queue = Promise.resolve();
  async function read() {
    try { return JSON.parse(await readFile(filename, "utf8")); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      return { sessions: {}, evaluations: {}, revisions: {} };
    }
  }
  function change(fn) {
    const work = queue.then(async () => {
      const data = await read();
      const result = await fn(data);
      await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
      await writeFile(`${filename}.tmp`, JSON.stringify(data), { mode: 0o600 });
      await rename(`${filename}.tmp`, filename);
      return result;
    });
    queue = work.catch(() => {});
    return work;
  }
  return {
    enrolled: async () => true,
    get: async (id) => { await queue; return (await read()).sessions[id]; },
    list: async (uid) => {
      await queue;
      return Object.values((await read()).sessions).filter(s => !uid || s.studentId === uid);
    },
    create: (s) => change(data => {
      // One session per student per week: starting a week again replaces the previous one.
      data.sessions[s.id] = s;
    }),
    mutate: (id, fn) => change(async data => {
      if (!data.sessions[id]) throw Error("NOT_FOUND");
      const next = await fn(data.sessions[id]);
      data.sessions[id] = next;
      return next;
    }),
    saveEvaluation: (id, result) => change(data => { data.evaluations[id] = result; }),
    getEvaluation: async (id) => { await queue; return (await read()).evaluations[id] || {}; },
    saveReview: (id, audit) => change(data => {
      (data.revisions[id] ||= []).push(audit);
      data.evaluations[id] = { ...data.evaluations[id], latestReview: audit, status: "reviewed" };
      data.sessions[id] = { ...data.sessions[id], feedback: audit.revision.feedback, evaluationStatus: "reviewed" };
    }),
  };
}

// Session IDs carry the student's key ("<studentId>~<uuid>"), so every session lives under that student:
//   students/{studentId}/reviewSessions/{sessionId}   (+ private/evaluation, revisions)
// next to the student's weekly transcripts on students/{studentId}. The top level only has `students`.
// Firestore layout, one document per student per week:
//   students/{studentId}                  { studentId, email, uid, lastActiveAt }
//   students/{studentId}/weeks/Week{N}    { studentId, weekId, status, createdAt, updatedAt, completedAt,
//                                           transcript (written on End) }
// Messages are not stored while a conversation is in progress: the page keeps them and sends them all on End.
// Leaving or reloading mid-conversation starts the week over, the same as the back button.
// A session ID is "<studentId>~Week<N>", so the ID alone locates its document.
// Only what the app needs is stored; values that never vary for a voice conversation are filled back in on read.
const STORED = ["studentId", "weekId", "status", "createdAt", "updatedAt", "completedAt"];
// Every stored field is written (missing ones as null) so a merge-write also clears what a reset removed,
// while the separately written `transcript` field is left alone.
export const packSession = (s) => Object.fromEntries(STORED.map((k) => [k, s[k] ?? null]));
export const unpackSession = (id, data, courseId) => {
  if (!data) return undefined;
  const { transcript, messages: _legacy, ...rest } = data;
  const session = { id, courseId, mode: "conversation", language: "en", conversationVersion: "conversation-2", evaluationStatus: "not_started", ...rest };
  for (const k of STORED) if (session[k] === null) delete session[k];
  // A finished week shows its saved transcript (e.g. on the transcript page).
  session.messages = (transcript || []).map((m, i) => ({ id: `${id}-${i}`, role: m.role, text: m.text, createdAt: m.at, order: i, revision: 1, complete: true }));
  return session;
};

export const sessionKey = (id) => (String(id).includes("~") ? String(id).split("~")[0] : null);
export const sessionWeek = (id) => String(id).match(/~(Week\d+)$/)?.[1] || null;
export const sessionIdFor = (key, weekId) => `${key}~Week${weekId}`;

export async function createCloudStore(courseId) {
  const { dataApp } = await import("./firebase-admin.js");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = dataApp();
  if (!app) throw Error("Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT (or a credentials file) for cloud storage.");
  const db = getFirestore(app);
  // REST instead of a long-lived gRPC channel: an idle channel can go stale and leave every request hanging.
  // Settings apply once per app; the transcript store sets the same ones.
  try { db.settings({ preferRest: true, ignoreUndefinedProperties: true }); } catch {}
  const weeks = (key) => db.collection("students").doc(key).collection("weeks");
  const ref = (id) => {
    const key = sessionKey(id), week = sessionWeek(id);
    if (!key || !week) throw Object.assign(Error("NOT_FOUND"), { status: 404 });
    return weeks(key).doc(week);
  };
  const idOf = (doc) => `${doc.ref.parent.parent.id}~${doc.id}`;
  return {
    persistsMessages: false,
    // Only consulted when REQUIRE_ENROLLMENT=true.
    enrolled: async uid => (await db.doc(`courses/${courseId}/members/${uid}`).get()).exists,
    get: async id => (sessionKey(id) && sessionWeek(id) ? unpackSession(id, (await ref(id).get()).data(), courseId) : undefined),
    list: async (uid, key) => {
      const result = await (key ? weeks(key).where("studentId", "==", uid) : db.collectionGroup("weeks")).get();
      return result.docs.map(doc => unpackSession(idOf(doc), doc.data(), courseId));
    },
    // One document per week: starting a week again replaces its previous session (and transcript).
    create: s => ref(s.id).set(packSession(s)),
    mutate: (id, fn) => db.runTransaction(async tx => {
      const doc = ref(id);
      const next = await fn(unpackSession(id, (await tx.get(doc)).data(), courseId));
      tx.set(doc, packSession(next), { merge: true });
      return next;
    }),
    saveEvaluation: async () => {},
    getEvaluation: async () => ({}),
    saveReview: async () => {},
  };
}
