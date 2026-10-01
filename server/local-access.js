export function allowLocalRequest(req) {
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) return false;
  if (req.headers["x-review-client"] !== "browser") return false;
  try {
    const host = new URL(`http://${req.headers.host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(host.hostname)) return false;
    if (req.headers.origin) {
      const origin = new URL(req.headers.origin);
      if (!["http:", "https:"].includes(origin.protocol) || origin.host !== host.host) return false;
    }
    return true;
  } catch { return false; }
}
