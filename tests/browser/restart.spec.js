import { test, expect } from '@playwright/test';

test('restart rejects old voice callbacks and retries a failed reset before reconnecting', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: Review } = await import('/src/components/ConversationReview.jsx');
    const { RealtimeConversation } = await import('/src/services/conversation-voice.js');
    const { repository } = await import('/src/services/api.js');
    const session = { id: 'a', weekId: 1, language: 'en', messages: [], audioConsent: false };
    window.restartTest = { connections: 0, resets: 0, fail: true, callbacks: [] };
    RealtimeConversation.prototype.begin = async function(s, callbacks) {
      window.restartTest.connections++;
      window.restartTest.callbacks.push(callbacks);
      callbacks.onState('speaking');
      callbacks.onMessage({ id: 'opening', role: 'assistant', text: 'Fresh opening', order: 0, revision: 1, complete: true });
    };
    RealtimeConversation.prototype.close = function() {
      window.restartTest.callbacks.at(-1)?.onMessage({ id: 'stale', role: 'assistant', text: 'Stale response', order: 9, revision: 1 });
    };
    repository.messages = async () => {};
    repository.reset = async () => {
      window.restartTest.resets++;
      if (window.restartTest.fail) throw Error('offline');
      return { ...session, messages: [] };
    };
    const host = document.createElement('div'); document.body.append(host);
    createRoot(host).render(React.createElement(Review, { session, onUpdate: () => {}, onLeave: () => {}, onComplete: () => {} }));
  });
  page.on('dialog', dialog => dialog.accept());
  await expect(page.getByRole('status').filter({ hasText: 'Speaking' })).toBeVisible();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry restart', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.restartTest.connections)).toBe(1);
  await page.evaluate(() => { window.restartTest.fail = false; });
  await page.getByRole('button', { name: 'Retry restart', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Speaking' })).toBeVisible();
  expect(await page.evaluate(() => window.restartTest.connections)).toBe(2);
  expect(await page.evaluate(() => window.restartTest.resets)).toBe(2);
  await page.getByText('Conversation transcript', { exact: true }).click();
  await expect(page.locator('.transcript-turn')).toHaveCount(1);
  await expect(page.locator('.transcript-turn')).toContainText('Fresh opening');
  await expect(page.getByText('Stale response', { exact: true })).toHaveCount(0);
});
