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

export async function createCloudStore(courseId) {
  const { dataApp } = await import("./firebase-admin.js");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = dataApp();
  if (!app) throw Error("Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT (or a credentials file) for cloud storage.");
  const db = getFirestore(app);
  const sessions = db.collection("courses").doc(courseId).collection("sessions");
  return {
    enrolled: async uid => (await db.doc(`courses/${courseId}/members/${uid}`).get()).exists,
    get: async id => (await sessions.doc(id).get()).data(),
    list: async uid => {
      const result = await (uid ? sessions.where("studentId", "==", uid) : sessions).get();
      return result.docs.map(doc => doc.data());
    },
    create: s => sessions.doc(s.id).create(s),
    mutate: (id, fn) => db.runTransaction(async tx => {
      const ref = sessions.doc(id);
      const next = await fn((await tx.get(ref)).data());
      tx.set(ref, next);
      return next;
    }),
    saveEvaluation: (id, result) => sessions.doc(id).collection("private").doc("evaluation").set(result),
    getEvaluation: async id => (await sessions.doc(id).collection("private").doc("evaluation").get()).data() || {},
    saveReview: (id, audit) => {
      const ref = sessions.doc(id), batch = db.batch();
      batch.set(ref.collection("revisions").doc(), audit);
      batch.set(ref.collection("private").doc("evaluation"), { latestReview: audit, status: "reviewed" }, { merge: true });
      batch.update(ref, { feedback: audit.revision.feedback, evaluationStatus: "reviewed" });
      return batch.commit();
    },
  };
}
