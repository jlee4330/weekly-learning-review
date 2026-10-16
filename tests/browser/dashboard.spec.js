import { test, expect } from '@playwright/test';

test('student overview shows both weeks and opens the saved Week 2 transcript', async ({ page }) => {
  const session = (studentId, weekId) => ({
    id: `${studentId}~Week${weekId}`, studentId, weekId, status: 'completed',
    createdAt: '2026-10-12T06:00:00Z', completedAt: '2026-10-12T06:01:00Z',
    talkMs: 60000, sessionMs: 60000, studentTurns: 1, studentSentences: 1,
    progress: { total: 1, reached: 1, answered: 1, finished: true, perQuestion: [] },
    transcript: [{ role: 'student', text: `Saved Week ${weekId} answer`, at: '2026-10-12T06:00:30Z' }],
  });
  await page.route('**/api/dashboard', route => route.fulfill({ json: {
    generatedAt: '2026-10-17T00:00:00Z', sessions: [session('student-a', 1), { ...session('student-a', 2), talkMs: 120000, late: true }, { ...session('student-b', 1), talkMs: 180000 },
      { ...session('student-c', 1), status: 'in_progress', talkMs: 900000 },
      { ...session('student-c', 2), status: 'in_progress', talkMs: null, transcript: [], progress: { total: 1, reached: 1, answered: 0, finished: false, perQuestion: [] } },
      { ...session('student-d', 1), talkMs: null },
      { ...session('student-e', 3), talkMs: null }],
  } }));
  await page.goto('/#/dash/test-dashboard-key');
  const overview = page.getByRole('region', { name: '학생별 주차 현황' });
  await expect(overview.getByRole('columnheader', { name: /Week 1/ })).toContainText('평균 대화 2m 00s · 2건 기준');
  await expect(overview.getByRole('columnheader', { name: /Week 2/ })).toContainText('평균 대화 2m 00s · 1건 기준');
  await expect(overview.getByRole('columnheader', { name: /Week 3/ })).toContainText('평균 대화 – · 0건 기준');
  const a = overview.getByRole('row').filter({ hasText: 'student-a' });
  await expect(a.getByRole('cell').nth(1)).toContainText('대화 시간 1m 00s');
  await expect(a.getByRole('cell').nth(2)).toContainText('대화 시간 2m 00s');
  await expect(overview.getByRole('row').filter({ hasText: 'student-c' }).getByRole('cell').nth(1)).toContainText('대화 시간 –');
  await expect(overview.getByRole('row').filter({ hasText: 'student-d' }).getByRole('cell').nth(1)).toContainText('대화 시간 –');
  await expect(overview.getByRole('row').filter({ hasText: 'student-b' })).toContainText('기록 없음');
  await expect(overview.getByRole('row').filter({ hasText: 'student-b' }).getByRole('cell').nth(2)).toHaveText('Late');
  await expect(overview.getByRole('row').filter({ hasText: 'student-c' }).getByRole('cell').nth(2)).toContainText('진행 중');
  await expect(a.getByRole('cell').nth(2)).toContainText('Late');
  await expect(page.getByRole('table')).toHaveCount(1);
  await expect(page.getByRole('group', { name: '진행 상태' })).toHaveCount(0);
  await expect(page.getByText('주차당 평균', { exact: false })).toHaveCount(0);
  await expect(overview.locator('p')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('heading', { name: '학생별 주차 현황' })).toHaveCount(0);
  await overview.getByRole('button', { name: 'student-a Week 2 대화 기록 보기', exact: true }).click();
  await expect(page.getByText('Saved Week 2 answer', { exact: true })).toBeVisible();
  await expect(page.getByText('Saved Week 1 answer', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Late', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Saved Week 2 answer', { exact: true })).toBeVisible();
  await expect(page.getByText('Saved Week 1 answer', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '전체 목록' }).click();
  const weekOne = overview.getByRole('button', { name: 'student-a Week 1 대화 기록 보기', exact: true });
  await weekOne.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Saved Week 1 answer', { exact: true })).toBeVisible();
  await expect(page.getByText('Saved Week 2 answer', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '전체 목록' }).click();
  await overview.getByRole('button', { name: 'student-a', exact: true }).click();
  await expect(page.getByText('Saved Week 1 answer', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Week 2', exact: true })).toBeVisible();
  await expect(page.getByText('Saved Week 2 answer', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Saved Week 2 answer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '전체 목록' }).click();
  await expect(overview).toBeVisible();
});

test('refresh updates the selected transcript and preserves data on failure', async ({ page }) => {
  let text = 'Original answer';
  let fail = false;
  await page.route('**/api/dashboard', route => route.fulfill(fail ? { status: 503 } : { json: {
    generatedAt: '2026-10-17T00:00:00Z',
    sessions: [{ id: 'a~Week2', studentId: 'a', weekId: 2, status: 'completed',
      progress: { total: 0, perQuestion: [] }, transcript: [{ role: 'student', text }] }],
  } }));
  await page.goto('/#/dash/test-dashboard-key/a/2');
  await expect(page.getByText('Original answer', { exact: true })).toBeVisible();
  text = 'Updated answer';
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByText('Updated answer', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/a\/2$/);
  fail = true;
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('기존 데이터를 표시하고 있습니다.');
  await expect(page.getByText('Updated answer', { exact: true })).toBeVisible();
  fail = false;
  text = 'Recovered answer';
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByText('Recovered answer', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
