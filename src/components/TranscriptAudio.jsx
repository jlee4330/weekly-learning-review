import React, { useEffect, useRef, useState } from 'react';

export function recordingAt(recordings, at) {
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return null;
  return recordings.filter(r => Date.parse(r.startedAt) <= time)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] || null;
}

export default function TranscriptAudio({ session, dashKey, children }) {
  const [recordings, setRecordings] = useState([]), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [active, setActive] = useState(null);
  const [source, setSource] = useState('');
  const offset = useRef(0), part = useRef(0), autoplay = useRef(false);
  const player = useRef(), url = useRef(), request = useRef(0), controller = useRef();
  const base = `/api/dashboard/sessions/${encodeURIComponent(session.id)}/audio`;
  useEffect(() => {
    setLoading(true); setError(''); setRecordings([]); setActive(null); setSource('');
    const abort = new AbortController();
    fetch(base, { headers: { 'X-Dashboard-Key': dashKey }, signal: abort.signal, cache: 'no-store' })
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(data => setRecordings((data.recordings || []).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))))
      .catch(() => { if (!abort.signal.aborted) setError('녹음 목록을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => { abort.abort(); controller.current?.abort(); request.current++; player.current?.pause(); if (url.current) URL.revokeObjectURL(url.current); };
  }, [base, dashKey, session]);
  useEffect(() => {
    if (recordings.length) playRecording(recordings[0], 'all', 0, false);
  }, [recordings]);
  async function replay(m, index) {
    const recording = recordingAt(recordings, m.at);
    if (!recording) return;
    return playRecording(recording, index, Math.max(0, (Date.parse(m.at) - Date.parse(recording.startedAt)) / 1000 - 0.5));
  }
  async function playRecording(recording, index, start = 0, shouldPlay = true) {
    if (!recording) return;
    autoplay.current = shouldPlay;
    part.current = recordings.findIndex(r => r.id === recording.id);
    const version = ++request.current;
    controller.current?.abort(); controller.current = new AbortController();
    player.current?.pause(); setBusy(true); setError(''); setActive(index); setSource('');
    try {
      const response = await fetch(`${base}/${encodeURIComponent(recording.id)}`, {
        headers: { 'X-Dashboard-Key': dashKey }, signal: controller.current.signal, cache: 'no-store',
      });
      if (!response.ok) throw Error('녹음을 불러오지 못했습니다. 다시 재생을 눌러주세요.');
      const blob = await response.blob();
      if (version !== request.current) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      offset.current = start;
      setSource(url.current);
    } catch (e) { if (version === request.current && e.name !== 'AbortError') { setError(e.message); setBusy(false); } }
  }
  function ready(event) {
    const audio = event.currentTarget;
    if (Number.isFinite(audio.duration) && offset.current >= audio.duration) {
      setError('이 발화 시각에 해당하는 녹음 구간이 없습니다.'); setBusy(false); return;
    }
    audio.currentTime = offset.current;
    if (!autoplay.current) { setBusy(false); return; }
    const version = request.current;
    audio.play().catch(() => {
      if (version === request.current) setError('플레이어의 재생 버튼을 눌러주세요.');
    }).finally(() => { if (version === request.current) setBusy(false); });
  }
  const controls = (recordings.length > 0 || error) && <div className="dash-inline-player">
    <audio ref={player} src={source || undefined} controls preload="metadata" aria-label="대화 녹음 재생" onLoadedMetadata={ready}
      onEnded={() => { if (recordings[part.current + 1]) playRecording(recordings[part.current + 1], 'all'); }}
      onError={() => { setBusy(false); setError('녹음을 재생할 수 없습니다. 다시 시도하세요.'); }} />
    {source && <small>{active === 'all' ? `전체 녹음 · ${part.current + 1}/${recordings.length}` : '학생·AI 혼합 녹음 · 발화 시각 기준으로 이동'}</small>}
    {error && <p role="alert">{error}</p>}
  </div>;
  const toolbar = <div className="dash-audio">
      {!loading && !recordings.length && !error && <p>저장된 녹음이 없습니다.</p>}
      {controls}
      {error && recordings.length > 0 && <button type="button" className="dash-replay" onClick={() => playRecording(recordings[part.current] || recordings[0], 'all', 0, false)}>녹음 다시 불러오기</button>}
    </div>;
  return children((m, i) => m.role === 'student' && recordingAt(recordings, m.at) ?
      <div className="dash-turn-audio">
        <button type="button" className="dash-replay" onClick={() => replay(m, i)} aria-label={`학생 발화 ${i + 1} 재생`} aria-busy={active === i && busy}>{active === i && busy ? '불러오는 중…' : active === i && source ? '↻ 이 발화부터 다시 듣기' : '▶ 재생'}</button>
      </div> : null, toolbar);
}
