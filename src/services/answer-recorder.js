// Temporary playback of the original microphone audio. Nothing is uploaded here.
export class AnswerRecorder {
  start(stream) {
    this.discard();
    if (typeof MediaRecorder === "undefined") throw Error("RECORDING_UNAVAILABLE");
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
      .find(type => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.recorder = recorder;
    this.chunks = [];
    recorder.ondataavailable = event => {
      if (this.recorder === recorder && event.data.size) this.chunks.push(event.data);
    };
    recorder.start(250);
  }
  stop() {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(null);
    if (this.stopping) return this.stopping;
    this.stopping = new Promise((resolve, reject) => {
      this.resolveStop = resolve;
      recorder.onstop = () => {
        if (this.recorder !== recorder) return resolve(null);
        const blob = new Blob(this.chunks, { type: recorder.mimeType });
        this.recorder = null;
        this.chunks = [];
        this.stopping = null;
        this.resolveStop = null;
        resolve(blob.size ? blob : null);
      };
      recorder.onerror = () => { this.resolveStop = null; this.discard(); reject(Error("RECORDING_FAILED")); };
      recorder.stop();
    });
    return this.stopping;
  }
  discard() {
    const recorder = this.recorder;
    this.recorder = null;
    this.chunks = [];
    this.resolveStop?.(null);
    this.resolveStop = null;
    this.stopping = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }
}
