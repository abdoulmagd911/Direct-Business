/**
 * Landing 37 (Finance F-C) in Arabic, through the screen. It needs the app-wide Arabic setting on, so it runs alone and
 * under the Arabic specs' one database lock (support/arabic.ts); the person reads Arabic because they saved it.
 *  1. CR-1594-23 in Arabic: «مخصص» opens its From / To panel on the first press, while the server's answer is held.
 *  2. The Ledger's not-yet-counted list reads in Arabic, right to left, at 1440 px and at 375 px, with nothing
 *     scrolling sideways; the amounts are the same digits as in English.
 *  3. The New invoice form shows the invoice saved last, in Arabic.
 * Every value is made up. Sabotage: tests/sabotage/landing-37-e2e.mjs.
 */
import { expect, test } from '@playwright/test';
import { withArabicOn, readsArabic } from './support/arabic';
import { blocksSettled } from './support/finance-blocks';
import { hydrated, ownMonth, rowNo, seedImported, seedOrg, signedInAdmin } from './support/landing-32';
import { PHONE, sideways } from './support/landing-34';

test('Arabic: Custom opens on the first press, the not-yet-counted list and the saved record read in Arabic', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const month = await ownMonth('1961-06');
  const org = await seedOrg(call, 'Arabic Pending');
  await seedImported(org.id, admin.id, month.mid, [{ number: rowNo(), revenue: 700, cost: 200 }]);
  const number = rowNo();
  await call('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: number,
      kind: 'transaction',
      status: 'Pending',
      created_on: month.mid,
      total_sar: 100,
      client_id: org.cid,
    },
    p_reason: 'made up e2e',
  });
  const row = page.locator(`[data-ledger-not-yet-counted-row][data-number="${number}"]`);
  // the amount as English writes it, to compare digit for digit
  await page.goto(month.url);
  await hydrated(page);
  await expect(row).toBeVisible({ timeout: 45_000 });
  const digits = (s: string) => s.replace(/[^\d.,]/g, '');
  const english = digits(await row.locator('[data-ledger-not-yet-counted-amount] bdi').innerText());

  await withArabicOn(admin.id, 'Made-up reason: the Landing 37 Arabic run', async () => {
    await readsArabic(admin.id);

    // 1 · Custom, first press, in Arabic
    await page.goto('/finance?period=ytd');
    await hydrated(page);
    await blocksSettled(page);
    await expect(page.locator('html'), 'the page reads right to left').toHaveAttribute('dir', 'rtl');
    const custom = page.locator('[data-finance-period-key="custom"]');
    await expect(custom, 'the tab is in Arabic').toHaveText('مخصص');
    const panel = page.locator('[data-finance-custom-panel]');
    await expect(panel).toHaveCount(0);
    const isCustom = (url: URL) => url.pathname === '/finance' && url.searchParams.get('period') === 'custom';
    await page.route(isCustom, async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    });
    await custom.click();
    await expect(panel, 'Arabic: the first press opens the From / To panel, before the server answers').toBeVisible({
      timeout: 2000,
    });
    await expect(custom, 'Arabic: Custom is the lit tab at once').toHaveAttribute('aria-current', 'page');
    await expect(panel.locator('label[for="finance-from"]'), 'From is named in Arabic').toHaveText('من');
    await expect(panel.locator('label[for="finance-to"]'), 'To is named in Arabic').toHaveText('إلى');
    await expect(page).toHaveURL(/period=custom/, { timeout: 30_000 });
    await expect(panel, 'Arabic: still open once the page has answered').toBeVisible();
    await page.unroute(isCustom);

    // 2 · the list, in Arabic, wide and on a phone
    for (const size of [{ width: 1440, height: 900 }, PHONE]) {
      await page.setViewportSize(size);
      await page.goto(`${month.url}#finance-ledger-waiting`);
      await hydrated(page);
      await expect(row, `${size.width} px: the Pending invoice is listed`).toBeVisible({ timeout: 45_000 });
      const list = page.locator('[data-ledger-not-yet-counted]');
      await expect(list.locator('h3'), `${size.width} px: the list is titled in Arabic`).toContainText('لم تُحتسب بعد');
      await expect(row, `${size.width} px: the row is marked in Arabic`).toContainText('لم تُحتسب بعد');
      await expect(row, `${size.width} px: the status label is Arabic`).toContainText('الحالة');
      expect(
        digits(await row.locator('[data-ledger-not-yet-counted-amount] bdi').innerText()),
        `${size.width} px: the amount is the same digits as in English, in Western digits`,
      ).toBe(english);
      expect(await sideways(page), `${size.width} px: nothing scrolls sideways`).toBeLessThanOrEqual(0);
    }

    // 3 · the form's saved record, in Arabic
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/finance/new');
    await hydrated(page);
    const record = page.locator('[data-last-saved-record]');
    await expect(record, 'Arabic: the form shows the invoice saved last').toHaveAttribute('data-ref', number, {
      timeout: 30_000,
    });
    await expect(record).toContainText('آخر ما حُفظ');
    await expect(record, 'Arabic: not counted until paid').toContainText('لا تُحتسب حتى تُدفع');
    await expect(record.locator('[data-saved-fact="transaction"] dd'), 'the number is the number').toHaveText(number);
  });
});
