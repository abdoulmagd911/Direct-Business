/**
 * Settings → Targets lists the plans that are open and opens one for a department and a year it has none for; the day the
 * app went live (Settings → App) is chosen in the date box, never typed as 2026-10-27, and read back as 27 Oct 2026.
 * Every value is made up. Sabotages: tests/sabotage/go-live-day.mjs, tests/sabotage/targets.mjs.
 */
import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();

test('Targets opens a plan for a department and a year it has none for, and lists it', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const tag = Math.random().toString(36).slice(2, 7);
  const name = `Made-up targets dept ${tag}`;
  await sql(`insert into core.department (code, name_en, name_ar) values ($1, $2, $3)`, [
    `d_${tag}`,
    name,
    `إدارة ${tag}`,
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email, '/settings/performance');
  await hydrated(page);
  await expect(page.locator('[data-targets]')).toBeVisible();

  await page.locator('[data-plan-open]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Department').click();
  await page.getByRole('option', { name }).click();
  const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }).slice(0, 4);
  await expect(dialog.getByLabel('Year'), 'this year is offered first').toContainText(year);
  await dialog.locator('[data-plan-save]').click();
  await expect(toast(page, `The ${year} plan is open`)).toBeVisible();

  const row = page.locator('[data-plan-row]', { hasText: name });
  await expect(row).toBeVisible();
  await expect(row).toContainText(year);
  await expect(row).toContainText(/Categories: [1-9]/);

  // a year the department already has is not offered again
  await page.locator('[data-plan-open]').click();
  await dialog.getByLabel('Department').click();
  await page.getByRole('option', { name }).click();
  await dialog.getByLabel('Year').click();
  await expect(page.getByRole('option', { name: year, exact: true }), 'a year with a plan is not offered').toHaveCount(
    0,
  );
});

test('the day the app went live is chosen in the date box and read back as 27 Oct 2026', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email, '/settings/app');
  await hydrated(page);
  const card = page.locator('[data-setting="app.go_live_on"]');
  await card.locator('[data-setting-change]').click();
  const dialog = page.getByRole('dialog');
  const box = dialog.getByLabel('New value');
  await expect(box, 'a date box, not a text box').toHaveAttribute('type', 'date');
  await box.fill('2026-10-27');
  await expect(box).toHaveValue('2026-10-27');
  await expect(dialog.locator('[data-date-text]')).toHaveText('27 Oct 2026');
  await dialog.getByLabel('Reason').fill('Made-up reason: only looking');
  await expect(dialog.locator('[data-setting-preview]')).toContainText('27 Oct 2026');
  // nothing is saved: the day is a setting of the whole app, which other specs read
});
