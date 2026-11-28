import { expect, type Page } from '@playwright/test';

/** The Overview reads its blocks in the browser, a few at a time: wait until every block has answered. */
export const blocksSettled = (page: Page) =>
  expect(page.locator('[data-finance-overview] [data-state="loading"]'), 'every block has answered').toHaveCount(0, {
    timeout: 45_000,
  });

/**
 * Landing 58: Finance is in tabs on every screen — open one by its name and wait until it is the open one. The figures
 * stay on top under every tab; a section under another tab is put away until its tab is opened.
 */
export async function openFinanceTab(page: Page, name: 'Overview' | 'Ledger' | 'Owed' | 'Checks' | 'Import') {
  // by the tab's own id, not its words, so the same step opens it in English and in Arabic
  const tab = page.locator(`[data-finance-overview] [role=tab][id$="-tab-${name.toLowerCase()}"]`);
  await tab.click();
  await expect(tab, `the ${name} tab is open`).toHaveAttribute('aria-selected', 'true');
}
