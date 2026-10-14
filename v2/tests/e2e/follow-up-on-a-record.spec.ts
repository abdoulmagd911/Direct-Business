/**
 * Follow up on a record (V632 Stage 2, V282, V283; the oversight's production walk of 14 Oct, findings 1–5). On a client
 * and on a task, Follow up is a visible action with the page's others; it opens the one Capture sheet (#242) on the
 * record, which names it and starts with no words. Save makes ONE follow-up — one note carrying one reminder, about the
 * record, titled "Follow-up" and never with the record's name (QA-560) — and My day lists it once, as a reminder above
 * My notes, tagged with its record, never again as a plain note. The record page then shows its author the follow-up
 * with its time. The client's watch action says Watch, not Follow. On My day a task row's client chip opens the client.
 * At 390 px and 1,440 px; every value made up. Sabotages: tests/sabotage/follow-up.mjs.
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

/**
 * Follow up is a visible action; the sheet names the record and starts empty; Save makes exactly one note carrying
 * exactly one reminder, about the record and titled "Follow-up" — and the record page then shows its chip.
 */
async function followUpOnce(page: Page, person: TestPerson, table: string, id: string, label: string) {
  const button = page.getByRole('button', { name: 'Follow up', exact: true });
  await expect(button, 'Follow up is a visible action on the record').toBeVisible();
  await button.click();
  const sheet = page.locator('[data-quick-capture]');
  await expect(sheet, 'the one Capture sheet opens').toBeVisible();
  await expect(sheet.locator('[data-quick-about]'), 'the sheet names the record').toHaveText(`Follow up on ${label}`);
  await expect(sheet.locator('[data-quick-text]'), 'no words are put in for the person').toHaveValue('');
  await sheet.locator('[data-quick-save]').click();
  await expect(sheet).toHaveCount(0);

  const notes = await sql<{ id: string; title: string; visibility: string; reminders: number }>(
    `select n.id, n.title, n.visibility,
            (select count(*)::int from core.reminder r where r.note_id = n.id and r.deleted_at is null) as reminders
     from my.note n where n.person_id = $1 and n.about_table = $2 and n.about_id = $3 and n.deleted_at is null`,
    [person.id, table, id],
  );
  expect(notes.length, 'one follow-up, not two').toBe(1);
  expect(notes[0]!.reminders, 'carrying exactly one reminder').toBe(1);
  expect(notes[0]!.visibility, 'private (V454)').toBe('private');
  expect(notes[0]!.title, "neutral, never the record's name").toBe('Follow-up');
  await expect(page.locator('[data-follow-up-chip]'), 'the record shows its author the follow-up').toHaveCount(1);
  await expect(page.locator('[data-follow-up-chip]')).toContainText('Follow up ·');
  return notes[0]!.id;
}

/** My day lists the follow-up once — a reminder above My notes, tagged with its record — and never as a plain note. */
async function listedOnceOnMyDay(page: Page, noteId: string, label: string) {
  await page.goto('/my-day');
  await hydrated(page);
  const reminders = page.locator('[data-reminders]');
  await expect(reminders, 'the reminder is listed').toBeVisible();
  await expect(reminders.locator('[data-reminder]'), 'once').toHaveCount(1);
  await expect(reminders, 'tagged with its record').toContainText(`Follow up: ${label}`);
  await expect(page.locator(`[data-block="me"] a[href$="${noteId}"]`), 'and not again among My notes').toHaveCount(0);
  const above = await page.evaluate(() => {
    const r = document.querySelector('[data-reminders]');
    const n = document.querySelector('[data-block="me"]');
    return !!r && !!n && !!(r.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(above, 'the reminders come before My notes').toBe(true);
}

for (const w of WIDTHS) {
  test(`${w.name}: on a client Follow up is visible, saves one follow-up, and Watch is named Watch`, async ({
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
    await expect(page.locator('[data-follow]'), 'watching a record is named Watch, not Follow').toHaveText(
      /^Watch(ing)?$/,
    );
    await page.locator('[data-partner-more]').click();
    await expect(page.getByRole('menuitem', { name: 'Follow up' }), 'no second Follow up in the menu').toHaveCount(0);
    await page.keyboard.press('Escape');
    const noteId = await followUpOnce(page, admin, 'partner.partner', id, name);
    await listedOnceOnMyDay(page, noteId, name);
    await ctx.close();
  });

  test(`${w.name}: on a task Follow up is visible, saves one follow-up, and Escalate stays in the ⋯ menu`, async ({
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
    await expect(page.locator('[data-mark-done]'), 'Mark done stays the main action').toBeVisible();
    await expect(page.getByRole('button', { name: 'Escalate', exact: true })).toHaveCount(0);
    await page.locator('[data-task-more]').click();
    await expect(page.getByRole('menuitem'), 'the ⋯ menu holds Escalate').toHaveText(['Escalate']);
    await page.keyboard.press('Escape');
    const noteId = await followUpOnce(page, admin, 'work.task', id, `${number} · ${title}`);
    await listedOnceOnMyDay(page, noteId, `${number} · ${title}`);
    await ctx.close();
  });

  test(`${w.name}: on My day a task's client chip opens the client`, async ({ browser }) => {
    const admin = await adminWithTeam();
    const { ctx, page } = await signedIn(browser, admin, w.width, w.height);
    const name = `Test Org Chip ${Math.random().toString(36).slice(2, 8)}`;
    const org = await callAs(ctx, 'partner_create', {
      p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
    });
    expect(org.status, JSON.stringify(org.body)).toBe(200);
    const clientId = (org.body as { id: string }).id;
    const task = await callAs(ctx, 'task_create', {
      p_values: { title: `Made-up chip ${name}`, partner_id: clientId },
    });
    expect(task.status, JSON.stringify(task.body)).toBe(200);
    const { number } = task.body as { number: string };
    await sql(`update work.task set due_on = core.riyadh_today() where number = $1`, [number]);

    await page.goto('/my-day');
    await hydrated(page);
    const chip = page.locator(`[data-today-task="${number}"] [data-today-client]`);
    await expect(chip).toHaveText(name);
    await chip.click();
    await expect(page, 'the chip opens the client, not the task').toHaveURL(new RegExp(`/clients/${clientId}$`));
    await ctx.close();
  });
}
