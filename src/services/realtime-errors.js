// Failed responses nest their cause in response.status_details.error.
// Keep only diagnostic identifiers; never log the complete event or transcript.
export function realtimeError(event) {
  const failure = event.response?.status_details?.error || event.error;
  const error = new Error(failure?.code || failure?.type || event.response?.status_details?.reason || 'VOICE_REQUEST_FAILED');
  error.diagnostics = { code: error.message, type: failure?.type || null, eventType: event.type, responseId: event.response?.id || null };
  return error;
}
export function canRetryResponse(event) {
  return event.type === 'response.done' && event.response?.status === 'failed'
    && ['server_error', 'internal_server_error'].includes(realtimeError(event).message)
    && !(event.response?.output || []).some(item => (item.content || []).some(c => c.transcript || c.text));
}

// HTTP handshake failures are different from errors sent over the data channel.
// Do not retain the provider's message: it can contain credentials or request data.
export async function realtimeConnectionError(response) {
  const body = await response.json().catch(() => ({}));
  const code = response.status === 401 ? 'VOICE_SESSION_AUTH_FAILED'
    : response.status === 403 ? 'VOICE_ACCESS_DENIED'
    : response.status === 400 ? 'VOICE_REQUEST_INVALID'
    : response.status === 429 ? (body.error?.code === 'insufficient_quota' ? 'insufficient_quota' : 'rate_limit_exceeded')
    : 'CONNECTION_FAILED';
  const error = new Error(code);
  error.diagnostics = { code, status: response.status, stage: 'realtime/calls' };
  return error;
}
