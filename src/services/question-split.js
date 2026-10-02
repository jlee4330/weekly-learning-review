// Splits an agent turn into [lead, question, tail] so only the question itself is highlighted.
// 1) If the turn contains one of this week's guide questions (the agent reads them verbatim),
//    the question is exactly that span; anything said after it ("Take your time…") becomes the tail.
// 2) Otherwise the question is the last question sentence, pulling in the sentence before it when the
//    question is too short to stand on its own ("Think about Netflix. What else does it need?").
// While a reply is still streaming without a question, everything stays in the lead.

const tokenize = (text) => [...text.matchAll(/[A-Za-z0-9]+/g)].map((m) => ({ word: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length }));

// Latest occurrence of any known question, as [start, end) character offsets.
function findKnown(text, known) {
  const tokens = tokenize(text);
  let best = null;
  for (const candidate of known) {
    const words = tokenize(candidate).map((t) => t.word);
    if (words.length < 4) continue;
    for (let i = tokens.length - words.length; i >= 0; i--) {
      if (!words.every((w, k) => tokens[i + k].word === w)) continue;
      if (!best || tokens[i].start > best[0]) best = [tokens[i].start, tokens[i + words.length - 1].end];
      break;
    }
  }
  if (!best) return null;
  // Keep the question's own closing punctuation with it.
  const close = text.slice(best[1]).match(/^[?.!]*["'”’)]*/)[0];
  return [best[0], best[1] + close.length];
}

export function splitQuestion(text, known = []) {
  const trimmed = text.trim();
  const span = findKnown(trimmed, known);
  if (span) return [trimmed.slice(0, span[0]).trim(), trimmed.slice(span[0], span[1]).trim(), trimmed.slice(span[1]).trim()];
  const sentences = trimmed.match(/[^.!?]+[.!?]+["'”’)]*\s*|[^.!?]+$/g) || [];
  const last = sentences.findLastIndex((s) => s.trim().replace(/["'”’)]+$/, "").endsWith("?"));
  if (last < 0) return [trimmed, "", ""];
  let first = last;
  const short = (sentences[last].match(/[A-Za-z0-9]+/g) || []).length < 8;
  if (short && last > 0 && !/!\s*$/.test(sentences[last - 1])) first -= 1;
  return [sentences.slice(0, first).join("").trim(), sentences.slice(first, last + 1).join("").trim(), sentences.slice(last + 1).join("").trim()];
}

const words = (text) => tokenize(text).map((t) => t.word);
// True when `phrase` appears in `text` word for word (punctuation and case ignored).
function containsWords(text, phrase) {
  const t = words(text), p = words(phrase);
  if (!p.length || p.length > t.length) return false;
  for (let i = 0; i + p.length <= t.length; i++) if (p.every((w, k) => t[i + k] === w)) return true;
  return false;
}

// Progress through a fixed question set, read from what the agent has said:
// the furthest guide question it has asked, and whether it has spoken the closing line.
export function reviewProgress(messages, guide) {
  const questions = (guide?.questions || []).filter((q) => q.type);
  if (!questions.length) return null;
  const said = messages.filter((m) => m.role === "assistant" && m.text).map((m) => m.text);
  let current = 0;
  questions.forEach((q, i) => { if (said.some((text) => containsWords(text, q.question))) current = Math.max(current, i + 1); });
  // The closing is matched on its first sentence, which the agent is told to say exactly.
  const closing = guide.closing?.split(/(?<=[.!?])\s/)[0];
  const done = !!closing && said.some((text) => containsWords(text, closing));
  return { total: questions.length, current: done ? questions.length : Math.max(current, 1), done };
}
