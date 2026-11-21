/**
 * 13 Oct sweep, PR 1 (V235): Finance has a New invoice button for a person with Full on Finance (desktop only — on a phone
 * Create in the bar already offers it, V630) — a Team member is such a person (the owner, 21 Nov: "everyone sees
 * Finance and everyone adds and edits it"), a Viewer (View) is not. Every value is made up.
 * Sabotage: tests/sabotage/new-button.mjs "finance-new-button-always-hidden", "finance-new-button-for-everyone".
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

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

test('Finance: a member gets the New invoice button and it opens the form', async ({ page }) => {
  // The owner's decision of 21 Nov: a Team member starts at Full on Finance, so the button is theirs as it is a
  // manager's, and the form behind it opens
  const member = await makePerson();
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, member.email, '/finance');
  await hydrated(page);
  await expect(page.locator('[data-finance-overview]'), 'a member gets the Finance page').toBeVisible();
  const button = page.locator('[data-new-invoice-link]');
  await expect(button, 'a member gets the New invoice button').toBeVisible();
  await button.click();
  await expect(page).toHaveURL(/\/finance\/new$/);
  await hydrated(page);
  await expect(page.locator('[data-new-invoice]'), 'the New invoice form opens for a member').toBeVisible();
  await expect(page.locator('[data-state="no-access"]'), 'and the member is not refused').toHaveCount(0);
});

test('Finance: a viewer does not get the New invoice button, and a write of their own is refused', async ({ page }) => {
  // The view-only role reads Finance: the page IS drawn for them, and the button is still Full's alone
  const viewer = await makePerson();
  await sql(`update core.person set role_id = (select id from core.role where key = 'viewer') where id = $1`, [
    viewer.id,
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, viewer.email, '/finance');
  await hydrated(page);
  await expect(page.locator('[data-finance-overview]'), 'a View reader gets the Finance page').toBeVisible();
  await expect(page.locator('[data-state="no-access"]'), 'and is not refused').toHaveCount(0);
  await expect(page.locator('[data-new-invoice-link]'), 'a viewer does not get the New invoice button').toHaveCount(0);
  const write = await callAs(page.context(), 'finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: `TX-9${Math.floor(Math.random() * 900000 + 100000)}`,
      kind: 'transaction',
      status: 'Fully Paid',
      created_on: '2019-03-10',
      paid_on: '2019-03-12',
      total_sar: 250,
      customer_name: 'Made Up Trading Co',
    },
    p_reason: 'made up',
  });
  expect(write.status, `a viewer's own write to Finance is refused: ${JSON.stringify(write.body)}`).toBe(403);
});
