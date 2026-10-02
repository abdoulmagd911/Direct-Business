/**
 * My profile (V9, V74, V97, V217): a team member edits their own profile — display name, colour, Compact — and sees
 * it at once in the top bar and the drawer foot; Settings is refused by address; another person's page
 * shows no Edit; the profile chip opens My profile; an Undo puts the stored value and the density back on screen.
 * Sabotage: tests/sabotage/screens.mjs "profile-saves-nothing", "settings-open-to-everyone", "profile-chip-leads-
 * nowhere", "profile-keeps-the-undone-value", "profile-keeps-the-undone-density".
 */
import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
// the newest toast is the front of the stack (older ones sit behind it, not clickable until hovered)
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });
const cookie = (page: Page, name: string) =>
  page.evaluate((n) => document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'))?.[1] ?? null, name);

test('a team member edits their profile and sees it at once; Settings refuses them by address', async ({ page }) => {
  const member = await makePerson();
  const other = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, member.email, '/profile');
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
  await expect(page.getByRole('heading', { level: 1, name: 'My profile' })).toBeVisible();

  await page.getByLabel('Display name', { exact: true }).fill('Nick');
  await page.getByLabel('Display name', { exact: true }).press('Enter');
  await expect(page.getByText('Profile saved').first()).toBeVisible();
  await expect(page.locator('[data-topbar] [data-profile-chip]')).toContainText('Nick');
  await expect(page.locator('[data-drawer] [data-entity="person"]')).toContainText('Nick');

  await page.locator('[data-colour="c5"]').click();
  await expect(page.getByText('Profile saved').first()).toBeVisible();
  // no badge, no theme, no start page, no drawer on the screen (V217, cut 6)
  for (const gone of ['Badge', 'Theme', 'Start page', 'Drawer', 'Nickname'])
    await expect(page.getByLabel(gone, { exact: true }), `${gone} is not on My profile`).toHaveCount(0);

  await page.getByLabel('Density').click();
  await page.getByRole('option', { name: 'Compact' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');

  // the profile row holds it (a reload keeps every choice)
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Nick');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  const [row] = await sql<{ display: string | null; density: string | null }>(
    `select pr.density, pr.display_name_en as display
       from core.person p left join core.person_profile pr on pr.person_id = p.id where p.id = $1`,
    [member.id],
  );
  expect(row).toMatchObject({ display: 'Nick', density: 'compact' });

  // the devices list shows this device
  await expect(page.locator('[data-device][data-this-device]')).toHaveCount(1);

  // Settings is the admin's door: no entry, and the address is refused in words
  await expect(page.locator('[data-drawer]').getByRole('link', { name: 'Settings' })).toHaveCount(0);
  await page.goto('/settings/org');
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
  await expect(page.locator('[data-state="no-access"]')).toBeVisible();
  await expect(page.locator('[data-people]')).toHaveCount(0);

  // another person's page opens (the structure is everyone's — V132) but carries no Edit and no access rail
  await page.goto(`/people/${other.id}`);
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
  await expect(page.getByRole('heading', { level: 1, name: other.name })).toBeVisible();
  await expect(page.locator('[data-person-edit]')).toHaveCount(0);
  await expect(page.locator('[data-person-switch]')).toHaveCount(0);
});

test('the profile chip opens My profile; an Undo puts the stored value and the density back on screen', async ({
  page,
}) => {
  const member = await makePerson();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, member.email, '/my-day');
  await hydrated(page);

  // the chip in the top bar leads to My profile (the address is /profile — QA on #92)
  await page.locator('[data-topbar] [data-profile-chip]').click();
  await page.getByRole('menuitem', { name: 'My profile' }).click();
  await expect(page, 'the chip opens My profile').toHaveURL(/\/profile$/);
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1, name: 'My profile' })).toBeVisible();

  // the first save of a profile creates its row, and the database does not undo a creation of core.person_profile
  // (its Undo answers "cannot be removed" — NEED for builder A), so the Undos below start from a profile that exists
  await sql(`insert into core.person_profile (person_id, created_by) values ($1, $1)`, [member.id]);
  await page.reload();
  await hydrated(page);

  // a saved display name, undone: the stored (empty) value is what the screen shows, and what a reload shows
  await page.getByLabel('Display name', { exact: true }).fill('Undone Nick');
  await page.getByLabel('Display name', { exact: true }).press('Enter');
  await toast(page, 'Profile saved').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(toast(page, 'Undone')).toBeVisible();
  await expect(
    page.getByLabel('Display name', { exact: true }),
    'the undone value is gone from the screen',
  ).toHaveValue('');
  await expect(page.locator('[data-topbar] [data-profile-chip]')).not.toContainText('Undone Nick');
  const [row] = await sql<{ display: string | null }>(
    `select display_name_en as display from core.person_profile where person_id = $1`,
    [member.id],
  );
  expect(row!.display).toBeNull();

  // a saved density, undone: the page and its cookie go back to the stored density, not the undone one
  await page.getByLabel('Density').click();
  await page.getByRole('option', { name: 'Compact' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  expect(await cookie(page, 'v2.density')).toBe('compact');
  await expect(toast(page, 'Profile saved')).toBeVisible();
  await toast(page, 'Profile saved').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(toast(page, 'Undone')).toBeVisible();
  await expect(page.locator('html'), 'the undone density is gone from the page').not.toHaveAttribute(
    'data-density',
    'compact',
  );
  await expect
    .poll(() => cookie(page, 'v2.density'), { message: 'the density cookie follows the profile' })
    .not.toBe('compact');
  await page.reload();
  await hydrated(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-density', 'compact');
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('');

  // a change made elsewhere (another device) shows after a reload without a stale copy in the way
  await sql(`update core.person_profile set display_name_en = 'Elsewhere' where person_id = $1`, [member.id]);
  await page.reload();
  await hydrated(page);
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Elsewhere');
});

test("a browser with no choice of its own gets the profile's density and theme before the first paint (QA-126)", async ({
  page,
}) => {
  const member = await makePerson();
  // the theme leaves the screens with the one-theme change, so a stored one stands in for it here — stored before the
  // page opens, so no save of the page's own can race it
  await sql(`insert into core.person_profile (person_id, created_by, theme) values ($1, $1, 'dark')`, [member.id]);
  await page.setViewportSize({ width: 1500, height: 900 });
  await signIn(page, member.email, '/profile');
  await hydrated(page);
  // the density is chosen in My profile (V217, cut 5: the chip menu holds My profile and Sign out only)
  await page.getByLabel('Density').click();
  await page.getByRole('option', { name: 'Compact' }).click();
  await expect(toast(page, 'Profile saved'), 'My profile saves to the profile').toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await sql<{ density: string | null }>(`select density from core.person_profile where person_id = $1`, [
            member.id,
          ])
        )[0]?.density,
    )
    .toBe('compact');
  await page.context().clearCookies({ name: /^v2\./ });
  const res = await page.reload();
  expect(await res!.text(), 'the server renders the profile theme').toMatch(/<html[^>]*data-theme="dark"/);
  await hydrated(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
});
