import test from 'node:test';
import assert from 'node:assert/strict';
import { AnswerRecorder } from '../src/services/answer-recorder.js';

class RecorderMock {
  static isTypeSupported(type) { return type === 'audio/webm;codecs=opus'; }
  constructor(stream, options) { this.stream = stream; this.mimeType = options.mimeType; this.state = 'inactive'; }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob([this.stream.answer]) });
      this.onstop?.();
    });
  }
}
test('re-recording discards old audio and stopping returns only the latest answer', async () => {
  const original = globalThis.MediaRecorder;
  globalThis.MediaRecorder = RecorderMock;
  try {
    const recorder = new AnswerRecorder();
    recorder.start({ answer: 'discard this take' });
    recorder.start({ answer: 'keep this take' });
    const blob = await recorder.stop();
    assert.equal(await blob.text(), 'keep this take');
    assert.equal(blob.type, 'audio/webm;codecs=opus');
    assert.equal(await recorder.stop(), null);
    recorder.start({ answer: 'leave without uploading' });
    const stopped = recorder.stop();
    recorder.discard();
    assert.equal(await stopped, null);
  } finally { globalThis.MediaRecorder = original; }
});
