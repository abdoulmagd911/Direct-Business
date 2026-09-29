/**
 * My profile (V9, V74, V97): a team member edits their own profile — nickname, badge, colour, theme Direct, Compact —
 * and sees it at once in the top bar and the drawer foot; Settings is refused by address; another person's page
 * shows no Edit; the profile chip opens My profile; an Undo puts the stored value and the theme back on screen.
 * Sabotage: tests/sabotage/screens.mjs "profile-saves-nothing", "settings-open-to-everyone", "profile-chip-leads-
 * nowhere", "profile-keeps-the-undone-value".
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

  await page.getByLabel('Nickname').fill('Nick');
  await page.getByLabel('Nickname').press('Enter');
  await expect(page.getByText('Profile saved').first()).toBeVisible();
  await expect(page.locator('[data-topbar] [data-profile-chip]')).toContainText('Nick');
  await expect(page.locator('[data-drawer] [data-entity="person"]')).toContainText('Nick');

  await page.locator('[data-colour="c5"]').click();
  await expect(page.getByText('Profile saved').first()).toBeVisible();
  await page.getByLabel('Badge').click();
  await expect(page.getByRole('option', { name: 'Zodiac sign' }), 'the zodiac sign is no longer offered').toHaveCount(
    0,
  );
  await page.getByRole('option', { name: 'Icon' }).click();
  await expect(page.getByLabel('Which one')).toBeVisible();

  await page.getByLabel('Density').click();
  await page.getByRole('option', { name: 'Compact' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await page.getByLabel('Theme').click();
  await page.getByRole('option', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // the profile row holds it (a reload keeps every choice)
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
  await expect(page.getByLabel('Nickname')).toHaveValue('Nick');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const [row] = await sql<{ display: string | null; nickname: string | null; theme: string | null }>(
    `select pr.theme, p.nickname_en as nickname, pr.display_name_en as display
       from core.person p left join core.person_profile pr on pr.person_id = p.id where p.id = $1`,
    [member.id],
  );
  expect(row).toMatchObject({ nickname: 'Nick', theme: 'dark' });

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

test('the profile chip opens My profile; an Undo puts the stored value and the theme back on screen', async ({
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

  // a saved nickname, undone: the stored (empty) value is what the screen shows, and what a reload shows
  await page.getByLabel('Nickname').fill('Undone Nick');
  await page.getByLabel('Nickname').press('Enter');
  await toast(page, 'Profile saved').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(toast(page, 'Undone')).toBeVisible();
  await expect(page.getByLabel('Nickname'), 'the undone value is gone from the screen').toHaveValue('');
  await expect(page.locator('[data-topbar] [data-profile-chip]')).not.toContainText('Undone Nick');
  const [row] = await sql<{ nickname: string | null }>(
    `select nickname_en as nickname from core.person where id = $1`,
    [member.id],
  );
  expect(row!.nickname).toBeNull();

  // a saved theme, undone: the page and its cookie go back to the stored theme (Direct), not the undone one
  await page.getByLabel('Theme').click();
  await page.getByRole('option', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await cookie(page, 'v2.theme')).toBe('dark');
  await expect(toast(page, 'Profile saved')).toBeVisible();
  await toast(page, 'Profile saved').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(toast(page, 'Undone')).toBeVisible();
  await expect(page.locator('html'), 'the undone theme is gone from the page').toHaveAttribute('data-theme', 'direct');
  await expect.poll(() => cookie(page, 'v2.theme'), { message: 'the theme cookie follows the profile' }).toBe('direct');
  await page.reload();
  await hydrated(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'direct');
  await expect(page.getByLabel('Nickname')).toHaveValue('');

  // a change made elsewhere (another device, an admin) shows after a reload without a stale copy in the way
  await sql(`update core.person set nickname_en = 'Elsewhere' where id = $1`, [member.id]);
  await page.reload();
  await hydrated(page);
  await expect(page.getByLabel('Nickname')).toHaveValue('Elsewhere');
});

test("the profile menu's theme and density are saved to the profile, not only this browser (QA-126)", async ({
  page,
}) => {
  const member = await makePerson();
  await page.setViewportSize({ width: 1500, height: 900 });
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  await page.locator('[data-profile-chip]').click();
  await page.locator('[data-theme-option="dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toast(page, 'Profile saved'), 'the menu saves to the profile').toBeVisible();
  await page.locator('[data-profile-chip]').click();
  await page.locator('[data-density-option="compact"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await expect
    .poll(
      async () =>
        (
          await sql<{ theme: string | null; density: string | null }>(
            `select theme, density from core.person_profile where person_id = $1`,
            [member.id],
          )
        )[0] ?? null,
      { message: 'the profile row holds both choices' },
    )
    .toEqual({ theme: 'dark', density: 'compact' });
  // a browser with no choice of its own gets them from the profile, before the first paint
  await page.context().clearCookies({ name: /^v2\./ });
  const res = await page.reload();
  expect(await res!.text(), 'the server renders the profile theme').toMatch(/<html[^>]*data-theme="dark"/);
  await hydrated(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
});
