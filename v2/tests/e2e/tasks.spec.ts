import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { shot } from './helpers';
import { makePerson, signIn, sql, type TestPerson } from './support/stack';

// The Tasks screens, P5-2's first PR (builder D; GC-3, V509's phone test): quick add → the list → the record → Done;
// Blocked needs its reason; a member sees only their department's work (V96); the page never scrolls sideways. At
// 390 px (the phone first) and 1,440 px. Everything here is made up (rule 7): "Test Person …", "Made-up task …".
// Sabotages: tests/sabotage/tasks.mjs.

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desk', width: 1440, height: 900 },
] as const;

/**
 * The one made-up team these specs use in a department (made once, then reused), so repeated runs never crowd another
 * spec's team pickers with "Test team" rows.
 */
async function testTeam(department: string, createdBy: string): Promise<string> {
  await sql(
    `insert into core.department (code, name_en, name_ar) values ($1, 'Test department', 'قسم تجريبي')
     on conflict (code) do nothing`,
    [department],
  );
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = $1), 'test_tasks', 'Test tasks team', 'فريق مهام تجريبي', $2)
     on conflict (department_id, code) do nothing`,
    [department, createdBy],
  );
  const [team] = await sql<{ id: string }>(
    `select t.id from core.team t join core.department d on d.id = t.department_id
     where d.code = $1 and t.code = 'test_tasks'`,
    [department],
  );
  return team!.id;
}

/** A made-up member with a home team in the Commercial department (a task's team is its owner's, V194). */
async function memberWithTeam(): Promise<TestPerson> {
  const person = await makePerson();
  const team = await testTeam('commercial', person.id);
  await sql(`update core.person set team_id = $1 where id = $2`, [team, person.id]);
  return person;
}

/** A task put straight into the database (a fixture), owned by `owner` in `department`'s test team. */
async function taskIn(department: string, owner: string, title: string): Promise<string> {
  const team = await testTeam(department, owner);
  const number = `TSK-1999-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  await sql(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by)
     values ($1, $2, $3, $4, (select department_id from core.team where id = $4),
             (select id from work.task_status where is_default and deleted_at is null), 'internal', $3)`,
    [number, title, owner, team],
  );
  return number;
}

async function signedIn(browser: Browser, person: TestPerson, width: number, height: number, path = '/tasks') {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await signIn(page, person.email, path);
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
  return { ctx, page };
}

async function noSidewaysScroll(page: Page, where: string) {
  const over = await page.evaluate(() => {
    const els = [document.scrollingElement, document.querySelector('[data-page]')].filter(Boolean) as Element[];
    return els.map((e) => e.scrollWidth - e.clientWidth);
  });
  for (const o of over) expect(o, `${where}: no sideways scroll`).toBeLessThanOrEqual(1);
}

/** Riyadh's calendar day, as the date field takes it. */
const riyadhToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

for (const w of WIDTHS) {
  test(`${w.name}: quick add, the list, the record, an action item and Done`, async ({ browser }) => {
    const member = await memberWithTeam();
    const { ctx, page } = await signedIn(browser, member, w.width, w.height);
    const title = `Made-up task ${randomUUID().slice(0, 6)}`;

    await page.locator('[data-add-task]').click();
    const form = page.locator('form[data-quick-add]');
    await form.locator('input[name="title"]').fill(title);
    await form.locator('input[name="due"]').fill(riyadhToday());
    await page.screenshot({ path: shot(`tasks-quick-add-${w.name}`) });
    await form.locator('button[type="submit"]').click();
    await expect(page.getByText(`Task added: ${title}`)).toBeVisible();

    // the list: in My work, due today, nothing sideways
    const row = page.locator('li[data-task-row]', { hasText: title });
    await expect(row, 'the new task is in My work').toBeVisible();
    await expect(row).toHaveAttribute('data-due', 'today');
    await expect(row).toContainText('Due today');
    await noSidewaysScroll(page, `${w.name} list`);
    await page.screenshot({ path: shot(`tasks-list-${w.name}`), fullPage: true });

    // the record
    await row.getByRole('link', { name: title }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('[data-task-status]').first()).toHaveAttribute('data-task-status', 'not_started');
    await noSidewaysScroll(page, `${w.name} record`);

    // an action item on its checklist
    await page.getByRole('link', { name: /Action items/ }).click();
    await page.locator('form[data-add-item] input[name="item"]').fill('Made-up item');
    await page.locator('form[data-add-item] button[type="submit"]').click();
    await expect(page.locator('[data-checklist] li[data-item="Made-up item"]')).toBeVisible();
    await expect(page.locator('[data-open-items]')).toHaveAttribute('data-open-items', '1');
    await page.screenshot({ path: shot(`tasks-record-items-${w.name}`), fullPage: true });

    // Done asks about the open item, then closes it in the same request
    await page.locator('[data-mark-done]').click();
    await expect(page.getByRole('alertdialog')).toContainText('1 action item is still open');
    await page.getByRole('button', { name: 'Close them and finish' }).click();
    await expect(page.locator('[data-task-status]').first()).toHaveAttribute('data-task-status', 'done');
    await expect(page.locator('[data-open-items]')).toHaveAttribute('data-open-items', '0');
    await ctx.close();
  });

  test(`${w.name}: Blocked needs its reason, and the record says it`, async ({ browser }) => {
    const member = await memberWithTeam();
    const title = `Made-up blocked ${randomUUID().slice(0, 6)}`;
    const { ctx, page } = await signedIn(browser, member, w.width, w.height);
    await page.locator('[data-add-task]').click();
    await page.locator('form[data-quick-add] input[name="title"]').fill(title);
    await page.locator('form[data-quick-add] button[type="submit"]').click();
    await page.locator('li[data-task-row]', { hasText: title }).getByRole('link', { name: title }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    await page.locator('button[data-task-status]').click();
    await page.locator('[data-move="blocked"]').click();
    const save = page.locator('[data-reason-save]');
    await expect(save, 'Blocked cannot be saved without its reason').toBeDisabled();
    await page.locator('[data-reason]').fill('   ');
    await expect(save, 'spaces are not a reason').toBeDisabled();
    await page.locator('[data-reason]').fill('Waiting for the made-up supplier');
    await save.click();
    await expect(page.locator('[data-task-status]').first()).toHaveAttribute('data-task-status', 'blocked');
    await expect(page.locator('[data-blocked-reason]')).toContainText('Waiting for the made-up supplier');
    await page.screenshot({ path: shot(`tasks-record-blocked-${w.name}`), fullPage: true });

    // resuming is choosing In progress
    await page.locator('button[data-task-status]').click();
    await page.locator('[data-move="in_progress"]').click();
    await expect(page.locator('[data-task-status]').first()).toHaveAttribute('data-task-status', 'in_progress');
    await expect(page.locator('[data-blocked-reason]')).toHaveCount(0);
    await ctx.close();
  });
}

test('phone: see what is due today and tick one off (V509)', async ({ browser }) => {
  const member = await memberWithTeam();
  const title = `Made-up due today ${randomUUID().slice(0, 6)}`;
  const { ctx, page } = await signedIn(browser, member, 390, 844, '/tasks?due=today');
  await page.locator('[data-add-task]').click();
  await page.locator('form[data-quick-add] input[name="title"]').fill(title);
  await page.locator('form[data-quick-add] input[name="due"]').fill(riyadhToday());
  await page.locator('form[data-quick-add] button[type="submit"]').click();
  const row = page.locator('li[data-task-row]', { hasText: title });
  await expect(row, 'due today shows under the Today chip').toBeVisible();
  await row.locator('[data-done-tick]').click();
  await expect(row.getByText('Done', { exact: true })).toBeVisible();
  await noSidewaysScroll(page, 'phone, ticked');
  await ctx.close();
});

test('a member sees their department’s work, never another’s (V96)', async ({ browser }) => {
  const member = await memberWithTeam();
  const colleague = await memberWithTeam();
  const outsider = await makePerson();
  const ours = await taskIn('commercial', colleague.id, `Made-up colleague task ${randomUUID().slice(0, 6)}`);
  const theirs = await taskIn(`test_other_${randomUUID().slice(0, 8)}`, outsider.id, 'Made-up other department task');
  await sql(
    `update core.person set department_id = (select department_id from work.task where number = $1) where id = $2`,
    [theirs, outsider.id],
  );
  const { ctx, page } = await signedIn(browser, member, 1440, 900, '/tasks?view=team');
  await expect(page.locator(`li[data-task-row="${ours}"]`), 'the department’s task shows in Team').toBeVisible();
  await expect(page.locator(`li[data-task-row="${theirs}"]`), 'another department’s does not').toHaveCount(0);

  await page.goto('/tasks');
  await expect(page.locator(`li[data-task-row="${ours}"]`), 'a colleague’s task is not My work').toHaveCount(0);

  await page.goto(`/tasks/${theirs}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Made-up other department task' })).toHaveCount(0);
  await page.goto(`/tasks/${ours}`);
  await expect(page.locator('[data-mark-done]'), 'a colleague’s task is seen, not changed (Own)').toHaveCount(0);
  await expect(page.locator('span[data-task-status]').first()).toBeVisible();
  await ctx.close();
});
