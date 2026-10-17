/**
 * The Architect's small ask of 16 Oct on Achievements, at phone (375 px) and desk (1,440 px) width:
 * (1) Log achievement's Deal value takes digits, one decimal point and commas only — anything else says "Enter a number"
 * in place and does not save; (2) the Achievements page has one title, one All (the category filter reads "All
 * categories", the Mine / All switch keeps "All") and no breadcrumb that repeats the title; (3) after Done on a task, one
 * tap offers "Log as achievement", pre-filled with the task's title, that can be waved off — and nothing is offered on
 * Cancelled. Every value is made up.
 * Sabotage: tests/sabotage/achievement-sense.mjs "deal-value-takes-any-text", "achievements-title-repeats",
 * "two-all-filters", "done-offers-nothing", "cancel-offers-the-achievement".
 */
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql, type TestPerson } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const WIDTHS = [
  ['phone 375', 375, 800],
  ['desk 1440', 1440, 900],
] as const;

/** Commercial's plan for this Riyadh year with its starting categories (Contract signed carries a deal value). */
async function plan() {
  await sql(
    `insert into core.department (code, name_en, name_ar) values ('commercial', 'Commercial', 'التجاري') on conflict (code) do nothing`,
  );
  await sql(
    `do $$
     declare
       d uuid := (select id from core.department where code = 'commercial');
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

/** A made-up member with a home team, and one task of theirs (a fixture) — the number to open it by. */
async function memberWithTask(title: string): Promise<{ me: TestPerson; number: string }> {
  const me = await makePerson();
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_sense', 'Test sense team', 'فريق تجريبي', $1)
     on conflict (department_id, code) do nothing`,
    [me.id],
  );
  const [team] = await sql<{ id: string }>(
    `select id from core.team where code = 'test_sense' and department_id = (select id from core.department where code = 'commercial')`,
  );
  await sql(`update core.person set team_id = $1 where id = $2`, [team!.id, me.id]);
  const number = `TSK-1999-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  await sql(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by)
     values ($1, $2, $3, $4, (select department_id from core.team where id = $4),
             (select id from work.task_status where is_default and deleted_at is null), 'internal', $3)`,
    [number, title, me.id, team!.id],
  );
  return { me, number };
}

test.beforeAll(plan);

