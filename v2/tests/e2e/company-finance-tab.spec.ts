/**
 * The company Finance tab (Landing 25, F-A/A1): the tab's list and totals come from the unified ledger filtered
 * to the company, so they equal the Finance page's by-company figures for the same company and period; hiding the
 * imported rows hides them from the list AND the total; a company whose rows lack a cost shows profit empty and
 * says how many rows lack one; the "Partner result" view is named and its rows export as a file; the stamp is the
 * same "as of last import" date the Finance page shows. Every value is made up.
 * Sabotage: tests/sabotage/finance.mjs "company-tab-reads-money-row-only", "company-tab-hides-imported-from-list-only",
 * "company-tab-profit-counts-cost-pending-rows".
 */
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
const tag = () => Math.random().toString(36).slice(2, 8);
// today in Riyadh, in the tab's year-to-date period
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
const ref = () => `TX-C${Math.floor(Math.random() * 900000 + 100000)}`;
const clientId = () => `88${Math.floor(Math.random() * 90000 + 10000)}`;

type Door = (fn: string, args: Record<string, unknown>) => Promise<{ id?: string }>;

const ledgerReady = (page: Page) =>
  expect(page.locator('[data-partner-finance-ledger]'), 'the tab ledger has answered').toHaveAttribute(
    'data-state',
    'ready',
    { timeout: 45_000 },
  );

/** A partner with a client ID, two manual rows (one costed, one provisional) and two imported rows. */
async function seedCompany(call: Door, adminId: string) {
  const cid = clientId();
  const d = today();
  const p = await call('partner_create', {
    p_partner: { trade_name_en: `Made Up Tab Co ${tag()}`, sides: [{ side: 'client', type: 'corporate' }] },
  });
  const partnerId = p.id!;
  await call('identifier_add', {
    p_partner: partnerId,
    p_kind: 'payments_client_id',
    p_value: cid,
    p_reason: 'made up',
    p_subkind: 'postpaid',
  });
  const m1 = ref();
  const m2 = ref();
  await call('finance_import', {
    p_file: 'invoices',
    p_rows: [
      {
        ref: m1,
        status: 'Fully Paid',
        created_on: d,
        total_sar: 1000,
        client_id: cid,
        dpin: 'DPIN-C1',
        dpin_total: 800,
      },
      { ref: m2, status: 'Fully Paid', created_on: d, total_sar: 500, client_id: cid },
    ],
    p_export_time: new Date().toISOString(),
  });
  await call('finance_import', {
    p_file: 'expenses',
    p_rows: [
      {
        ref: m1,
        expense_type: 'Hotel',
        status: 'Approved',
        amount_sar: 200,
        created_at: '2026-01-01T10:00:00Z',
      },
    ],
    p_export_time: new Date().toISOString(),
  });
  const batch = randomUUID();
  const i1 = `1163${Math.floor(Math.random() * 900000 + 100000)}`;
  const i2 = `1163${Math.floor(Math.random() * 900000 + 100000)}`;
  await sql(
    `insert into work.import_batch (id, partner_id, signature, file_name, created_by)
     values ($1, $2, 'invoice_export', 'made-up-tab.csv', $3)`,
    [batch, partnerId, adminId],
  );
  await sql(
    `insert into work.import_record
       (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar,
        profit_sar, fully_paid, created_by)
     values ($1, $2, 'transaction', $3, $3, $4, 500, 500, 100, 400, true, $5),
            ($1, $2, 'transaction', $6, $6, $4, 700, 700, null, null, true, $5)`,
    [partnerId, batch, i1, d, adminId, i2],
  );
  return { partnerId, m1, m2, i1, i2 };
}

/** A partner with one manual row only, fully paid, no expense at all. */
async function seedCostMissing(call: Door) {
  const cid = clientId();
  const d = today();
  const p = await call('partner_create', {
    p_partner: { trade_name_en: `Made Up No Cost Co ${tag()}`, sides: [{ side: 'client', type: 'corporate' }] },
  });
  const partnerId = p.id!;
  await call('identifier_add', {
    p_partner: partnerId,
    p_kind: 'payments_client_id',
    p_value: cid,
    p_reason: 'made up',
    p_subkind: 'postpaid',
  });
  await call('finance_import', {
    p_file: 'invoices',
    p_rows: [{ ref: ref(), status: 'Fully Paid', created_on: d, total_sar: 700, client_id: cid }],
    p_export_time: new Date().toISOString(),
  });
  return { partnerId };
}

