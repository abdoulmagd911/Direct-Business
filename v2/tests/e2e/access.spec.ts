/**
 * The scenario-catalogue gaps in the screens lane (the oversight, 29 Sep 15:57):
 *  · PRF-002/123 — a person at level none on Overview, Finance, KPIs, Reports or Appraisal sees the no-access state,
 *    never an empty page; an admin sees the page.
 *  · ACC-127 — My profile is reached from the avatar menu at the top, its one place (daily use 10).
 *  · ACC-091 — the root goes to the person's start page (their choice, else the admin's default, else My day).
 *  · ACC-090 — a person without their own theme or density gets the admin's defaults.
 *  · ACC-129/139 — the language switch shows only while Arabic is on; a cookie saying Arabic is ignored while it is off.
 * The promises that change the admin's App settings reach everyone, so they run alone, after every other spec:
 * app-settings.alone.spec.ts. Sabotages: tests/sabotage/screens.mjs "none-gets-an-empty-page", "root-ignores-the-start-page",
 * "arabic-cookie-wins-while-off", "profile-back-in-the-drawer".
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

const AREAS: [string, string][] = [
  ['/overview', 'Overview'],
  ['/finance', 'Finance'],
  ['/kpis', 'Achievements'],
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
  for (const [route, area] of AREAS) {
    await page.goto(route);
    await hydrated(page);
    // /kpis opens the Achievements list until the KPIs page is built (V605 (2))
    const title = route === '/kpis' ? 'Achievements' : area;
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('[data-state="no-access"]')).toHaveCount(0);
  }
});

test('My profile is reached from the avatar menu at the top, its one place, at 1,500 and 400 px (ACC-127)', async ({
  page,
}) => {
  const member = await makePerson();
  await signIn(page, member.email, '/tasks');
  for (const width of [1500, 400]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/tasks');
    await hydrated(page);
    // the drawer, or on a phone More, does not repeat it (daily use 10)
    if (width > 700) await expect(page.locator('[data-drawer] a[href="/profile"]')).toHaveCount(0);
    else {
      await page.locator('[data-bottom-more]').click();
      await expect(page.locator('[data-more-sheet]')).toBeVisible();
      await expect(page.locator('[data-more-sheet] a[href="/profile"]'), 'More has no profile entry').toHaveCount(0);
      await page.keyboard.press('Escape');
    }
    await page.locator('[data-topbar] [data-profile-chip]').click();
    await page.getByRole('menuitem', { name: 'My profile' }).click();
    await expect(page, `the avatar menu opens My profile at ${width} px`).toHaveURL(/\/profile$/);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: 'My profile' })).toBeVisible();
  }
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