for (const [label, width, height] of WIDTHS) {
  test(`${label}: Deal value takes digits, a decimal point and commas only; anything else says Enter a number and does not save`, async ({
    page,
  }) => {
    const me = await makePerson();
    const what = `Made-up deal ${randomUUID().slice(0, 8)}`;
    await page.setViewportSize({ width, height });
    await signIn(page, me.email, '/kpis/achievements/new');
    await hydrated(page);
    await page.getByRole('combobox', { name: 'Category' }).click();
    await page.getByRole('option', { name: 'Contract signed' }).click();
    await page.getByLabel('What').fill(what);
    await page.getByLabel('Reference', { exact: true }).fill(`MADE-UP-${what.slice(-8)}`);
    const value = page.getByLabel('Deal value · Not revenue');
    const save = page.getByRole('button', { name: 'Save' });
    const saved = () => sql<{ n: number }>(`select count(*)::int as n from perf.achievement where title = $1`, [what]);

    for (const bad of ['12abc', '1.2.3', 'SAR 5', '1e5', '1 000', '-5', ',', '.']) {
      await value.fill(bad);
      await expect(page.getByRole('alert').filter({ hasText: 'Enter a number' }), `"${bad}" is refused`).toBeVisible();
      await expect(save, `"${bad}" cannot be saved`).toBeDisabled();
      await value.press('Enter'); // Enter on the field must not save it either
    }
    expect((await saved())[0]!.n, 'nothing was saved with a bad value').toBe(0);

    for (const good of ['125000', '1,250.50', '.5', '12,5']) {
      await value.fill(good);
      await expect(page.getByRole('alert').filter({ hasText: 'Enter a number' }), `"${good}" is accepted`).toHaveCount(
        0,
      );
      await expect(save).toBeEnabled();
    }
    await value.fill('1,250.50');
    await save.click();
    await expect(page).toHaveURL(/\/kpis\/achievements\/[0-9a-f-]{36}/);
    const [row] = await sql<{ deal_value: string }>(`select deal_value::text from perf.achievement where title = $1`, [
      what,
    ]);
    expect(Number(row?.deal_value), 'commas read as thousands, the point as the decimal').toBe(1250.5);
  });

  test(`${label}: the Achievements page has one title, one All and no repeating breadcrumb`, async ({ page }) => {
    const me = await makePerson();
    await page.setViewportSize({ width, height });
    await signIn(page, me.email, '/kpis/achievements');
    await hydrated(page);
    const main = page.locator('main');
    await expect(main.getByRole('heading', { level: 1, name: 'Achievements' })).toHaveCount(1);
    await expect(main.getByText('Achievements', { exact: true }), 'the title is said once on the page').toHaveCount(1);
    await expect(main.locator('nav[aria-label="Breadcrumb"]'), 'no breadcrumb repeats the title').toHaveCount(0);
    const filters = page.locator('[data-achievement-filters]');
    await expect(filters.getByText('All', { exact: true }), 'one All among the filters').toHaveCount(1);
    await expect(
      filters.getByRole('combobox', { name: 'Category' }),
      'the category filter says what it holds',
    ).toContainText('All categories');
  });

  test(`${label}: Done offers Log as achievement beside Undo, pre-filled and dismissible; Cancelled offers nothing`, async ({
    page,
  }) => {
    const title = `Made-up signed the supplier ${randomUUID().slice(0, 8)}`;
    const { me, number } = await memberWithTask(title);
    const other = await memberWithTask(`Made-up cancelled ${randomUUID().slice(0, 8)}`);
    await page.setViewportSize({ width, height });
    await signIn(page, me.email, `/tasks/${number}`);
    await hydrated(page);

    const move = async (meaning: 'done' | 'cancelled') => {
      await page.locator('[data-task-status]').first().click();
      await page.locator(`[data-move="${meaning}"]`).click();
    };
    const toast = page.locator('[data-sonner-toast][data-front="true"]');
    const offer = toast.getByRole('button', { name: 'Log as achievement' });

    // Done: one toast with Undo and the offer, and a way to wave it off
    await move('done');
    await expect(toast).toBeVisible();
    await expect(toast.getByRole('button', { name: 'Undo' }), 'Undo is still on the toast').toBeVisible();
    await expect(offer, 'Done offers the achievement').toBeVisible();
    await toast.hover();
    await toast.locator('[data-close-button]').click();
    await expect(toast, 'the offer can be waved off, well before it lapses').toHaveCount(0, { timeout: 1500 });

    // a second Done on a fresh task: taking the offer pre-fills the title
    const second = await memberWithTask(title);
    await sql(
      `update work.task set owner_id = $1, team_id = (select team_id from core.person where id = $1) where number = $2`,
      [me.id, second.number],
    );
    await page.goto(`/tasks/${second.number}`);
    await hydrated(page);
    await move('done');
    await expect(offer).toBeVisible();
    await toast.hover();
    await offer.click();
    await expect(page).toHaveURL(/\/kpis\/achievements\/new\?title=/);
    await hydrated(page);
    await expect(page.getByLabel('What'), 'the task’s words start the title').toHaveValue(title);

    // Cancelled: the toast comes, with Undo, and no offer
    await page.context().clearCookies();
    await signIn(page, other.me.email, `/tasks/${other.number}`);
    await hydrated(page);
    await move('cancelled');
    await expect(toast.getByRole('button', { name: 'Undo' }), 'the move was made').toBeVisible();
    // counted at once: waiting for something to go proves nothing about something that was never there
    expect(await offer.count(), 'Cancelled offers nothing').toBe(0);
  });
}
