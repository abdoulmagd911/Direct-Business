/**
 * Landing 58 — Finance in tabs on every screen (the owner's review of 26 Nov: "Finance is too much on one page"), in the
 * browser against made-up people of their own. The figures stay on top; under them one row of tabs — Overview, Ledger,
 * Owed, Checks and, for a person who imports, Import — each shows only its own sections; the open tab rides the address
 * (`?tab=`) so a refresh keeps it; an anchor opens the tab that holds its section; at 375 px nothing scrolls sideways.
 * Every value is made up. Sabotage: tests/sabotage/landing-58-e2e.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { blocksSettled } from './support/finance-blocks';
import { hydrated, personAs, signedInAdmin, signedInAs } from './support/landing-32';

const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const section = (page: Page, id: string) => page.locator(`#${id}`);

test('Finance opens on Overview, each tab shows only its own sections, and the address keeps the tab', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signedInAdmin(page);
  await page.goto('/finance');
  await hydrated(page);
  await blocksSettled(page);

  // the figures are on top, and Overview is open: the months and income by service, nothing else
  await expect(page.locator('[data-finance-tile="revenue"]'), 'the figures are on top').toBeVisible();
  await expect(tab(page, 'Overview')).toHaveAttribute('aria-selected', 'true');
  await expect(section(page, 'finance-months'), 'Overview shows the months').toBeVisible();
  await expect(section(page, 'finance-service'), 'and income by service').toBeVisible();
  for (const id of ['finance-ledger', 'finance-ageing', 'finance-reconciliation', 'finance-held'])
    await expect(section(page, id), `${id} is under another tab`).toBeHidden();
  await expect(tab(page, 'Import'), 'an admin imports').toBeVisible();

  // Ledger: the ledger and "Is it counted?", the months put away; the address names the tab
  await tab(page, 'Ledger').click();
  await expect(page).toHaveURL(/\/finance\?tab=ledger$/);
  await expect(section(page, 'finance-ledger'), 'Ledger shows the ledger').toBeVisible();
  await expect(section(page, 'finance-months'), 'the months are put away').toBeHidden();
  await expect(page.locator('[data-finance-tile="revenue"]'), 'the figures stay on top').toBeVisible();

  // a refresh keeps the tab
  await page.reload();
  await hydrated(page);
  await expect(tab(page, 'Ledger'), 'a refresh keeps Ledger').toHaveAttribute('aria-selected', 'true');
  await expect(section(page, 'finance-ledger')).toBeVisible();

  // Owed: what is owed and how old
  await tab(page, 'Owed').click();
  await expect(page).toHaveURL(/\/finance\?tab=owed$/);
  await expect(section(page, 'finance-ageing'), 'Owed shows what is owed').toBeVisible();
  await expect(section(page, 'finance-ledger')).toBeHidden();

  // Checks: does Finance agree with itself, and what is held
  await tab(page, 'Checks').click();
  await expect(page).toHaveURL(/\/finance\?tab=checks$/);
  await expect(section(page, 'finance-reconciliation'), 'Checks shows the reconciliation').toBeVisible();
  await expect(section(page, 'finance-held'), 'and what is held').toBeVisible();
  await expect(section(page, 'finance-ageing')).toBeHidden();

  // Import, and back to Overview: the bare address
  await tab(page, 'Import').click();
  await expect(section(page, 'finance-import'), 'Import shows the import').toBeVisible();
  await tab(page, 'Overview').click();
  await expect(page).toHaveURL(/\/finance$/);
  await expect(section(page, 'finance-months')).toBeVisible();

  // an anchor opens the tab that holds its section
  await page.goto('/finance#finance-ageing');
  await hydrated(page);
  await expect(tab(page, 'Owed'), '#finance-ageing opens Owed').toHaveAttribute('aria-selected', 'true');
  await expect(section(page, 'finance-ageing')).toBeVisible();
});

test('a member who does not import has no Import tab, and on a phone the tabs fit with nothing scrolling sideways', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const member = await personAs('member');
  const { context, page } = await signedInAs(browser, member);
  try {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/finance');
    await hydrated(page);
    for (const name of ['Overview', 'Ledger', 'Owed', 'Checks']) await expect(tab(page, name), name).toBeVisible();
    await expect(tab(page, 'Import'), 'no Import tab for a member who does not import').toHaveCount(0);
    await tab(page, 'Checks').click();
    await expect(page).toHaveURL(/\/finance\?tab=checks$/);
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sideways, 'nothing scrolls sideways at 375 px').toBeLessThanOrEqual(1);
  } finally {
    await context.close();
  }
});
