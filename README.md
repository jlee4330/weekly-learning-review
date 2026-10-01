# Weekly Learning Review

React 19 + Vite 기반의 ID40018 주차별 구술 리뷰. 원본 `../dasd2026` 파일·설정은 수정하지 않았습니다.

## 실행

Node.js 22.12 이상 권장 (검증: Node 24).

```sh
cd /Users/donggunlee/Desktop/GIT/weekly-learning-review
npm install
npm run dev
```

기본 포트는 5174입니다. 이미 사용 중이면 터미널에 표시된 다음 포트를 사용합니다. 설정 없이 데모로 실행됩니다. 실제 음성을 사용하려면 아래 로컬 Realtime 실행 방법을 따릅니다.

```sh
npm run build
npm test
npm run test:e2e
```

브라우저 테스트는 설치된 Google Chrome을 사용합니다. 실행 URL은 `playwright.config.js`를 참고하세요.

## 구현 및 데모 경계

첫 화면은 주차별 리뷰 목록입니다. Overview 페이지와 메뉴는 제거했으며, 기존 `#overview` 주소도 리뷰 목록으로 연결됩니다.

- 실제 모드: 주차 선택 → 마이크 확인 → 대화 시작 → 자연스러운 음성 대화 → 종료/피드백. 질문 수, 진행선, 답변 제출 버튼이 없습니다. 에이전트의 현재 발화가 화면에 업데이트되고 내 마이크 파형은 대화 중 계속 표시됩니다.
- UI, 새 대화 및 피드백은 영어로 고정합니다. 언어 전환과 답변 언어 안내, 주차 옆 언어 표시는 제거했습니다. 기존 기록의 원문은 삭제하거나 번역하지 않습니다.
- 데모: localStorage 저장, 텍스트 답변, 브라우저 `speechSynthesis` 질문 읽기, 실제 마이크 입력 레벨 테스트. **음성 인식, 의미 기반 LLM 평가, 클라우드 저장은 실행하지 않습니다.** 마이크 테스트는 녹음하지 않습니다.
- 데모 적응형 분기는 `src/services/demo.js`의 의도적으로 단순한 규칙입니다. ‘잘 모르겠어요’ / ‘not sure’는 예시 질문, ‘항상 정확’ / ‘always correct’는 이해 확인 질문, 디자인 적용 단계는 한계 질문을 유도합니다. 짧은 답변만으로 무조건 추가 질문하지 않습니다.
- 데모 피드백은 답변과 무관한 **명시적으로 표시된 예시**입니다. 점수로 저장하거나 실제 평가로 제시하지 않습니다.
- 로컬 실제 모드: 실제 OpenAI Realtime 음성·transcript, LLM 대화 진행·평가를 사용하고 `.data/reviews.json`에 저장합니다. Firebase 없이 사용 가능하며 테스트 피드백을 반환하지 않습니다.
- 수업용 실연동 코드: Firebase Auth → 인증된 Express 서버 → Firestore Admin / OpenAI. Realtime 대화 에이전트와 최종 judge는 분리되어 있습니다. 기존 planner는 레거시 질문형 세션용입니다.
- 교수자 검토/수정은 서버 API와 감사 이력 저장 구조까지 구현했습니다. 별도의 교수자 대시보드 UI는 포함하지 않았습니다.
- Realtime 토큰 발급과 모델 접근은 설정된 키로 확인했습니다. Firebase 로그인·권한과 실제 기기 마이크는 수업 환경에서 별도 검증이 필요합니다.

## API 키 입력과 실제 모드 전환

프로젝트 루트의 `.env`에서 `OPENAI_API_KEY=` 오른쪽에 키를 입력합니다. 채팅이나 클라이언트 입력창에 붙여넣지 않습니다. `.env`는 Git 제외 대상이며, OpenAI 키는 서버에서만 읽습니다.

```env
OPENAI_API_KEY=여기에_키_입력
```

### Firebase 없이 이 컴퓨터에서 실제 음성 사용

```sh
npm run activate:local
npm run server
# 다른 터미널
npm run dev
```

`activate:local`은 실제 Realtime 임시 토큰 발급과 평가 모델 접근을 확인한 뒤 `VITE_MODE=local`, `REVIEW_STORAGE=local`로 설정합니다. OpenAI 키는 서버에만 남고 브라우저에는 짧은 수명의 Realtime 토큰만 전달합니다. 음성 대화·추가 질문·평가는 실제 API를 호출하므로 사용 요금이 발생합니다.

