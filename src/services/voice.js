import { realtimeError, realtimeConnectionError } from "./realtime-errors.js";
import { api } from "./api";
import { AnswerRecorder } from "./answer-recorder.js";
import { InputMonitor } from "./input-monitor.js";
export { checkMicrophone } from './microphone.js';
export function speakDemo(text, language, onEnd) {
  if (!("speechSynthesis" in window)) {
    onEnd();
    return () => {};
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = language === "ko" ? "ko-KR" : "en-US";
  u.rate = 0.94;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return () => window.speechSynthesis.cancel();
}
export class RealtimeVoice {
  constructor({deviceId = "", onRecording = () => {}, onRecordingError = () => {}, onInput = () => {}} = {}) {
    this.deviceId = deviceId;
    this.onRecording = onRecording;
    this.onRecordingError = onRecordingError;
    this.recorder = new AnswerRecorder();
    this.inputMonitor = new InputMonitor(onInput);
  }
  async connect(session, onTranscript, onError, onSpeakingEnd) {
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.onSpeakingEnd = onSpeakingEnd;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(this.deviceId ? {deviceId: {exact: this.deviceId}} : {}) },
      });
      if (this.closed) { this.stream.getTracks().forEach(t => t.stop()); return; }
      this.stream.getTracks().forEach((t) => (t.enabled = false));
      this.inputMonitor.attach(this.stream);
      this.pc = new RTCPeerConnection();
      this.audio = new Audio();
      this.audio.autoplay = true;
      this.watchPlayback();
      this.pc.ontrack = (e) => {
        this.audio.srcObject = e.streams[0];
        this.audio.play().catch(() => onError(Error("AUDIO_PLAYBACK")));
      };
      this.pc.onconnectionstatechange = () => {
        if (["failed", "disconnected"].includes(this.pc.connectionState))
          onError(Error("CONNECTION_LOST"));
      };
      this.stream.getTracks().forEach((t) => this.pc.addTrack(t, this.stream));
      this.dc = this.pc.createDataChannel("oai-events");
      this.dc.onmessage = (e) => this.handleEvent(JSON.parse(e.data));
      const opened = new Promise((resolve, reject) => {
        this.connectionTimeout = setTimeout(() => reject(Error("CONNECTION_TIMEOUT")), 25000);
        this.dc.onopen = () => {
          clearTimeout(this.connectionTimeout);
          resolve();
        };
      });
      opened.catch(() => {});
      const token = await api("/realtime/token", { sessionId: session.id });
      this.opening = token.opening;
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      const r = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.value}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
      if (!r.ok) throw await realtimeConnectionError(r);
      await this.pc.setRemoteDescription({
        type: "answer",
        sdp: await r.text(),
      });
      await opened;
    } catch (e) {
      this.close();
      throw e;
    }
  }
  handleEvent(event) {
        if (
          event.type === "conversation.item.input_audio_transcription.completed"
        ) {
          if (!this.awaitingTranscript) return;
          this.awaitingTranscript = false;
          clearTimeout(this.transcriptionTimeout);
          this.onTranscript(event.transcript, event.item_id);
        }
        if (event.type === "output_audio_buffer.stopped" && this.speaking) {
          this.speaking = false;
          this.onSpeakingEnd();
        }
        if (
          event.type === "error" ||
          event.type === "conversation.item.input_audio_transcription.failed" ||
          (event.type === "response.done" && event.response?.status === "failed")
        ) {
          clearTimeout(this.transcriptionTimeout);
          this.onError(realtimeError(event));
        }
  }
  send(event) {
    if (this.dc?.readyState !== "open") throw Error("CONNECTION_LOST");
    this.dc.send(JSON.stringify(event));
  }
  ask(text) {
    this.inputMonitor.stop();
    this.speaking = true;
    this.stream.getTracks().forEach((t) => (t.enabled = false));
    this.send({
      type: "response.create",
      response: {
        instructions: `Read only this question exactly, with no explanation: ${text}`,
      },
    });
  }
  listen() {
    this.awaitingTranscript = false;
    this.send({ type: "input_audio_buffer.clear" });
    this.stream.getTracks().forEach((t) => (t.enabled = true));
    this.inputMonitor.start();
    this.onRecording(null);
    try { this.recorder.start(this.stream); }
    catch { this.onRecordingError(); }
  }
  finish() {
    this.inputMonitor.stop();
    this.awaitingTranscript = true;
    this.transcriptionTimeout = setTimeout(
      () => this.onError(Error("TRANSCRIPTION_TIMEOUT")),
      20000,
    );
    this.recorder.stop().then(blob => {
      if (!this.closed && blob) this.onRecording(blob);
    }).catch(() => this.onRecordingError());
    this.stream.getTracks().forEach((t) => (t.enabled = false));
    this.send({ type: "input_audio_buffer.commit" });
  }
  // Logs to the console when incoming agent audio loses packets or needs concealment,
  // so crackling can be told apart from network problems. Checks every 5 seconds.
  watchPlayback() {
    let last = null;
    this.statsTimer = setInterval(async () => {
      const report = await this.pc?.getStats().catch(() => null);
      report?.forEach((r) => {
        if (r.type !== "inbound-rtp" || r.kind !== "audio") return;
        if (last) {
          const samples = r.totalSamplesReceived - last.totalSamplesReceived;
          const concealed = r.concealedSamples - last.concealedSamples;
          const lost = r.packetsLost - last.packetsLost;
          if (samples > 0 && (lost > 0 || concealed / samples > 0.02))
            console.warn(`[voice] agent audio degraded: ${lost} packets lost, ${(100 * concealed / samples).toFixed(1)}% concealed, jitter ${(r.jitter * 1000).toFixed(0)} ms`);
        }
        last = r;
      });
    }, 5000);
  }
  close() {
    clearInterval(this.statsTimer);
    clearTimeout(this.replyTimer);
    this.closed = true;
    clearTimeout(this.responseRetryTimer);
    this.inputMonitor.close();
    this.recorder.discard();
    this.awaitingTranscript = false;
    this.speaking = false;
    clearTimeout(this.connectionTimeout);
    clearTimeout(this.transcriptionTimeout);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.dc?.close();
    this.pc?.close();
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
    }
  }
}
