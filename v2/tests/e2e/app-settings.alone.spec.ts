/**
 * The admin's App settings reach every screen (QA-207, V182, V214; ACC-090, ACC-091, ACC-129): the default start page,
 * theme and density a person without their own gets, and the language switch once Arabic is on. Each changes a setting
 * of the whole app, which every other spec running at the same moment would see — so these run alone, after all the
 * others (playwright.config.ts, the `alone` project). Every value is made up.
 */
import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { setPrefs } from './helpers';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test("the admin's default start page applies to a person without their own (ACC-091)", async ({ page }) => {
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

test('once Arabic is on, the switch shows and the cookie is honoured (ACC-129)', async ({ page, context }) => {
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
    // the language lives in My profile's Preferences, not in the profile chip's menu (V217, cut 5)
    await page.goto('/profile');
    await hydrated(page);
    await expect(page.locator('main').getByText('Language', { exact: true })).toBeVisible();
    // My profile keeps the language cookie as its own cache, so the cookie choice is tried on another page
    await page.goto('/my-day');
    await hydrated(page);
    await setPrefs(context, { locale: 'ar' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  } finally {
    await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled'`);
  }
});
