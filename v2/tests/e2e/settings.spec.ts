/**
 * The Settings framework (V97, V131, V133): a setting changes with a reason and a preview and shows its new value; a
 * list entry needs its Arabic name and archives (never deletes); one Undo brings a change back; the settings log
 * shows it and Revert restores the earlier value. Sabotages: tests/sabotage/screens.mjs "list-arabic-optional",
 * "setting-saves-without-reason".
 */
import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();

test('an admin changes a setting with a reason, sees the preview and the new value, and reverts it from the log', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/settings/work');
  await hydrated(page);
  const card = page.locator('[data-setting="work.no_update_days"]');
  const before = (await card.locator('[data-setting-value]').textContent())!.trim();
  const next = before === '12' ? '11' : '12';
  await card.locator('[data-setting-change]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-setting-save]')).toBeDisabled();
  await dialog.getByLabel('New value').fill(next);
  await expect(dialog.locator('[data-setting-save]'), 'a reason is required').toBeDisabled();
  const reason = `Made-up reason ${Date.now().toString(36)}`;
  await dialog.getByLabel('Reason').fill(reason);
  await expect(dialog.locator('[data-setting-preview]')).toContainText(before);
  await expect(dialog.locator('[data-setting-preview]')).toContainText(next);
  // the preview is the database's rolled-back dry run (api.setting_preview — V97), not the screen's guess
  await expect(dialog.locator('[data-setting-preview]')).toHaveAttribute('data-previewed', 'server');
  await dialog.locator('[data-setting-save]').click();
  await expect(toast(page, 'Setting saved')).toBeVisible();
  await expect(card.locator('[data-setting-value]')).toHaveText(next);
  const [row] = await sql<{ value: string }>(
    `select value::text from core.setting where key = 'work.no_update_days' and department_id is null order by valid_from desc, created_at desc limit 1`,
  );
  expect(row!.value).toBe(next);

  // the settings log names it, and Revert brings the earlier value back as a new entry
  await page.goto('/activity?tab=settings');
  await hydrated(page);
  const entry = page.locator('[data-activity-settings] li', { hasText: reason }).first();
  await expect(entry).toBeVisible();
  await entry.locator('[data-setting-revert]').click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Back to the earlier value');
  await page.getByRole('dialog').locator('[data-reason-save]').click();
  await expect(toast(page, 'Setting reverted')).toBeVisible();
  await page.goto('/settings/work');
  await hydrated(page);
  await expect(card.locator('[data-setting-value]')).toHaveText(before);
});

test('a list entry needs its Arabic name, archives with the count shown, and one Undo restores it', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  const key = `test_${Date.now().toString(36)}`;
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/settings/work');
  await hydrated(page);
  const list = page.locator('[data-list="priority"]');
  await list.locator('[data-list-add]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Key').fill(key);
  await dialog.getByLabel('Name', { exact: true }).fill('Made-up priority');
  await expect(dialog.locator('[data-list-save]'), 'the Arabic name is required (V76)').toBeDisabled();
  await dialog.getByLabel('Name (Arabic)').fill('أولوية تجريبية');
  await dialog.locator('[data-list-save]').click();
  await expect(toast(page, 'Entry saved')).toBeVisible();
  const row = list.locator(`[data-list-entry="${key}"]`);
  await expect(row).toBeVisible();

  await row.locator('[data-list-archive]').click();
  // Used in N comes from the database (api.list_usage — V97); a fresh entry is used nowhere
  await expect(page.getByRole('dialog').locator('[data-list-usage]')).toHaveText('Used in 0');
  await expect(page.getByRole('dialog')).toContainText('Made-up priority');
  await page.getByRole('dialog').locator('[data-list-archive-confirm]').click();
  await expect(toast(page, 'archived')).toBeVisible();
  await expect(row).toHaveCount(0); // archived entries hide unless shown
  const [gone] = await sql<{ active: boolean }>(`select active from work.priority where key = $1`, [key]);
  expect(gone, 'archived, never deleted').toMatchObject({ active: false });

  await toast(page, 'archived').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(toast(page, 'Undone')).toBeVisible();
  await expect(list.locator(`[data-list-entry="${key}"][data-active="true"]`)).toBeVisible();
});
