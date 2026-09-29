/**
 * My profile (V9, V74, V97): a team member edits their own profile — nickname, badge, colour, theme Direct, Compact —
 * and sees it at once in the top bar and the drawer foot; Settings is refused by address; another person's page
 * shows no Edit. Sabotage: tests/sabotage/screens.mjs "profile-saves-nothing", "settings-open-to-everyone".
 */
import { expect, test } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

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
  await page.getByRole('option', { name: 'Zodiac sign' }).click();
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
