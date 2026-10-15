/**
 * The supervisor's production sweep of 15 Oct, at 375 px and 1,440 px:
 *   1. /tasks/new shows the loading state at once, never a blank page; once the task is saved the address is the new
 *      task's own, so Back and refresh never reopen the empty form.
 *   2. A toast names the thing by its title, then its number: "Done · <title> (<number>)".
 * Every value is made up. Sabotages: tests/sabotage/sweep-15-oct.mjs.
 */
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql, type TestPerson } from './support/stack';

const WIDTHS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'desk', width: 1440, height: 900 },
] as const;

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

/** A made-up member with a home team in the made-up team the task specs share (a task's team is its owner's, V194). */
async function memberWithTeam(): Promise<TestPerson> {
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
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_tasks') where id = $1`,
    [person.id],
  );
  return person;
}

for (const w of WIDTHS) {
  test(`${w.name}: /tasks/new shows Loading at once, and saving moves the address to the new task`, async ({
    browser,
  }) => {
    const member = await memberWithTeam();
    const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const page = await ctx.newPage();
    await signIn(page, member.email, '/my-day');
    await hydrated(page);

    // the page's first bytes already carry the loading state, before the list is read
    const html = await (await page.request.get('/tasks/new')).text();
    expect(html, 'the loading state is in the first answer, not a blank page').toContain('data-tasks-loading');

    await page.goto('/tasks/new');
    await hydrated(page);
    const form = page.locator('form[data-quick-add]');
    await expect(form).toBeVisible();
    const title = `Made-up new task ${randomUUID().slice(0, 6)}`;
    await form.locator('input[name="title"]').fill(title);
    await form.locator('button[type="submit"]').click();

    await expect(page, 'the address is the new task’s own').toHaveURL(/\/tasks\/TSK-\d{4}-\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await page.reload();
    await hydrated(page);
    await expect(page.locator('form[data-quick-add]'), 'a refresh never reopens the empty form').toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await ctx.close();
  });

  test(`${w.name}: the Done toast names the task by its title, then its number`, async ({ browser }) => {
    const member = await memberWithTeam();
    const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const page = await ctx.newPage();
    await signIn(page, member.email, '/my-day');
    await hydrated(page);
    const title = `Made-up toast task ${randomUUID().slice(0, 6)}`;
    const r = await callAs(ctx, 'task_create', { p_values: { title } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const { number } = r.body as { number: string };

    await page.goto(`/tasks/${number}`);
    await hydrated(page);
    await page.locator('[data-mark-done]').click();
    await expect(
      page.locator('[data-sonner-toast]', { hasText: `Done · ${title} (${number})` }),
      'title first, then the number',
    ).toBeVisible();
    await ctx.close();
  });
}
