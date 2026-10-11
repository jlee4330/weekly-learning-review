import reviewFirebase from "../config/review-firebase.json" with { type: "json" };
import { studentIdOf, weekKey } from "./transcript-store.js";

// Saves the mixed student and agent conversation audio (only when they agreed on the start screen) to Firebase Storage:
//   students/{studentId}/Week{N}/{startedAt}.webm
// The browser sends one self-contained part every few minutes; restarting or resetting the week deletes them.
// Needs the Blaze plan for *.firebasestorage.app buckets. Failures are logged and never block the conversation.
export async function createAudioStore() {
  const bucketName = process.env.AUDIO_STORAGE_BUCKET || reviewFirebase.firebase?.storageBucket;
  const projectId = process.env.TRANSCRIPT_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!bucketName || !projectId) return null;
  const { dataApp } = await import("./firebase-admin.js");
  const { getStorage } = await import("firebase-admin/storage");
  const app = dataApp(projectId);
  if (!app) return null;
  const bucket = getStorage(app).bucket(bucketName);
  const prefix = (session, user) => `students/${studentIdOf(user, session.studentId)}/${weekKey(session.weekId)}/`;
  return {
    bucket: bucketName,
    async save(session, user, { data, contentType, startedAt }) {
      const extension = contentType.includes("mp4") ? "m4a" : "webm";
      const path = `${prefix(session, user)}${startedAt.replace(/[:.]/g, "-")}.${extension}`;
      await bucket.file(path).save(data, { contentType, resumable: false, metadata: { metadata: { sessionId: session.id, startedAt } } });
      return path;
    },
    async clear(session, user) {
      try { await bucket.deleteFiles({ prefix: prefix(session, user) }); }
      catch (error) { if (Number(error.code) !== 404) throw error; }
    },
  };
}
