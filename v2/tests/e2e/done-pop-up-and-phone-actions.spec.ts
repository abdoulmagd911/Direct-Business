/**
 * The owner's live test of 17 Oct (rulings V641), at 375 px and 1,440 px, every value made up:
 *  (A) the round Done tick on a task row (My day's Today block and the Tasks list) asks "Mark done?" first — Done and
 *      Cancel, Done focused so Enter confirms, the Undo toast after; Cancel and Escape change nothing; a checklist
 *      item's own tick stays one tap;
 *  (B) on a phone the task page's action row holds Done and the ⋯ only — Edit and Follow up sit behind the dots, which
 *      never sit alone on a second row (V633); on a desk all four sit on one row.
 * Sabotages: tests/sabotage/done-pop-up.mjs.
 */
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql, type TestPerson } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

async function memberWithTeam(): Promise<TestPerson> {
  const person = await makePerson();
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select department_id from core.person where id = $1), 'test_done_ask', 'Test done team', 'فريق الإنجاز', $1)
     on conflict (department_id, code) do nothing`,
    [person.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t where t.code = 'test_done_ask'
                                       and t.department_id = core.person.department_id) where id = $1`,
    [person.id],
  );
  return person;
}

/** A task straight into the database, owned by `owner`, due today so My day lists it. */
async function taskFor(owner: TestPerson, title: string): Promise<string> {
  const number = `TSK-1998-${Date.now()}${Math.floor(Math.random() * 1000)}`;
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

const meaning = async (number: string) =>
  (
    await sql<{ m: string }>(
      `select s.meaning as m from work.task t join work.task_status s on s.id = t.status_id where t.number = $1`,
      [number],
    )
  )[0]?.m;

for (const [width, height] of [
  [375, 812],
  [1440, 900],
] as const) {
  for (const where of ['the Tasks list', 'My day'] as const) {
    test(`${where}: the round tick asks Mark done? with Done focused; Cancel and Escape change nothing; Enter confirms, then Undo — at ${width} px`, async ({
      browser,
    }) => {
      const member = await memberWithTeam();
      const title = `Made-up tick task ${randomUUID().slice(0, 6)}`;
      const number = await taskFor(member, title);
      const ctx = await browser.newContext({ viewport: { width, height } });
      const page = await ctx.newPage();
      await signIn(page, member.email, where === 'My day' ? '/my-day' : '/tasks');
      await hydrated(page);
      const row = page.locator(where === 'My day' ? `[data-today-task="${number}"]` : 'li[data-task-row]', {
        hasText: title,
      });
      const tick = row.locator('[data-done-tick]');
      const box = page.locator('[role="alertdialog"]');

      // the tick asks first
      await tick.click();
      await expect(box, 'the tick opens a Mark done? box').toBeVisible();
      await expect(box.getByRole('heading', { name: 'Mark done?' })).toBeVisible();
      await expect(box, 'it names the task').toContainText(title);
      await expect(box.locator('[data-confirm-action]'), 'the button says Done').toHaveText('Done');
      await expect(box.locator('[data-confirm-cancel]')).toHaveText('Cancel');
      await expect(box.locator('[data-confirm-action]'), 'Done has focus, so Enter confirms').toBeFocused();
      expect(await meaning(number), 'asking changes nothing').not.toBe('done');

      // Cancel and Escape leave it open
      await box.locator('[data-confirm-cancel]').click();
      await expect(box).toBeHidden();
      expect(await meaning(number), 'Cancel changes nothing').not.toBe('done');
      await tick.click();
      await page.keyboard.press('Escape');
      await expect(box).toBeHidden();
      expect(await meaning(number), 'Escape changes nothing').not.toBe('done');

      // Enter confirms, and the Undo toast follows
      await tick.click();
      await expect(box.locator('[data-confirm-action]')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect.poll(() => meaning(number), { message: 'Enter marks it done' }).toBe('done');
      const undo = page.locator('[data-sonner-toast]').getByRole('button', { name: 'Undo' });
      await expect(undo, 'an Undo follows').toBeVisible();
      await undo.click();
      await expect.poll(() => meaning(number), { message: 'Undo brings it back' }).not.toBe('done');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        'no sideways scroll',
      ).toBe(true);
      await ctx.close();
    });
  }

  test(`a checklist item's own tick stays one tap, with no question — at ${width} px`, async ({ browser }) => {
    const member = await memberWithTeam();
    const title = `Made-up checklist task ${randomUUID().slice(0, 6)}`;
    const number = await taskFor(member, title);
    await sql(
      `insert into work.action_item (task_id, text, owner_id, happened_on, created_by)
       values ((select id from work.task where number = $1), 'Made-up item to tick', $2, (now() at time zone 'Asia/Riyadh')::date, $2)`,
      [number, member.id],
    );
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    await signIn(page, member.email, `/tasks/${number}?tab=items`);
    await hydrated(page);
    await page.locator('[data-checklist] li[data-item="Made-up item to tick"]').getByRole('checkbox').click();
    await expect(page.locator('[role="alertdialog"]'), 'no Mark done? box for an item').toHaveCount(0);
    await expect(
      page.locator('[data-checklist] li[data-item="Made-up item to tick"]').getByRole('checkbox'),
      'the item is ticked at once',
    ).toBeChecked();
    await ctx.close();
  });
}

test('phone 375: the task page keeps Done, Escalate and the dots on one row; Edit and Follow up are behind the dots', async ({
  browser,
}) => {
  const member = await memberWithTeam();
  const title = `Made-up phone actions ${randomUUID().slice(0, 6)}`;
  const number = await taskFor(member, title);
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await signIn(page, member.email, `/tasks/${number}`);
  await hydrated(page);
  const row = page.locator('[data-record-actions]');
  await expect(row.locator('[data-mark-done]')).toBeVisible();
  await expect(row.locator('[data-task-more]')).toBeVisible();
  await expect(row.locator('[data-escalate-open]'), 'Escalate is a labelled button on the row').toHaveText('Escalate');
  await expect(row.locator('[data-escalate-open]'), 'with its one line of what it does').toHaveAttribute(
    'title',
    'Tell someone about this task, with a note. They get a notification and follow the task from then on.',
  );
  await expect(row.locator('[data-edit-task-open]'), 'Edit is not on the row').toBeHidden();
  await expect(row.locator('[data-follow-up]'), 'Follow up is not on the row').toBeHidden();

  // every action that shows sits on the first row: the dots never sit alone on a second one
  const tops = await row.evaluate((el) =>
    Array.from(el.children)
      .filter((c) => (c as HTMLElement).offsetParent !== null)
      .map((c) => Math.round(c.getBoundingClientRect().top)),
  );
  expect(tops.length, 'Done, Escalate and the dots show').toBeGreaterThanOrEqual(3);
  expect(new Set(tops).size, 'the actions all sit on one row').toBe(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    'no sideways scroll',
  ).toBe(true);

  // behind the dots: Edit and Follow up, each working; Escalate is no longer there
  await row.locator('[data-task-more]').click();
  await expect(page.locator('[data-menu-edit]')).toBeVisible();
  await expect(page.locator('[data-menu-follow-up]')).toBeVisible();
  await expect(page.getByRole('menuitem'), 'the dots hold Edit and Follow up only').toHaveCount(2);
  await page.keyboard.press('Escape');
  await row.locator('[data-escalate-open]').click();
  await expect(page.getByRole('dialog'), 'Escalate opens, its line read out with it').toHaveAccessibleDescription(
    'Tell someone about this task, with a note. They get a notification and follow the task from then on.',
  );
  await page.keyboard.press('Escape');
  await row.locator('[data-task-more]').click();
  await page.locator('[data-menu-edit]').click();
  await expect(page.locator('form[data-edit-task]'), 'Edit from the dots opens the edit form').toBeVisible();
  await page.keyboard.press('Escape');
  await row.locator('[data-task-more]').click();
  await page.locator('[data-menu-follow-up]').click();
  await expect(page.locator('[data-quick-capture]'), 'Follow up opens Capture').toBeVisible();
  await ctx.close();
});

test('phone 375: a closed task still keeps its dots on the row with Follow up behind them', async ({ browser }) => {
  const owner = await memberWithTeam();
  const number = await taskFor(owner, `Made-up closed ${randomUUID().slice(0, 6)}`);
  await sql(
    `update work.task set status_id = (select id from work.task_status where meaning = 'done' and deleted_at is null limit 1),
            closed_at = now() where number = $1`,
    [number],
  );
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await signIn(page, owner.email, `/tasks/${number}`);
  await hydrated(page);
  const row = page.locator('[data-record-actions]');
  await expect(row.locator('[data-task-more]'), 'the dots show').toBeVisible();
  await expect(row.locator('[data-follow-up]')).toBeHidden();
  const tops = await row.evaluate((el) =>
    Array.from(el.children)
      .filter((c) => (c as HTMLElement).offsetParent !== null)
      .map((c) => Math.round(c.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size, 'one row').toBe(1);
  await ctx.close();
});

test('desk 1440: Done, Edit, Follow up and Escalate all sit on one row, with no ⋯', async ({ browser }) => {
  const member = await memberWithTeam();
  const number = await taskFor(member, `Made-up desk actions ${randomUUID().slice(0, 6)}`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page, member.email, `/tasks/${number}`);
  await hydrated(page);
  const row = page.locator('[data-record-actions]');
  for (const sel of ['[data-mark-done]', '[data-edit-task-open]', '[data-follow-up]', '[data-escalate-open]'])
    await expect(row.locator(sel), `${sel} shows on a desk`).toBeVisible();
  await expect(row.locator('[data-escalate-open]'), 'Escalate says what it is').toHaveText('Escalate');
  await expect(row.locator('[data-task-more]'), 'a ⋯ that held only Escalate is gone').toBeHidden();
  const tops = await row.evaluate((el) =>
    Array.from(el.children)
      .filter((c) => (c as HTMLElement).offsetParent !== null)
      .map((c) => Math.round(c.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size, 'one row').toBe(1);
  await ctx.close();
});
