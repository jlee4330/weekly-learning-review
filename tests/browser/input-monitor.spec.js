import { test, expect } from '@playwright/test';

test('recording visualizer follows real stream audio and releases only its own resources', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start review', exact: true }).first().click();
  await page.evaluate(async () => {
    const { InputMonitor } = await import('/src/services/input-monitor.js');
    const context = new AudioContext();
    await context.resume();
    const tone = context.createOscillator(), gain = context.createGain(), output = context.createMediaStreamDestination();
    tone.connect(gain); gain.connect(output); gain.gain.value = 0; tone.start();
    window.inputTest = { context, tone, gain, stream: output.stream, level: 0, status: '', samples: 0 };
    const monitor = new InputMonitor((level, status) => Object.assign(window.inputTest, { level, status, samples: window.inputTest.samples + 1 }));
    window.inputTest.monitor = monitor;
    monitor.attach(output.stream); monitor.start();
  });
  await expect.poll(() => page.evaluate(() => window.inputTest.status)).toBe('waiting');
  expect(await page.evaluate(() => window.inputTest.level)).toBe(0);
  await page.evaluate(() => { window.inputTest.gain.gain.value = .12; });
  await expect.poll(() => page.evaluate(() => window.inputTest.level)).toBeGreaterThan(.5);
  await expect.poll(() => page.evaluate(() => window.inputTest.status)).toBe('signal');
  await page.evaluate(() => { window.inputTest.gain.gain.value = 0; });
  await expect.poll(() => page.evaluate(() => window.inputTest.status), { timeout: 6000 }).toBe('silent');
  await page.evaluate(() => window.inputTest.monitor.stop());
  const count = await page.evaluate(() => window.inputTest.samples);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.inputTest.samples)).toBe(count);
  await page.evaluate(() => { window.inputTest.monitor.close(); });
  expect(await page.evaluate(() => window.inputTest.stream.getAudioTracks()[0].readyState)).toBe('live');
  await page.evaluate(() => { window.inputTest.stream.getTracks().forEach(t => t.stop()); window.inputTest.tone.stop(); window.inputTest.context.close(); });
});
