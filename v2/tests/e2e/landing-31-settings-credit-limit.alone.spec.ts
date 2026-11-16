/**
 * Landing 31 — the credit limit in Settings → Finance (the owner's decision of 16 Nov 2026). A team member opens
 * Settings → Finance and reads the figure — no box, no button, Finance alone in the menu — while every other Settings
 * page still tells them Settings is for admins and points to the credit limit; a manager changes the figure: a whole
 * amount, a confirmation that carries the reason, a toast, and the new figure on the page and in the database.
 * Runs alone: the figure is one for the whole of Direct, so another spec must not read it half-way. It is put back
 * afterwards. Every value is made up.
 * Sabotages: tests/sabotage/landing-31-settings.mjs ("e2e-credit-limit-…"); the database's own rule is CCL-01.
 */
import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();
const inForce = async () =>
  Number(
    (
      await sql<{ v: string }>(
        `select core.setting_at('finance.credit_limit', null, core.riyadh_today()) #>> '{}' as v`,
      )
    )[0]!.v,
  );

test('a team member reads the credit limit and cannot change it; the rest of Settings stays closed', async ({
  page,
}) => {
  const member = await makePerson();
  const amount = await inForce();
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, member.email, '/settings/finance');
  await hydrated(page);
  const card = page.locator('[data-credit-limit]');
  await expect(card, 'the read-only view').toHaveAttribute('data-credit-limit', 'view');
  await expect(card.locator('[data-credit-limit-value]')).toHaveText(`SAR ${amount.toLocaleString('en-US')}`);
  await expect(card).toContainText('Only managers and heads of department can change this.');
  await expect(card.locator('input, button'), 'no box and no button').toHaveCount(0);
  await expect(page.locator('[data-settings-groups] a'), 'Finance alone in the menu').toHaveCount(1);
  await expect(page.locator('main [data-list], main [data-setting]'), 'nothing else of Settings').toHaveCount(0);

  await page.goto('/settings/work');
  await hydrated(page);
  await expect(page.locator('[data-state="no-access"]')).toContainText('Settings is for admins');
  await expect(page.locator('[data-settings-open-to-all] a[href="/settings/finance"]')).toContainText('Credit limit');
});

test('a manager changes the credit limit: a whole amount, a reason, and the new figure stands', async ({
  page,
  context,
}) => {
  const manager = await makePerson();
  await sql(`update core.person set role_id = (select id from core.role where key = 'manager') where id = $1`, [
    manager.id,
  ]);
  const before = await inForce();
  const next = before === 900000 ? 950000 : 900000;
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, manager.email, '/settings/finance');
  await hydrated(page);
  try {
    const card = page.locator('[data-credit-limit]');
    await expect(card, 'the edit form').toHaveAttribute('data-credit-limit', 'edit');
    const box = card.locator('[data-credit-limit-input]');
    await expect(box).toHaveValue(before.toLocaleString('en-US'));
    await expect(card.locator('[data-credit-limit-save]'), 'nothing to save yet').toBeDisabled();
    await box.fill('1000.50');
    await expect(card, 'a fraction is refused in words').toContainText('Enter a whole amount in riyals, above zero.');
    await expect(card.locator('[data-credit-limit-save]')).toBeDisabled();
    await box.fill(String(next));
    await card.locator('[data-credit-limit-save]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-credit-limit-change]')).toContainText(next.toLocaleString('en-US'));
    await expect(dialog.locator('[data-reason-save]'), 'a reason is required').toBeDisabled();
    await dialog.getByLabel('Reason').fill('made up: a tighter quarter');
    await dialog.locator('[data-reason-save]').click();
    await expect(toast(page, 'Credit limit saved')).toBeVisible();
    await expect(box, 'the page shows the new figure').toHaveValue(next.toLocaleString('en-US'));
    expect(await inForce(), 'and the database holds it').toBe(next);
  } finally {
    // the figure is everyone's: put it back as it was, the same way it was changed
    if ((await inForce()) !== before)
      await callAs(context, 'finance_credit_limit_set', {
        p_amount: before,
        p_reason: 'made up: put back after the test',
      });
  }
});
