/**
 * 13 Oct sweep, PR 1 (V235): Finance has a New invoice button for a person with Full on Finance (desktop only — on a phone
 * Create in the bar already offers it, V630); Every value is
 * made up.
 * Sabotage: tests/sabotage/new-button.mjs "finance-new-button-always-hidden", "finance-new-button-for-everyone".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

test('Finance: New invoice is on the page for Full, opens the form, is off on a phone', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email, '/finance');
  await hydrated(page);
  const button = page.locator('[data-new-invoice-link]');
  await expect(button, 'Full on Finance sees New invoice on the page').toBeVisible();
  await expect(button).toHaveText('New invoice');
  await button.click();
  await expect(page).toHaveURL(/\/finance\/new$/);
  await hydrated(page);
  await expect(page.locator('[data-new-invoice]')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  await hydrated(page);
  await expect(page.locator('[data-new-invoice-link]'), 'on a phone Create in the bar is the one action').toBeHidden();
});

test('Finance: a member does not get the New invoice button', async ({ page }) => {
  const member = await makePerson();
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, member.email, '/finance');
  await hydrated(page);
  await expect(page.locator('[data-new-invoice-link]')).toHaveCount(0);
});
