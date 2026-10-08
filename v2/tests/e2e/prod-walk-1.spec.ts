/**
 * The production walk of 1 Oct, the screens' small items (W35–W49): the tab says the page it is on (W37); a page the
 * person may not open says so once and offers Go to My day (W40); the phone's Search box is 44 px high (W41); an empty
 * Settings group says "Nothing to set up here yet." (W44); a setting nobody changed says "Default", not a 2026 date
 * (W45); the file types carry their extension (W46); a list's Key is behind Details and a new entry takes one from its
 * name (W49); the sign-in and password boxes name what they are for (W35). Every value is made up.
 * Sabotages: tests/sabotage/screens.mjs "page-titles-lost", "no-access-has-no-way-out", "phone-search-too-short",
 * "setting-default-shows-a-date", "file-types-without-extensions", "list-key-stays-in-the-table",
 * "list-key-needs-typing", "settings-empty-group-explains-the-build".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test('each page names itself in the tab (W37)', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email, '/my-day');
  await hydrated(page);
  await expect(page).toHaveTitle('My day · Commercial');
  for (const [route, title] of [
    ['/tasks', 'Tasks · Commercial'],
    ['/clients', 'Clients · Commercial'],
    ['/suppliers', 'Suppliers · Commercial'],
    ['/finance', 'Finance · Commercial'],
    ['/activity', 'Activity · Commercial'],
    ['/profile', 'My profile · Commercial'],
    ['/settings/org', 'People & access · Commercial'],
  ] as const) {
    await page.goto(route);
    await expect(page, route).toHaveTitle(title);
  }
});

test('a page without access says so in one line and leads back to My day (W40)', async ({ page }) => {
  const person = await makePerson();
  await sql(
    `insert into core.role (key, name_en, name_ar, is_admin) values ('test_none', 'Test None', 'بلا صلاحية', false)
     on conflict (key) do nothing`,
  );
  await sql(`update core.person set role_id = (select id from core.role where key = 'test_none') where id = $1`, [
    person.id,
  ]);
  await signIn(page, person.email, '/overview');
  const state = page.locator('[data-state="no-access"]');
  await expect(state).toContainText('You do not have access to Overview');
  await state.locator('[data-no-access-home]').click();
  await expect(page).toHaveURL(/\/my-day/);
});

test('the phone Search box is at least 44 px high (W41)', async ({ page }) => {
  const person = await makePerson();
  await page.setViewportSize({ width: 400, height: 800 });
  await signIn(page, person.email, '/my-day');
  await hydrated(page);
  const box = await page.locator('[data-search]').boundingBox();
  expect(box!.height, 'a finger-sized Search box').toBeGreaterThanOrEqual(44);
});

// W44's empty-group line is checked on the group's body (tests/unit/pages/an-empty-settings-group-says-what-it-is-in-one-
// line.test.tsx): since Finance landed (#186) no Settings group is empty, and Settings › Finance shows its lists.
test('Settings › Finance shows its lists, not the empty-group line (W44, #186)', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email, '/settings/finance');
  await hydrated(page);
  await expect(page.locator('main')).not.toContainText('Nothing to set up here yet.');
});

test('a setting nobody changed says Default (W45)', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email, '/settings/work');
  await hydrated(page);
  const card = page.locator('[data-setting="work.reminder_days_before_due"]');
  await expect(card, 'a setting nobody changed says Default').toContainText('Default');
  await expect(card).not.toContainText('Applies from');
});

test('the file types carry their extension (W46)', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email, '/settings/app');
  await hydrated(page);
  const types = page.locator('[data-setting="files.allowed_types"]');
  await expect(types).toContainText('Word (.docx)');
  await expect(types).toContainText('Excel (.xlsx)');
  await expect(types).toContainText('PowerPoint (.pptx)');
});

test("a list's Key is behind Details, and a new entry takes its key from its name (W49)", async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/settings/work');
  await hydrated(page);
  const list = page.locator('[data-list="priority"]');
  await expect(list.locator('th', { hasText: /^Key$/ }), 'the key is not a column').toHaveCount(0);
  await list.locator('[data-list-add]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Key'), 'the key sits behind Details').toBeHidden();
  const name = `Made-up priority ${Math.random().toString(36).slice(2, 7)}`;
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('Name (Arabic)').fill('أولوية تجريبية');
  await dialog.locator('[data-list-save]').click();
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  await expect(list.locator(`[data-list-entry="${key}"]`), 'the key came from the name').toBeVisible();
});

test('the sign-in boxes say what they are for (W35)', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.locator('input[type="email"]')).toHaveAttribute('autocomplete', 'username');
  const password = page.locator('input[autocomplete="current-password"]');
  await expect(password, 'the password box asks the browser for the saved password').toHaveCount(1);
});