리뷰는 이 컴퓨터의 `.data/reviews.json`에 저장됩니다. 데모의 localStorage 기록은 가져오지 않습니다. 우측 계정 정보에 로컬 저장임을 표시합니다. 로컬 모드는 한 사람이 개발 중 사용하는 용도이며 서버와 Vite 모두 loopback에서 실행해야 합니다. 원격 호스트·다른 origin·클라이언트 헤더가 없는 요청을 거부하고, `NODE_ENV=production`에서 로컬 저장 모드를 허용하지 않습니다. 학생별 로그인과 수업 공유에는 아래 Firebase 모드를 사용합니다. `.data/`는 Git에서 제외됩니다.

### Firebase와 연결

Firebase 설정도 완료한 뒤 다음 명령을 실행합니다.

```sh
npm run check:connection
npm run activate:live
npm run server
# 다른 터미널에서 Vite 재시작
npm run dev
```

`check:connection`은 Realtime 임시 토큰 발급·평가 모델 조회와 Firestore 서버 연결을 확인합니다. 키 값이나 제공자의 응답 본문을 출력하지 않습니다. `activate:live`는 같은 점검을 통과한 경우에만 `.env`의 `VITE_MODE`를 `live`로 변경합니다. 이후 UI에서 데모 표시·예시 동작 대신 실제 연결을 사용합니다. 데모 소스는 아직 삭제하지 않았습니다. 실제 Google 로그인·WebRTC 음성·LLM 평가 성공 여부는 별도로 확인해야 하며, 모델 조회 성공만으로 전체 통합이 검증된 것은 아닙니다.

## 실제 연결

1. `.env.example`을 참고해 `.env`의 `VITE_MODE=live`, `REVIEW_STORAGE=firebase`를 설정합니다. 기존 키를 덮어쓰지 않도록 주의합니다.
2. Firebase 프로젝트를 만들고 Authentication의 Google provider, 허용 도메인(localhost 및 배포 도메인), Firestore를 설정합니다. 브라우저용 Firebase 설정을 `VITE_FIREBASE_*`에 입력합니다. 기존 수업 사이트와 **별도 Firebase 프로젝트 사용을 권장**합니다.
3. 서버에 `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`(로컬 서비스 계정 파일의 절대 경로 또는 배포 환경의 ADC), `OPENAI_API_KEY`를 설정합니다. 서비스 계정 파일은 저장소 외부에 둡니다. OpenAI 비밀키/서비스 계정에 `VITE_`를 붙이지 않습니다.
4. 관리자 신뢰 환경에서 `courses/id40018-2026/members/{firebaseAuthUid}` 문서를 만들어 학생을 등록합니다. 로그인만으로 수업 접근 권한을 부여하지 않습니다.
5. 교수자 계정에는 Admin SDK로 custom claim `instructorCourses: ['id40018-2026']`를 부여합니다. 기존 custom claims를 보존해서 병합하세요. 변경 후 재로그인해야 합니다. 학생이 자기 역할이나 멤버십을 바꾸는 API는 없습니다.
6. Firebase CLI에서 새 프로젝트를 명시하여 `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`를 실행합니다. 클라이언트 직접 DB 접근은 모두 거부하고 서버가 소유권·수업 등록·교수자 범위를 검증합니다. Admin SDK는 규칙을 우회하므로 서버 검증이 권한 경계입니다.
7. 터미널 두 개에서 `npm run server` / `npm run dev`를 실행합니다. 개발에서는 Vite가 `/api`를 3001 포트로 프록시합니다.
8. 배포 시 HTTPS, 동일 origin의 `/api` reverse proxy, 서버 환경 비밀 관리가 필요합니다. `vite preview`는 API 배포 서버가 아닙니다. 서버는 기본적으로 loopback에 bind하므로 배포 reverse proxy 설정에 맞게 조정합니다.

모델은 서버 환경 변수 `OPENAI_REALTIME_MODEL`, `OPENAI_JUDGE_MODEL`로 교체합니다. 기본값은 예시이며 해당 계정의 모델 사용 가능 여부를 확인하세요. 실제 음성 연결은 인증된 서버에서 짧은 수명의 client secret을 발급받고 브라우저가 WebRTC로 연결합니다. 일반 API 키는 브라우저로 보내지 않습니다.

실연동은 Realtime의 `semantic_vad` (`eagerness: low`)로 발화 종료를 판단하고 자동으로 응답합니다. 생각하는 짧은 침묵에 여유를 주지만 자동 감지가 완벽하지는 않습니다. 에이전트가 말하는 중에도 마이크가 켜져 있으며 끼어들 수 있습니다. 질문 목록은 대화의 학습 목표 참고 자료로만 사용하며 순서·개수·추가 질문 횟수를 강제하지 않습니다.

