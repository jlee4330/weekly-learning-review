export function reviewErrorMessage(error, language = "en") {
  const messages = {
    VOICE_SESSION_AUTH_FAILED: ["OpenAI rejected the temporary voice session credential. Select Reconnect to request a new session.", "OpenAI가 임시 음성 세션 인증을 거부했습니다. 다시 연결하여 새 세션을 요청해 주세요."],
    VOICE_REQUEST_INVALID: ["OpenAI rejected the voice connection request (400). The connection configuration needs to be checked.", "OpenAI가 음성 연결 요청을 거부했습니다(400). 연결 설정을 확인해야 합니다."],
    VOICE_ACCESS_DENIED: ["This OpenAI project does not have permission to start this voice session. Check its API permissions.", "OpenAI 프로젝트의 음성 세션 접근 권한을 확인해 주세요."],
    VOICE_AUTH_FAILED: ["OpenAI rejected the server API credentials. Check the server API key before reconnecting.", "OpenAI가 서버 API 인증을 거부했습니다. 서버의 API 키를 확인해 주세요."],
    VOICE_CONNECTION_SERVICE: ["The voice service could not start a session. Please reconnect in a moment.", "음성 세션을 시작하지 못했습니다. 잠시 후 다시 연결해 주세요."],
    server_error: ["The voice service could not generate a response. Reconnect to continue from your saved conversation.", "음성 서비스가 응답을 생성하지 못했습니다. 다시 연결해 저장된 대화를 이어가세요."],
    insufficient_quota: ["The OpenAI project has no available API quota. Check its billing or usage limit before reconnecting.", "OpenAI 프로젝트의 사용 한도를 확인한 뒤 다시 연결해 주세요."],
    rate_limit_exceeded: ["The voice service is temporarily rate limited. Wait a moment, then reconnect.", "음성 서비스 요청 한도에 도달했습니다. 잠시 후 다시 연결해 주세요."],
    VOICE_REQUEST_FAILED: ["The voice service could not complete its response. Reconnect to continue; your collected transcript is kept.", "음성 응답을 완료하지 못했습니다. 수집된 기록은 유지되며 다시 연결할 수 있습니다."],
    CONNECTION_LOST: ["The voice connection was interrupted. Reconnect to continue from your saved conversation.", "음성 연결이 끊어졌습니다. 다시 연결하면 저장된 대화를 이어갈 수 있습니다."],
    TRANSCRIPTION_TIMEOUT: ["Speech transcription is still pending. Wait a moment and try again before leaving.", "음성 인식 결과를 기다리고 있습니다. 잠시 후 다시 시도해 주세요."],
    LOCAL_ACCESS_ONLY: [
      "This request was blocked by the local connection settings. Refresh this page and try again. Your saved answers are kept.",
      "로컬 연결 설정 때문에 요청이 차단되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요. 저장된 답변은 유지됩니다.",
    ],
    AUTH_REQUIRED: ["Please sign in again to continue your review.", "리뷰를 계속하려면 다시 로그인해 주세요."],
    CONNECTION_TIMEOUT: ["The voice connection timed out. Select Reconnect to try again.", "음성 연결 시간이 초과되었습니다. ‘다시 연결’을 눌러 주세요."],
    CONNECTION_FAILED: ["The voice connection could not be established. Select Reconnect to try again.", "음성 연결을 시작하지 못했습니다. ‘다시 연결’을 눌러 주세요."],
    DRAFT_SAVE_FAILED: ["Your answer has not been saved yet. Select Retry saving before continuing.", "답변이 아직 저장되지 않았습니다. ‘저장 재시도’를 누른 뒤 계속해 주세요."],
  };
  const fallback = [
    "The request could not be completed. Your current answer is kept. Please try again.",
    "요청을 완료하지 못했습니다. 현재 답변은 유지됩니다. 다시 시도해 주세요.",
  ];
  const text = (messages[error?.message] || fallback)[language === "ko" ? 1 : 0];
  // TEMP: show the underlying code on the generic message so failures can be diagnosed.
  return !messages[error?.message] && error?.message ? `${text} (${error.message})` : text;
}
