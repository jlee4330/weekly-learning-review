import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, ArrowLeft } from "lucide-react";
import "../dashboard.css";

// Instructor-only dashboard, opened by the secret link /#/dash/<DASHBOARD_KEY>.
// The key stays in the URL fragment (never sent as part of a request URL) and goes to the API as a header.

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
  if (!p.answered) return { kind: "early", label: "Q1 답변 전 종료" };
  return { kind: "early", label: `Q${p.reached}에서 종료` };
};
const ICON = { done: CheckCircle2, early: CircleAlert, open: CircleDashed };

function Progress({ s }) {
  const { kind, label } = stage(s);
  const Icon = ICON[kind];
  return (
    <span className={`dash-status ${kind}`}>
      <Icon size={14} />{label}
      {kind === "early" && s.progress.answered > 0 && <small>답변 {s.progress.answered}/{s.progress.total}</small>}
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

function StudentView({ id, sessions, onBack }) {
  const mine = sessions.filter((s) => s.studentId === id).sort((a, b) => a.weekId - b.weekId);
  return (
    <section className="dash-student">
      <button className="dash-back" onClick={onBack}><ArrowLeft size={16} /> 전체 목록</button>
      <h2>{id}</h2>
      {mine.map((s) => (
        <article key={s.id} className="dash-week">
          <header>
            <h3>Week {s.weekId}</h3>
            <Progress s={s} />
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
  const [week, setWeek] = useState("all");
  const [show, setShow] = useState("all");
  const [student, setStudent] = useState(() => decodeURIComponent(location.hash.split("/")[3] || ""));

  useEffect(() => { (async () => {
    try {
      const r = await fetch("/api/dashboard", { headers: { "X-Dashboard-Key": dashKey }, cache: "no-store", signal: AbortSignal.timeout(30000) })
        .catch((e) => { throw Error(e.name === "TimeoutError" ? "서버 응답이 없습니다. 페이지를 새로고침해 다시 시도하세요." : "서버에 연결할 수 없습니다."); });
      if (r.status === 503 && (await r.clone().json().catch(() => ({}))).error === "DASHBOARD_KEY_NOT_SET")
        throw Error("서버에 DASHBOARD_KEY가 설정되지 않았습니다. 배포 환경 변수에 추가한 뒤 다시 배포하세요.");
      if (!r.ok) throw Error(r.status === 404 ? "링크가 올바르지 않습니다. (서버의 DASHBOARD_KEY와 다릅니다)"
        : [502, 503, 504].includes(r.status) ? "API 서버가 응답하지 않습니다. 서버가 켜져 있는지 확인하고 페이지를 새로고침하세요."
        : `불러오기 실패 (${r.status})`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
  })(); }, []);
  useEffect(() => {
    document.title = "Review Dashboard";
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  // Keep the selected student in the fragment so a reload stays on the same page.
  const open = (id) => {
    setStudent(id);
    history.replaceState(null, "", `#/dash/${dashKey}${id ? `/${encodeURIComponent(id)}` : ""}`);
    window.scrollTo(0, 0);
  };

  const sessions = data?.sessions || [];
  const weeks = useMemo(() => [...new Set(sessions.map((s) => s.weekId))].sort((a, b) => a - b), [sessions]);
  const inWeek = useMemo(() => sessions
    .filter((s) => week === "all" || s.weekId === Number(week)), [sessions, week]);
  const count = (kind) => inWeek.filter((s) => stage(s).kind === kind).length;
  const rows = inWeek
    .filter((s) => show === "all" || stage(s).kind === show)
    .sort((a, b) => a.studentId.localeCompare(b.studentId) || a.weekId - b.weekId);

  return (
    <main className="dash">
      <header className="dash-top">
        <div>
          <h1>Weekly Review Dashboard</h1>
          {data && <small>업데이트 {when(data.generatedAt)}</small>}
        </div>
      </header>
      {error && <p className="dash-error">{error}</p>}
      {!data && !error && <p className="dash-empty">불러오는 중…</p>}
      {data && (student ? (
        <StudentView id={student} sessions={sessions} onBack={() => open("")} />
      ) : (
        <>
          <div className="dash-filters">
            <div className="dash-seg" role="group" aria-label="진행 상태">
              {[["all", "전체", inWeek.length], ["done", "끝까지 완료", count("done")], ["early", "중간 종료", count("early")], ["open", "진행 중", count("open")]]
                .filter(([k, , n]) => k === "all" || n > 0)
                .map(([k, label, n]) => (
                  <button key={k} className={show === k ? "on" : ""} aria-pressed={show === k} onClick={() => setShow(k)}>{label} <small>{n}</small></button>
                ))}
            </div>
            <select value={week} onChange={(e) => setWeek(e.target.value)} aria-label="주차">
              <option value="all">전체 주차</option>
              {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>학생</th><th>주차</th><th>진행</th>
                  <th className="num">세션 시간</th><th className="num">학생 발화</th><th>시작</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} onClick={() => open(s.studentId)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(s.studentId)}>
                    <td><b>{s.studentId}</b></td>
                    <td>Week {s.weekId}</td>
                    <td><Progress s={s} /></td>
                    <td className="num">{dur(s.sessionMs)}</td>
                    <td className="num">{s.studentSentences}문장</td>
                    <td>{when(s.createdAt)}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={6} className="dash-empty">세션이 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ))}
    </main>
  );
}
