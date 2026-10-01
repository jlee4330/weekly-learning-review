import { test, expect } from '@playwright/test';

test('late Week 1 feedback does not replace the selected Week 2 session', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { repository } = await import('/src/services/api.js');
    const evaluate = repository.evaluate.bind(repository);
    repository.evaluate = async s => { await new Promise(resolve => { window.releaseFeedback = resolve; }); return evaluate(s); };
  });
  await page.getByRole('button', { name: 'Start review', exact: true }).first().click();
  await page.getByRole('button', { name: 'Begin review', exact: true }).click();
  for (let i = 0; i < 8; i++) {
    if (await page.getByRole('heading', { name: 'A little clearer, a little further.' }).count()) break;
    await page.getByLabel('Your answer', {exact:true}).fill('Pretrained models adapt to tasks. For example, users should verify outputs using sources because the model can be wrong.');
    await page.getByRole('button', {name:'Finish answer',exact:true}).click();
  }
  await expect(page.getByRole('heading', { name: 'A little clearer, a little further.' })).toBeVisible();
  await page.getByRole('button', {name:'Back to weekly reviews',exact:true}).click();
  await page.locator('.week-row').filter({hasText:'LLM & Prompt Engineering - Part 1'}).getByRole('button').click();
  await page.evaluate(() => window.releaseFeedback());
  await expect(page.getByRole('button', {name:'Begin review',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Begin review',exact:true}).click();
  await expect(page.locator('.review-conversation')).toContainText('WEEK 02');
  await expect(page.locator('.question-card h2')).toContainText('few-shot');
});
