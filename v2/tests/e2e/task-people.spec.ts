/**
 * The task page's Details (the Architect's ruling of 16 Oct, V287), at 375 px and 1,440 px: the owner — or a manager —
 * changes the Owner and adds or removes Helpers with one picker each, every change logged with Undo; a task I am a
 * helper on is in my Tasks list, under My work and Helping. Everyone here is made up (rule 7). Sabotages:
 * tests/sabotage/task-people.mjs.
 */
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql, type TestPerson } from './support/stack';

const WIDTHS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'desk', width: 1440, height: 900 },
] as const;

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();

async function memberWithTeam(name: string): Promise<TestPerson> {
  const person = await makePerson();
  await sql(
    `insert into core.department (code, name_en, name_ar) values ('commercial', 'Test department', 'قسم تجريبي')
     on conflict (code) do nothing`,
  );
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_tasks', 'Test tasks team', 'فريق مهام تجريبي', $1)
     on conflict (department_id, code) do nothing`,
    [person.id],
  );
  await sql(
    `update core.person set full_name_en = $2, team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_tasks') where id = $1`,
    [person.id, name],
  );
  return { ...person, name };
}

/** A task put straight into the database (a fixture), due today so My day lists it. */
async function taskFor(owner: TestPerson, title: string): Promise<string> {
  // digits only, as the task address reads them, and never the same twice across specs running together
  const number = `TSK-1999-${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await sql(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by, due_on)
     values ($1, $2, $3, (select team_id from core.person where id = $3),
             (select department_id from core.person where id = $3),
             (select id from work.task_status where is_default and deleted_at is null), 'internal', $3,
             (now() at time zone 'Asia/Riyadh')::date)`,
    [number, title, owner.id],
  );
  return number;
}

const ownerOf = async (number: string) =>
  (await sql<{ owner_id: string | null }>(`select owner_id from work.task where number = $1`, [number]))[0]?.owner_id;
const helpersOf = async (number: string) =>
  (
    await sql<{ person_id: string }>(
      `select h.person_id from work.task_helper h join work.task t on t.id = h.task_id
       where t.number = $1 and h.deleted_at is null`,
      [number],
    )
  ).map((r) => r.person_id);

