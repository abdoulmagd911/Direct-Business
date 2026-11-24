/**
 * Landing 47 (Finance Part B) in Arabic, wide and on a phone — it runs alone (Arabic is one setting for everyone),
 * under the Arabic specs' one database lock (support/arabic.ts); the person reads Arabic because they saved it.
 * The Ledger's marks, "By deal type" and the three new cards — the agreement check, what is owed and how old, what is
 * held — read in Arabic, right to left, with the same Western digits as in English; at 1440 px and at 375 px nothing
 * scrolls sideways and no word is under 12 px. The organisation's Finance tab too: no top-up for a postpaid
 * organisation, its own pursue list, its contract's payments. Every value is made up.
 * With L47_SHOTS set to a folder, each view is saved there as a picture (for the builder's own look; nothing reads it).
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Locator } from '@playwright/test';
import { readsArabic, withArabicOn } from './support/arabic';
import { blocksSettled } from './support/finance-blocks';
import { hydrated, ownMonth, rowNo, seedImported, seedOrg, signedInAdmin, tag } from './support/landing-32';
import { PHONE, sideways } from './support/landing-34';

const SHOTS = process.env.L47_SHOTS;
async function shot(part: Locator, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await part.scrollIntoViewIfNeeded();
  await part.screenshot({ path: `${SHOTS}/${name}.png` });
}
/** How many words in a part of the page are drawn under 12 px. */
const smallWords = (part: Locator) =>
  part.evaluate(
    (el) =>
      [...el.querySelectorAll('*')].filter(
        (n) =>
          n.children.length === 0 &&
          (n.textContent ?? '').trim() !== '' &&
          parseFloat(getComputedStyle(n).fontSize) < 12,
      ).length,
  );

