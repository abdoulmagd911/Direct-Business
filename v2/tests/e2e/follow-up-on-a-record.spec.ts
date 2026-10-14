/**
 * Follow up on a record (V632 Stage 2, the Architect's ruling of 14 Oct; the design brief my-day-stage2 §E, tests 6–7;
 * V282): on a client and on a task the ⋯ menu's first entry is Follow up, and no new button is drawn on the header — on
 * the task page Escalate moved into the same menu, so the header lost a button. Follow up opens the one Capture sheet
 * (#242) on the record: it names the record, leaves the words empty, and saves a private note `about` that record whose
 * title is the neutral "Follow-up" — never the record's name (QA-560). At 390 px and 1,440 px; every value made up.
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

/** How many buttons on the page carry these words — 0 means the action is no button of its own. */
const buttons = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/**
 * The sheet opened by Follow up names the record, starts with no words of its own, and saves a private note about
 * that record titled "Follow-up" — never with the record's name in the title.
 */
async function followUpSaves(page: Page, person: TestPerson, table: string, id: string, label: string) {
  const sheet = page.locator('[data-quick-capture]');
  await expect(sheet, 'the one Capture sheet opens').toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Follow up' })).toBeVisible();
  await expect(sheet.locator('[data-quick-about]'), 'the sheet names the record').toHaveText(`Follow up on ${label}`);
  await expect(sheet.locator('[data-quick-text]'), 'no words are put in for the person').toHaveValue('');
  await sheet.locator('[data-quick-save]').click();
  await expect(sheet).toHaveCount(0);
  const [note] = await sql<{ title: string; visibility: string; about_table: string; about_id: string }>(
    `select title, visibility, about_table, about_id from my.note
     where person_id = $1 and deleted_at is null order by created_at desc limit 1`,
    [person.id],
  );
  expect(note, 'a follow-up note was saved').toBeTruthy();
  expect(note!.about_table).toBe(table);
  expect(note!.about_id).toBe(id);
  expect(note!.visibility, 'a follow-up is private (V454)').toBe('private');
  expect(note!.title, 'the title is neutral').toBe('Follow-up');
  expect(note!.title, "the record's name never goes into the title").not.toContain(label);
}

for (const w of WIDTHS) {
  test(`${w.name}: Follow up is the first entry of a client's ⋯ menu and saves a private note about the client`, async ({
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
    await page.locator('[data-partner-more]').click();
    const first = page.getByRole('menuitem').first();
    await expect(first, 'Follow up is the first entry').toHaveText('Follow up');
    await first.click();
    await followUpSaves(page, admin, 'partner.partner', id, name);
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
    await page.locator('[data-task-more]').click();
    const items = page.getByRole('menuitem');
    await expect(items, 'Follow up first, then Escalate').toHaveText(['Follow up', 'Escalate']);
    await items.first().click();
    await followUpSaves(page, admin, 'work.task', id, `${number} ${title}`);
    await ctx.close();
  });
}
