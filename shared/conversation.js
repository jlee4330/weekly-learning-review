export function asConversation(session) {
  if (session.mode === "conversation") return session;
  const messages = session.turns.flatMap((turn, index) => [
    { id: `${turn.id}-agent`, role: "assistant", text: turn.question, order: index * 2, revision: 1, complete: true, createdAt: turn.askedAt },
    { id: turn.id, role: "student", text: turn.answer, order: index * 2 + 1, revision: 1, complete: true, createdAt: turn.answeredAt },
  ]);
  if (session.draft?.trim() && !session.pendingDecision) messages.push({ id: `${session.id}-saved-draft`, role: "student", text: session.draft, order: messages.length, revision: 1, complete: false, createdAt: session.updatedAt || session.createdAt });
  return { ...session, mode: "conversation", conversationVersion: "conversation-1", messages, pendingDecision: false };
}

export function mergeMessages(session, incoming) {
  if (session.mode !== "conversation" || session.status !== "in_progress") throw Error("CONVERSATION_CLOSED");
  const byId = new Map(session.messages.map(message => [message.id, message]));
  for (const message of incoming) {
    const old = byId.get(message.id);
    if (old && old.role !== message.role) throw Error("MESSAGE_ROLE_CHANGED");
    if (old && (old.revision >= message.revision || (old.complete && !message.complete))) continue;
    byId.set(message.id, { ...message, ...(old ? { order: old.order, createdAt: old.createdAt } : {}) });
  }
  return { ...session, messages: [...byId.values()].sort((a, b) => a.order - b.order), updatedAt: new Date().toISOString() };
}

export function completeConversation(session) {
  if (session.mode !== "conversation") throw Error("NOT_A_CONVERSATION");
  if (session.status === "completed") return session;
  if (!session.messages.some(m => m.role === "student" && m.complete && m.text.trim())) throw Error("NO_STUDENT_SPEECH");
  const now = new Date().toISOString();
  return { ...session, status: "completed", completedAt: now, updatedAt: now, evaluationStatus: "pending" };
}
