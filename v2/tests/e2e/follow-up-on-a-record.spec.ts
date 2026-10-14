/**
 * Follow up on a record (V632 Stage 2, the Architect's ruling of 14 Oct; the design brief my-day-stage2 §E, tests 6–7):
 * on a client and on a task the ⋯ menu's first entry is Follow up, and no new button is drawn on the header — on the
 * task page Escalate moved into the same menu, so the header lost a button. Follow up opens the one Capture sheet and
 * hands it the record (`about`: entity, id, the words the sheet shows) on Reminder, with no title: the record's name
 * never goes into the note's title (QA 2), it shows only through `about`. At 390 px and 1,440 px; every value made up.
 * Sabotages: tests/sabotage/follow-up.mjs.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql, type TestPerson } from './support/stack';

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desk', width: 1440, height: 900 },
] as const;

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

/** A made-up admin in the made-up team the task specs share (a task's team is its owner's, V194). */
async function adminWithTeam(): Promise<TestPerson> {
  const admin = await makePerson({ admin: true });
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
  return admin;
}

async function signedIn(browser: Browser, person: TestPerson, width: number, height: number) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await signIn(page, person.email, '/my-day');
  await hydrated(page);
  return { ctx, page };
}

/** Keeps what every open-the-sheet event carried, so a spec can read what the ⋯ entry handed the sheet. */
async function listen(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __capture: unknown[] };
    w.__capture = [];
    window.addEventListener('quick-capture:open', (e) => w.__capture.push((e as CustomEvent).detail ?? null));
  });
}
const heard = (page: Page) => page.evaluate(() => (window as unknown as { __capture: unknown[] }).__capture);

/** How many buttons on the page carry these words — 0 means the action is no button of its own. */
const buttons = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

for (const w of WIDTHS) {
  test(`${w.name}: Follow up is the first entry of a client's ⋯ menu and hands the sheet the client`, async ({
    browser,
  }) => {
    const admin = await adminWithTeam();
    const { ctx, page } = await signedIn(browser, admin, w.width, w.height);
    const name = `Test Org Follow ${Math.random().toString(36).slice(2, 8)}`;
    const org = await callAs(ctx, 'partner_create', {
      p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
    });
    expect(org.status, JSON.stringify(org.body)).toBe(200);
    const id = (org.body as { id: string }).id;

    await page.goto(`/clients/${id}`);
    await hydrated(page);
    await expect(buttons(page, 'Follow up'), 'no Follow up button on the header').toHaveCount(0);
    await listen(page);
    await page.locator('[data-partner-more]').click();
    const first = page.getByRole('menuitem').first();
    await expect(first, 'Follow up is the first entry').toHaveText('Follow up');
    await expect(first).toHaveAttribute('data-follow-up', '');
    await first.click();

    await expect(page.locator('[data-quick-capture]'), 'the one Capture sheet opens').toBeVisible();
    expect(await heard(page)).toEqual([{ kind: 'reminder', about: { entity: 'partner', id, label: name } }]);
    await ctx.close();
  });

  test(`${w.name}: on a task Follow up and Escalate share one ⋯ menu, and the header loses a button`, async ({
    browser,
  }) => {
    const admin = await adminWithTeam();
    const { ctx, page } = await signedIn(browser, admin, w.width, w.height);
    const title = `Made-up follow ${Math.random().toString(36).slice(2, 8)}`;
    const task = await callAs(ctx, 'task_create', { p_values: { title } });
    expect(task.status, JSON.stringify(task.body)).toBe(200);
    const { id, number } = task.body as { id: string; number: string };

    await page.goto(`/tasks/${number}`);
    await hydrated(page);
    await expect(page.locator('[data-mark-done]'), 'Mark done stays the one main action').toBeVisible();
    await expect(buttons(page, 'Escalate'), 'Escalate is no longer a header button').toHaveCount(0);
    await expect(buttons(page, 'Follow up'), 'Follow up is no header button').toHaveCount(0);
    await listen(page);
    await page.locator('[data-task-more]').click();
    const items = page.getByRole('menuitem');
    await expect(items, 'Follow up first, then Escalate').toHaveText(['Follow up', 'Escalate']);
    await items.first().click();

    await expect(page.locator('[data-quick-capture]'), 'the one Capture sheet opens').toBeVisible();
    expect(await heard(page)).toEqual([
      { kind: 'reminder', about: { entity: 'task', id, label: `${number} ${title}` } },
    ]);
    await ctx.close();
  });
}
