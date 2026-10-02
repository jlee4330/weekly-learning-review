import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Pause, Play, RefreshCw, RotateCcw, X } from 'lucide-react';
import { RealtimeConversation } from '../services/conversation-voice';
import { repository } from '../services/api';
import { reviewErrorMessage } from '../services/errors';
import { splitQuestion } from '../services/question-split';
import { weekQuestions } from '../../content/weeks/index.js';

export default function ConversationReview({ session, deviceId, onUpdate, onComplete, onLeave }) {
  const t = (en) => en;
  const current = useRef(session), pending = useRef(new Map()), voice = useRef(), timer = useRef(), queue = useRef(Promise.resolve()), url = useRef(''), mounted = useRef(true), stage = useRef();
  const [messages, setMessages] = useState(session.messages || []), [state, setState] = useState('connecting'), [error, setError] = useState(''), [saved, setSaved] = useState(true), [busy, setBusy] = useState(false), [recording, setRecording] = useState(''), [bars, setBars] = useState(Array(48).fill(0)), [signal, setSignal] = useState('idle');
  function flush() {
    clearTimeout(timer.current); timer.current = null;
    const task = queue.current.catch(() => {}).then(async () => {
      while (pending.current.size) {
        const batch = [...pending.current.values()].slice(0, 20);
        await repository.messages(current.current, batch);
        for (const m of batch) if (pending.current.get(m.id)?.revision === m.revision) pending.current.delete(m.id);
      }
      if (mounted.current) { setSaved(true); onUpdate(current.current); }
    });
    queue.current = task;
    return task;
  }
  function receive(message) {
    const list = current.current.messages.filter(m => m.id !== message.id).concat(message).sort((a,b) => a.order - b.order);
    current.current = { ...current.current, messages: list };
    pending.current.set(message.id, message);
    setMessages(list); setSaved(false);
    if (!timer.current) timer.current = setTimeout(() => { timer.current = null; flush().catch(() => setError(t('Your conversation has not been saved yet. Retry saving before leaving.', '대화가 아직 저장되지 않았습니다. 나가기 전에 저장을 다시 시도해 주세요.'))); }, 1500);
  }
  async function connect() {
    voice.current?.close(); setError(''); setState('connecting');
    const v = new RealtimeConversation({ deviceId, onInput: (level, status) => { if (voice.current !== v) return; setSignal(status); setBars(old => status === 'idle' ? Array(48).fill(0) : [...old.slice(1), level]); }, onRecording: blob => { if (url.current) URL.revokeObjectURL(url.current); url.current = blob ? URL.createObjectURL(blob) : ''; setRecording(url.current); }, onRecordingError: () => setError(t('Audio playback is unavailable in this browser. Your transcript will still be saved.', '이 브라우저에서 녹음 재생을 사용할 수 없습니다. 대화 기록은 계속 저장됩니다.')) });
    voice.current = v;
    const fail = e => { if (!mounted.current || voice.current !== v) return; console.warn('Realtime failure', e.diagnostics || { code: e.message }); setError(reviewErrorMessage(e, session.language)); setState('error'); v.close(); };
    try { await v.begin(current.current, { onMessage: m => { if (mounted.current && voice.current === v) receive(m); }, onState: s => { if (mounted.current && voice.current === v) setState(s); }, onError: fail }); } catch(e) { fail(e); }
  }
  useEffect(() => {
    mounted.current = true; connect();
    const warn = e => { if (pending.current.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => { mounted.current = false; clearTimeout(timer.current); voice.current?.close(); if (url.current) URL.revokeObjectURL(url.current); window.removeEventListener('beforeunload', warn); flush().catch(() => {}); };
  }, []);
  async function action(fn) { setBusy(true); setError(''); try { await fn(); } catch(e) { setError(e.message === 'NO_STUDENT_SPEECH' ? t('Say a little about what you learned before requesting feedback.', '피드백을 받기 전에 배운 내용에 대해 조금 이야기해 주세요.') : reviewErrorMessage(e, session.language)); } finally { if (mounted.current) setBusy(false); } }
  // Stops the voice session, discards unsaved transcript updates and clears the stored conversation.
  async function clearConversation() {
    voice.current?.close(); voice.current = null;
    clearTimeout(timer.current); timer.current = null; pending.current.clear();
    await queue.current.catch(() => {});
    current.current = await repository.reset(current.current);
    setMessages([]); setSaved(true); setRecording(''); onUpdate(current.current);
  }
  // Restart: clear, then reconnect so the opening plays again.
  function reset() {
    if (!confirm(t('Restart this week from the beginning? The conversation so far will be cleared.'))) return;
    action(async () => { await clearConversation(); await connect(); });
  }
  // Back: leaving the conversation resets it, so the next visit starts from the opening.
  function back() {
    if (!confirm(t('Leave this conversation? It will be cleared and start from the beginning next time.'))) return;
    action(async () => { await clearConversation(); onLeave(); });
  }
  // Everything the agent has said since the student last spoke, so a multi-part reply is never replaced by its last piece.
  const lastStudent = messages.findLastIndex(m => m.role === 'student' && m.text?.trim());
  const turnText = messages.slice(lastStudent + 1).filter(m => m.role === 'assistant' && m.text).map(m => m.text.trim()).join(' ');
  const agent = turnText ? { text: turnText } : messages.filter(m => m.role === 'assistant' && m.text).at(-1);
  const guide = weekQuestions[session.weekId];
  const knownQuestions = [guide?.opening, ...(guide?.questions || []).map(q => q.question)].filter(Boolean);
  const [lead, question, tail] = splitQuestion(agent?.text || '', knownQuestions);
  useEffect(() => { const pin = () => { const el = stage.current; if (el) el.scrollTop = el.scrollHeight; }; const frame = requestAnimationFrame(pin); document.fonts?.ready.then(pin); return () => cancelAnimationFrame(frame); }, [agent?.text]);
  const labels = { connecting: t('Connecting…', '연결 중…'), listening: t('I’m listening', '이야기를 듣고 있어요'), thinking: t('Thinking with you…', '함께 생각하고 있어요…'), speaking: t('Speaking…', '학습 에이전트가 이야기하고 있어요'), paused: t('Conversation paused', '대화가 잠시 멈췄어요'), error: t('Connection interrupted', '연결이 끊어졌어요') };
  const micIssue = state === 'listening' && (signal === 'muted' || signal === 'disconnected');
  const level = Math.min(1, (bars.at(-1) + bars.at(-2) + bars.at(-3)) / 3 * 1.6);
  return <div className="continuous-conversation">
    <div className="conversation-meta"><button className="setup-week-link" disabled={busy} onClick={back} aria-label={t('Back to all weekly reviews', '전체 주차별 리뷰로 돌아가기')} title={t('All weekly reviews', '전체 주차별 리뷰')}><span className="setup-week-arrow"><ChevronLeft size={15} /></span><span>WEEK {String(session.weekId).padStart(2,'0')}</span></button><button className="restart-control" disabled={busy} onClick={reset}><RotateCcw size={15}/>{t('Restart', '처음부터 다시 시작')}</button></div>
    <section className="agent-card" ref={stage}>{agent ? <>{lead && <p className="agent-lead">{lead}</p>}{question && <h1 className={`agent-question${question.length > 110 ? ' long' : ''}`}>{question}</h1>}{question && tail && <p className="agent-tail">{tail}</p>}</> : <h1 className="agent-question">{t('Your conversation is about to begin.', '곧 대화가 시작됩니다.')}</h1>}</section>
    <section className="voice-stage" aria-label={t('Your microphone', '내 마이크')}>
      <div className="voice-row">
        <div className="voice-control">
          {state === 'error'
            ? <button className="round-control" onClick={connect} aria-label={t('Reconnect', '다시 연결')}><RefreshCw size={22}/></button>
            : <button className="round-control" disabled={busy || state === 'connecting'} onClick={() => action(() => state === 'paused' ? voice.current.resume() : voice.current.pause())} aria-label={state === 'paused' ? t('Resume conversation', '대화 이어하기') : t('Pause', '잠시 멈추기')}>{state === 'paused' ? <Play size={22}/> : <Pause size={22}/>}</button>}
          <span aria-hidden="true">{state === 'error' ? t('Reconnect') : state === 'paused' ? t('Resume') : t('Pause')}</span>
        </div>
        <div className={`live-orb is-${micIssue ? 'warning' : state}`} style={{ '--level': state === 'listening' ? level : 0 }} role="meter" aria-label={t('Microphone input level', '마이크 입력 수준')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
          <span className="orb-halo" /><span className="orb-ring" /><span className="orb-ring" /><span className="orb-sphere"><i /><i /><i /></span>
        </div>
        <div className="voice-control">
          <button className="round-control end" disabled={busy || state === 'connecting' || state === 'error'} onClick={() => action(async () => { await voice.current.drain(); await flush(); const done = await repository.complete(current.current); voice.current.close(); onComplete(done); })} aria-label={t('End conversation', '대화 마치기')}><X size={22}/></button>
          <span aria-hidden="true">{busy ? t('Saving…') : t('End')}</span>
        </div>
      </div>
      <p className={`voice-status is-${micIssue ? 'warning' : state}`} role="status">{micIssue ? t('Check your microphone', '마이크 연결을 확인해 주세요') : labels[state]}</p>
      <small>{state === 'speaking' ? t('Your microphone is off while I’m speaking.') : state === 'listening' && !micIssue ? t('Take your time — I’ll wait until you finish your thought.') : state === 'paused' ? t('Your microphone is off while paused.') : '\u00a0'}</small>
    </section>
    {error && <div role="alert" className="notice">{error} {!saved && <button onClick={() => action(flush)}>{t('Retry saving', '저장 재시도')}</button>}</div>}
    {state === 'paused' && recording && <div className="conversation-playback"><RecordingAudio src={recording}/></div>}
    <details className="conversation-history"><summary>{t('Conversation transcript', '대화 기록')} <small>{saved ? t('Saved', '저장됨') : t('Saving…', '저장 중…')}</small></summary>{messages.filter(m => m.text).map(m => <div className="transcript-turn" key={m.id}><strong>{m.role === 'student' ? t('You', '나') : t('Learning companion', '학습 에이전트')}</strong><p>{m.text}</p>{!m.complete && <small>{t('Transcription in progress or interrupted', '음성 인식 중이거나 중단된 기록')}</small>}{m.interrupted && <small>{t('Interrupted', '발화 중단됨')}</small>}</div>)}</details>
  </div>;
}

// MediaRecorder WebM files carry no duration, so Chrome shows a broken timeline (Infinity / no seeking).
// Seeking far past the end once forces the browser to scan the file and learn the real duration.
export function RecordingAudio({ src }) {
  const ref = useRef();
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const fix = () => {
      if (Number.isFinite(audio.duration)) return;
      const reset = () => { if (!Number.isFinite(audio.duration)) return; audio.removeEventListener('durationchange', reset); audio.currentTime = 0; };
      audio.addEventListener('durationchange', reset);
      audio.currentTime = 1e101;
    };
    audio.addEventListener('loadedmetadata', fix);
    return () => audio.removeEventListener('loadedmetadata', fix);
  }, [src]);
  return <audio ref={ref} controls preload="metadata" src={src} />;
}
