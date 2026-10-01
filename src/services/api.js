import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { demoRepository } from "./demo";
export const isLocal = import.meta.env.VITE_MODE === "local";
export const isDemo = !["live", "local"].includes(import.meta.env.VITE_MODE);
export const localUser = isLocal ? { uid: "local-student", displayName: "Local session" } : null;
export const auth = isDemo || isLocal
  ? null
  : getAuth(
      initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      }),
    );
export const login = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logout = () => signOut(auth);
export async function api(path, body, method) {
  if (!isLocal && !auth?.currentUser) throw Error("AUTH_REQUIRED");
  const r = await fetch(`/api${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(isLocal ? { "X-Review-Client": "browser" } : { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok)
    throw Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  return r.json();
}
export const repository = isDemo
  ? demoRepository
  : {
      list: () => api("/sessions"),
      create: (weekId, language) => api("/sessions", { weekId, language }),
      openConversation: (s) => api(`/sessions/${s.id}/conversation`, {}),
      messages: (s, messages) => api(`/sessions/${s.id}/messages`, { messages }),
      complete: (s) => api(`/sessions/${s.id}/complete`, {}),
      draft: (s, text) => api(`/sessions/${s.id}/draft`, { text }),
      answer: (s, text) =>
        api(`/sessions/${s.id}/answer`, {
          text,
          turnCount: s.turns.length - (s.pendingDecision ? 1 : 0),
        }),
      evaluate: (s) => api(`/sessions/${s.id}/evaluate`, {}),
    };
