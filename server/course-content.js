import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Week content lives in content/weeks/week-NN/{summary.md, questions.json}.
// Files are read on demand so edits apply to the next conversation without a restart.
const root = new URL("../content/weeks/", import.meta.url);
const folder = (weekId) => `week-${String(weekId).padStart(2, "0")}`;

// Minimal front matter: `key: value` lines between leading `---` fences.
export function parseSummary(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { meta: {}, body: markdown.trim() };
  const meta = Object.fromEntries(match[1].split("\n").map((line) => {
    const i = line.indexOf(":");
    return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
  }));
  return { meta, body: markdown.slice(match[0].length).trim() };
}

export function weekContent(weekId) {
  const markdown = readFileSync(new URL(`${folder(weekId)}/summary.md`, root), "utf8");
  const guide = readFileSync(new URL(`${folder(weekId)}/questions.json`, root), "utf8");
  const { meta, body } = parseSummary(markdown);
  const { questions, closing } = JSON.parse(guide);
  return {
    version: `content-${createHash("sha1").update(markdown).update(guide).digest("hex").slice(0, 10)}`,
    status: meta.status || "schedule_only",
    scope: meta.scope || "",
    summary: body,
    questions,
    closing: closing || null,
  };
}
