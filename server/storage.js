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
      if (data.sessions[s.id]) throw Error("SESSION_EXISTS");
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
// Firestore keeps only what the app needs: who, which week, progress, times and the messages.
// Values that never vary for a voice conversation are filled back in when a session is read.
const STORED = ["studentId", "weekId", "status", "messages", "createdAt", "updatedAt", "completedAt"];
export const packSession = (s) => Object.fromEntries(STORED.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
export const unpackSession = (id, data, courseId) => data && ({
  id, courseId, mode: "conversation", language: "en", conversationVersion: "conversation-2", evaluationStatus: "not_started", messages: [], ...data,
});

export const sessionKey = (id) => (String(id).includes("~") ? String(id).split("~")[0] : null);

export async function createCloudStore(courseId) {
  const { dataApp } = await import("./firebase-admin.js");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = dataApp();
  if (!app) throw Error("Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT (or a credentials file) for cloud storage.");
  const db = getFirestore(app);
  const student = (key) => db.collection("students").doc(key);
  const ref = (id) => {
    const key = sessionKey(id);
    if (!key) throw Object.assign(Error("NOT_FOUND"), { status: 404 });
    return student(key).collection("reviewSessions").doc(id);
  };
  return {
    // Only consulted when REQUIRE_ENROLLMENT=true.
    enrolled: async uid => (await db.doc(`courses/${courseId}/members/${uid}`).get()).exists,
    get: async id => (sessionKey(id) ? unpackSession(id, (await ref(id).get()).data(), courseId) : undefined),
    list: async (uid, key) => {
      const result = await (key ? student(key).collection("reviewSessions").where("studentId", "==", uid) : db.collectionGroup("reviewSessions")).get();
      return result.docs.map(doc => unpackSession(doc.id, doc.data(), courseId));
    },
    create: s => ref(s.id).create(packSession(s)),
    mutate: (id, fn) => db.runTransaction(async tx => {
      const doc = ref(id);
      const next = await fn(unpackSession(id, (await tx.get(doc)).data(), courseId));
      tx.set(doc, packSession(next));
      return next;
    }),
    saveEvaluation: (id, result) => ref(id).collection("private").doc("evaluation").set(result),
    getEvaluation: async id => (await ref(id).collection("private").doc("evaluation").get()).data() || {},
    saveReview: (id, audit) => {
      const doc = ref(id), batch = db.batch();
      batch.set(doc.collection("revisions").doc(), audit);
      batch.set(doc.collection("private").doc("evaluation"), { latestReview: audit, status: "reviewed" }, { merge: true });
      batch.update(doc, { feedback: audit.revision.feedback, evaluationStatus: "reviewed" });
      return batch.commit();
    },
  };
}
