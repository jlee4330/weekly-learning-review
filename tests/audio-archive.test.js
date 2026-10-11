import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioArchive } from '../src/services/audio-archive.js';
import { packSession, unpackSession } from '../server/storage.js';
class Recorder {
  static isTypeSupported(t) { return t === 'audio/webm;codecs=opus'; }
  constructor(stream, options) { this.stream = stream; this.mimeType = options.mimeType; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable({ data: new Blob([this.stream.text]) }); this.onstop(); }); }
}
test('consent survives cloud serialization and defaults to absent', () => {
  const s = { audioConsent: true, audioConsentAt: new Date().toISOString() };
  assert.equal(unpackSession('test', packSession(s), 'course').audioConsent, true);
  assert.equal(unpackSession('test', packSession({}), 'course').audioConsent, undefined);
});
test('pause/resume produces independent files; finish waits for uploads; discard drops pending audio', async () => {
  const original = globalThis.MediaRecorder; globalThis.MediaRecorder = Recorder;
  try {
    const sent = [];
    const a = new AudioArchive({ upload: async b => sent.push(await b.text()) });
    a.start({ text: 'first' }); a.pause();
    a.start({ text: 'second' }); await a.finish();
    assert.deepEqual(sent, ['first', 'second']);
    a.start({ text: 'discard' }); await a.discard();
    assert.deepEqual(sent, ['first', 'second']);
    let release, entered;
    const started = new Promise(r => { entered = r; });
    const b = new AudioArchive({ upload: () => { entered(); return new Promise(r => { release = r; }); } });
    b.start({ text: 'in-flight' }); b.pause(); await started;
    let done = false; const discarded = b.discard().then(() => { done = true; });
    await Promise.resolve(); assert.equal(done, false);
    release(); await discarded; assert.equal(done, true);
  } finally { globalThis.MediaRecorder = original; }
});
test('failed upload reports an error without blocking subsequent parts or finish', async () => {
  const original = globalThis.MediaRecorder; globalThis.MediaRecorder = Recorder;
  try {
    let attempts = 0; const errors = [];
    const a = new AudioArchive({ upload: async () => { if (++attempts === 1) throw Error('offline'); }, onError: e => errors.push(e.message) });
    a.start({ text: 'first' }); a.pause(); a.start({ text: 'second' }); await a.finish();
    assert.equal(attempts, 2); assert.deepEqual(errors, ['offline']);
  } finally { globalThis.MediaRecorder = original; }
});
