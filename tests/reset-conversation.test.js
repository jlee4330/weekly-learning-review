import test from 'node:test';
import assert from 'node:assert/strict';
import { restartConversation } from '../server/reset-conversation.js';

const original = { id: 'a~Week1', createdAt: '2020-01-01T00:00:00Z', completedAt: '2020-01-02T00:00:00Z', messages: [{ text: 'old' }], audioConsent: true, feedback: {} };
test('restart clears the transcript and renews the start time even when audio cleanup fails', async () => {
  const events = [];
  const result = await restartConversation({
    session: original, user: {},
    store: { mutate: async (id, fn) => fn(original) },
    transcripts: { clear: async s => { assert.deepEqual(s.messages, []); events.push('transcript'); } },
    audio: { clear: async () => { events.push('audio'); throw Error('permission denied'); } },
    onAudioError: () => events.push('warning'),
  });
  assert.deepEqual(events, ['transcript', 'audio', 'warning']);
  assert.equal(result.audioCleanupFailed, true);
  assert.equal(result.audioConsent, true);
  assert.equal(result.status, 'in_progress');
  assert.notEqual(result.createdAt, original.createdAt);
  assert.equal(result.completedAt, undefined);
  assert.equal(result.feedback, undefined);
});
test('restart does not report success when transcript cleanup fails', async () => {
  await assert.rejects(restartConversation({ session: original, user: {},
    store: { mutate: async (id, fn) => fn(original) },
    transcripts: { clear: async () => { throw Error('offline'); } },
  }), /offline/);
});
