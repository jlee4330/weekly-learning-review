import { test, expect } from '@playwright/test';

test('Week 5 diagram stays through question 2 hints and disappears for question 3 and closing', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: Review } = await import('/src/components/ConversationReview.jsx');
    const { RealtimeConversation } = await import('/src/services/conversation-voice.js');
    const { repository } = await import('/src/services/api.js');
    const { weekQuestions } = await import('/content/weeks/index.js');
    let callbacks, order = 0;
    RealtimeConversation.prototype.begin = async function(s, c) { callbacks = c; c.onState('listening'); };
    RealtimeConversation.prototype.close = function() {};
    repository.messages = async () => {};
    window.ragTest = {
      say(text) { callbacks.onMessage({ id: `rag-${++order}`, role: 'assistant', text, order, revision: 1, complete: true }); },
      guide: weekQuestions[5],
    };
    const host = document.createElement('div'); document.body.replaceChildren(host);
    createRoot(host).render(React.createElement(Review, {
      session: { id: 'rag-test', weekId: 5, language: 'en', messages: [], audioConsent: false },
      onUpdate() {}, onLeave() {}, onComplete() {},
    }));
  });
  await expect(page.getByText('I’m listening', { exact: true })).toBeVisible();
  const diagram = page.locator('.question-illustration img');
  await page.evaluate(() => window.ragTest.say(window.ragTest.guide.questions[0].question));
  await expect(diagram).toHaveCount(0);
  await page.evaluate(() => window.ragTest.say(window.ragTest.guide.questions[1].question));
  await expect(diagram).toBeVisible();
  expect(await diagram.evaluate(img => img.complete && img.naturalWidth > 0)).toBeTruthy();
  await page.evaluate(() => window.ragTest.say('What does the next step need?'));
  await expect(diagram).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await diagram.evaluate(img => img.getBoundingClientRect().right <= window.innerWidth)).toBeTruthy();
  await page.evaluate(() => window.ragTest.say(window.ragTest.guide.questions[2].question));
  await expect(diagram).toHaveCount(0);
  await page.evaluate(() => window.ragTest.say(window.ragTest.guide.closing));
  await expect(diagram).toHaveCount(0);
});
