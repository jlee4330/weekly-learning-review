import React, { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, X } from 'lucide-react';
import { RealtimeConversation } from '../services/conversation-voice';
import { repository } from '../services/api';
import { reviewErrorMessage } from '../services/errors';

export default function ConversationReview({ session, deviceId, onUpdate, onComplete, onLeave }) {
  const t = (en) => en;
  const current = useRef(session), pending = useRef(new Map()), voice = useRef(), timer = useRef(), queue = useRef(Promise.resolve()), url = useRef(''), mounted = useRef(true);
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
    const fail = e => { if (!mounted.current || voice.current !== v) return; setError(reviewErrorMessage(e, session.language)); setState('error'); v.close(); };
    try { await v.begin(current.current, { onMessage: m => { if (mounted.current && voice.current === v) receive(m); }, onState: s => { if (mounted.current && voice.current === v) setState(s); }, onError: fail }); } catch(e) { fail(e); }
  }
  useEffect(() => {
    mounted.current = true; connect();
    const warn = e => { if (pending.current.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => { mounted.current = false; clearTimeout(timer.current); voice.current?.close(); if (url.current) URL.revokeObjectURL(url.current); window.removeEventListener('beforeunload', warn); flush().catch(() => {}); };
  }, []);
  async function action(fn) { setBusy(true); setError(''); try { await fn(); } catch(e) { setError(e.message === 'NO_STUDENT_SPEECH' ? t('Say a little about what you learned before requesting feedback.', '피드백을 받기 전에 배운 내용에 대해 조금 이야기해 주세요.') : reviewErrorMessage(e, session.language)); } finally { if (mounted.current) setBusy(false); } }
  const agent = messages.filter(m => m.role === 'assistant' && m.text).at(-1);
  const labels = { connecting: t('Connecting…', '연결 중…'), listening: t('I’m listening', '이야기를 듣고 있어요'), thinking: t('Thinking with you…', '함께 생각하고 있어요…'), speaking: t('Your learning companion is speaking', '학습 에이전트가 이야기하고 있어요'), paused: t('Conversation paused', '대화가 잠시 멈췄어요'), error: t('Connection interrupted', '연결이 끊어졌어요') };
  return <div className="continuous-conversation">
    <div className="conversation-meta"><span>WEEK {String(session.weekId).padStart(2,'0')}</span><span role="status">{labels[state]}</span></div>
    <section className="agent-utterance"><p className="eyebrow">{t('Let’s talk it through', '함께 이야기해 봐요')}</p><h1>{agent?.text || t('Your conversation is about to begin.', '곧 대화가 시작됩니다.')}</h1></section>
    <section className="conversation-input" aria-label={t('Your microphone', '내 마이크')}><div className="continuous-wave" role="meter" aria-label={t('Microphone input level', '마이크 입력 수준')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((bars.at(-1)||0)*100)}>{bars.map((b,i) => <i key={i} style={{ height: `${4 + b * 48}px` }} />)}</div><p><Mic size={16}/>{state === 'paused' ? t('Microphone paused', '마이크 일시 정지') : state === 'connecting' || state === 'error' ? t('Microphone disconnected', '마이크 연결 대기') : signal === 'muted' || signal === 'disconnected' ? t('Check your microphone', '마이크 연결을 확인해 주세요') : t('Your microphone is on', '마이크가 켜져 있어요')}</p><small>{t('Speak naturally. You can take a moment to think or ask a question.', '편하게 이야기하세요. 잠시 생각하거나 궁금한 것을 물어봐도 좋아요.')}</small></section>
    {error && <div role="alert" className="notice">{error} {!saved && <button onClick={() => action(flush)}>{t('Retry saving', '저장 재시도')}</button>}</div>}
    <div className="conversation-controls">{state === 'error' ? <button onClick={connect}>{t('Reconnect', '다시 연결')}</button> : <button disabled={busy || state === 'connecting'} onClick={() => action(() => state === 'paused' ? voice.current.resume() : voice.current.pause())}>{state === 'paused' ? <Play size={17}/> : <Pause size={17}/>} {state === 'paused' ? t('Resume conversation', '대화 이어하기') : t('Pause', '잠시 멈추기')}</button>}<button disabled={busy || state === 'connecting' || state === 'error'} onClick={() => action(async () => { await voice.current.drain(); await flush(); const done = await repository.complete(current.current); voice.current.close(); onComplete(done); })}><X size={17}/>{busy ? t('Saving…', '저장 중…') : t('End conversation', '대화 마치기')}</button></div>
    {state === 'paused' && <div className="conversation-playback">{recording && <><label>{t('Listen to your voice', '내 목소리 다시 듣기')}</label><audio controls src={recording}/><small>{t('Microphone audio since your last resume. Available only during this visit.', '마지막으로 대화를 시작한 이후의 내 녹음입니다. 현재 화면에서만 재생할 수 있습니다.')}</small></>}<button disabled={busy} onClick={() => action(async () => { await voice.current.drain(); await flush(); onLeave(); })}>{t('Save & leave for now', '저장하고 나가기')}</button></div>}
    <details className="conversation-history"><summary>{t('Conversation transcript', '대화 기록')} <small>{saved ? t('Saved', '저장됨') : t('Saving…', '저장 중…')}</small></summary>{messages.filter(m => m.text).map(m => <div className="transcript-turn" key={m.id}><strong>{m.role === 'student' ? t('You', '나') : t('Learning companion', '학습 에이전트')}</strong><p>{m.text}</p>{!m.complete && <small>{t('Transcription in progress or interrupted', '음성 인식 중이거나 중단된 기록')}</small>}{m.interrupted && <small>{t('Interrupted', '발화 중단됨')}</small>}</div>)}</details>
  </div>;
}