test('Arabic: the deal types, the agreement check, the pursue list, the held rows and the organisation’s tab', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const month = await ownMonth('1962-09');
  const org = await seedOrg(call, 'Arabic Postpaid With A Long Trade Name For The Narrow Screen');
  const bare = await call('partner_create', {
    p_partner: {
      trade_name_en: `Made Up Arabic No Client Id Org ${tag()}`,
      sides: [{ side: 'client', type: 'corporate' }],
    },
  });
  const paid = rowNo();
  const unset = rowNo();
  await seedImported(org.id, admin.id, month.mid, [{ number: paid, revenue: 12_345, cost: 2_345 }]);
  await seedImported(bare.id!, admin.id, month.mid, [{ number: unset, revenue: 250, cost: null }]);
  const pending = rowNo();
  await call('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: pending,
      kind: 'transaction',
      status: 'Pending',
      created_on: month.mid,
      total_sar: 400,
      client_id: org.cid,
    },
    p_reason: 'made up e2e',
  });
  await call('contract_save', {
    p_partner: org.id,
    p_id: null,
    p_values: {
      side: 'client',
      title: `Made-up Arabic contract ${tag()}`,
      start_on: `${month.from}`,
      end_on: month.to,
    },
  });
  const row = (number: string) => page.locator('[data-finance-ledger-row]').filter({ hasText: number });
  // the revenue as English writes it, to compare digit for digit
  await page.goto(month.url);
  await hydrated(page);
  await blocksSettled(page);
  await expect(row(paid)).toBeVisible({ timeout: 45_000 });
  const digits = (s: string) => s.replace(/[^\d.,]/g, '');
  const line = page.locator('[data-ledger-deal-line="postpaid"] [data-ledger-deal-revenue]');
  const english = digits(await line.innerText());
  await shot(page.locator('[data-finance-ledger-rows]'), 'en-1440-rows');

  await withArabicOn(admin.id, 'Made-up reason: the Landing 47 Arabic run', async () => {
    await readsArabic(admin.id);
    // a page of another address first: the language is read when a page is loaded, never on a move within one
    await page.goto('/finance/new');
    await hydrated(page);
    for (const size of [{ width: 1440, height: 900 }, PHONE]) {
      const at = `${size.width} px`;
      await page.setViewportSize(size);
      // the address names the Ledger: on a phone that opens the Ledger view
      await page.goto(`${month.url}#finance-ledger`);
      await hydrated(page);
      await blocksSettled(page);
      await expect(page.locator('html'), `${at}: the page reads right to left`).toHaveAttribute('dir', 'rtl');
      await expect(row(paid), `${at}: the row is listed`).toBeVisible({ timeout: 45_000 });
      // the marks, in Arabic
      await expect(row(paid).locator('[data-ledger-deal-type]'), `${at}: the deal type is said in Arabic`).toHaveText(
        'آجل الدفع',
      );
      await expect(row(paid).locator('[data-ledger-receivable]'), `${at}: paid but receivable, in Arabic`).toHaveText(
        'مدفوعة · مستحقة التحصيل',
      );
      await expect(row(unset).locator('[data-ledger-deal-type]'), `${at}: not set, in Arabic`).toHaveText(
        'نوع التعامل غير محدد',
      );
      expect(digits(await line.innerText()), `${at}: the same digits as in English, in Western digits`).toBe(english);
      // the three cards, in Arabic
      const agree = page.locator('[data-finance-reconciliation]');
      await expect(agree.locator('h2'), `${at}: the agreement card is titled in Arabic`).toContainText(
        'هل تتطابق أرقام المالية؟',
      );
      await expect(agree.locator('[data-reconcile-verdict]'), `${at}: it agrees, in Arabic`).toContainText('متطابقة', {
        timeout: 45_000,
      });
      const ageing = page.locator('[data-finance-ageing]');
      await expect(ageing.locator('h2'), `${at}: the pursue list is titled in Arabic`).toContainText(
        'المستحقات وأعمارها',
      );
      await expect(
        ageing.locator(`[data-ageing-row][data-number="${pending}"]`),
        `${at}: the Pending invoice is on it`,
      ).toBeVisible({ timeout: 45_000 });
      const held = page.locator('[data-finance-held]');
      await expect(held.locator('h2'), `${at}: the held card is titled in Arabic`).toContainText('معلّقة');
      await expect(
        held.locator(`[data-held-reason="no_client_id"] [data-held-row][data-number="${unset}"]`),
        `${at}: the row with no client ID is held`,
      ).toBeVisible({ timeout: 45_000 });
      await expect(held.locator('[data-held-reason="no_client_id"] h3'), `${at}: its reason in Arabic`).toContainText(
        'بلا رقم عميل',
      );
      expect(await sideways(page), `${at}: nothing scrolls sideways on the Finance page`).toBeLessThanOrEqual(0);
      for (const [name, part] of [
        ['By deal type', page.locator('[data-finance-ledger-rows]')],
        ['the agreement card', agree],
        ['the pursue list', ageing],
        ['the held card', held],
      ] as const)
        expect(await smallWords(part), `${at}: no word under 12 px in ${name}`).toBe(0);
      await shot(page.locator('[data-finance-ledger-rows]'), `ar-${size.width}-rows`);
      await shot(agree, `ar-${size.width}-agree`);
      await shot(ageing, `ar-${size.width}-ageing`);
      await shot(held, `ar-${size.width}-held`);

      // the organisation's own tab
      await page.goto(`/partners/${org.id}?tab=finance`);
      await hydrated(page);
      const wallet = page.locator('[data-partner-finance-wallet-postpaid]');
      await expect(wallet, `${at}: no top-up for a postpaid organisation, in Arabic`).toContainText('آجل الدفع', {
        timeout: 45_000,
      });
      const contracts = page.locator('[data-partner-finance-contracts]');
      await expect(contracts.locator('h2'), `${at}: contract payments, in Arabic`).toHaveText('دفعات العقود');
      await contracts.locator('[data-contract-payments-open]').first().click();
      await expect(
        contracts.locator('[data-contract-period]').first(),
        `${at}: the contract’s month is listed`,
      ).toBeVisible({
        timeout: 45_000,
      });
      await expect(
        page.locator('[data-partner-finance] [data-finance-ageing] [data-ageing-row]'),
        `${at}: its own pursue list`,
      ).toHaveCount(1, { timeout: 45_000 });
      expect(await sideways(page), `${at}: nothing scrolls sideways on the tab`).toBeLessThanOrEqual(0);
      expect(await smallWords(contracts), `${at}: no word under 12 px in the contract payments`).toBe(0);
      await shot(page.locator('[data-partner-finance-wallet]'), `ar-${size.width}-wallet`);
      await shot(contracts, `ar-${size.width}-contracts`);
    }
  });
});
