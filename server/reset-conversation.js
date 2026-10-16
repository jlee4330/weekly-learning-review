export function resetConversation(current) {
  const { feedback, completedAt, evaluationLease, ...rest } = current;
  const now = new Date().toISOString();
  return { ...rest, messages: [], status: "in_progress", evaluationStatus: "not_started", createdAt: now, updatedAt: now };
}

export async function restartConversation({ store, transcripts, audio, session, user, onAudioError = () => {} }) {
  const reset = await store.mutate(session.id, resetConversation);
  // Transcript removal is required before a new voice connection reads the session.
  await transcripts?.clear(reset, user);
  let audioCleanupFailed = false;
  try { await audio?.clear(reset, user); }
  catch (error) { audioCleanupFailed = true; onAudioError(error); }
  return { ...reset, audioCleanupFailed };
}