for (const w of WIDTHS) {
  test(`${w.name}: a manager changes the Owner with one picker, logged with Undo`, async ({ browser }) => {
    const tag = randomUUID().slice(0, 6);
    const manager = await makePerson({ admin: true });
    const first = await memberWithTeam(`Ab First Owner ${tag}`);
    const second = await memberWithTeam(`Ab Second Owner ${tag}`);
    const number = await taskFor(first, `Made-up owner change ${tag}`);
    const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const page = await ctx.newPage();
    await signIn(page, manager.email, `/tasks/${number}`);
    await hydrated(page);

    const picker = page.locator('[data-owner-picker]').getByRole('combobox', { name: 'Change owner' });
    await expect(picker, 'the Owner is a picker, showing the current owner').toContainText(first.name);
    await picker.click();
    await page.getByRole('option', { name: second.name, exact: true }).click();
    await expect(toast(page, `${number} is now with ${second.name}`)).toBeVisible();
    expect(await ownerOf(number), 'the owner changed').toBe(second.id);
    await expect(picker).toContainText(second.name);

    await toast(page, `${number} is now with`).getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => ownerOf(number), 'Undo gives it back').toBe(first.id);
    await expect(picker).toContainText(first.name);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);
    await ctx.close();
  });

  test(`${w.name}: the owner adds and removes Helpers, logged with Undo; a helper sees the task under My work and Helping`, async ({
    browser,
  }) => {
    const tag = randomUUID().slice(0, 6);
    const owner = await memberWithTeam(`Ab Task Owner ${tag}`);
    const helper = await memberWithTeam(`Ab Task Helper ${tag}`);
    const second = await memberWithTeam(`Ab Task Second Helper ${tag}`);
    const title = `Made-up helped task ${tag}`;
    const number = await taskFor(owner, title);

    const ownerCtx = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const page = await ownerCtx.newPage();
    await signIn(page, owner.email, `/tasks/${number}`);
    await hydrated(page);
    await expect(
      page.locator('[data-owner-picker]'),
      'a member who may not give work to others has no Owner picker',
    ).toHaveCount(0);

    const add = page.locator('[data-helper-add]').getByRole('combobox', { name: 'Add a helper' });
    await add.click();
    await page.getByRole('option', { name: helper.name, exact: true }).click();
    await expect(toast(page, `${helper.name} now helps on ${number}`)).toBeVisible();
    expect(await helpersOf(number), 'the helper is on the task').toEqual([helper.id]);
    const row = page.locator(`[data-helper="${helper.id}"]`);
    await expect(row, 'the helper is listed with a remove button').toContainText(helper.name);
    // a second helper is added to the first, never in their place
    await add.click();
    await page.getByRole('option', { name: second.name, exact: true }).click();
    await expect(toast(page, `${second.name} now helps on ${number}`)).toBeVisible();
    await expect
      .poll(async () => (await helpersOf(number)).sort(), 'the second helper joins the first')
      .toEqual([helper.id, second.id].sort());

    // the helper: the task is in their Tasks list — under My work and under Helping (V195). My day's Today block keeps
    // out what I only help on (V240), so it is not asserted there.
    const helperCtx = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const theirs = await helperCtx.newPage();
    await signIn(theirs, helper.email, '/tasks');
    await hydrated(theirs);
    const rowOf = (p: Page) => p.locator('[data-task-rows] [data-task-row]', { hasText: title });
    await expect(rowOf(theirs), 'a task I help on is in My work').toBeVisible();
    await theirs.goto('/tasks?view=helping');
    await hydrated(theirs);
    await expect(rowOf(theirs), 'and under Helping').toBeVisible();

    // removing the helper takes it away from both, and Undo brings it back
    await page.locator(`[data-helper-remove="${helper.id}"]`).click();
    await expect(toast(page, `${helper.name} no longer helps on ${number}`)).toBeVisible();
    await expect.poll(() => helpersOf(number), 'the helper is off the task, the other stays').toEqual([second.id]);
    await theirs.goto('/tasks?view=helping');
    await hydrated(theirs);
    await expect(rowOf(theirs)).toHaveCount(0);
    await toast(page, 'no longer helps').getByRole('button', { name: 'Undo' }).click();
    await expect
      .poll(async () => (await helpersOf(number)).sort(), 'Undo puts the helper back')
      .toEqual([helper.id, second.id].sort());
    await theirs.reload();
    await hydrated(theirs);
    await expect(rowOf(theirs)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);
    await ownerCtx.close();
    await helperCtx.close();
  });

  test(`${w.name}: a tab that read the task earlier adds a helper without dropping one added since`, async ({
    browser,
  }) => {
    const tag = randomUUID().slice(0, 6);
    const owner = await memberWithTeam(`Ab Stale Owner ${tag}`);
    const first = await memberWithTeam(`Ab First Added ${tag}`);
    const second = await memberWithTeam(`Ab Second Added ${tag}`);
    const number = await taskFor(owner, `Made-up stale tab ${tag}`);
    const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const fresh = await ctx.newPage();
    await signIn(fresh, owner.email, `/tasks/${number}`);
    await hydrated(fresh);
    const stale = await ctx.newPage();
    await stale.goto(`/tasks/${number}`);
    await hydrated(stale);

    // the first tab adds one; the second still shows none, and adds another
    await fresh.locator('[data-helper-add]').getByRole('combobox', { name: 'Add a helper' }).click();
    await fresh.getByRole('option', { name: first.name, exact: true }).click();
    await expect(toast(fresh, `${first.name} now helps on ${number}`)).toBeVisible();
    await stale.locator('[data-helper-add]').getByRole('combobox', { name: 'Add a helper' }).click();
    await stale.getByRole('option', { name: second.name, exact: true }).click();
    await expect(toast(stale, `${second.name} now helps on ${number}`)).toBeVisible();
    await expect
      .poll(async () => (await helpersOf(number)).sort(), 'both helpers are on the task')
      .toEqual([first.id, second.id].sort());
    await ctx.close();
  });
}
