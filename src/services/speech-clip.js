// Builds "your response" playback: only the parts of a recording where the student was speaking,
// joined with short gaps and encoded as WAV (which, unlike MediaRecorder WebM, has a real duration).

const LEAD = 0.8; // VAD reports speech_started a little after the first syllable.
const TAIL = 0.5;
const GAP = 0.35;

// Pads each [start, end] (seconds) window, clamps it to the recording and merges overlaps.
export function speechWindows(segments, duration) {
  const padded = segments
    .filter(s => Number.isFinite(s.start))
    .map(s => [Math.max(0, s.start - LEAD), Math.min(duration, (Number.isFinite(s.end) ? s.end : duration) + TAIL)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const w of padded) {
    const last = merged.at(-1);
    if (last && w[0] <= last[1] + GAP) last[1] = Math.max(last[1], w[1]);
    else merged.push([...w]);
  }
  return merged;
}

export async function speechClip(blob, segments) {
  const Context = window.AudioContext || window.webkitAudioContext;
  const context = new Context();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    const windows = speechWindows(segments, audio.duration);
    if (!windows.length) return null;
    const rate = audio.sampleRate, source = audio.getChannelData(0), gap = Math.round(GAP * rate);
    const parts = windows.map(([a, b]) => source.subarray(Math.floor(a * rate), Math.ceil(b * rate)));
    const length = parts.reduce((n, p) => n + p.length, 0) + gap * (parts.length - 1);
    const samples = new Float32Array(length);
    let offset = 0;
    for (const part of parts) { samples.set(part, offset); offset += part.length + gap; }
    return wav(samples, rate);
  } finally {
    context.close().catch(() => {});
  }
}

function wav(samples, rate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return new Blob([buffer], { type: 'audio/wav' });
}
