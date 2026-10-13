/**
 * D5: a task added to a client, and later done, leaves a worded line on the client's timeline (Activity tab) — "Task added:
 * <title>", "Task done: <title>" — the title from the read, the sentence from the screen. Arabic wording is held by the unit
 * test against the real catalogs (the Arabic switch is a global setting, so no spec here turns it on). Every value is made up.
 * Sabotage: tests/sabotage/timeline-events.mjs "timeline-event-has-no-words-on-the-page".
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

test('a task added to a client and then done leaves worded lines on the client’s timeline', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  // a task's team is its owner's (V194): the made-up person gets the one made-up team the task specs share
  await sql(
    `insert into core.department (code, name_en, name_ar) values ('commercial', 'Test department', 'قسم تجريبي')
     on conflict (code) do nothing`,
  );
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_tasks', 'Test tasks team', 'فريق مهام تجريبي', $1)
     on conflict (department_id, code) do nothing`,
    [admin.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_tasks') where id = $1`,
    [admin.id],
  );
  await signIn(page, admin.email, '/my-day');
  await hydrated(page);
  const stamp = Math.random().toString(36).slice(2, 8);
  const org = await callAs(page.context(), 'partner_create', {
    p_partner: { trade_name_en: `Test Org ${stamp}`, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(org.status, JSON.stringify(org.body)).toBe(200);
  const clientId = (org.body as { id: string }).id;
  const title = `Call the hotel ${stamp}`;
  const task = await callAs(page.context(), 'task_create', { p_values: { title, partner_id: clientId } });
  expect(task.status, JSON.stringify(task.body)).toBe(200);
  const taskId = (task.body as { id: string }).id;

  await page.goto(`/clients/${clientId}?tab=activity`);
  await hydrated(page);
  const lines = page.locator('[data-note-event]');
  await expect(
    lines.filter({ hasText: `Task added: ${title}` }),
    'the added line is worded with the title',
  ).toHaveCount(1);

  const closed = await callAs(page.context(), 'task_status_set', { p_id: taskId, p_status: 'done' });
  expect(closed.status, JSON.stringify(closed.body)).toBe(200);
  await page.reload();
  await hydrated(page);
  await expect(lines.filter({ hasText: `Task done: ${title}` }), 'the done line is worded with the title').toHaveCount(
    1,
  );
  await expect(lines, 'two lines, no bare "Update"').toHaveCount(2);
});
