export function reviewErrorMessage(error, language = "en") {
  const messages = {
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
  return (messages[error?.message] || fallback)[language === "ko" ? 1 : 0];
}
