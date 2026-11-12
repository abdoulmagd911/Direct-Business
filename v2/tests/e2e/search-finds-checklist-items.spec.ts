/**
 * V660 (the owner's productivity list): the top search finds the items inside a task's checklist — and says
 * which item it found, beside the task. A checklist note is NOT in search (Landing 15, F-B3-03: the 'notes'
 * key is gone), so no note leg remains here. At 375 and 1,440 px. Every value is made up.
 * Sabotages: supabase/tests/sabotage/search-skips-task-checklists.sql (the server) and
 * tests/sabotage/search-items.mjs (the search box).
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => `moss${Math.random().toString(36).slice(2, 7)}`;
const search = async (page: Page, words: string) => {
  await page.locator('[data-search]').click();
  await page.locator('[data-command-palette]').getByPlaceholder('Go to a page or search…').fill(words);
};

for (const width of [375, 1440]) {
  test(`search finds the items inside checklists and names them — at ${width} px`, async ({ page }) => {
    const author = await makePerson();
    const t = tag();
    const [team] = await sql<{ id: string }>(
      `insert into core.team (department_id, code, name_en, name_ar)
         select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
      [author.id, `ci_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
    );
    await sql(`update core.person set team_id = $2 where id = $1`, [author.id, team!.id]);
    const height = width > 700 ? 1000 : 800;
    await page.setViewportSize({ width, height });
    await signIn(page, author.email, '/my-day');
    await hydrated(page);

    const made = await callAs(page.context(), 'task_create', { p_values: { title: 'Made-up renewal pack' } });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const task = made.body as { id: string; number: string };
    const item = `Made-up ${t} quote from the supplier`;
    const added = await callAs(page.context(), 'action_item_add', { p_task: task.id, p_values: { text: item } });
    expect(added.status, JSON.stringify(added.body)).toBe(200);

    await search(page, t);
    const row = page.locator(`[data-palette-task="${task.id}"]`);
    await expect(row, 'the task is found by an item of its checklist').toBeVisible();
    await expect(row.locator('[data-palette-item]'), 'and the search box names the item').toHaveText(` · ${item}`);
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${task.number}$`));
  });
}
