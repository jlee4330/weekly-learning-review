import { test, expect } from '@playwright/test';

test('transcript replay loads protected audio and seeks to the student turn', async ({ page }) => {
  const startedAt = '2026-10-17T00:00:00Z';
  const wav = Buffer.alloc(44 + 8000 * 2 * 10);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  await page.route('**/api/dashboard', route => route.fulfill({ json: { sessions: [{
    id: 'student~Week5', studentId: 'student', weekId: 5, status: 'completed',
    progress: { total: 0, perQuestion: [] }, transcript: [
      { role: 'assistant', text: 'Question', at: startedAt },
      { role: 'student', text: 'My answer', at: '2026-10-17T00:00:04Z' },
    ],
  }] } }));
  await page.route('**/api/dashboard/sessions/*/audio', route => {
    expect(route.request().headers()['x-dashboard-key']).toBe('test-dashboard-key');
    return route.fulfill({ json: { recordings: [{ id: 'part.webm', startedAt }, { id: 'second.webm', startedAt: '2026-10-17T00:00:10Z' }] } });
  });
  await page.route('**/api/dashboard/sessions/*/audio/part.webm', route => {
    expect(route.request().headers()['x-dashboard-key']).toBe('test-dashboard-key');
    return route.fulfill({ body: wav, contentType: 'audio/wav' });
  });
  await page.route('**/api/dashboard/sessions/*/audio/second.webm', route => route.fulfill({ body: wav, contentType: 'audio/wav' }));
  await page.goto('/#/dash/test-dashboard-key/student/5');
  await expect(page.getByRole('button', { name: '학생 발화 2 재생' })).toBeVisible();
  await expect(page.locator('.dash-week > header audio')).toBeVisible();
  await expect.poll(() => page.locator('audio').evaluate(a => a.readyState)).toBeGreaterThan(0);
  expect(await page.locator('audio').evaluate(a => a.paused && a.currentTime === 0)).toBe(true);
  await page.getByRole('button', { name: '학생 발화 2 재생' }).click();
  const player = page.getByLabel('대화 녹음 재생');
  await expect.poll(() => player.evaluate(a => a.currentTime)).toBeGreaterThanOrEqual(3.5);
  expect(await player.evaluate(a => a.src.startsWith('blob:'))).toBe(true);
  await expect(page.locator('.dash-week > header audio')).toBeVisible();
  await player.evaluate(a => { a.currentTime = 0; });
  await expect(page.locator('.dash-week > header .dash-audio audio')).toBeVisible();
  await expect(page.getByText('녹음을 준비하고 있습니다…', { exact: true })).toHaveCount(0);
  await expect.poll(() => player.evaluate(a => a.currentTime)).toBeLessThan(3);

  await player.evaluate(a => a.dispatchEvent(new Event('ended')));
  await expect(page.getByText('전체 녹음 · 2/2', { exact: true })).toBeVisible();
  await expect(page.locator('audio')).toHaveCount(1);
  await page.getByRole('button', { name: '전체 목록' }).click();
  await expect(player).toHaveCount(0);
});
