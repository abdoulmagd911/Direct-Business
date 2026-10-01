/**
 * The visual review of 29–30 Sep (V216): the People list says a person's real status and names the department and
 * the team apart; the person record carries the Arabic names, the nicknames and the Arabic job title, adds a second
 * email and removes one with a reason, groups Pages and Settings sections in Access; one's own record shows real
 * figures and never "not measured"; Activity says fields in words and names the added person; an unknown address is
 * a Not found page; every area page says what goes there; a setting's value is a word, never a key; My day greets by
 * the clock; the bell says what it is for when empty. Sabotages: tests/sabotage/screens.mjs "no-role-reads-as-allowed",
 * "not-found-shows-the-raw-path", "activity-shows-column-names", "setting-value-shows-the-key".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });

async function personWithoutRole(): Promise<{ id: string; name: string }> {
  const tag = Math.random().toString(36).slice(2, 8);
  const name = `Test NoRole ${tag}`;
  const [row] = await sql<{ id: string }>(
    `insert into core.person (full_name_en, department_id, role_id, can_sign_in, kind)
       values ($1, (select id from core.department where code = 'commercial'), null, true, 'staff') returning id`,
    [name],
  );
  return { id: row!.id, name };
}

test('the People list: Switched off (grey) and No role (amber) in words; Department and Team apart', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  const off = await makePerson();
  await sql(`update core.person set can_sign_in = false where id = $1`, [off.id]);
  const none = await personWithoutRole();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/settings/org');
  await hydrated(page);
  await expect(page.getByPlaceholder('Search by name or email')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Department' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Team' })).toBeVisible();
  await expect(page.locator(`[data-person-row="${off.id}"] [data-person-status]`), 'switched off in words').toHaveText(
    'Switched off',
  );
  await expect(page.locator(`[data-person-row="${none.id}"] [data-person-status]`), 'no role in words').toHaveText(
    'No role',
  );
  await expect(page.locator(`[data-person-row="${none.id}"] [data-person-role]`)).toHaveText('No role');
  await expect(page.locator(`[data-person-row="${admin.id}"] [data-person-status]`)).toHaveText('Allowed');
  // on a phone the status is still on the card
  await page.setViewportSize({ width: 400, height: 800 });
  await expect(page.locator(`[data-person-card="${off.id}"]`)).toContainText('Switched off');
});

test('the person record: Arabic name, a second email added and one removed with a reason, Access grouped; Activity in words', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  const member = await makePerson();
  const tag = Math.random().toString(36).slice(2, 8);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, `/people/${member.id}`);
  await hydrated(page);

  // the edit form carries the Arabic names, the nicknames and the Arabic job title
  await page.locator('[data-person-edit]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name (Arabic)').fill(`شخص اختبار ${tag}`);
  await dialog.getByLabel('Nickname', { exact: true }).fill('Nick');
  await dialog.getByLabel('Job title (Arabic)').fill('مسمى');
  await dialog.locator('[data-person-save]').click();
  await expect(toast(page, 'updated')).toBeVisible();
  const [stored] = await sql<{ full_name_ar: string | null; nickname_en: string | null; job_title_ar: string | null }>(
    `select full_name_ar, nickname_en, job_title_ar from core.person where id = $1`,
    [member.id],
  );
  expect(stored).toEqual({ full_name_ar: `شخص اختبار ${tag}`, nickname_en: 'Nick', job_title_ar: 'مسمى' });

  // a second email while one exists (QA-123); Remove with a reason (QA-124)
  const second = `test.e2e-second-${tag}@example.test`;
  await expect(page.locator('[data-email-add]'), 'Add email stays once one email exists').toBeVisible();
  await page.locator('[data-email-add]').click();
  await page.getByRole('dialog').getByLabel('Work email').fill(second);
  await page.getByRole('dialog').locator('[data-email-save]').click();
  await expect(page.locator(`[data-person-email="${second}"]`)).toBeVisible();
  await page.locator(`[data-person-email="${second}"] [data-email-remove]`).click();
  await page.getByRole('dialog').getByLabel('Reason').fill(`Made-up reason ${tag}`);
  await page.getByRole('dialog').locator('[data-reason-save]').click();
  await expect(toast(page, 'removed')).toBeVisible();
  await expect(page.locator(`[data-person-email="${second}"]`)).toHaveCount(0);
  // the removed email's sign-in is banned too, not only refused (V144, QA-209)
  const [gone] = await sql<{ banned: boolean }>(
    `select banned_until > now() as banned from auth.users where email = $1`,
    [second],
  );
  expect(gone?.banned, 'its auth user is banned').toBe(true);

  // Access: pages and settings sections apart (item 8)
  await expect(page.locator('[data-access-group="pages"]')).toBeVisible();
  await expect(page.locator('[data-access-group="settings"]')).toBeVisible();

  // the record's own Activity says each field in words with its before and after (W5)
  await page.getByRole('main').getByRole('link', { name: 'Activity' }).click();
  const change = page.locator('[data-history-row]', { hasText: 'Person changed' }).first();
  await expect(change.locator('[data-history-field="nickname_en"]'), 'the field in words').toHaveText(
    /^Nickname: — → Nick$/,
  );
  // the whole change log names the field too, never the column (api.activity carries the names only)
  await page.goto('/activity');
  await hydrated(page);
  await expect(page.locator('[data-activity-changes] [data-history-field="nickname_en"]').first()).toHaveText(
    'Nickname',
  );
  await expect(page.locator('[data-activity-changes]')).not.toContainText('nickname_en');
});

test('a person added is named in Activity with their department; an undo entry offers no Undo (W5, W25)', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  const tag = Math.random().toString(36).slice(2, 8);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/settings/org');
  await hydrated(page);
  await page.locator('[data-person-add]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name', { exact: true }).fill(`Test Person Added ${tag}`);
  await dialog.locator('[data-person-save]').click();
  await expect(toast(page, `Test Person Added ${tag} added`)).toBeVisible();
  await page.goto('/activity');
  await hydrated(page);
  const row = page.locator('[data-history-row]', { hasText: `Test Person Added ${tag}` }).first();
  await expect(row.locator('[data-history-summary]'), 'the person and their department').toContainText(
    `Test Person Added ${tag} · Commercial`,
  );
  await expect(row, 'an added record lists no columns').not.toContainText('full_name_en');
  await row.locator('[data-undo-request]').click();
  await expect(toast(page, 'Undone')).toBeVisible();
  await page.reload();
  await hydrated(page);
  const undoRow = page.locator('[data-history-row][data-kind="undo"]').first();
  await expect(undoRow, 'the undo itself is in the log').toBeVisible();
  await expect(undoRow.locator('[data-undo-request]'), 'an undo entry offers no Undo').toHaveCount(0);
});

test("one's own record shows real figures, never not measured; a member sees a colleague without them", async ({
  page,
}) => {
  const member = await makePerson();
  const colleague = await makePerson();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, member.email, `/people/${member.id}`);
  await hydrated(page);
  const figures = page.locator('[data-key-figures]');
  await expect(figures).not.toContainText('not measured');
  await expect(figures, 'the last sign-in from the log the person may read').toContainText('Last sign-in');
  await expect(page.locator('[data-record-header]').first()).toContainText('Member');
  await page.goto(`/people/${colleague.id}`);
  await hydrated(page);
  await expect(page.locator('[data-key-figures]')).not.toContainText('not measured');
  // the Arabic display name is data: editable on My profile whatever the Arabic switch says (QA-179); the full names
  // are the admins', on the person's record (V217, cut 6)
  await page.goto('/profile');
  await hydrated(page);
  await expect(page.getByLabel('Display name (Arabic)')).toBeVisible();
});

test('an unknown address is Not found; an unbuilt page says it is being built; a setting reads as a word; My day is headed by the date; the empty bell says what it is for', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/no-such-page');
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expect(page.locator('h1'), 'never the raw path as a title').not.toHaveText(/^\//);
  await expect(page.locator('[data-not-found-home]')).toHaveText('Go to My day');
  // an unbuilt page says so in two words (V217, cut 9)
  for (const route of ['/tasks', '/finance', '/kpis']) {
    await page.goto(route);
    await hydrated(page);
    await expect(page.locator('[data-state="empty"]'), `${route} says it is being built`).toContainText('Being built.');
    await expect(page.locator('[data-state="empty"]')).not.toContainText('Nothing here yet');
  }
  await page.goto('/settings/work');
  await hydrated(page);
  await expect(
    page.locator('[data-setting="work.week_starts_on"] [data-setting-value]'),
    'a word, not a key',
  ).toHaveText(/^(Saturday|Sunday|Monday)$/);
  await page.goto('/my-day');
  await hydrated(page);
  // My day's heading is the date, no greeting (V217, cut 9)
  await expect(page.locator('h1')).toHaveText(/^(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day\b.*\d{4}$/);
  await page.locator('[data-bell]').click();
  await expect(page.locator('[data-notifications-panel]')).toContainText('Nothing new');
});
