import { inputLevel } from "./microphone.js";

// Observe the same stream sent to Realtime and recorded for playback.
// The monitor never requests a second microphone or stops the shared tracks.
export class InputMonitor {
  constructor(onSample) { this.onSample = onSample; }
  attach(stream) {
    this.close();
    this.stream = stream;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      this.context = new Context();
      this.context.resume().catch(() => {});
      this.source = this.context.createMediaStreamSource(stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.samples = new Float32Array(this.analyser.fftSize);
      this.silentOutput = this.context.createGain();
      this.silentOutput.gain.value = 0;
      this.source.connect(this.analyser);
      this.analyser.connect(this.silentOutput);
      this.silentOutput.connect(this.context.destination);
    } catch { this.close(); }
  }
  start() {
    this.stop();
    if (!this.context) { this.onSample(0, "unavailable"); return; }
    this.context.resume().catch(() => {});
    let lastSound = performance.now(), detected = false;
    this.timer = setInterval(() => {
      const track = this.stream.getAudioTracks()[0];
      if (!track || track.readyState === "ended") { this.onSample(0, "disconnected"); return; }
      if (track.muted) { this.onSample(0, "muted"); return; }
      if (this.context.state !== "running") { this.onSample(0, "paused"); return; }
      if (!track.enabled) { this.onSample(0, "waiting"); return; }
      this.analyser.getFloatTimeDomainData(this.samples);
      const level = inputLevel(this.samples);
      if (level > .08) { lastSound = performance.now(); detected = true; }
      const status = performance.now() - lastSound > 3500 ? "silent" : detected ? "signal" : "waiting";
      this.onSample(level, status);
    }, 80);
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.onSample(0, "idle");
  }
  close() {
    this.stop();
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.silentOutput?.disconnect();
    if (this.context && this.context.state !== "closed") this.context.close().catch(() => {});
    this.context = null;
  }
}
