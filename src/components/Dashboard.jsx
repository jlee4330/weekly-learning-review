import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, ArrowLeft, RefreshCw } from "lucide-react";
import "../dashboard.css";

// Instructor-only dashboard, opened by the secret link /#/dash/<DASHBOARD_KEY>.
// The key stays in the URL fragment (never sent as part of a request URL) and goes to the API as a header.

// Instructor confirmed Week 2's deadline has passed (2026-10-17).
// Missing records are marked in the dashboard; persisted late flags survive later submissions.
const closedWeeks = [2];

const dur = (ms) => {
  if (ms == null) return "–";
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
};
const when = (iso) => (iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
const clock = (iso, start) => (iso && start ? dur(Date.parse(iso) - Date.parse(start)) : "");

// How far the student got: all questions done, stopped partway (End can be pressed at any time), or still open.
const stage = (s) => {
  const p = s.progress;
  if (!p.total) return { kind: "open", label: "고정 질문 없음" };
  if (p.finished) return { kind: "done", label: `${p.total}/${p.total} 완료` };
  if (s.status !== "completed") return { kind: "open", label: `진행 중 · Q${p.reached || 1}` };
  if (s.weekId === 1) return { kind: "early", label: `${p.answered}/${p.total} 완료` };
  if (!p.answered) return { kind: "early", label: "Q1 답변 전 종료" };
  return { kind: "early", label: `Q${p.reached}에서 종료` };
};
const ICON = { done: CheckCircle2, early: CircleAlert, open: CircleDashed };

function LateBadge() {
  return <span className="dash-status late" title="마감 후 기록 미제출로 확인됨"><CircleAlert size={14} />Late</span>;
}

function Progress({ s }) {
  const { kind, label } = stage(s);
  const Icon = ICON[kind];
  return (
    <span className={`dash-status ${kind}`}>
      <Icon size={14} />{label}
      {kind === "early" && s.weekId !== 1 && s.progress.answered > 0 && <small>답변 {s.progress.answered}/{s.progress.total}</small>}
    </span>
  );
}

function Transcript({ s }) {
  if (!s.transcript.length)
    return <p className="dash-empty">저장된 transcript가 없습니다. (End를 누르기 전에는 저장되지 않습니다)</p>;
  const start = s.transcript[0].at;
  const topics = Object.fromEntries(s.progress.perQuestion.map((q) => [q.n, q.topic]));
  const { kind } = stage(s);
  return (
    <ol className="dash-transcript">
      {s.transcript.map((m, i) => (
        <React.Fragment key={i}>
        {m.idleBefore && <li className="dash-idle">{dur(m.idleBefore)} 동안 대화 없음 (시간 계산에서 제외)</li>}
        <li className={m.role}>
          <div className="dash-meta">
            <b>{m.role === "student" ? s.studentId : "Agent"}</b>
            {m.question && <span className="dash-q">Q{m.question}</span>}
            {m.question && topics[m.question] && <span>{topics[m.question]}</span>}
            {m.closing && <span className="dash-q close">마무리</span>}
            <time>{clock(m.at, start)}</time>
          </div>
          <p>{m.text}</p>
        </li>
        </React.Fragment>
      ))}
      {kind === "early" && <li className="dash-end">여기서 End conversation을 눌렀습니다 (Q{s.progress.reached} 진행 중)</li>}
    </ol>
  );
}

function StudentView({ id, sessions, week, onBack }) {
  const mine = sessions.filter((s) => s.studentId === id && (!week || s.weekId === week)).sort((a, b) => a.weekId - b.weekId);
  return (
    <section className="dash-student">
      <button className="dash-back" onClick={onBack}><ArrowLeft size={16} /> 전체 목록</button>
      <h2>{id}</h2>
      {mine.map((s) => (
        <article key={s.id} className="dash-week">
          <header>
            <h3>Week {s.weekId}</h3>
            <Progress s={s} />
            {s.late && <LateBadge />}
            <dl>
              <div><dt>소요 시간</dt><dd>{dur(s.talkMs)}</dd></div>
              <div><dt>세션 시간</dt><dd>{dur(s.sessionMs)}</dd></div>
              <div><dt>학생 발화</dt><dd>{s.studentTurns}회 · {s.studentSentences}문장</dd></div>
              <div><dt>시작</dt><dd>{when(s.createdAt)}</dd></div>
            </dl>
            {s.progress.total > 0 && (
              <ul className="dash-qtimes">
                {Array.from({ length: s.progress.total }, (_, k) => {
                  const q = s.progress.perQuestion.find((x) => x.n === k + 1);
                  return (
                    <li key={k} className={!q ? "missed" : q.answered ? "" : "unanswered"}>
                      <b>Q{k + 1}</b> {q ? `${dur(q.ms)} · ${q.sentences}문장${q.answered ? "" : " · 답변 없음"}` : "도달 못 함"}
                    </li>
                  );
                })}
              </ul>
            )}
          </header>
          <Transcript s={s} />
        </article>
      ))}
    </section>
  );
}

export default function Dashboard({ dashKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState(() => Number(location.hash.split("/")[4]) || null);
  const [student, setStudent] = useState(() => decodeURIComponent(location.hash.split("/")[3] || ""));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
    try {
      const r = await fetch("/api/dashboard", { headers: { "X-Dashboard-Key": dashKey }, cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })
        .catch((e) => { throw Error(e.name === "TimeoutError" ? "서버 응답이 없습니다. 새로고침 버튼으로 다시 시도하세요." : "서버에 연결할 수 없습니다."); });
      if (!r.ok) throw Error(r.status === 404 ? "링크가 올바르지 않습니다."
        : [502, 503, 504].includes(r.status) ? "API 서버가 응답하지 않습니다. 서버가 켜져 있는지 확인하고 새로고침 버튼으로 다시 시도하세요."
        : `불러오기 실패 (${r.status})`);
      const next = await r.json();
      if (!controller.signal.aborted) setData(next);
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    })();
    return () => controller.abort();
  }, [dashKey, refresh]);
  useEffect(() => {
    document.title = "Review Dashboard";
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  // Keep the selected student in the fragment so a reload stays on the same page.
  const open = (id, week = null) => {
    setStudent(id);
    setSelectedWeek(week);
    history.replaceState(null, "", `#/dash/${dashKey}${id ? `/${encodeURIComponent(id)}${week ? `/${week}` : ""}` : ""}`);
    window.scrollTo(0, 0);
  };

  const sessions = data?.sessions || [];
  const weeks = useMemo(() => [...new Set([...closedWeeks, ...sessions.map((s) => s.weekId)])].sort((a, b) => a - b), [sessions]);
  const weekTimes = useMemo(() => Object.fromEntries(weeks.map(w => {
    const timed = sessions.filter(s => s.weekId === w && s.status === "completed" && Number.isFinite(s.talkMs) && s.talkMs >= 0);
    return [w, { count: timed.length, average: timed.length ? timed.reduce((sum, s) => sum + s.talkMs, 0) / timed.length : null }];
  })), [sessions, weeks]);
  const students = useMemo(() => {
    const completedWeeks = new Map();
    for (const s of sessions) {
      if (![1, 2].includes(s.weekId) || s.status !== "completed" || !s.progress.finished) continue;
      if (!completedWeeks.has(s.studentId)) completedWeeks.set(s.studentId, new Set());
      completedWeeks.get(s.studentId).add(s.weekId);
    }
    return [...new Set(sessions.map(s => s.studentId))].sort((a, b) =>
      (completedWeeks.get(b)?.size || 0) - (completedWeeks.get(a)?.size || 0)
      || a.localeCompare(b));
  }, [sessions]);

  return (
    <main className="dash">
      <header className="dash-top">
        <div>
          <h1>Weekly Review Dashboard</h1>
          {data && <small>업데이트 {when(data.generatedAt)}</small>}
        </div>
        <button type="button" className="dash-refresh" onClick={() => setRefresh(value => value + 1)} disabled={loading} aria-busy={loading}>
          <RefreshCw size={16} aria-hidden="true" />{loading ? "불러오는 중…" : "새로고침"}
        </button>
      </header>
      {error && <p className="dash-error" role="alert">{error}{data && " 기존 데이터를 표시하고 있습니다."}</p>}
      {!data && !error && <p className="dash-empty">불러오는 중…</p>}
      {data && (student ? (
        <StudentView id={student} sessions={sessions} week={selectedWeek} onBack={() => open("")} />
      ) : (
            <section className="dash-overview" aria-label="학생별 주차 현황">
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead><tr><th scope="col" className="dash-number">번호</th><th scope="col">학생</th>{weeks.map(w => <th scope="col" key={w}>Week {w}<small className="dash-average">평균 대화 {dur(weekTimes[w].average)} · {weekTimes[w].count}건 기준</small></th>)}</tr></thead>
                  <tbody>{students.map((id, index) => (
                    <tr key={id}>
                      <td className="dash-number">{index + 1}</td>
                      <th scope="row"><button className="dash-student-link" onClick={() => open(id)}>{id}</button></th>
                      {weeks.map(w => {
                        const s = sessions.find(s => s.studentId === id && s.weekId === w);
                        return <td key={w} className={s ? "dash-week-cell" : undefined}>{s ? <button className="dash-week-link" aria-label={`${id} Week ${w} 대화 기록 보기`} onClick={() => open(id, w)}><Progress s={s} />{s.late && <LateBadge />}<small className="dash-average">대화 시간 {dur(s.status === "completed" && Number.isFinite(s.talkMs) && s.talkMs >= 0 ? s.talkMs : null)}</small></button> : (closedWeeks.includes(w) || data.lateStudentsByWeek?.[w]?.includes(id)) ? <LateBadge /> : <span className="dash-muted">기록 없음</span>}</td>;
                      })}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>

      ))}
    </main>
  );
}
