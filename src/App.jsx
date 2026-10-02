import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Lock,
  CheckCircle2,
  ChevronLeft,
  LogOut,
  ChevronDown,
  Mic,
  MicOff,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { weeks, titleOf, objectiveOf } from "../shared/questions";
import { isWeekUnlocked } from "../shared/config";
import { currentQuestion } from "../shared/engine";
import { isDemo, isLocal, localUser, requiresLogin, repository, auth, logout } from "./services/api";
import { onAuthStateChanged } from "firebase/auth";
import { checkMicrophone, speakDemo, RealtimeVoice } from "./services/voice";
import { microphoneError } from "./services/microphone";
import { reviewErrorMessage } from "./services/errors";
import ConversationReview from "./components/ConversationReview";
// A session only counts as started once someone has actually spoken (or a demo draft was saved).
const hasStarted = (s) => !!s && (s.mode === "conversation" ? s.messages?.some((m) => m.text?.trim()) : s.turns?.length > 0 || !!s.draft?.trim());
import LoginDialog from "./components/LoginDialog";
function App() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [done, setDone] = useState("");
  useEffect(() => { if (!done) return; const id = setTimeout(() => setDone(""), 6000); return () => clearTimeout(id); }, [done]);
  const lang = "en";
  const [page, setPage] = useState("reviews");
  const [sessions, setSessions] = useState([]),
    [session, setSession] = useState(null),
    [week, setWeek] = useState(null),
    [user, setUser] = useState(auth?.currentUser || localUser),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("all");
  const [answer, setAnswer] = useState(""),
    [phase, setPhase] = useState("ready"),
    [mic, setMic] = useState("idle"),
    [level, setLevel] = useState(0),
    [micDevice, setMicDevice] = useState(""),
    [micDevices, setMicDevices] = useState([]),
    [selectedMic, setSelectedMic] = useState(""),
    [micSignal, setMicSignal] = useState("waiting"),
    [saveState, setSaveState] = useState(""),
    [recordingUrl, setRecordingUrl] = useState(""),
    [playbackUnavailable, setPlaybackUnavailable] = useState(false),
    [inputVisual, setInputVisual] = useState({ bars: Array(48).fill(0), status: "idle" }),
    [exitOpen, setExitOpen] = useState(false);
  const voice = useRef(null),
    stopMic = useRef(null),
    micAbort = useRef(null),
    accountMenu = useRef(null),
    stopSpeech = useRef(null),
    sessionRef = useRef(null),
    draftQueue = useRef(Promise.resolve()),
    recordingUrlRef = useRef(""),
    playback = useRef(null),
    listenAfterQuestion = useRef(true),
    answerRef = useRef("");
  const l = "en";
  const t = (en) => en;
  useEffect(() => { document.documentElement.lang = "en"; localStorage.removeItem("wlr-language"); }, []);
  useEffect(() => {
    if (auth) return onAuthStateChanged(auth, setUser);
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!isDemo && !user) {
      setSessions([]);
      setSession(null);
      sessionRef.current = null;
      cleanup();
      setPage("reviews");
      return;
    }
    repository
      .list()
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            t(
              "Unable to load your reviews. Please retry.",
              "리뷰를 불러오지 못했습니다. 다시 시도해 주세요.",
            ),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [user]);
  useEffect(() => {
    const handler = () => {
      if (sessionRef.current && ["review", "conversation"].includes(page)) return;
      setPage("reviews");
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [page]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => () => cleanup(), []);
  useEffect(() => {
    const close = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "keydown" || !accountMenu.current?.contains(event.target)) {
        if (accountMenu.current) accountMenu.current.open = false;
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {document.removeEventListener("pointerdown", close);document.removeEventListener("keydown", close);};
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [page, session?.index, session?.followUp?.id]);
  function clearRecording() {
    playback.current?.pause();
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = "";
    setRecordingUrl("");
    setPlaybackUnavailable(false);
  }
  function cleanup() {
    clearRecording();
    micAbort.current?.abort();
    stopMic.current?.();
    stopMic.current = null;
    stopSpeech.current?.();
    voice.current?.close();
    voice.current = null;
  }
  // Ending a conversation returns to the list with a short congratulation. Only the transcript is kept; no AI evaluation runs.
  function finishConversation(s) {
    update(s);
    navigate("reviews");
    setDone(`Nice work! You've finished your Week ${String(s.weekId).padStart(2, "0")} review.`);
  }
  function navigate(p) {
    if (page === "review") {
      setExitOpen(true);
      return;
    }
    cleanup();
    setError("");
    setPage(p);
    location.hash = "reviews";
  }
  function update(s) {
    if (s && requiresLogin && auth.currentUser?.uid !== s.studentId) return;
    sessionRef.current = s;
    setSession(s);
    if (s) setSessions((old) => [s, ...old.filter((x) => x.id !== s.id)]);
  }
  // Background saves and feedback may finish after the student chooses another week.
  function refreshSession(s) {
    if (requiresLogin && auth.currentUser?.uid !== s.studentId) return;
    setSessions(old => [s, ...old.filter(x => x.id !== s.id)]);
    if (sessionRef.current?.id === s.id) {
      sessionRef.current = s;
      setSession(s);
    }
  }
  async function evaluateSession(s) {
    refreshSession({ ...s, evaluationStatus: "processing" });
    try { refreshSession(await repository.evaluate(s)); }
    catch (e) {
      refreshSession({ ...s, evaluationStatus: "failed" });
      if (sessionRef.current?.id === s.id) setError(reviewErrorMessage(e, "en"));
    }
  }
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(reviewErrorMessage(e, l));
      console.error(e);
    } finally {
      setBusy(false);
    }
  }
  // Clears every conversation of the signed-in student (local storage only) and reloads the list.
  function resetAll() {
    if (!confirm(t("Reset every week? All your conversations will be cleared."))) return;
    navigate("reviews");
    run(async () => {
      update(null);
      setSessions(await repository.resetAll());
    });
  }
  function choose(w, s) {
    cleanup();
    setWeek(w);
    setMic("idle");
    setError("");
    if (s?.status === "completed") {
      update(s);
      setPage("feedback");
    } else {
      update(s || null);
      setPage("setup");
    }
  }
  async function testMic(deviceId = selectedMic) {
    micAbort.current?.abort();
    stopMic.current?.();
    const controller = new AbortController();
    micAbort.current = controller;
    setError(""); setLevel(0); setMicDevice(""); setMicSignal("waiting"); setMic("checking");
    try {
      const stop = await checkMicrophone(setLevel, {signal: controller.signal, deviceId, onDevice:setMicDevice, onDevices:setMicDevices, onStatus:setMicSignal, onError:(error)=>{if(!controller.signal.aborted){setMic("error");setError(microphoneError(error,l));}}});
      if (controller.signal.aborted) {stop();return;}
      stopMic.current = stop;
      setMic("ready");
    } catch (error) {
      if(controller.signal.aborted)return;
      setMic("error");
      setError(microphoneError(error,l));
    }
  }

  function stopMicTest(){micAbort.current?.abort();stopMic.current?.();stopMic.current=null;setLevel(0);setMic("idle");setMicSignal("waiting");}
  async function start() {
    await run(async () => {
      micAbort.current?.abort();
      stopMic.current?.();
      stopMic.current = null;
      let s = session?.weekId === week.id && session.status === "in_progress"
        ? session : await repository.create(week.id, lang);
      if (!isDemo) {
        s = await repository.openConversation(s);
        update(s);
        setPage("conversation");
        return;
      }
      update(s);
      const draft = s.pendingDecision ? s.turns.at(-1).answer : s.draft || "";
      setAnswer(draft);
      answerRef.current = draft;
      setPage("review");
      setPhase("ready");
      if (!isDemo) await connectVoice(s);
    });
  }
  async function connectVoice(s) {
    setPhase("connecting");
    voice.current?.close();
    const v = new RealtimeVoice({
      deviceId: selectedMic,
      onRecording: (blob) => {
        if (voice.current !== v) return;
        clearRecording();
        if (blob) {
          recordingUrlRef.current = URL.createObjectURL(blob);
          setRecordingUrl(recordingUrlRef.current);
        }
      },
      onRecordingError: () => { if (voice.current === v) setPlaybackUnavailable(true); },
      onInput: (level, status) => {
        if (voice.current !== v) return;
        setInputVisual(old => ({
          bars: status === "idle" ? Array(48).fill(0) : [...old.bars.slice(1), level],
          status,
        }));
      },
    });
    voice.current = v;
    try {
      await v.connect(
        s,
        (text) => {
          if (voice.current !== v) return;
          setPhase("recorded");
          const transcript = [answerRef.current, text].filter(Boolean).join(" ").trim();
          if (!transcript) {
            setError(t("No speech was captured. Try recording your answer again.", "음성이 인식되지 않았습니다. 답변을 다시 녹음해 주세요."));
            return;
          }
          changeAnswer(transcript);
        },
        () => {
          if (voice.current !== v) return;
          v.close();
          setPhase("error");
          setError(
            t(
              "Voice connection interrupted. Saved text is preserved. Reconnect to continue.",
              "음성 연결이 끊겼습니다. 저장된 텍스트는 보존됩니다. 다시 연결해 주세요.",
            ),
          );
        },
        () => {
          if (voice.current !== v) return;
          if (listenAfterQuestion.current) {
            setPhase("answering");
            v.listen();
          } else setPhase("recorded");
        },
      );
      if (voice.current !== v) return;
      if (answerRef.current.trim() || s.pendingDecision) setPhase("recorded");
      else {
        listenAfterQuestion.current = true;
        setPhase("speaking");
        v.ask(currentQuestion(s).text);
      }
    } catch (e) {
      if (voice.current !== v) return;
      setPhase("error");
      throw e;
    }
  }
  function changeAnswer(value) {
    setAnswer(value);
    answerRef.current = value;
    setSaveState("saving");
    const s = sessionRef.current;
    draftQueue.current = draftQueue.current
      .catch(() => {})
      .then(() => repository.draft({ ...s, draft: value }, value))
      .then(() => {
        setSaveState("saved");
        setSessions((old) =>
          old.map((x) => (x.id === s.id ? { ...x, draft: value } : x)),
        );
      })
      .catch(() => {
        setSaveState("failed");
        throw Error("DRAFT_SAVE_FAILED");
      });
    draftQueue.current.catch(() => {});
  }
  function ask() {
    playback.current?.pause();
    listenAfterQuestion.current = !answerRef.current.trim();
    setPhase("speaking");
    setError("");
    if (isDemo)
      stopSpeech.current = speakDemo(
        currentQuestion(session).text,
        session.language,
        () => setPhase("answering"),
      );
    else
      try {
        voice.current.ask(currentQuestion(session).text);
      } catch {
        setPhase("error");
      }
  }
  async function redoAnswer() {
    await run(async () => {
      stopSpeech.current?.();
      clearRecording();
      changeAnswer("");
      await draftQueue.current;
      if (!isDemo) voice.current.listen();
      setPhase("answering");
    });
  }
  function finishAnswer() {
    if (!isDemo && phase === "answering") {
      try {
        setPhase("transcribing");
        voice.current.finish();
      } catch {
        setPhase("error");
      }
    } else submit();
  }
  async function submit(text = answerRef.current) {
    await run(async () => {
      playback.current?.pause();
      stopSpeech.current?.();
      setPhase("preparing");
      await draftQueue.current;
      const s = await repository.answer(sessionRef.current, text);
      clearRecording();
      update(s);
      setAnswer("");
      answerRef.current = "";
      setSaveState("");
      if (s.status === "completed") {
        cleanup();
        setPage("feedback");
        evaluateSession(s);
      }
      if (s.status !== "completed" && !isDemo && voice.current) {
        listenAfterQuestion.current = true;
        setPhase("speaking");
        voice.current.ask(currentQuestion(s).text);
      } else setPhase("ready");
    });
    if (sessionRef.current?.status !== "completed" && answerRef.current) setPhase("recorded");
  }
  async function pause() {
    await run(async () => {
      await draftQueue.current;
      cleanup();
      setExitOpen(false);
      setPage("reviews");
      location.hash = "reviews";
    });
  }
  const completed = sessions.filter((s) => s.status === "completed").length;
  const latest = (id) => sessions.find((s) => s.weekId === id);
  return (
    <div className="app-shell">
      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)}/>}
      <div className="workspace">
          <div className="utility-controls">
            {isLocal && user && <button className="reset-all" disabled={busy} onClick={resetAll}><RotateCcw size={14}/>{t("Reset all")}</button>}
            {isDemo || user ? (
              <details className="account-menu" ref={accountMenu}>
                <summary aria-label={t("Account information", "계정 정보")}>
                  <span className="avatar">{isDemo ? "S" : user?.displayName?.[0] || "S"}</span>
                  <span className="account-name">{isDemo ? t("Demo student", "데모 학생") : !requiresLogin && isLocal ? t("Local session", "로컬 세션") : user.displayName || user.email || t("Student", "학생")}</span>
                  <ChevronDown size={13}/>
                </summary>
                <div className="account-popover">
                  <span className="account-label">{!requiresLogin && isLocal ? t("THIS COMPUTER", "현재 컴퓨터") : t("YOUR ACCOUNT", "내 계정")}</span>
                  <strong>{isDemo ? t("Demo student", "데모 학생") : !requiresLogin && isLocal ? t("Local session", "로컬 세션") : user.displayName || user.email || t("Student", "학생")}</strong>
                  <small>{isDemo ? t("Local device · not signed in", "현재 기기 · 로그인되지 않음") : !requiresLogin && isLocal ? t("Live voice · reviews saved on this computer. No cloud account connected.", "실제 음성 연결 · 리뷰는 이 컴퓨터에 저장됩니다. 클라우드 계정은 연결되지 않았습니다.") : user.email}</small>
                  {requiresLogin && <button onClick={()=>run(logout)} disabled={busy}><LogOut size={15}/>{t("Sign out", "로그아웃")}</button>}
                </div>
              </details>
            ) : <button className="header-login" disabled={busy} onClick={()=>setLoginOpen(true)}>Sign in</button>}
          </div>
        <main id="main">
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label={t("Dismiss", "닫기")}
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page === "reviews" && (
            <div className="reviews-page">
              {done && <div className="done-banner" role="status"><CheckCircle2 size={20}/><span>{done}</span><button className="icon-button" aria-label="Dismiss" onClick={() => setDone("")}><X size={16}/></button></div>}
              <div className="eyebrow">
                ID40018 DDASD
              </div>
              <div className="review-title-row">
                <h1>Weekly Learning Review</h1>
              </div>
              <p className="lead">
                {t(
                  "Talk through key concepts. Explain your thinking. Connect what you’ve learned.",
                  "핵심 개념을 말로 풀어보세요. 자신의 생각을 설명하고, 배운 내용을 연결해 보세요.",
                )}
              </p>
              <div className="review-summary">
                <div>
                  <span className="summary-icon">
                    <BookOpen size={23} />
                  </span>
                  <div>
                    <strong>
                      {t(
                        "Your learning, in progress",
                        "차근차근 쌓이는 나의 이해",
                      )}
                    </strong>
                    <p>
                      {t(
                        `${completed} completed · 14 weekly conversations`,
                        `${completed}개 완료 · 14개의 주차별 대화`,
                      )}
                    </p>
                  </div>
                </div>
                <div className="summary-progress">
                  <span>{completed} / 14</span>
                  <div>
                    <i
                      style={{ width: `${Math.min(completed / 14, 1) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="tabs">
                {[
                  ["all", "All weeks", "전체 주차"],
                  ["open", "To explore", "미완료"],
                  ["done", "Completed", "완료"],
                ].map(([v, en, ko]) => (
                  <button
                    key={v}
                    className={filter === v ? "selected" : ""}
                    onClick={() => setFilter(v)}
                  >
                    {t(en, ko)}
                  </button>
                ))}
              </div>
              <div className="week-list">
                {weeks
                  .filter(
                    (w) =>
                      filter === "all" ||
                      (filter === "done"
                        ? latest(w.id)?.status === "completed"
                        : w.reviewAvailable && isWeekUnlocked(w.id) &&
                          latest(w.id)?.status !== "completed"),
                  )
                  .map((w) => {
                    const s = latest(w.id);
                    const progress = !w.reviewAvailable ? "none" : !isWeekUnlocked(w.id) ? "locked" : s?.status === "completed" ? "done" : hasStarted(s) ? "progress" : "ready";
                    const open = progress !== "none" && progress !== "locked";
                    return (
                      <article
                        className={
                          "week-row " +
                          (!open ? "unavailable" : "")
                        }
                        key={w.id}
                      >
                        <div className="week-number">
                          <small>{t("WEEK", "주차")}</small>
                          {String(w.id).padStart(2, "0")}
                        </div>
                        <div className="week-info">
                          <h3>{titleOf(w, l)}</h3>
                          <p>{objectiveOf(w, l)}</p>
                          <span className={`status ${progress}`}>
                            {progress === "done" ? (
                              <Check size={13} />
                            ) : progress === "locked" ? (
                              <Lock size={12} />
                            ) : (
                              <i />
                            )}
                            {progress === "none"
                              ? t("No review scheduled", "리뷰 없음")
                              : progress === "locked"
                                ? t("Locked", "잠김")
                              : progress === "done"
                                ? t("Completed", "완료")
                                : progress === "progress"
                                  ? t("In progress", "진행 중")
                                  : t("Ready to explore", "시작 가능")}
                          </span>
                        </div>
                        <button
                          disabled={!open || (!isDemo && !user)}
                          className="row-action"
                          onClick={() => choose(w, s)}
                        >
                          {!w.reviewAvailable
                            ? "—"
                            : progress === "locked"
                              ? <Lock size={15} aria-label={t("Locked", "잠김")} />
                            : progress === "done"
                              ? t("View transcript", "대화 기록 보기")
                              : progress === "progress"
                                ? t("Continue review", "리뷰 이어하기")
                                : t("Start review", "리뷰 시작")}{" "}
                          {open && <ArrowUpRight size={17} />}
                        </button>
                      </article>
                    );
                  })}
              </div>
              <p className="source-note">
                {t(
                  "Topics follow the existing course schedule. Learning goals and questions are editable drafts; weeks 8 and 16 have no review.",
                  "주제는 기존 수업 일정표 기준입니다. 학습 목표와 질문은 수정 가능한 초안이며, 8·16주차는 리뷰가 없습니다.",
                )}
              </p>
            </div>
          )}
          {page === "setup" && week && (
            <div className="narrow review-setup">
              <div className="setup-topic">
                <div className="setup-topic-topline">
                  <button
                    className="setup-week-link"
                    onClick={() => navigate("reviews")}
                    aria-label={t("Back to all weekly reviews", "전체 주차별 리뷰로 돌아가기")}
                    title={t("All weekly reviews", "전체 주차별 리뷰")}
                  >
                    <span className="setup-week-arrow"><ChevronLeft size={15} /></span>
                    <span>{t("WEEK", "주차")} {String(week.id).padStart(2, "0")}</span>
                  </button>
                </div>
                <h1>{titleOf(week, l)}</h1>
              </div>
              <div className="setup-guidance">
                <ul className="setup-list">
                  {[
                    ["Open book—feel free to use your notes and course materials.", "오픈북입니다. 노트와 수업 자료를 자유롭게 참고하세요."],
                    isDemo ? ["Re-record your answer as many times as you like.", "답변은 원하는 만큼 다시 녹음할 수 있습니다."] : ["Ask questions, explore an example, or pause whenever you need.", "궁금한 것을 묻고, 예시를 함께 생각하거나 필요할 때 잠시 멈추세요."],
                    isDemo ? ["Listen back to your recording, then select “Finish answer” to continue.", "녹음한 답변을 다시 듣고, 준비되면 ‘답변 완료’를 선택하세요."] : ["Find a quiet spot and allow microphone access.", "조용한 곳에서 마이크 접근을 허용해 주세요."],
                  ].map(([en,ko]) => <li key={en}><CheckCircle2/>{t(en,ko)}</li>)}
                </ul>
              </div>
              <div className="panel mic-panel">
                <div className="mic-circle">
                  <Mic size={24} />
                </div>
                <div>
                  <h3>{t("Check your microphone", "마이크 확인")}</h3>
                  {micDevices.length > 0 && <label className="mic-device-select">
                    <span>{t("Input device", "입력 장치")}</span>
                    <select value={selectedMic} disabled={mic === "checking"} onChange={e=>{const id=e.target.value;setSelectedMic(id);testMic(id)}}>
                      <option value="">{t("System default", "시스템 기본 장치")}</option>
                      {micDevices.filter(d=>d.id).map((d,i)=><option key={d.id} value={d.id}>{d.label || t(`Microphone ${i+1}`, `마이크 ${i+1}`)}</option>)}
                    </select>
                  </label>}
                  <div
                    className="meter"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(level*100)}
                    aria-label={t("Microphone input level", "마이크 입력 수준")}
                  >
                    <i style={{ width: `${level * 100}%` }} />
                  </div>
                  <div className="mic-level-caption"><span>{t("Input level", "입력 레벨")}</span><strong>{Math.round(level*100)}%</strong></div>
                  {mic === "ready" && <div className="mic-diagnostics">
                    <span>{micDevice || t("Default microphone", "기본 마이크")}</span>
                    <p role="status">{micSignal === "paused" ? t("Audio processing is paused. Activate this tab and test again.", "오디오 처리가 일시 정지되었습니다. 이 탭을 활성화하고 다시 테스트해 주세요.") : micSignal === "muted" ? t("The input device is not sending audio. Check its mute switch or try another device.", "입력 장치에서 소리가 전달되지 않습니다. 음소거를 확인하거나 다른 장치를 선택해 주세요.") : micSignal === "signal" ? t("Sound detected", "소리 입력이 감지됩니다") : micSignal === "silent" ? t("No sound detected. Check the selected input device, mute switch, and system input volume.", "소리가 감지되지 않습니다. 입력 장치, 음소거, 시스템 입력 음량을 확인해 주세요.") : t("Listening for sound…", "소리 입력을 기다리고 있어요…")}</p>
                  </div>}

                </div>
                <button onClick={()=>testMic()} disabled={mic === "checking"}>
                  <Mic size={15} />
                  {mic === "checking" ? t("Connecting…", "연결 중…") : mic === "idle"
                    ? t("Test microphone", "마이크 테스트")
                    : t("Test again", "다시 테스트")}
                </button>
                {mic === "ready" && <button className="mic-stop" onClick={stopMicTest}>{t("Stop test", "테스트 종료")}</button>}
              </div>
              <div className="setup-actions">
                <button
                  className="primary"
                  disabled={busy || (!isDemo && mic !== "ready")}
                  onClick={start}
                >
                  {busy
                    ? t("Connecting…", "연결 중…")
                    : hasStarted(session)
                      ? t("Continue conversation", "대화 이어하기")
                      : isDemo ? t("Begin review", "리뷰 시작") : t("Start conversation", "대화 시작")}
                  <ArrowRight size={17} />
                </button>
                {!isDemo && mic !== "ready" && !busy && <span className="setup-hint">{t("Test your microphone to start.", "마이크를 테스트하면 시작할 수 있어요.")}</span>}
              </div>
            </div>
          )}
          {page === "conversation" && session && <ConversationReview session={session} deviceId={selectedMic} onUpdate={refreshSession} onLeave={() => navigate("reviews")} onComplete={finishConversation} />}
          {page === "review" && session && (
            <div className="narrow review-conversation">
              <div className="review-top">
                <span className="eyebrow">
                  {t("WEEK", "주차")} {String(session.weekId).padStart(2, "0")}{" "}

                </span>
                <button className="back" onClick={() => setExitOpen(true)}>
                  <X size={16} />
                  {t("End review", "리뷰 종료")}
                </button>
              </div>
              <div className="question-progress" role="progressbar" aria-label={t("Review progress", "리뷰 진행")} aria-valuemin={0} aria-valuemax={session.questions.length} aria-valuenow={session.index + 1}>
                <i style={{width:`${((session.index + 1) / session.questions.length) * 100}%`}} />
              </div>
              <div className="question-card">
                <span className="question-kind">
                  {session.followUp
                    ? t(
                        "A LITTLE DEEPER · FOLLOW-UP",
                        "조금 더 깊이 · 추가 질문",
                      )
                    : t(
                        [
                          "UNDERSTAND THE CONCEPT",
                          "EXPLAIN & COMPARE",
                          "CONNECT TO DESIGN",
                          "REFLECT ON THE TRADE-OFFS",
                        ][session.index],
                        [
                          "핵심 개념 이해",
                          "설명과 비교",
                          "디자인 적용",
                          "한계와 영향 돌아보기",
                        ][session.index],
                      )}
                </span>
                <h2>{currentQuestion(session).text}</h2>
                <button
                  className="listen"
                  onClick={ask}
                  disabled={[
                    "connecting",
                    "preparing",
                    "speaking",
                    "transcribing",
                    "error",
                    "answering",
                  ].includes(phase)}
                >
                  <Volume2 size={17} />
                  {t("Listen to the question", "질문 듣기")}
                </button>
                <div className="voice-state" aria-live="polite">
                  <div
                    className={
                      "voice-indicator " +
                      (phase === "speaking" ? "moving" : phase === "answering" && !isDemo ? "recording" : "")
                    }
                  >
                    {phase === "speaking" ? (
                      <Volume2 />
                    ) : phase === "preparing" || phase === "connecting" ? (
                      <MoreHorizontal />
                    ) : (
                      <Mic />
                    )}
                  </div>
                  <strong>
                    {t(
                      {
                        ready: "Ready when you are",
                        speaking: "Listen to the question",
                        answering: isDemo
                          ? "Your turn · demo text input"
                          : "Your turn · microphone is recording",
                        preparing: "Preparing your next step…",
                        connecting: "Connecting to voice…",
                        transcribing: "Transcribing your answer…",
                        recorded: recordingUrl ? "Listen back before you continue" : "Your answer is ready to review",
                        error: "Connection needs attention",
                      }[phase],
                      {
                        ready: "준비되면 시작하세요",
                        speaking: "질문을 듣고 있어요",
                        answering: isDemo
                          ? "이제 답변해 주세요 · 데모 텍스트 입력"
                          : "이제 말해 주세요 · 마이크 녹음 중",
                        preparing: "다음 단계를 준비하고 있어요…",
                        connecting: "음성을 연결하고 있어요…",
                        transcribing: "답변을 텍스트로 변환하고 있어요…",
                        recorded: recordingUrl ? "다음으로 넘어가기 전에 답변을 들어보세요" : "답변 기록을 확인해 주세요",
                        error: "연결 상태를 확인해 주세요",
                      }[phase],
                    )}
                  </strong>
                  <p>
                    {phase === "recorded" ? (recordingUrl ? t("Play your recording, or try again if you’d like.", "녹음을 재생하거나 원하는 만큼 다시 녹음할 수 있어요.") : t("Review your transcript, or record a new answer.", "답변 기록을 확인하거나 새로 녹음할 수 있어요.")) : t(
                      "A pause is just a pause. You decide when your answer is complete.",
                      "잠깐 멈춰도 괜찮아요. 답변이 끝났을 때 직접 알려 주세요.",
                    )}
                  </p>
                </div>
                {!isDemo && phase === "answering" && <div className="recording-visual">
                  <div className="input-waveform" aria-hidden="true">
                    {inputVisual.bars.map((value, index) => <i key={index} style={{ height: `${3 + value * 39}px`, opacity: .25 + value * .75 }} />)}
                  </div>
                  <span className="input-status" role="status">
                    <i className={inputVisual.status === "signal" ? "signal" : ""} aria-hidden="true" />
                    {t({
                      idle: "Listening for sound…", waiting: "Listening for sound…", signal: "Sound detected", silent: "No sound detected · check your microphone",
                      muted: "Microphone input is muted", disconnected: "Microphone disconnected", paused: "Input display paused · activate this tab", unavailable: "Input display unavailable",
                    }[inputVisual.status], {
                      idle: "소리 입력을 기다리고 있어요…", waiting: "소리 입력을 기다리고 있어요…", signal: "소리가 들어오고 있어요", silent: "소리가 감지되지 않아요 · 마이크를 확인해 주세요",
                      muted: "마이크 입력이 음소거되어 있어요", disconnected: "마이크 연결이 끊겼어요", paused: "입력 표시가 멈췄어요 · 이 탭을 활성화해 주세요", unavailable: "입력 상태를 표시할 수 없어요",
                    }[inputVisual.status])}
                  </span>
                </div>}
              </div>
              {!isDemo && recordingUrl && <div className="answer-playback">
                <label htmlFor="answer-recording">{t("Your recording", "내 답변 다시 듣기")}</label>
                <audio id="answer-recording" ref={playback} controls preload="metadata" src={recordingUrl} aria-label={t("Play your recorded answer", "녹음한 내 답변 재생")} />
              </div>}
              {!isDemo && playbackUnavailable && <p className="playback-note" role="status">{t("Playback isn’t available in this browser. You can still review your transcript and continue.", "이 브라우저에서는 다시 듣기를 사용할 수 없습니다. 답변 기록을 확인한 뒤 계속할 수 있어요.")}</p>}
              {isDemo ? <>
              <div className="answer-header">
                <label htmlFor="answer">
                  {t("Your answer", "내 답변")}
                </label>
                <span aria-live="polite">
                  {saveState === "saving"
                    ? t("Saving…", "저장 중…")
                    : saveState === "failed"
                      ? t(
                          "Not saved · retry below",
                          "저장 실패 · 아래에서 재시도",
                        )
                      : saveState === "saved"
                        ? t("Saved", "저장됨")
                        : t("Private to your review", "내 리뷰에 저장됩니다")}
                </span>
              </div>
              <textarea
                id="answer"
                value={answer}
                readOnly={!isDemo}
                disabled={busy}
                onChange={(e) => changeAnswer(e.target.value)}
                placeholder={
                  isDemo
                    ? t(
                        "Type what you would say. Try “I’m not sure” to explore a follow-up.",
                        "말하고 싶은 내용을 입력해 주세요. ‘잘 모르겠어요’로 추가 질문 흐름을 확인할 수 있습니다.",
                      )
                    : t(
                        "Listen to the question, speak, then stop recording to collect your transcript.",
                        "질문을 듣고 답변한 다음, 녹음을 마쳐 답변 기록을 확인하세요.",
                      )
                }
              />
              </> : answer.trim() && <details className="answer-transcript">
                <summary>{t("View your transcript", "답변 기록 보기")}<span>{saveState === "saving" ? t("Saving…", "저장 중…") : saveState === "saved" ? t("Saved", "저장됨") : ""}</span></summary>
                <p>{answer}</p>
              </details>}
              {saveState === "failed" && (
                <button onClick={() => changeAnswer(answer)}>
                  <RefreshCw size={15} />
                  {t("Retry saving", "저장 재시도")}
                </button>
              )}
              <div className="answer-actions">
                <span>
                  {!isDemo && phase === "answering" ? (
                    <Mic size={15} />
                  ) : (
                    <MicOff size={15} />
                  )}
                  {isDemo
                    ? t(
                        "Demo · microphone is not recording",
                        "데모 · 녹음하지 않습니다",
                      )
                    : t(
                        "Playback stays in this tab until you continue. Only your transcript is saved.",
                        "녹음은 다음으로 넘어가기 전까지 이 탭에서 다시 들을 수 있습니다. 텍스트 기록만 저장됩니다.",
                      )}
                </span>
                <div>
                  {((answer.trim() && (isDemo || ["ready", "recorded"].includes(phase))) || (!isDemo && phase === "answering")) && (
                    <button disabled={busy || session.pendingDecision} onClick={redoAnswer}>
                      <RefreshCw size={15}/>{isDemo ? t("Rewrite answer", "답변 다시 쓰기") : t("Re-record answer", "다시 녹음하기")}
                    </button>
                  )}
                  {!isDemo && phase === "recorded" && !answer.trim() && <button onClick={redoAnswer}><Mic size={15}/>{t("Try recording again", "다시 녹음하기")}</button>}
                  {!isDemo && phase === "error" && (
                    <button onClick={() => run(() => connectVoice(session))}>
                      {t("Reconnect", "다시 연결")}
                    </button>
                  )}
                  <button
                    className="primary"
                    disabled={
                      (!answer.trim() && (isDemo || phase !== "answering")) ||
                      busy ||
                      ([
                        "speaking",
                        "transcribing",
                        "connecting",
                        "error",
                      ].includes(phase) &&
                        !isDemo)
                    }
                    onClick={finishAnswer}
                  >
                    {busy
                      ? t("Saving…", "저장 중…")
                      : !isDemo && phase === "answering" ? t("Finish recording", "녹음 마치기") : t("Finish answer", "답변 완료")}
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            </div>
          )}
          {page === "feedback" && session && (
            <div className="narrow">
              <button className="back" onClick={() => navigate("reviews")}>
                <ChevronLeft size={16} />
                {t("All weekly reviews", "전체 주차별 리뷰")}
              </button>
              {session.mode === "conversation" ? (
                <>
                  <div className="eyebrow">
                    {t("WEEK", "주차")} {String(session.weekId).padStart(2, "0")} · {t("TRANSCRIPT", "대화 기록")}
                  </div>
                  <h1>{titleOf(weeks.find((w) => w.id === session.weekId), l)}</h1>
                  {session.completedAt && <p className="lead">{t("Completed", "완료")} {new Date(session.completedAt).toLocaleString("en-US")}</p>}
                </>
              ) : (
                <>
              <div className="complete-icon">
                <Check size={29} />
              </div>
              <div className="eyebrow">
                {t("WEEK", "주차")} {String(session.weekId).padStart(2, "0")} ·{" "}
                {t("REVIEW COMPLETE", "리뷰 완료")}
              </div>
              <h1>
                {t(
                  "A little clearer, a little further.",
                  "한층 명확해진 이해.",
                )}
              </h1>
              <p className="lead">
                {t(
                  "You made time to think. Here’s a place to continue from.",
                  "생각할 시간을 가졌어요. 여기서 다음 배움을 이어가세요.",
                )}
              </p>
              <div className="notice">
                <ShieldCheck size={18} />
                {isDemo
                  ? t(
                      "Illustrative feedback only. This is not an evaluation of your answers.",
                      "아래 피드백은 예시이며, 실제 답변을 평가한 결과가 아닙니다.",
                    )
                  : t(
                      "AI feedback is provisional and can be reviewed by your instructor.",
                      "AI 피드백은 잠정 결과이며 교수자가 검토하고 수정할 수 있습니다.",
                    )}
              </div>
              {session.feedback ? (
                <div className="feedback-grid">
                  {[
                    [
                      "strengths",
                      "What to build on",
                      "잘 이해한 부분",
                      CheckCircle2,
                    ],
                    [
                      "revisit",
                      "What to revisit",
                      "다시 살펴볼 부분",
                      BookOpen,
                    ],
                    [
                      "next",
                      "Your next small step",
                      "다음 학습을 위한 제안",
                      ArrowUpRight,
                    ],
                  ].map(([k, en, ko, Icon]) => (
                    <article className={"feedback-card " + k} key={k}>
                      <Icon size={20} />
                      <div>
                        <h3>{t(en, ko)}</h3>
                        <p>{session.feedback[k]}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="panel">
                  <h3>
                    {t(
                      "Your transcript is saved",
                      "답변 기록이 저장되었습니다",
                    )}
                  </h3>
                  <p>
                    {t(
                      "Feedback is pending or needs another attempt. You can come back later.",
                      "피드백을 준비 중이거나 재시도가 필요합니다. 나중에 다시 확인할 수 있습니다.",
                    )}
                  </p>
                  <button
                    disabled={busy || session.evaluationStatus === "processing"}
                    onClick={() => evaluateSession(session)}
                  >
                    <RefreshCw size={16} />
                    {t("Prepare feedback", "피드백 준비하기")}
                  </button>
                </div>
              )}
                </>
              )}
              <section className="transcript">
                {session.mode !== "conversation" && <div className="section-heading">
                  <h2>{t("Your conversation", "나의 대화 기록")}</h2>
                  <span>
                    {session.mode === "conversation" ? t("Saved", "저장됨") : `${session.turns.length} ${t("answers", "개의 답변")}`}
                  </span>
                </div>}
                {session.mode === "conversation" ? session.messages.filter(m => m.text).map(m => <div className="transcript-turn" key={m.id}><strong>{m.role === "student" ? t("You", "나") : t("Learning companion", "학습 에이전트")}</strong><p>{m.text}</p><time>{new Date(m.createdAt).toLocaleString(l === "ko" ? "ko-KR" : "en-US")}</time></div>) : session.questions.map((q, i) => (
                  <details key={q.id}>
                    <summary>
                      <span>0{i + 1}</span>
                      {q.text}
                    </summary>
                    {session.turns
                      .filter(
                        (turn) =>
                          turn.questionId === q.id || turn.parentId === q.id,
                      )
                      .map((turn) => (
                        <div className="transcript-turn" key={turn.id}>
                          {turn.kind === "followup" && (
                            <strong>
                              {t("Follow-up", "추가 질문")} · {turn.question}
                            </strong>
                          )}
                          <p>{turn.answer}</p>
                          <time>
                            {new Date(turn.answeredAt).toLocaleString(
                              session.language === "ko" ? "ko-KR" : "en-US",
                            )}
                          </time>
                        </div>
                      ))}
                  </details>
                ))}
              </section>
              <div className="setup-actions">
                <button className="primary" onClick={() => navigate("reviews")}>
                  {t("Back to weekly reviews", "주차별 리뷰로 돌아가기")}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
          <footer>
            <span>
              ID40018 <i /> Data-Driven AI Service Design
            </span>
          </footer>
        </main>
      </div>
      {exitOpen && (
        <div className="modal-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            className="modal"
          >
            <h2 id="exit-title">
              {t("Pause this conversation?", "대화를 잠시 멈출까요?")}
            </h2>
            <p>
              {!isDemo && phase === "answering" ? t(
                "Your saved answers will be here when you return. Audio from an unfinished answer isn’t saved.",
                "저장된 답변은 이어서 볼 수 있습니다. 아직 완료하지 않은 답변의 음성은 저장되지 않습니다.",
              ) : t(
                "Your answers and current draft will be saved. Return to Weekly Reviews to continue.",
                "답변과 작성 중인 내용을 저장합니다. 주차별 리뷰에서 다시 이어갈 수 있습니다.",
              )}
            </p>
            <div>
              <button autoFocus onClick={() => setExitOpen(false)}>
                {t("Keep going", "계속하기")}
              </button>
              <button className="primary" disabled={busy} onClick={pause}>
                {t("Save & leave", "저장하고 나가기")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
