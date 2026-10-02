import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import courseAuth from "../config/course-auth.json" with { type: "json" };

// Two Firebase projects are involved:
// - the course website project (config/course-auth.json) issues student logins; we only verify its ID tokens,
//   which needs its project ID but no credentials;
// - the review data project (FIREBASE_PROJECT_ID) stores sessions and weekly transcripts with a service account.

// Service account: FIREBASE_SERVICE_ACCOUNT holds the JSON itself (Vercel); locally a file path works too.
export function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Tolerate the value being pasted with surrounding quotes, and keys whose newlines arrive as "\\n".
    let raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    if (/^(['"]).*\1$/s.test(raw)) raw = raw.slice(1, -1);
    let account;
    try { account = JSON.parse(raw); } catch { throw Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON."); }
    if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, "\n");
    return account;
  }
  const file = process.env.TRANSCRIPT_FIREBASE_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return file ? JSON.parse(readFileSync(file, "utf8")) : null;
}

const named = (name, options) => getApps().find((app) => app.name === name) || initializeApp(options, name);

export function dataApp(projectId = process.env.FIREBASE_PROJECT_ID || process.env.TRANSCRIPT_FIREBASE_PROJECT_ID) {
  const account = serviceAccount();
  if (!projectId || !account) return null;
  if (account.project_id && account.project_id !== projectId) throw Error(`Service account is for ${account.project_id}, not ${projectId}.`);
  return named("review-data", { credential: cert(account), projectId });
}

const courseAuthApp = () => named("course-auth", { projectId: process.env.COURSE_AUTH_PROJECT_ID || courseAuth.firebase.projectId });
export const verifyCourseLogin = (token) => getAuth(courseAuthApp()).verifyIdToken(token);