async function signedInAdmin(page: Page): Promise<{ call: Door; adminId: string }> {
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email, '/');
  await hydrated(page);
  const call: Door = async (fn, args) => {
    const r = await callAs(page.context(), fn, args);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body as { id?: string };
  };
  return { call, adminId: admin.id };
}

test('desk 1440: the tab shows the unified-ledger totals, the imported rows, the stamp and the Partner result view; the file exports', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, adminId } = await signedInAdmin(page);
  const { partnerId, m1, m2, i1, i2 } = await seedCompany(call, adminId);
  await page.goto(`/partners/${partnerId}?tab=finance`);
  await hydrated(page);
  await ledgerReady(page);

  const totals = page.locator('[data-partner-finance-totals]');
  // 4 units: revenue 2700 (1000 + 500 + 500 + 700), cost 300 (200 + 100), profit 1200 (800 + 400)
  await expect(totals, 'revenue is the manual and imported rows together').toContainText('2,700');
  await expect(totals, 'cost is only the costed rows').toContainText('300');
  await expect(totals, 'profit is only the costed rows').toContainText('1,200');
  await expect(totals, 'two rows still have no cost').toContainText('2 rows still have no cost');
  // the list is all four rows, manual and imported, with their source beside them
  const rows = page.locator('[data-partner-finance-row]');
  await expect(rows, 'four rows in the list').toHaveCount(4);
  for (const n of [m1, m2, i1, i2]) await expect(rows.filter({ hasText: n }), `row ${n} is listed`).toHaveCount(1);
  await expect(rows.filter({ hasText: 'Recorded here' }), 'two manual rows').toHaveCount(2);
  await expect(rows.filter({ hasText: 'Imported' }), 'two imported rows').toHaveCount(2);
  // the stamp and the named view
  await expect(page.locator('[data-finance-stamp]'), 'the as-of stamp is on the tab').toContainText('Payments · ');
  const view = page.locator('[data-view="partner-result"]');
  await expect(view, 'the Partner result view is on the tab').toBeVisible();
  await expect(view, 'the Partner result view is the open one').toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('[data-partner-finance-not-counted]'),
    'nothing is missing, so the tab says everything is counted',
  ).toContainText('Everything is counted');

  // the file is the view on screen: the four rows, then the totals line
  const download = page.waitForEvent('download');
  await page.locator('[data-finance-export]').click();
  const file = await download;
  const stream = await file.createReadStream();
  const body = await new Promise<string>((resolve, reject) => {
    if (!stream) return resolve('');
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(c as Buffer));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
  for (const n of [m1, m2, i1, i2]) expect(body, `the file carries row ${n}`).toContain(n);
  expect(body, 'the file totals line carries the revenue').toContain('2700');
});

test('desk 1440: hiding the imported rows hides them from the list AND the total, and the address keeps it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, adminId } = await signedInAdmin(page);
  const { partnerId } = await seedCompany(call, adminId);
  await page.goto(`/partners/${partnerId}?tab=finance`);
  await hydrated(page);
  await ledgerReady(page);

  const totals = page.locator('[data-partner-finance-totals]');
  const rows = page.locator('[data-partner-finance-row]');
  await expect(rows, 'four rows before hiding').toHaveCount(4);
  await page.getByRole('switch', { name: 'Imported', exact: true }).click();
  await expect(page, 'the address keeps the filter').toHaveURL(/hideImported=1/);
  await expect(rows, 'two rows after hiding the imported ones').toHaveCount(2);
  await expect(rows.filter({ hasText: 'Imported' }), 'no imported row is left').toHaveCount(0);
  // the manual rows alone: revenue 1500 (1000 + 500), cost 200, profit 800
  await expect(totals, 'revenue drops to the manual rows alone').toContainText('1,500');
  await expect(totals, 'cost drops to the manual rows alone').toContainText('200');
  await expect(totals, 'profit drops to the manual rows alone').toContainText('800');
  // and back: the imported rows return, list and total together
  await page.getByRole('switch', { name: 'Imported', exact: true }).click();
  await expect(page, 'the address drops the filter').not.toHaveURL(/hideImported=1/);
  await expect(rows, 'four rows again').toHaveCount(4);
  await expect(totals, 'revenue is back to the full view').toContainText('2,700');
});

