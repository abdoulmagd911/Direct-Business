import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

// The bell says "<who> changed <what> on <record>" (the Architect's order of 14 Oct, after the oversight's phone walk
// read "Admin account changed your Status change"): an admin closes a member's task, and the member's bell reads
// "<admin> changed Status on <number> · <title>", at 1,440 px and at 375 px. Every value is made up.
// Sabotage: supabase/tests/sabotage/a-change-notice-points-at-its-side-row.sql (NTF-05, the data under this line).

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

for (const size of [
  { name: 'desk 1440', width: 1440, height: 900 },
  { name: 'phone 375', width: 375, height: 812 },
]) {
  test(`${size.name}: a change by someone else reads as who changed what on which record`, async ({
    page,
    browser,
  }) => {
    const admin = await makePerson({ admin: true });
    const member = await makePerson();
    // a task's team is its owner's (V194): both get the one made-up team the task specs share
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
                                         where d.code = 'commercial' and t.code = 'test_tasks') where id = any ($1)`,
      [[admin.id, member.id]],
    );

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await signIn(adminPage, admin.email, '/my-day');
    await hydrated(adminPage);
    const title = `Made-up visa call ${Math.random().toString(36).slice(2, 8)}`;
    const made = await callAs(adminCtx, 'task_create', { p_values: { title, owner_id: member.id } });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const task = made.body as { id: string; number: string };
    const closed = await callAs(adminCtx, 'task_status_set', { p_id: task.id, p_status: 'done' });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    await adminCtx.close();

    await page.setViewportSize({ width: size.width, height: size.height });
    await signIn(page, member.email, '/my-day');
    await hydrated(page);
    await page.locator('[data-bell]').click();
    const panel = page.locator('[data-notifications-panel]');
    await expect(panel).toBeVisible();
    await expect(panel, 'who changed what on which record').toContainText(
      `${admin.name} changed Status on ${task.number} · ${title}`,
    );
    await expect(panel, 'never the side row the request wrote').not.toContainText('Status change');
    await expect(panel, 'and the assignment reads the same way').toContainText(
      `${admin.name} assigned you ${task.number} · ${title}`,
    );
    // nothing scrolls sideways on the phone
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(wide, 'no sideways scroll').toBe(false);
  });
}
