import { test, expect } from '@playwright/test';

// The client decides when the companion replies (create_response is off) and mutes the mic while it speaks.
test('replies after a short pause, keeps listening if the student goes on, and mutes the mic while the agent speaks', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { RealtimeConversation } = await import('/src/services/conversation-voice.js');
    const make = () => {
      const v = new RealtimeConversation(), sent = [], track = { enabled: true, stop() {} };
      v.onState = () => {}; v.onError = () => {}; v.onMessage = () => {}; v.send = (e) => sent.push(e.type);
      v.messages = new Map(); v.pending = new Set(); v.speech = []; v.order = 0; v.recordingStart = performance.now();
      v.stream = { getTracks: () => [track] };
      return { v, sent, track };
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const ev = (v, type, extra = {}) => v.handleEvent({ type, ...extra });

    // 1) The student finishes: no instant reply, then one reply after the pause.
    const idle = make();
    ev(idle.v, 'input_audio_buffer.committed', { item_id: 'u1' });
    const immediately = [...idle.sent];
    await wait(1300);
    const afterPause = [...idle.sent];

    // 2) The student keeps talking within the pause: the pending reply is dropped.
    const goesOn = make();
    ev(goesOn.v, 'input_audio_buffer.committed', { item_id: 'u2' });
    await wait(500);
    ev(goesOn.v, 'input_audio_buffer.speech_started', { item_id: 'u3' });
    await wait(1000);
    const continued = [...goesOn.sent];

    // 3) Speaking while a reply is being prepared (no audio yet) cancels it.
    const preparing = make();
    ev(preparing.v, 'response.created');
    ev(preparing.v, 'input_audio_buffer.speech_started', { item_id: 'u4' });
    const cancelled = [...preparing.sent];

    // 4) The mic is off while the agent's audio plays and back on afterwards.
    const speaking = make();
    ev(speaking.v, 'output_audio_buffer.started');
    const micDuring = speaking.track.enabled;
    ev(speaking.v, 'output_audio_buffer.stopped');
    const micAfter = speaking.track.enabled;

    idle.v.close(); goesOn.v.close(); preparing.v.close(); speaking.v.close();
    return { immediately, afterPause, continued, cancelled, micDuring, micAfter };
  });
  expect(result.immediately).toEqual([]);
  expect(result.afterPause).toEqual(['response.create']);
  expect(result.continued).toEqual([]);
  expect(result.cancelled).toEqual(['response.cancel']);
  expect(result.micDuring).toBe(false);
  expect(result.micAfter).toBe(true);
});
