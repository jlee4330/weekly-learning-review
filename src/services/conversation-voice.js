import { realtimeError, canRetryResponse } from "./realtime-errors.js";
import { RealtimeVoice } from './voice';
import { speechClip } from './speech-clip';
import { conversationConfig } from '../../shared/conversation-config';

// Pause after the student stops before the companion answers; speaking again in this window cancels the reply.
const REPLY_DELAY_MS = 1200;
// The microphone is off while the companion's audio plays, so nothing the student hears or says can cut it off.

export class RealtimeConversation extends RealtimeVoice {
  async begin(session, { onMessage, onState, onError }) {
    this.onMessage = onMessage;
    this.onState = onState;
    this.messages = new Map();
    this.pending = new Set();
    this.speech = []; this.recordingStart = performance.now();
    this.deferred = null; this.replyOnResume = false;
    this.order = Math.max(-1, ...(session.messages || []).map(m => m.order)) + 1;
    await super.connect(session, () => {}, onError, () => {});
    if (this.closed) return;
    for (const m of (session.messages || []).filter(m => m.complete && m.text).slice(-40)) {
      this.send({ type: 'conversation.item.create', item: { type: 'message', role: m.role === 'student' ? 'user' : 'assistant', content: [{ type: m.role === 'student' ? 'input_text' : 'output_text', text: m.text }] } });
    }
    this.openingPending = !session.messages?.some(m => m.role === "assistant" && m.text) && !!this.opening;
    this.openingInstructions = `Speak only the following opening in English, exactly as written, then wait for the student: ${JSON.stringify(this.opening)}`;
    this.resume();
    this.send({ type: 'response.create', ...(!session.messages?.some(m => m.role === 'assistant' && m.text) && this.opening ? { response: { instructions: `Speak only the following opening in English, exactly as written, then wait for the student: ${JSON.stringify(this.opening)}` } } : {}) });
  }
  message(id, role, text, complete, append = false) {
    if (!id) return;
    const old = this.messages.get(id);
    const message = { id, role, text: append ? (old?.text || '') + text : text, complete, order: old?.order ?? this.order++, createdAt: old?.createdAt || new Date().toISOString(), revision: (old?.revision || 0) + 1 };
    this.messages.set(id, message);
    this.onMessage(message);
  }
  handleEvent(e) {
    if (this.closed) return;
    // Recent event types for diagnosing turn-taking (window.__realtimeEvents in the browser console).
    if (typeof window !== 'undefined') { const log = (window.__realtimeEvents ||= []); log.push([Math.round(performance.now()), e.type]); if (log.length > 300) log.shift(); }
    if (e.type === 'input_audio_buffer.speech_started') { clearTimeout(this.replyTimer); this.yieldBeforeSpeaking(); this.speech.push({ start: this.clock() }); this.userSpeaking = true; this.pending.add(e.item_id); this.message(e.item_id, 'student', '', false); this.onState('listening'); }
    if (e.type === 'input_audio_buffer.speech_stopped') { const open = this.speech.at(-1); if (open && open.end === undefined) open.end = this.clock(); this.userSpeaking = false; if (!this.paused) this.onState('thinking'); }
    if (e.type === 'input_audio_buffer.committed') { this.pending.add(e.item_id); this.studentTurnEnded(e.item_id); }
    if (e.type === 'conversation.item.input_audio_transcription.delta') this.message(e.item_id, 'student', e.delta, false, true);
    if (e.type === 'conversation.item.input_audio_transcription.completed') { this.pending.delete(e.item_id); this.message(e.item_id, 'student', e.transcript, true); this.transcribed(e.item_id, e.transcript); }
    if (e.type === 'conversation.item.input_audio_transcription.failed') this.transcribed(e.item_id, '');
    if (e.type === 'response.output_audio_transcript.delta') this.message(e.item_id, 'assistant', e.delta, false, true);
    if (e.type === 'response.output_audio_transcript.done') this.message(e.item_id, 'assistant', e.transcript, true);
    if (e.type === 'response.created') { this.responding = true; if (this.paused) this.send({ type: 'response.cancel' }); else this.onState('thinking'); }
    if (e.type === 'response.done') {
      this.responding = false;
      queueMicrotask(() => this.replyAfterAgent());
      if (e.response?.status === 'completed') this.responseRetries = 0;
      if (canRetryResponse(e) && !this.paused && (this.responseRetries || 0) < 1) {
        this.responseRetries = (this.responseRetries || 0) + 1;
        this.onState('thinking');
        this.responseRetryTimer = setTimeout(() => {
          if (this.closed || this.paused || this.responding || this.userSpeaking || this.playing) return;
          try { this.send({ type: 'response.create', ...(this.openingPending ? { response: { instructions: this.openingInstructions } } : {}) }); }
          catch (error) { this.onError(error); }
        }, 1000);
        return;
      }
      if (e.response?.status === 'completed') this.openingPending = false;
    }
    if (e.type === 'output_audio_buffer.started') { this.playing = true; this.setMic(false); if (!this.paused) this.onState('speaking'); }
    if (e.type === 'output_audio_buffer.stopped' || e.type === 'output_audio_buffer.cleared') { this.playing = false; if (!this.paused) { this.setMic(true); this.onState('listening'); } this.replyAfterAgent(); }
    if (e.type === 'conversation.item.truncated') {
      const m = this.messages.get(e.item_id);
      if (m) { const next = { ...m, interrupted: true, revision: m.revision + 1 }; this.messages.set(m.id, next); this.onMessage(next); }
    }
    if (e.type === 'error' && ['input_audio_buffer_commit_empty', 'response_cancel_not_active'].includes(e.error?.code)) return;
    if (e.type === 'error' || e.type === 'conversation.item.input_audio_transcription.failed' || (e.type === 'response.done' && e.response?.status === 'failed')) this.onError(realtimeError(e));
  }
  // Turn-taking (create_response is off): reply as soon as the student finishes, unless the companion is still
  // talking. Then wait until it finishes and reply only if what the student said transcribed to actual words,
  // so a cough or background noise never cuts it off or triggers a "take your time".
  studentTurnEnded(itemId) {
    if (!this.playing && !this.responding) return this.reply();
    this.deferred ||= { items: new Set(), heard: false };
    this.deferred.items.add(itemId);
  }
  transcribed(itemId, text) {
    if (!this.deferred?.items.delete(itemId)) return;
    if (text?.trim()) this.deferred.heard = true;
    this.replyAfterAgent();
  }
  replyAfterAgent() {
    const d = this.deferred;
    if (!d || this.closed || this.playing || this.responding || d.items.size) return;
    this.deferred = null;
    if (d.heard) this.reply();
  }
  reply() {
    if (this.closed) return;
    if (this.paused) { this.replyOnResume = true; return; }
    clearTimeout(this.replyTimer);
    this.replyTimer = setTimeout(() => {
      if (this.closed || this.paused || this.userSpeaking || this.playing || this.responding) return;
      try { this.send({ type: 'response.create' }); } catch (error) { this.onError(error); }
    }, REPLY_DELAY_MS);
  }
  // The student kept talking while a reply was being prepared but before any audio played: drop that reply and keep listening.
  yieldBeforeSpeaking() {
    if (!this.responding || this.playing) return;
    try { this.send({ type: 'response.cancel' }); } catch (error) { this.onError(error); }
  }
  setMic(on) {
    this.stream?.getTracks().forEach((t) => { t.enabled = on; });
  }
  resume() {
    this.paused = false;
    this.send({ type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: conversationConfig.turnDetection } } } });
    this.stream.getTracks().forEach(t => { t.enabled = true; });
    this.inputMonitor.start();
    this.onRecording(null);
    // Times (s, relative to the recording) when the student spoke, used to cut "your response" playback.
    this.speech = []; this.recordingStart = performance.now();
    try { this.recorder.start(this.stream); } catch { this.onRecordingError(); }
    this.onState('listening');
    if (this.interruptedByPause || this.replyOnResume) { this.interruptedByPause = false; this.replyOnResume = false; this.deferred = null; this.send({ type: 'response.create' }); }
  }
  async pause() {
    if (this.paused) return;
    this.paused = true;
    clearTimeout(this.replyTimer);
    this.interruptedByPause = this.responding || this.playing;
    this.send({ type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: null } } } });
    this.stream.getTracks().forEach(t => { t.enabled = false; });
    this.inputMonitor.stop();
    if (this.responding) this.send({ type: 'response.cancel' });
    if (this.playing) this.send({ type: 'output_audio_buffer.clear' });
    if (this.userSpeaking) { this.send({ type: 'input_audio_buffer.commit' }); this.userSpeaking = false; }
    this.onState('paused');
    const speech = this.speech.map(s => ({ ...s, end: s.end ?? this.clock() }));
    try {
      const blob = await this.recorder.stop();
      if (!blob || this.closed) return;
      // Fall back to the full recording if decoding fails; null means the student did not speak.
      const clip = await speechClip(blob, speech).catch(() => blob);
      if (!this.closed && this.paused) this.onRecording(clip);
    } catch { this.onRecordingError(); }
  }
  clock() { return (performance.now() - this.recordingStart) / 1000; }
  async drain() {
    await this.pause();
    const deadline = Date.now() + 20000;
    while (this.pending.size && !this.closed && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    if (this.pending.size) throw Error('TRANSCRIPTION_TIMEOUT');
  }
}
