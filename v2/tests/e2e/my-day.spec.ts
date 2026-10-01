/**
 * P3-14 — My day: Capture, then Convert (V433, V454): a note captured in one keystroke is turned into a logged call; the
 * note says "turned into" and the call "from note", each opening the other; deleting the call leaves the note and clears
 * its chip. A team member sees no colleague's private note on any tab or at its address, and neither does an admin
 * (V454); a note shared with the team is there under My team. Finish meeting logs the meeting on its organisation.
 * Wrap up today carries the open captures to the next working day, keeping the day they happened. Every block draws
 * 7 rows and a "more" link, at 400 and 1,500 px.
 * Every value is made up.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { callAs, makePerson, removeAs, signIn, sql, type TestPerson } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });
const tag = () => Math.random().toString(36).slice(2, 8);

async function createClient(context: BrowserContext, name: string) {
  const r = await callAs(context, 'partner_create', {
    p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return (r.body as { id: string }).id;
}

async function capture(context: BrowserContext, title: string, visibility = 'private', kind = 'sticky') {
  const r = await callAs(context, 'note_capture', { p_kind: kind, p_values: { title, visibility } });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return (r.body as { id: string }).id;
}

async function sameTeam(people: TestPerson[]) {
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [people[0]!.id, `md_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  for (const p of people) await sql(`update core.person set team_id = $2 where id = $1`, [p.id, team!.id]);
}

test('a note captured in one keystroke becomes a logged call; both chips lead to the other; deleting the call keeps the note', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  const t = tag();
  const org = `Test Org ${t}`;
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/my-day');
  await hydrated(page);
  await createClient(page.context(), org);

  // one keystroke: "/" comes to the capture row wherever the focus is on My day
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('/');
  const input = page.locator('[data-capture-input]');
  await expect(input).toBeFocused();
  await expect(page.locator('[data-capture-visibility]'), 'private by default (V454)').toHaveText(/Only me/);
  await input.fill(`Call Test Person about the offsite ${t}`);
  await input.press('Enter');
  await expect(toast(page, 'Note filed in My notes')).toBeVisible();
  const row = page.locator('[data-my-note]', { hasText: `offsite ${t}` });
  await expect(row).toBeVisible();

  await row.locator('[data-note-open]').click();
  await expect(page).toHaveURL(/\/my-day\/notes\//);
  await hydrated(page);
  await page.locator('[data-turn-into]').click();
  await expect(page.locator('[data-turn-kind="task"]'), 'a task waits for Tasks').toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(page.locator('[data-turn-kind="task"]')).toContainText('not yet');
  await page.locator('[data-turn-kind="activity"]').click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-partner-search]').fill(org);
  await dialog.locator('[data-partner-hit]').first().click();
  await dialog.getByLabel('Outcome').click();
  await page.getByRole('option').first().click();
  await dialog.locator('[data-log-from-note-save]').click();
  await expect(toast(page, `logged on ${org}`)).toBeVisible();

  // the note says what it became, and the chip opens the organisation, where the call says where it came from
  const chip = page.locator('[data-note-links] [data-turned-into="note"]');
  await expect(chip).toContainText(org);
  await chip.click();
  await hydrated(page);
  const call = page.locator('[data-note-kind="activity"]', { has: page.locator('[data-from-note]') });
  await expect(call).toBeVisible();
  await call.locator('[data-from-note]').click();
  await expect(page).toHaveURL(/\/my-day\/notes\//);

  // the call is deleted: the note stays, its chip goes (spec §3.3a — deleting one never deletes the other)
  const noteUrl = page.url();
  const activityId = await chip.getAttribute('data-link-id');
  await removeAs(admin.id, 'core.note', activityId!);
  await page.goto(noteUrl);
  await hydrated(page);
  await expect(page.locator('[data-note-page]')).toBeVisible();
  await expect(page.locator('[data-note-links] [data-turned-into]')).toHaveCount(0);
});

test('no colleague reads a private note — not on any tab, not at its address, not an admin; a team note is under My team', async ({
  browser,
}) => {
  const author = await makePerson();
  const colleague = await makePerson();
  const admin = await makePerson({ admin: true });
  await sameTeam([author, colleague, admin]);
  const t = tag();
  const mine = await browser.newContext();
  const authorPage = await mine.newPage();
  await signIn(authorPage, author.email, '/my-day');
  const hidden = await capture(mine, `Private thought ${t}`);
  await capture(mine, `For the team ${t}`, 'team');
  await mine.close();

  for (const reader of [colleague, admin]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, reader.email, '/my-day');
    for (const tab of ['', '?tab=team', '?tab=workspace']) {
      await page.goto(`/my-day${tab}`);
      await hydrated(page);
      await expect(page.locator('main'), `${reader.name} on ${tab || 'Me'}`).not.toContainText(`Private thought ${t}`);
    }
    await page.goto('/my-day?tab=team');
    await hydrated(page);
    await expect(page.locator('[data-my-note]', { hasText: `For the team ${t}` })).toContainText(author.name);
    await page.goto(`/my-day/notes/${hidden}`);
    await hydrated(page);
    await expect(page.locator('main'), 'reads as not there, never as "no access"').toContainText('not yours to read');
    await expect(page.locator('main')).not.toContainText(`Private thought ${t}`);
    const read = await callAs(ctx, 'note', { p_id: hidden });
    expect(read.status, 'the door refuses too').not.toBe(200);
    await ctx.close();
  }
});

test('Finish meeting logs the meeting on its organisation and marks the note logged', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const t = tag();
  const org = `Test Org ${t}`;
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/my-day');
  await hydrated(page);
  await createClient(page.context(), org);
  await page.locator('[data-capture-input]').fill(`/meeting Kick-off ${t}`);
  await page.locator('[data-capture-input]').press('Enter');
  await expect(page).toHaveURL(/\/my-day\/notes\//);
  await hydrated(page);
  await page.locator('[data-note-add-item]').click();
  await page.getByRole('textbox', { name: 'Row 1' }).fill('Share the made-up approver list');
  await page.locator('[data-note-save]').click();
  await expect(toast(page, 'Note saved')).toBeVisible();

  await page.locator('[data-finish-meeting]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-finish-tasks]'), 'tasks wait for Tasks, and say so').toContainText('not yet');
  await dialog.locator('[data-partner-search]').fill(org);
  await dialog.locator('[data-partner-hit]').first().click();
  await dialog.getByLabel('Outcome').click();
  await page.getByRole('option').first().click();
  await dialog.locator('[data-log-from-note-save]').click();
  await expect(toast(page, `Meeting logged on ${org}`)).toBeVisible();
  await expect(page.locator('[data-note-links] [data-turned-into="note"]')).toContainText(org);
  await expect(page.locator('[data-finish-meeting]'), 'a finished meeting is not finished twice').toHaveCount(0);
});

test('Wrap up today carries the open captures to the next working day, keeping the day they happened', async ({
  page,
}) => {
  const person = await makePerson();
  const t = tag();
  await signIn(page, person.email, '/my-day');
  const ids = [await capture(page.context(), `First thing ${t}`), await capture(page.context(), `Second thing ${t}`)];
  await page.goto('/my-day');
  await hydrated(page);
  await page.locator('[data-wrap-open]').click();
  const dialog = page.getByRole('dialog');
  for (const id of ids)
    await expect(dialog.locator(`[data-wrap-note="${id}"] [data-wrap-choice="carry"]`)).toHaveAttribute(
      'aria-checked',
      'true',
    );
  await dialog.locator('[data-wrap-save]').click();
  await expect(toast(page, 'Day wrapped up')).toBeVisible();
  await expect(page.locator('[data-my-note]', { hasText: t }), 'carried notes wait for their day').toHaveCount(0);
  const rows = await sql<{ happened_on: string; carried_to: string | null }>(
    `select happened_on::text, carried_to::text from my.note where id = any($1)`,
    [ids],
  );
  for (const r of rows) {
    expect(r.carried_to, 'carried over').not.toBeNull();
    expect(r.carried_to! > r.happened_on, 'to a later day, the day it happened kept').toBe(true);
  }
});

for (const width of [400, 1500])
  test(`every block draws 7 rows and a "more" link at ${width} px`, async ({ page }) => {
    const person = await makePerson();
    const t = tag();
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, person.email, '/my-day');
    for (let i = 1; i <= 10; i++) await capture(page.context(), `Made-up note ${String(i).padStart(2, '0')} ${t}`);
    await page.goto('/my-day');
    await hydrated(page);
    await expect(page.locator('[data-block="me"] [data-block-rows] > li')).toHaveCount(7);
    await expect(page.locator('[data-block-more]')).toHaveText('Show all');
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'no sideways scroll').toBeLessThanOrEqual(
      width,
    );
    await page.locator('[data-block-more]').click();
    await expect(page.locator('[data-block="me"] [data-block-rows] > li')).toHaveCount(10);
  });
