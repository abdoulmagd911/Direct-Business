/**
 * V660 (the owner's productivity list): the top search finds the items inside checklists — a task's own checklist, and
 * a checklist note shared with the reader by name — and says which item it found, beside the task or the note. At 375
 * and 1,440 px. Every value is made up.
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
  test(`search finds the items inside checklists and names them — at ${width} px`, async ({ page, browser }) => {
    const author = await makePerson();
    const named = await makePerson();
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
    const note = await callAs(page.context(), 'note_capture', {
      p_kind: 'checklist',
      p_values: {
        title: 'Made-up trip list',
        visibility: 'person',
        shared_with: named.id,
        items: [{ text: 'Made-up passports' }, { text: `Made-up ${t} visa letter` }],
      },
    });
    expect(note.status, JSON.stringify(note.body)).toBe(200);
    const noteId = (note.body as { id: string }).id;

    await search(page, t);
    const row = page.locator(`[data-palette-task="${task.id}"]`);
    await expect(row, 'the task is found by an item of its checklist').toBeVisible();
    await expect(row.locator('[data-palette-item]'), 'and the search box names the item').toHaveText(` · ${item}`);
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${task.number}$`));

    const theirs = await browser.newContext();
    const other = await theirs.newPage();
    await other.setViewportSize({ width, height });
    await signIn(other, named.email, '/my-day');
    await hydrated(other);
    await search(other, t);
    const hit = other.locator(`[data-palette-note="${noteId}"]`);
    await expect(hit, 'the colleague it is shared with finds the note by an item').toBeVisible();
    await expect(hit.locator('[data-palette-item]')).toHaveText(` · Made-up ${t} visa letter`);
    await theirs.close();
  });
}
