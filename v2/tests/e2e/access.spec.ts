/**
 * The scenario-catalogue gaps in the screens lane (the oversight, 29 Sep 15:57):
 *  · PRF-002/123 — a person at level none on Overview, Finance, KPIs, Reports or Appraisal sees the no-access state,
 *    never an empty page; an admin sees the page.
 *  · ACC-127 — My profile is reached from the chip's menu, the drawer foot and the bottom bar's More sheet.
 *  · ACC-091 — the root goes to the person's start page (their choice, else the admin's default, else My day).
 *  · ACC-090 — a person without their own theme or density gets the admin's defaults.
 *  · ACC-129/139 — the language switch shows only while Arabic is on; a cookie saying Arabic is ignored while it is off.
 * The admin's defaults and the switch come from builder A's `api.app_settings()`; the promises that need it skip, by
 * name, until it exists. Sabotages: tests/sabotage/screens.mjs "none-gets-an-empty-page", "root-ignores-the-start-page",
 * "arabic-cookie-wins-while-off", "profile-link-lost-in-the-drawer".
 */
import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { setPrefs } from './helpers';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

/** A role with no level anywhere (none on every page), and a person in it. */
async function personAtNone() {
  const person = await makePerson();
  await sql(
    `insert into core.role (key, name_en, name_ar, is_admin) values ('test_none', 'Test None', 'بلا صلاحية', false)
     on conflict (key) do nothing`,
  );
  await sql(`update core.person set role_id = (select id from core.role where key = 'test_none') where id = $1`, [
    person.id,
  ]);
  return person;
}

async function appSettingsRpcExists(): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }>(
    `select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'api' and p.proname = 'app_settings') as ok`,
  );
  return row?.ok === true;
}

const NEEDS_A = "waits for builder A's api.app_settings()";

const AREAS: [string, string][] = [
  ['/overview', 'Overview'],
  ['/finance', 'Finance'],
  ['/kpis', 'KPIs'],
  ['/reports', 'Reports'],
  ['/appraisal', 'Appraisal'],
];

test('a person at level none sees the no-access state on every area page, never an empty page', async ({ page }) => {
  const person = await personAtNone();
  await signIn(page, person.email, '/my-day');
  for (const [route, title] of AREAS) {
    await page.goto(route);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('[data-state="no-access"]'), `${route} says no access`).toBeVisible();
    await expect(page.locator('[data-state="no-access"]')).toContainText(`You do not have access to ${title}`);
    await expect(
      page.locator('[data-state="empty"]'),
      `${route} draws no empty state for a refused person`,
    ).toHaveCount(0);
  }
});

test('an admin sees every area page (empty until its step lands), not a refusal', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email, '/my-day');
  for (const [route, title] of AREAS) {
    await page.goto(route);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('[data-state="no-access"]')).toHaveCount(0);
  }
});

test('My profile is reached from the chip, the drawer foot and the bottom bar (ACC-127)', async ({ page }) => {
  const member = await makePerson();
  await page.setViewportSize({ width: 1500, height: 900 });
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  // the drawer foot
  const foot = page.locator('[data-drawer] a[data-entity="person"]');
  await expect(foot).toHaveAttribute('href', '/profile');
  await foot.click();
  await expect(page, 'the drawer foot opens My profile').toHaveURL(/\/profile$/);
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1, name: 'My profile' })).toBeVisible();
  // the chip's menu
  await page.goto('/tasks');
  await hydrated(page);
  await page.locator('[data-topbar] [data-profile-chip]').click();
  await page.getByRole('menuitem', { name: 'My profile' }).click();
  await expect(page, 'the chip opens My profile').toHaveURL(/\/profile$/);
  // the bottom bar's More sheet on a phone
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto('/tasks');
  await hydrated(page);
  await page.locator('[data-bottom-more]').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('a[data-entity="person"]')).toHaveAttribute('href', '/profile');
  await sheet.locator('a[data-entity="person"]').click();
  await expect(page, 'the bottom bar opens My profile').toHaveURL(/\/profile$/);
});

test('the root goes to the start page the person chose (ACC-091)', async ({ page }) => {
  const member = await makePerson();
  await sql(`insert into core.person_profile (person_id, created_by, start_page) values ($1, $1, 'tasks')`, [
    member.id,
  ]);
  await signIn(page, member.email, '/');
  await expect(page, 'the start page is Tasks').toHaveURL(/\/tasks$/);
  // a start page the person may not see falls back to My day, never to a refusal
  await sql(`update core.person_profile set start_page = 'overview' where person_id = $1`, [member.id]);
  await page.goto('/');
  await expect(page).toHaveURL(/\/my-day$/);
});

test("the admin's default start page applies to a person without their own (ACC-091)", async ({ page }) => {
  test.skip(!(await appSettingsRpcExists()), NEEDS_A);
  const admin = await makePerson({ admin: true });
  const member = await makePerson();
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.default_start_page', '"tasks"'::jsonb, current_date, 'Made-up reason', $1)`,
    [admin.id],
  );
  try {
    await signIn(page, member.email, '/');
    await expect(page).toHaveURL(/\/tasks$/);
  } finally {
    await sql(`update core.setting set deleted_at = now() where key = 'app.default_start_page'`);
  }
});

test("the admin's default theme and density apply to a person without their own (ACC-090)", async ({ page }) => {
  test.skip(!(await appSettingsRpcExists()), NEEDS_A);
  const admin = await makePerson({ admin: true });
  const member = await makePerson();
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by) values
       ('app.default_theme', '"dark"'::jsonb, current_date, 'Made-up reason', $1),
       ('app.default_density', '"compact"'::jsonb, current_date, 'Made-up reason', $1)`,
    [admin.id],
  );
  try {
    await signIn(page, member.email, '/my-day');
    await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    // their own choice still wins
    await sql(
      `insert into core.person_profile (person_id, created_by, theme) values ($1, $1, 'light')
       on conflict (person_id) do update set theme = 'light'`,
      [member.id],
    );
    await page.reload();
    await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  } finally {
    await sql(`update core.setting set deleted_at = now() where key in ('app.default_theme', 'app.default_density')`);
  }
});

test('a locale cookie saying Arabic is ignored while Arabic is off, and no switch shows (ACC-129/139)', async ({
  page,
  context,
}) => {
  const member = await makePerson();
  await setPrefs(context, { locale: 'ar' });
  await page.goto('/sign-in');
  await expect(page.locator('html'), 'the door stays English').toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('[data-door-language]'), 'no language button while Arabic is off').toHaveCount(0);
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/\S/);
  await page.locator('[data-topbar] [data-profile-chip]').click();
  await expect(page.getByRole('menu').getByText('Language')).toHaveCount(0);
});

test('once Arabic is on, the switch shows and the cookie is honoured (ACC-129)', async ({ page, context }) => {
  test.skip(!(await appSettingsRpcExists()), NEEDS_A);
  const admin = await makePerson({ admin: true });
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.arabic_enabled', 'true'::jsonb, current_date, 'Made-up reason', $1)`,
    [admin.id],
  );
  try {
    await page.goto('/sign-in');
    // the door draws the button twice — in the phone's bar and beside the form on a wide screen — and shows one
    await expect(page.locator('[data-door-language]:visible')).toBeVisible();
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    await page.locator('[data-topbar] [data-profile-chip]').click();
    await expect(page.getByRole('menu').getByText('Language')).toBeVisible();
    await page.keyboard.press('Escape');
    await setPrefs(context, { locale: 'ar' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  } finally {
    await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled'`);
  }
});
