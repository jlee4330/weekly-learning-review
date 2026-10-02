// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json) and handled by the Express app.
// The app is imported lazily so a load failure answers with its reason instead of FUNCTION_INVOCATION_FAILED.
const loading = import("../server/index.js");
// Mark the rejection as handled so a load failure does not terminate the function before a request can report it.
loading.catch(() => {});

export default async function handler(req, res) {
  let app;
  try {
    ({ default: app } = await loading);
  } catch (error) {
    console.error("SERVER_LOAD_FAILED", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "SERVER_LOAD_FAILED", detail: error.message, code: error.code || null }));
  }
  return app(req, res);
}
