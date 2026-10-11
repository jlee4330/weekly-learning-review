import { test, expect } from '@playwright/test';

test('real browser recording rotates into playable files, pauses, and discards', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { AudioArchive } = await import('/src/services/audio-archive.js');
    const context = new AudioContext(); await context.resume();
    const tone = context.createOscillator(), output = context.createMediaStreamDestination();
    tone.connect(output); tone.start();
    const blobs = [], errors = [];
    const archive = new AudioArchive({ upload: async blob => { blobs.push(blob); }, onError: e => errors.push(e.message), intervalMs: 250 });
    archive.start(output.stream);
    await new Promise(r => setTimeout(r, 650));
    archive.pause(); await archive.queue;
    const before = blobs.length;
    await new Promise(r => setTimeout(r, 350));
    const after = blobs.length;
    archive.start(output.stream); await new Promise(r => setTimeout(r, 150)); await archive.finish();
    const durations = [];
    for (const blob of blobs) durations.push((await context.decodeAudioData(await blob.arrayBuffer())).duration);
    const kept = blobs.length;
    archive.start(output.stream); await new Promise(r => setTimeout(r, 100)); await archive.discard();
    tone.stop(); output.stream.getTracks().forEach(t => t.stop()); await context.close();
    return { before, after, kept, final: blobs.length, errors, durations };
  });
  expect(result.errors).toEqual([]);
  expect(result.before).toBeGreaterThanOrEqual(2);
  expect(result.after).toBe(result.before);
  expect(result.kept).toBe(result.before + 1);
  expect(result.final).toBe(result.kept);
  expect(result.durations.every(d => d > 0)).toBe(true);
});

test('mixed recording contains both voices and retains the agent when the microphone is muted', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { ConversationMixer } = await import('/src/services/conversation-mixer.js');
    const { AudioArchive } = await import('/src/services/audio-archive.js');
    const context = new AudioContext(); await context.resume();
    const makeTone = frequency => {
      const oscillator = context.createOscillator(), gain = context.createGain(), output = context.createMediaStreamDestination();
      oscillator.frequency.value = frequency; gain.gain.value = 0.2;
      oscillator.connect(gain); gain.connect(output); oscillator.start();
      return { oscillator, stream: output.stream };
    };
    const student = makeTone(440), agent = makeTone(880);
    const mixer = new ConversationMixer(student.stream); await mixer.ready();
    // The remote WebRTC track can arrive after the microphone and mixer.
    mixer.setAgent(agent.stream);
    const blobs = [], errors = [];
    const archive = new AudioArchive({ upload: async b => blobs.push(b), onError: e => errors.push(e.message) });
    const wait = () => new Promise(r => setTimeout(r, 500));
    archive.start(mixer.stream); await wait(); archive.pause(); await archive.queue;
    student.stream.getAudioTracks()[0].enabled = false;
    archive.start(mixer.stream); await wait(); await archive.finish();
    const strength = (buffer, frequency) => {
      const data = buffer.getChannelData(0), start = Math.floor(buffer.sampleRate * 0.15), count = Math.floor(buffer.sampleRate * 0.2);
      let sin = 0, cos = 0;
      for (let i = 0; i < count; i++) { const angle = 2 * Math.PI * frequency * i / buffer.sampleRate; sin += data[start + i] * Math.sin(angle); cos += data[start + i] * Math.cos(angle); }
      return 2 * Math.hypot(sin, cos) / count;
    };
    const levels = [];
    for (const blob of blobs) {
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      levels.push([strength(decoded, 440), strength(decoded, 880)]);
    }
    mixer.close(); await new Promise(r => setTimeout(r, 50));
    const released = { context: mixer.context.state, mixed: mixer.stream.getAudioTracks()[0].readyState, student: student.stream.getAudioTracks()[0].readyState, agent: agent.stream.getAudioTracks()[0].readyState };
    for (const tone of [student, agent]) { tone.oscillator.stop(); tone.stream.getTracks().forEach(t => t.stop()); }
    await context.close();
    return { errors, levels, released };
  });
  expect(result.errors).toEqual([]);
  expect(result.levels).toHaveLength(2);
  expect(result.levels[0][0]).toBeGreaterThan(0.05);
  expect(result.levels[0][1]).toBeGreaterThan(0.05);
  expect(result.levels[1][0]).toBeLessThan(0.01);
  expect(result.levels[1][1]).toBeGreaterThan(0.05);
  expect(result.released).toEqual({ context: 'closed', mixed: 'ended', student: 'live', agent: 'live' });
});