‘잠시 멈추기’는 마이크와 에이전트 발화를 멈추고 마지막 시작/재개 이후의 내 목소리를 재생할 수 있게 합니다. 원본 오디오는 현재 탭의 임시 메모리에만 남으며 재개·화면 종료·새로고침 시 해제됩니다. 앱 서버에는 transcript만 저장합니다. ‘저장하고 나가기’로 나중에 대화를 이어갈 수 있습니다.

Transcript는 부분 발화도 약 1.5초 단위로 저장하며, 최종 발화가 이전 부분 기록을 갱신합니다. 종료 시 진행 중인 음성 인식과 저장을 기다린 뒤 완료하고 전체 대화를 별도 judge로 평가합니다. 네트워크 오류를 데모로 전환하지 않습니다. 저장 실패 시 현재 기록을 보존하고 재시도를 제공합니다. 새로고침하면 아직 서버로 전달되지 못한 텍스트·음성은 복원할 수 없습니다.

설정 없는 오프라인 데모는 이전의 질문별 텍스트 흐름을 유지합니다. 연속 음성 대화 자체는 실제 Realtime 연결이 필요합니다.

## 질문·rubric 수정

| 파일 | 용도 |
| --- | --- |
| `shared/conversation-config.js` | 인사→이해→적용→성찰 대화 규칙, 주제 범위 제한, 자동 발화 감지, 평가 지침 |
| `shared/course-dialogue.js` | 주차별 고정 인사와 첫 질문 (서비스 작성 문구) |
| `server/course-context.json` | 수업 원본에서 가져온 주차별 학습 목표·주제·본문 발췌·출처와 버전 |
| `shared/conversation.js` | 발화 병합·순서·완료·이전 기록 변환 |
| `src/components/ConversationReview.jsx` | 연속 대화 화면·자동 저장·중단·재개 |
| `src/services/conversation-voice.js` | Realtime 자동 대화·스트리밍 transcript·일시 정지 |
| `shared/course.json` | 원본 일정표에서 추출한 16주 주제·설명·출처 |
| `shared/questions.js` | 한국어/영어 제목, 초안 학습 목표, 4개 핵심 질문, 예상 답변 요소, 질문별 적용 기준 |
| `shared/config.js` | rubric, 점수 수준, 기존 질문형 대화·평가 지침, 버전, 레거시 `maxFollowUps` |
| `shared/engine.js` | UI와 독립적인 세션 진행 및 핵심/추가 질문 관계 |
| `src/services/demo.js` | 데모 저장·분기·예시 피드백 |
| `src/services/voice.js` | 마이크 테스트, 데모 TTS, 실제 Realtime WebRTC |
| `src/services/answer-recorder.js` | 현재 답변의 임시 녹음·원음 다시 듣기 |
| `src/services/input-monitor.js` | Realtime과 동일한 마이크 스트림의 실시간 입력 파형·무음 감지 |
| `server/index.js` | 인증, planner, judge, 교수자 검토 API |
| `server/storage.js` | Firebase / 로컬 파일 저장 구현 |
| `server/realtime.js` | Realtime 세션 설정과 서버 전용 토큰 발급 |

질문 템플릿은 임시입니다. 각 주의 최종 질문을 작성할 때 해당 질문에 맞는 `expectedElements`, `criteria`, `objective`를 함께 세분화하세요. 현재 예상 요소는 해당 주제 수준의 초안입니다. 배포할 때 questionVersion/rubricVersion을 변경합니다. 세션에 질문 snapshot과 버전을 저장하므로 기존 기록을 새 질문으로 덮어쓰지 않습니다.

### 원본 콘텐츠 충돌 처리

기존 `Schedule.jsx`와 일부 `lectures/WeekN.jsx`의 주차 배정이 일치하지 않습니다(예: 일정표 6주차 Agentic AI, 상세 6주차 Personalized AI). 이 앱의 목록은 **Schedule.jsx**를 기준으로 했습니다. 원본에 없는 확정 수업 내용을 만들어 넣지 않았으며 학습 목표/질문은 서비스 초안입니다. 8주차는 일정표에 No Class, 16주차는 Final Wrap-up & Showcase / No exam이 명시되어 구술 리뷰를 배정하지 않았습니다. 최종 수업 일정 확정 후 `shared/course.json`과 질문을 함께 검토하세요.

## 저장 모델과 권한

```
courses/{courseId}/members/{uid}               # 관리자가 등록
courses/{courseId}/sessions/{sessionId}       # 학생 소유, 서버만 쓰기
  studentId, weekId, courseId, language
  questions[], questionVersion, rubricVersion
  mode: conversation, conversationVersion
  messages[]: id, role (student/assistant), text, order, revision,
              complete, createdAt, interrupted?
  index, followUp, draft, status, evaluationStatus # 이전 질문형 세션 호환
  turns[]: id, questionId, parentId, kind, question, answer,
           askedAt, answeredAt
  createdAt, updatedAt, completedAt, feedback
  private/evaluation                         # 교수자만 읽는 점수·근거
  revisions/{revisionId}                     # 교수자 수정 감사 이력
```

