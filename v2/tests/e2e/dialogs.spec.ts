/**
 * M93 and D19: Escape closes and returns focus; the Confirm box names the item and has Cancel
 * focused; a dirty form is not closed by Escape; toasts carry Undo.
 */
import { expect, test } from '@playwright/test';
import { open, setPrefs } from './helpers';

test.beforeEach(async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/kit');
  await expect(page.locator('[data-kit-section="Table"] tr[data-index]').first()).toBeVisible();
});

test('Escape closes the dialog and returns focus to the opener', async ({ page }) => {
  const opener = page.locator('[data-open-dialog]');
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Add helper' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Colleague')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('Confirm names the item, has Cancel focused, and Enter never removes', async ({ page }) => {
  const opener = page.locator('[data-open-confirm]');
  await opener.click();
  const box = page.getByRole('alertdialog');
  await expect(box).toBeVisible();
  await expect(box).toContainText('Remove INV-T-0204?');
  await expect(box.locator('[data-confirm-cancel]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(box).toBeHidden();
  await expect(page.getByText('Removed', { exact: true })).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('Confirm → Remove → toast with Undo → undone', async ({ page }) => {
  await page.locator('[data-open-confirm]').click();
  await page.locator('[data-confirm-action]').click();
  await expect(page.getByText('Removed', { exact: true })).toBeVisible();
  const toast = page.getByText('INV-T-0204 removed');
  await expect(toast).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('Removed', { exact: true })).toHaveCount(0);
});

test('Escape closes the detail panel and returns focus to the row', async ({ page }) => {
  const row = page.locator('[data-kit-section="Table"] tr[data-index="1"]');
  await row.click();
  const panel = page.locator('aside[data-detail-panel]');
  await expect(panel).toBeVisible();
  await expect(row).toHaveAttribute('aria-current', 'true');
  await panel.locator('[data-panel-close]').focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(row).toBeFocused();
});

test('a failed toast says the reason in words', async ({ page }) => {
  await page.locator('[data-toast-failed]').click();
  await expect(page.getByText('Needs the Full level on Finance')).toBeVisible();
});
