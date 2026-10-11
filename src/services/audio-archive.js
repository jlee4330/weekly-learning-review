// Separate, playable files from the supplied audio stream (the conversation mixer output).
export class AudioArchive {
  constructor({ upload, onError = () => {}, intervalMs = 300000 }) {
    Object.assign(this, { upload, onError, intervalMs });
    this.queue = Promise.resolve();
    this.cancelled = false;
  }
  start(stream) {
    if (this.cancelled || this.recorder) return;
    this.stream = stream;
    try {
      if (typeof MediaRecorder === 'undefined') throw Error('RECORDING_UNAVAILABLE');
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
      if (!mimeType) throw Error('RECORDING_UNAVAILABLE');
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48000 });
      const chunks = [], startedAt = new Date().toISOString();
      this.recorder = recorder;
      this.part = new Promise(resolve => {
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        recorder.onerror = () => { this.onError(Error('RECORDING_FAILED')); resolve(null); };
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
      });
      recorder.start();
      this.startedAt = startedAt;
      this.timer = setTimeout(() => {
        this.stopPart();
        this.start(stream);
      }, this.intervalMs);
    } catch (error) { this.recorder = null; this.onError(error); }
  }
  stopPart() {
    clearTimeout(this.timer);
    const recorder = this.recorder;
    if (!recorder) return;
    const part = this.part, startedAt = this.startedAt;
    this.recorder = null;
    if (recorder.state !== 'inactive') recorder.stop();
    this.queue = this.queue.then(async () => {
      const blob = await part;
      if (this.cancelled || !blob?.size) return;
      if (blob.size > 4 * 1024 * 1024) throw Error('AUDIO_TOO_LARGE');
      await this.upload(blob, startedAt);
    }).catch(error => { if (!this.cancelled) this.onError(error); });
  }
  pause() { this.stopPart(); }
  async finish() { this.stopPart(); await this.queue; }
  async discard() {
    this.cancelled = true;
    this.stopPart();
    // Wait for an already-running request before the caller deletes the week's files.
    await this.queue;
  }
}
