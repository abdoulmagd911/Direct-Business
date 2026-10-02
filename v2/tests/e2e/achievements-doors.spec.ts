/**
 * The shell's three doors to Achievements (GC-4, V377): the + menu offers Achievement, and the KPIs page links to the
 * list. The record address is held by a unit test. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "kpis-page-hides-the-achievements-link".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

test('the KPIs page links to Achievements, and the + menu offers Achievement', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email, '/kpis');
  await hydrated(page);
  const link = page.locator('[data-achievements-link]');
  await expect(link, 'the KPIs page links to Achievements').toHaveText('Achievements');
  await page.locator('[data-create]').click();
  await expect(page.getByRole('menuitem', { name: 'Achievement' })).toBeVisible();
  await page.keyboard.press('Escape');
  await link.click();
  await expect(page).toHaveURL(/\/kpis\/achievements$/);
  await expect(page.locator('h1')).toHaveText('Achievements');
});
