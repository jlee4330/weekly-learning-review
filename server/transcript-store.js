import { readFileSync } from "node:fs";

// Mirrors each student's weekly conversations into Firestore, one document per student:
//   students/{studentId}
//     uid, email, studentId, lastActiveAt
//     Week1: [{ role, text, at }, …]   ← the week's transcript only
//     Week2: [ … ]
// studentId is the part of the login email before "@" (falls back to the login uid).
// The review store stays the source of truth; mirroring failures are logged and never block the student.
// Enabled when TRANSCRIPT_FIREBASE_PROJECT_ID and TRANSCRIPT_FIREBASE_CREDENTIALS (service-account JSON path) are set.

export const weekKey = (weekId) => `Week${weekId}`;
export const studentIdOf = (user, uid) => (user?.email ? user.email.split("@")[0] : uid);

// A week is just its transcript: spoken messages in order, as { role, text, at }.
export function weekEntry(session) {
  return (session.messages || [])
    .filter((m) => m.text?.trim())
    .sort((a, b) => a.order - b.order)
    .map((m) => ({ role: m.role, text: m.text, at: m.createdAt }));
}

export async function createTranscriptStore() {
  const projectId = process.env.TRANSCRIPT_FIREBASE_PROJECT_ID;
  const keyFile = process.env.TRANSCRIPT_FIREBASE_CREDENTIALS;
  if (!projectId || !keyFile) return null;
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  // A named app, so it never collides with the default app used to verify course logins.
  const app = initializeApp({ credential: cert(JSON.parse(readFileSync(keyFile, "utf8"))), projectId }, "transcripts");
  const db = getFirestore(app);
  // A missing field should never make the whole transcript write fail.
  db.settings({ ignoreUndefinedProperties: true });
  return {
    projectId,
    async save(session, user) {
      if (session?.mode !== "conversation") return;
      const studentId = studentIdOf(user, session.studentId);
      // merge keeps the other weeks; this week's array is replaced in full each time, so a reset empties it.
      await db.collection("students").doc(studentId).set({
        uid: session.studentId,
        email: user?.email || null,
        studentId,
        lastActiveAt: new Date().toISOString(),
        [weekKey(session.weekId)]: weekEntry(session),
      }, { merge: true });
    },
  };
}