test('desk 1440: a view saved with the filter on opens with the filter on after a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, adminId } = await signedInAdmin(page);
  const { partnerId } = await seedCompany(call, adminId);
  await page.goto(`/partners/${partnerId}?tab=finance`);
  await hydrated(page);
  await ledgerReady(page);

  await page.getByRole('switch', { name: 'Imported', exact: true }).click();
  await expect(page.locator('[data-partner-finance-row]'), 'two rows with the filter on').toHaveCount(2);
  await page.locator('[data-view-save]').click();
  const dialog = page.getByRole('dialog', { name: 'Save this view' });
  await dialog.getByLabel('Name', { exact: true }).fill('Manual only');
  await page.locator('[data-view-save-confirm]').click();
  const saved = page.getByRole('button', { name: 'Manual only', exact: true });
  await expect(saved, 'the saved view is on the bar').toBeVisible();
  await expect(saved, 'the saved view is the open one').toHaveAttribute('aria-pressed', 'true');
  await expect(page, 'the address carries the view').toHaveURL(/view=/);
  // a reload opens the saved view from the address: the filter is still on
  await page.reload();
  await hydrated(page);
  await ledgerReady(page);
  await expect(page.locator('[data-partner-finance-row]'), 'two rows after the reload').toHaveCount(2);
  // Landing 31: the switch is the one word "Imported" — on shows the imported rows, so with the filter on it is off
  await expect(page.getByRole('switch', { name: 'Imported', exact: true })).toHaveAttribute('aria-checked', 'false');
});

test('desk 1440: a company whose rows lack a cost shows profit empty and says how many rows lack one', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call } = await signedInAdmin(page);
  const { partnerId } = await seedCostMissing(call);
  await page.goto(`/partners/${partnerId}?tab=finance`);
  await hydrated(page);
  await ledgerReady(page);

  const totals = page.locator('[data-partner-finance-totals]');
  await expect(totals, 'revenue is the one row').toContainText('700');
  await expect(totals, 'one row still has no cost').toContainText('1 row still has no cost');
  await expect(totals, 'cost is not known yet').toContainText('Cost not known yet');
  await expect(totals, 'profit is empty, never 0').toContainText('Not known yet');
  await expect(page.locator('[data-partner-finance-row]'), 'one row in the list').toHaveCount(1);
});

test('the tab stamp is the same as-of date the Finance page shows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, adminId } = await signedInAdmin(page);
  const { partnerId } = await seedCompany(call, adminId);
  await page.goto('/finance');
  await hydrated(page);
  await expect(page.locator('[data-finance-stamp]'), 'the Finance page stamp').toContainText('Payments · ');
  const financeStamp = await page.locator('[data-finance-stamp]').innerText();
  await page.goto(`/partners/${partnerId}?tab=finance`);
  await hydrated(page);
  await ledgerReady(page);
  await expect(page.locator('[data-finance-stamp]'), 'the tab stamp matches the Finance page').toHaveText(financeStamp);
});

test('phone 390: the tab fits, the rows table scrolls inside its box', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { call, adminId } = await signedInAdmin(page);
  const { partnerId } = await seedCompany(call, adminId);
  await page.goto(`/partners/${partnerId}?tab=finance`);
  await hydrated(page);
  await ledgerReady(page);

  expect(await page.evaluate(() => document.documentElement.scrollWidth), 'no sideways scroll').toBeLessThanOrEqual(
    390,
  );
  await expect(page.locator('[data-partner-finance-totals]'), 'the totals are on the phone').toBeVisible();
  await expect(page.locator('[data-partner-finance-row]'), 'four rows on the phone').toHaveCount(4);
});
