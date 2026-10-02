
// Writes each student's finished weekly transcript to Firestore:
//   students/{studentId}                 { uid, email, studentId, lastActiveAt }
//   students/{studentId}/weeks/Week{N}   { transcript: [{ role, text, at }, …] }  (alongside the session fields)
// Saved when the student presses End; removed again when the week is restarted or reset.
// studentId is the part of the login email before "@" (falls back to the login uid).
// The review store stays the source of truth; mirroring failures are logged and never block the student.
// Enabled when TRANSCRIPT_FIREBASE_PROJECT_ID and a service account (FIREBASE_SERVICE_ACCOUNT JSON or a credentials file) are set.

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
  if (!projectId) return null;
  const { dataApp } = await import("./firebase-admin.js");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  const app = dataApp(projectId);
  if (!app) return null;
  const db = getFirestore(app);
  // A missing field should never make the whole transcript write fail (settings can only be applied once per app).
  try { db.settings({ ignoreUndefinedProperties: true }); } catch {}
  const student = (session, user) => db.collection("students").doc(studentIdOf(user, session.studentId));
  return {
    projectId,
    // End: identity on the student document, the clean transcript on students/{studentId}/weeks/Week{N}.
    async save(session, user) {
      if (session?.mode !== "conversation") return;
      const ref = student(session, user), batch = db.batch();
      batch.set(ref, { uid: session.studentId, email: user?.email || null, studentId: ref.id, lastActiveAt: new Date().toISOString() }, { merge: true });
      batch.set(ref.collection("weeks").doc(weekKey(session.weekId)), { transcript: weekEntry(session) }, { merge: true });
      await batch.commit();
    },
    // Restart / back / Reset all: remove that week's transcript.
    async clear(session, user) {
      if (session?.mode !== "conversation") return;
      try { await student(session, user).collection("weeks").doc(weekKey(session.weekId)).update({ transcript: FieldValue.delete() }); }
      catch (error) { if (error.code !== 5) throw error; } // 5 = NOT_FOUND: nothing was saved yet
    },
  };
}
