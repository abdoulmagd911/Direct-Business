/**
 * Achievements under KPIs (GC-4; builder E). A member logs an achievement with a Direct reference from Log achievement
 * and lands on its record page, the reference on the Evidence tab; the list shows it; a colleague in the same
 * department sees it, someone in another department does not (V96); at 390 px the form fits the phone; the same award
 * logged again for the same organisation asks "This is a new one" or "Same as the earlier one", and the new one carries
 * its number and names the earlier one (V531). Every value is made up (rule 7).
 * Sabotage: tests/sabotage/achievements.mjs "log-sends-no-reference".
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

test('a member logs an achievement with a reference and finds it on its page and in the list', async ({ page }) => {
  const member = await makePerson();
  const tag = member.id.slice(0, 8);
  await signIn(page, member.email, '/kpis/achievements/new');
  await hydrated(page);
  await page.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option', { name: 'Contract signed' }).click();
  await page.getByLabel('What').fill(`Made-up deal ${tag}`);
  await expect(page.getByText('Deal value · Not revenue'), 'Contract signed carries a deal value').toBeVisible();
  await page.getByLabel('Deal value · Not revenue').fill('125000');
  await page.getByLabel('Reference', { exact: true }).fill(`MADE-UP-${tag}`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page, 'Achievement logged')).toBeVisible();
  await expect(page).toHaveURL(/\/kpis\/achievements\/[0-9a-f-]{36}/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Made-up deal ${tag}`);
  await expect(page.getByText('Not revenue').first()).toBeVisible();

  await page.getByRole('link', { name: /Evidence/ }).click();
  await expect(page.locator('[data-refs]')).toContainText(`MADE-UP-${tag}`);

  await page.goto('/kpis/achievements?mine=1');
  await hydrated(page);
  await expect(page.locator('[data-achievement-list]')).toContainText(`Made-up deal ${tag}`);
});

test("a colleague sees the department's achievement; another department does not", async ({ browser }) => {
  await planFor('operations_e2e');
  const owner = await makePerson();
  const colleague = await makePerson();
  const other = await makePerson();
  await sql(
    `update core.person set department_id = (select id from core.department where code = 'operations_e2e')
             where id = $1`,
    [other.id],
  );
  const tag = owner.id.slice(0, 8);
  const [row] = await sql<{ id: string }>(
    `insert into perf.achievement (plan_id, department_id, category_id, title, happened_on, owner_id)
     select c.plan_id, d.id, c.id, $2, (now() at time zone 'Asia/Riyadh')::date, $1
     from core.department d
     join perf.achievement_category c on c.plan_id = perf.plan_of(d.id, extract(year from now() at time zone 'Asia/Riyadh')::int)
     where d.code = 'commercial' and c.code = 'AWARD' and c.deleted_at is null
     returning id`,
    [owner.id, `Made-up award ${tag}`],
  );

  const theirs = await (await browser.newContext()).newPage();
  await signIn(theirs, colleague.email, '/kpis/achievements');
  await hydrated(theirs);
  await expect(theirs.locator('[data-achievement-list]')).toContainText(`Made-up award ${tag}`);
  await theirs.goto(`/kpis/achievements/${row!.id}`);
  await expect(theirs.getByRole('heading', { level: 1 })).toContainText(`Made-up award ${tag}`);
  await expect(theirs.locator('[data-edit-achievement]'), 'a colleague cannot edit it').toHaveCount(0);

  const outside = await (await browser.newContext()).newPage();
  await signIn(outside, other.email, '/kpis/achievements');
  await hydrated(outside);
  await expect(outside.getByText(`Made-up award ${tag}`)).toHaveCount(0);
});

test('Log achievement fits a phone at 390 px', async ({ page }) => {
  const member = await makePerson();
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, member.email, '/kpis/achievements/new');
  await hydrated(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no sideways scroll').toBeLessThanOrEqual(0);
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
});

test('logging the same award again for an organisation offers the one-tap repeat choice', async ({ page, context }) => {
  const member = await makePerson();
  const tag = member.id.slice(0, 8);
  await signIn(page, member.email, '/kpis/achievements');
  await hydrated(page);
  // a made-up organisation the member owns, made through the app's own door as the member
  const made = await callAs(context, 'partner_create', {
    p_partner: {
      trade_name_en: `Made Up Repeat ${tag}`,
      sides: [{ side: 'client', type: 'corporate', owner_id: member.id }],
    },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  const log = async () => {
    await page.goto('/kpis/achievements/new');
    await hydrated(page);
    await page.getByRole('combobox', { name: 'Category' }).click();
    await page.getByRole('option', { name: 'Awards' }).click();
    await page.getByLabel('What').fill(`Made-up travel award ${tag}`);
    await page.getByRole('combobox', { name: 'Organisation' }).click();
    await page.getByRole('option', { name: `Made Up Repeat ${tag}` }).click();
    await page.getByRole('button', { name: 'Save' }).click();
  };
  await log();
  await expect(toast(page, 'Achievement logged')).toBeVisible();
  const first = page.url();
  const number = (await page.locator('[data-record-header]').innerText()).match(/ACH-\d{4}-\d{4,}/)?.[0];
  expect(number, 'the record shows its number').toBeTruthy();

  await log();
  const dialog = page.getByRole('dialog', { name: 'Logged before?' });
  await expect(dialog).toContainText(number!);
  await dialog.locator('[data-repeat-new]').click();
  await expect(toast(page, 'Achievement logged')).toBeVisible();
  await expect(page).not.toHaveURL(first);
  await expect(page.getByRole('link', { name: number! }), 'the new one names the earlier one').toBeVisible();

  await log();
  await page.getByRole('dialog', { name: 'Logged before?' }).locator('[data-repeat-same]').click();
  await expect(page, 'the earlier one opens; nothing is saved').toHaveURL(/\/kpis\/achievements\/[0-9a-f-]{36}$/);
  const [count] = await sql<{ n: number }>(
    `select count(*)::int as n from perf.achievement where owner_id = $1 and deleted_at is null`,
    [member.id],
  );
  expect(count!.n).toBe(2);
});