학생 API는 본인 세션만 반환합니다. 교수자 범위는 서버 claim으로 제한합니다. 점수와 인용 근거는 공개 세션과 다른 문서에 저장합니다. 학생 피드백은 strengths/revisit/next만 제공합니다. 평가에는 `assessed`, `not_assessed`, `insufficient_evidence`를 구분하며 후자의 두 상태는 null 점수입니다. 서버는 질문별 rubric 적용 여부, 점수/null 일관성, 인용의 실제 학생 답변 포함 여부와 질문 관계를 검증합니다. AI 발화를 평가 근거로 허용하지 않습니다.

### 교수자 API

Authorization: Bearer Firebase ID token 필요.

- `GET /api/instructor/sessions`: 담당 수업 리뷰 목록
- `GET /api/instructor/sessions/:id/evaluation`: 원본 평가·최신 검토
- `POST /api/instructor/sessions/:id/review`: `criteria`와 `feedback`으로 수정본 제출. 원본은 보존하고 수정 이력/검토자/시간을 별도 저장합니다. 학생 피드백은 최신 검토로 반영됩니다.

`criteria` 항목: `{questionId, criterion, status, score, evidence:[{turnId, quote}], reason}`.
`feedback`: `{strengths, revisit, next}`. 미평가 기준은 낮은 점수를 넣지 말고 올바른 상태와 null을 사용합니다.

## 검증 범위

질문 진행/추가 질문 상한/버전/완료/빈 답변 방지 단위 테스트와 Chrome E2E를 제공합니다. 데모에서 페이지 이동, 언어 유지/리뷰 언어 고정, 작성 중 저장·이어하기, 추가 질문, 완료, transcript 열기, 피드백 재열람, 마이크 거부, 390px 모바일 overflow를 확인합니다. `tests/screenshots`에 시각 확인용 캡처를 저장합니다.

실제 OpenAI API에 합성 음성을 입력해 WebRTC 연결, 자동 발화 감지와 후속 응답, 스트리밍 transcript 저장, 일시 정지와 원음 재생, 저장 후 대화 맥락 복원, 전체 대화의 rubric 평가·피드백 생성을 확인했습니다. 390px 화면의 가로 넘침도 확인했습니다. 검증 데이터는 별도의 임시 저장소를 사용했습니다. 실제 MacBook 마이크 입력 품질, Firebase 권한, 한국어 음성 품질, 교수자 수정은 수업 환경에서 별도 검증이 필요합니다. Firebase emulator 기반 권한 통합 테스트는 아직 포함하지 않았습니다. 데모 저장소는 공유 기기에서 다른 사용자를 구분하는 보안 경계가 아닙니다.

## 공식 API 참고

- [OpenAI Realtime WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc)
- [OpenAI Realtime conversations / manual turn control](https://developers.openai.com/api/docs/guides/realtime-conversations)

연속 대화의 평가는 `questionId: "conversation"`, `evidence.turnId: message.id`로 저장합니다. 학습 에이전트 발화와 불완전한 학생 발화는 근거로 허용하지 않습니다. 선택적 실제 API 통합 점검: `node --env-file=.env scripts/verify-conversation.mjs /absolute/path/to/spoken-answer.wav` (임시 DB 사용, 실제 API 요금 발생).

## 주차별 대화 근거와 인사

첫 발화는 서버가 지정한 인사·주차 소개·첫 질문을 Realtime에 읽도록 요청합니다. 이후에는 이해 확인→같은 개념의 디자인 적용→한계 성찰 규칙 안에서 자연스럽게 이어집니다. 이 후속 흐름은 모델 지침이며 결정론적인 상태 기계는 아닙니다. 질문 수를 강제하지 않습니다.

1·2·3주차 상세 강의의 실제 목표와 주제·본문을 가져왔습니다. 일정표와 상세 강의의 주차 배정이 다른 곳은 상세 내용을 섞지 않고 해당 주차의 일정 요약만 사용합니다. 확인하지 않은 Google Slides 내용은 포함하지 않았습니다. 서비스가 작성한 첫 질문은 수업 원문 인용이 아닙니다. 각 세션에는 courseContext와 courseContextVersion을 저장해 사용한 근거를 확인할 수 있습니다. 기존 초안 질문 배열은 레거시 호환용이며 Realtime의 수업 근거로 사용하지 않습니다.

설계 참고: [OpenAI 공식 Realtime prompting 문서](https://developers.openai.com/api/docs/guides/voice-prompting).
