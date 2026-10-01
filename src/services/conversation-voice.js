import { RealtimeVoice } from './voice';
import { conversationConfig } from '../../shared/conversation-config';

export class RealtimeConversation extends RealtimeVoice {
  async begin(session, { onMessage, onState, onError }) {
    this.onMessage = onMessage;
    this.onState = onState;
    this.messages = new Map();
    this.pending = new Set();
    this.order = Math.max(-1, ...(session.messages || []).map(m => m.order)) + 1;
    await super.connect(session, () => {}, onError, () => {});
    if (this.closed) return;
    for (const m of (session.messages || []).filter(m => m.complete && m.text).slice(-40)) {
      this.send({ type: 'conversation.item.create', item: { type: 'message', role: m.role === 'student' ? 'user' : 'assistant', content: [{ type: m.role === 'student' ? 'input_text' : 'output_text', text: m.text }] } });
    }
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
    if (e.type === 'input_audio_buffer.speech_started') { this.userSpeaking = true; this.pending.add(e.item_id); this.message(e.item_id, 'student', '', false); this.onState('listening'); }
    if (e.type === 'input_audio_buffer.speech_stopped') { this.userSpeaking = false; if (!this.paused) this.onState('thinking'); }
    if (e.type === 'input_audio_buffer.committed') this.pending.add(e.item_id);
    if (e.type === 'conversation.item.input_audio_transcription.delta') this.message(e.item_id, 'student', e.delta, false, true);
    if (e.type === 'conversation.item.input_audio_transcription.completed') { this.pending.delete(e.item_id); this.message(e.item_id, 'student', e.transcript, true); }
    if (e.type === 'response.output_audio_transcript.delta') this.message(e.item_id, 'assistant', e.delta, false, true);
    if (e.type === 'response.output_audio_transcript.done') this.message(e.item_id, 'assistant', e.transcript, true);
    if (e.type === 'response.created') { this.responding = true; if (this.paused) this.send({ type: 'response.cancel' }); else this.onState('thinking'); }
    if (e.type === 'response.done') this.responding = false;
    if (e.type === 'output_audio_buffer.started') { this.playing = true; if (!this.paused) this.onState('speaking'); }
    if (e.type === 'output_audio_buffer.stopped' || e.type === 'output_audio_buffer.cleared') { this.playing = false; if (!this.paused) this.onState('listening'); }
    if (e.type === 'conversation.item.truncated') {
      const m = this.messages.get(e.item_id);
      if (m) { const next = { ...m, interrupted: true, revision: m.revision + 1 }; this.messages.set(m.id, next); this.onMessage(next); }
    }
    if (e.type === 'error' && ['input_audio_buffer_commit_empty', 'response_cancel_not_active'].includes(e.error?.code)) return;
    if (e.type === 'error' || e.type === 'conversation.item.input_audio_transcription.failed' || (e.type === 'response.done' && e.response?.status === 'failed')) this.onError(Error(e.error?.code || 'VOICE_REQUEST_FAILED'));
  }
  resume() {
    this.paused = false;
    this.send({ type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: conversationConfig.turnDetection } } } });
    this.stream.getTracks().forEach(t => { t.enabled = true; });
    this.inputMonitor.start();
    this.onRecording(null);
    try { this.recorder.start(this.stream); } catch { this.onRecordingError(); }
    this.onState('listening');
    if (this.interruptedByPause) { this.interruptedByPause = false; this.send({ type: 'response.create' }); }
  }
  async pause() {
    if (this.paused) return;
    this.paused = true;
    this.interruptedByPause = this.responding || this.playing;
    this.send({ type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: null } } } });
    this.stream.getTracks().forEach(t => { t.enabled = false; });
    this.inputMonitor.stop();
    if (this.responding) this.send({ type: 'response.cancel' });
    if (this.playing) this.send({ type: 'output_audio_buffer.clear' });
    if (this.userSpeaking) { this.send({ type: 'input_audio_buffer.commit' }); this.userSpeaking = false; }
    this.onState('paused');
    try { const blob = await this.recorder.stop(); if (blob && !this.closed) this.onRecording(blob); } catch { this.onRecordingError(); }
  }
  async drain() {
    await this.pause();
    const deadline = Date.now() + 20000;
    while (this.pending.size && !this.closed && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    if (this.pending.size) throw Error('TRANSCRIPTION_TIMEOUT');
  }
}
