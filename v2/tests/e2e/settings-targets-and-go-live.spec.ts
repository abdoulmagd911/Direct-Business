/**
 * Settings → Targets lists the plans that are open and opens one for a department and a year it has none for; a plan
 * row opens the plan's targets screen, where a target and a category are added and edited; the day the app went live
 * (Settings → App) is chosen in the date box, never typed as 2026-10-27, and read back as 27 Oct 2026.
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

test('a plan row opens its targets screen, where a target and a category are added and edited', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const tag = Math.random().toString(36).slice(2, 7);
  const name = `Made-up detail dept ${tag}`;
  await sql(`insert into core.department (code, name_en, name_ar) values ($1, $2, $3)`, [
    `g_${tag}`,
    name,
    `إدارة ${tag}`,
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email, '/settings/performance');
  await hydrated(page);
  await expect(page.locator('[data-targets]')).toBeVisible();

  await page.locator('[data-plan-open]').click();
  const openDialog = page.getByRole('dialog');
  await openDialog.getByLabel('Department').click();
  await page.getByRole('option', { name }).click();
  const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }).slice(0, 4);
  await openDialog.locator('[data-plan-save]').click();
  await expect(toast(page, `The ${year} plan is open`)).toBeVisible();

  // the row opens the plan's targets screen (FIX-23: it used to do nothing)
  const row = page.locator('[data-plan-row]', { hasText: name });
  await row.locator('a').click();
  await expect(page).toHaveURL(new RegExp(`/settings/performance/[0-9a-f-]{36}$`));
  await expect(page.locator('[data-plan-targets]')).toBeVisible();
  await expect(page.locator('[data-plan-categories]')).toBeVisible();
  await expect(page.locator('[data-plan-targets]')).toContainText('No targets yet.');

  // the month picker offers the plan year's twelve months, picked, never typed
  await page.locator('[data-target-add]').click();
  const targetDialog = page.getByRole('dialog');
  await targetDialog.getByLabel('Month').click();
  await expect(page.getByRole('option')).toHaveCount(12);
  await page.getByRole('option', { name: `March ${year}` }).click();
  await targetDialog.getByLabel('Category').click();
  await page.getByRole('option').first().click();
  await targetDialog.getByLabel('Count').fill('5');
  await targetDialog.locator('[data-target-save]').click();
  await expect(toast(page, 'Target saved')).toBeVisible();
  const targetRow = page.locator('[data-target-row]').first();
  await expect(targetRow).toContainText(`March ${year}`);
  await expect(targetRow).toContainText('5');

  // editing the target changes only what changed
  await targetRow.locator('[data-target-edit]').click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel('Count').fill('7');
  await editDialog.locator('[data-target-save]').click();
  await expect(toast(page, 'Target saved')).toBeVisible();
  await expect(page.locator('[data-target-row]').first()).toContainText('7');

  // a category is added, then renamed
  const code = `TEST${tag.toUpperCase()}`;
  await page.locator('[data-category-add]').click();
  const catDialog = page.getByRole('dialog');
  await catDialog.getByLabel('Code').fill(code);
  await catDialog.getByLabel('Name', { exact: true }).fill('Made-up test category');
  await catDialog.getByLabel('Name (Arabic)').fill('فئة اختبار');
  await catDialog.locator('[data-category-save]').click();
  await expect(toast(page, 'Category saved')).toBeVisible();
  const catRow = page.locator(`[data-category-entry="${code}"]`);
  await expect(catRow).toContainText('Made-up test category');
  await catRow.locator('[data-category-edit]').click();
  const catEdit = page.getByRole('dialog');
  await catEdit.getByLabel('Name', { exact: true }).fill('Made-up test category renamed');
  await catEdit.locator('[data-category-save]').click();
  await expect(toast(page, 'Category saved')).toBeVisible();
  await expect(page.locator(`[data-category-entry="${code}"]`)).toContainText('Made-up test category renamed');
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
  await expect(dialog.locator('[data-date-picker]'), 'a date box, not a text box').toBeVisible();
  await expect(box).not.toHaveAttribute('type', 'date');
  await box.fill('2026-10-27');
  await expect(box).toHaveValue('2026-10-27');
  await box.blur();
  await expect(box).toHaveValue('27 Oct 2026');
  await expect(dialog.locator('[data-date-result]')).toHaveText('Tue, 27 Oct 2026');
  await dialog.getByLabel('Reason').fill('Made-up reason: only looking');
  await expect(dialog.locator('[data-setting-preview]')).toContainText('27 Oct 2026');
  // nothing is saved: the day is a setting of the whole app, which other specs read
});

test('a department with a plan for every year says why Open is grey', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const tag = Math.random().toString(36).slice(2, 7);
  const name = `Made-up full dept ${tag}`;
  const [dept] = await sql<{ id: string }>(
    `insert into core.department (code, name_en, name_ar) values ($1, $2, $3) returning id`,
    [`f_${tag}`, name, `إدارة ${tag}`],
  );
  const year = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }).slice(0, 4));
  for (let y = 2024; y <= year + 1; y++)
    await sql(`insert into perf.plan (department_id, year, name, created_by) values ($1, $2, $3, $4)`, [
      dept!.id,
      y,
      `${name} ${y}`,
      admin.id,
    ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email, '/settings/performance');
  await hydrated(page);
  await page.locator('[data-plan-open]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Department').click();
  await page.getByRole('option', { name }).click();
  await expect(dialog.locator('[data-plan-no-year]'), 'a greyed Open says why').toHaveText(
    'This department has a plan for every year.',
  );
  await expect(dialog.locator('[data-plan-save]')).toBeDisabled();
});
