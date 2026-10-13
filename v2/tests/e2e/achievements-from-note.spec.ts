/**
 * Turn a note into an achievement (V379, QA-517; builder E). A member captures a note on My day, opens it, chooses Turn
 * into → Achievement, picks the category (the title comes from the note) and saves: the toast says it is logged, the note
 * shows "turned into" with the achievement, and its chip opens the achievement's record page, which says "From note" and
 * leads back. Every value is made up (rule 7).
 * Sabotages: tests/sabotage/achievements.mjs "note-turns-into-no-achievement", "achievement-forgets-its-note".
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();

/** A department's plan for this Riyadh year, with the starting categories — opened once, whichever spec comes first. */
async function planFor(department: string) {
  await sql(
    `insert into core.department (code, name_en, name_ar) values ($1, initcap($1), 'قسم ' || $1) on conflict (code) do nothing`,
    [department],
  );
  await sql(
    `do $$
     declare
       d uuid := (select id from core.department where code = '${department}');
       y int := extract(year from now() at time zone 'Asia/Riyadh')::int;
       p uuid;
     begin
       if perf.plan_of(d, y) is null then
         begin
           insert into perf.plan (department_id, year, name) values (d, y, 'Made-up plan ' || y) returning id into p;
           perform perf.categories_seed(p);
         exception when unique_violation then null;
         end;
       end if;
     end $$`,
  );
}

test.beforeAll(async () => {
  await planFor('commercial');
});

test('a note turned into an achievement says so, and the achievement says where it came from', async ({ page }) => {
  const member = await makePerson();
  const tag = member.id.slice(0, 8);
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  const r = await callAs(page.context(), 'note_capture', {
    p_kind: 'sticky',
    p_values: { title: `Made-up fix for the booking queue ${tag}`, visibility: 'private' },
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const noteId = (r.body as { id: string }).id;

  await page.goto(`/my-day/notes/${noteId}`);
  await hydrated(page);
  await page.locator('[data-turn-into]').click();
  await page.locator('[data-turn-kind="achievement"]').click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.locator('[data-achievement-from-note]'),
    'Achievement from note opens from Turn into',
  ).toBeVisible();
  await expect(dialog.getByLabel('What')).toHaveValue(`Made-up fix for the booking queue ${tag}`);
  await dialog.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option', { name: 'Problem solving' }).click();
  await dialog.locator('[data-achievement-from-note-save]').click();
  await expect(toast(page, 'Achievement logged')).toBeVisible();

  // the note says what it became; its chip opens the achievement, which says where it came from and leads back
  const chip = page.locator('[data-note-links] [data-turned-into="achievement"]');
  await expect(chip).toContainText('Achievement');
  await chip.click();
  await expect(page).toHaveURL(/\/kpis\/achievements\/[0-9a-f-]{36}/);
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`booking queue ${tag}`);
  const back = page.locator('[data-from-note]');
  await expect(back, 'the achievement says it came from the note').toBeVisible();
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/my-day/notes/${noteId}`));
});
