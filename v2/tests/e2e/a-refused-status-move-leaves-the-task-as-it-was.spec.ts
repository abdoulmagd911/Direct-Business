/**
 * A status move the database refuses changes nothing on screen (the Architect's order of 2 Nov: 4cfaca77 showed a move
 * before the database had answered, so a refused move still read as made). At 375 px and 1,440 px: the owner moves a
 * Not started task to In progress, the database refuses it, the refusal is said in a toast, and the record still reads
 * Not started, before and after a reload. Everyone here is made up (rule 7).
 * Sabotage: tests/sabotage/status-move-shown-before-the-answer.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const WIDTHS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'desk', width: 1440, height: 900 },
] as const;

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

for (const w of WIDTHS) {
  test(`${w.name}: a refused status move leaves the task as it was`, async ({ browser }) => {
    const owner = await makePerson();
    await sql(
      `insert into core.department (code, name_en, name_ar) values ('commercial', 'Test department', 'قسم تجريبي')
       on conflict (code) do nothing`,
    );
    await sql(
      `insert into core.team (department_id, code, name_en, name_ar, created_by)
       values ((select id from core.department where code = 'commercial'), 'test_tasks', 'Test tasks team', 'فريق مهام تجريبي', $1)
       on conflict (department_id, code) do nothing`,
      [owner.id],
    );
    await sql(
      `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                         where d.code = 'commercial' and t.code = 'test_tasks') where id = $1`,
      [owner.id],
    );
    const number = `TSK-1999-${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await sql(
      `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by)
       values ($1, 'Made-up refused move', $2, (select team_id from core.person where id = $2),
               (select department_id from core.person where id = $2),
               (select id from work.task_status where is_default and deleted_at is null), 'internal', $2)`,
      [number, owner.id],
    );
    const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const page = await ctx.newPage();
    await signIn(page, owner.email, `/tasks/${number}`);
    await hydrated(page);
    const chip = page.locator('button[data-task-status]');
    await expect(chip).toHaveAttribute('data-task-status', 'not_started');

    // the database says no, as it does for a move it will not make
    await page.route('**/rest/v1/rpc/task_status_set', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'P0001', message: 'task.status_before_raised', details: null, hint: null }),
      }),
    );
    await chip.click();
    await page.locator('[data-move="in_progress"]').click();
    await expect(page.locator('[data-sonner-toast]', { hasText: 'before the task was raised' }).first()).toBeVisible();
    await expect(chip, 'a refused move is not shown as made').toHaveAttribute('data-task-status', 'not_started');
    const status = await sql<{ key: string }>(
      `select s.key from work.task t join work.task_status s on s.id = t.status_id where t.number = $1`,
      [number],
    );
    expect(status[0]?.key).toBe('not_started');

    await page.unroute('**/rest/v1/rpc/task_status_set');
    await page.reload();
    await hydrated(page);
    await expect(page.locator('button[data-task-status]')).toHaveAttribute('data-task-status', 'not_started');
    await ctx.close();
  });
}
