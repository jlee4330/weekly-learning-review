import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { courseAuthConfig, loginEmail } from "./course-auth";
import { demoRepository } from "./demo";
export const isLocal = import.meta.env.VITE_MODE === "local";
export const isDemo = !["live", "local"].includes(import.meta.env.VITE_MODE);
export const requiresLogin = !isDemo && (!isLocal || import.meta.env.VITE_AUTH_PROVIDER === "firebase");
export const localUser = isLocal && !requiresLogin ? { uid: "local-student", displayName: "Local session" } : null;
export const auth = !requiresLogin
  ? null
  : getAuth(
      initializeApp({
        ...courseAuthConfig.firebase,
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || courseAuthConfig.firebase.apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || courseAuthConfig.firebase.authDomain,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || courseAuthConfig.firebase.projectId,
      }),
    );
export const login = (identifier, password) => signInWithEmailAndPassword(auth, loginEmail(identifier), password);
export const logout = () => signOut(auth);
export async function api(path, body, method) {
  if (requiresLogin && !auth?.currentUser) throw Error("AUTH_REQUIRED");
  const r = await fetch(`/api${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(isLocal ? { "X-Review-Client": "browser" } : {}),
      ...(requiresLogin ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } : {}),
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
      reset: (s) => api(`/sessions/${s.id}/reset`, {}),
      resetAll: () => api("/dev/reset-all", {}),
      draft: (s, text) => api(`/sessions/${s.id}/draft`, { text }),
      answer: (s, text) =>
        api(`/sessions/${s.id}/answer`, {
          text,
          turnCount: s.turns.length - (s.pendingDecision ? 1 : 0),
        }),
      evaluate: (s) => api(`/sessions/${s.id}/evaluate`, {}),
    };
