/**
 * Landing 47 (Finance Part B) in the browser — the addendum items, on the real pages.
 *  1. The Ledger says what each row is: its deal type (postpaid from the organisation's client ID; "Deal type not set"
 *     where nothing settles it), "Paid · receivable" on a counted postpaid row, "Tax invoice issued" on a row with a
 *     DPIN. "By deal type" filters the list and moves no figure. A person sets a row's deal type with a reason; the
 *     row then says it, and Revenue is what it was. The agreement card says Agrees; the held card names the row
 *     whose organisation holds no client ID.
 *  2. What is owed and how old: a Pending invoice of a postpaid organisation, 40 days old, is on the pursue list of the
 *     Finance page and of the organisation's own Finance tab, with its age and its amount.
 *  3. The organisation's Finance tab: a postpaid organisation shows no wallet top-up; a contract lists its payments
 *     by month and by quarter, each period's total with its invoices under it.
 *  4. A commission typed by hand must carry its proof; saved, its Ledger row says which commission it is.
 *  5. An expense file: a line repeated in the file is counted once, a reference that is a tax invoice number is held
 *     in words, and Confirm stores the cost the preview showed.
 *  6. The speed gate: the four new reads answer in under 3 s in total for every role; no role, no read.
 * Page-wide figures are read only inside a far-past month no other spec uses. Every value is made up.
 * Sabotage: tests/sabotage/landing-47-e2e.mjs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { blocksSettled } from './support/finance-blocks';
import {
  hydrated,
  num,
  ownMonth,
  personAs,
  rowNo,
  seedImported,
  seedOrg,
  signedInAdmin,
  signedInAs,
  tag,
  today,
} from './support/landing-32';
import { callAs, sql } from './support/stack';

test.describe.configure({ mode: 'default' });

async function openFinance(page: Page, url: string) {
  await page.goto(url);
  await hydrated(page);
  await blocksSettled(page);
  await expect(page.locator('[data-finance-report]'), 'the Ledger has answered').toBeVisible({ timeout: 45_000 });
}
const strip = (page: Page, kind: string) => page.locator(`[data-finance-ledger-total="${kind}"] > span`).nth(1);
const stripNumber = async (page: Page, kind: string) => num(await strip(page, kind).innerText());
const ledgerRow = (page: Page, number: string) => page.locator('[data-finance-ledger-row]').filter({ hasText: number });
const daysAgo = (n: number) => {
  const d = new Date(`${today()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

/** One imported, fully paid transaction with its own tax number (or none). */
async function seedImportedRow(
  partnerId: string,
  byId: string,
  day: string,
  row: { number: string; revenue: number; cost: number | null; taxNo?: string | null; paid?: boolean; status?: string },
) {
  const batch = randomUUID();
  await sql(
    `insert into work.import_batch (id, partner_id, signature, file_name, created_by)
     values ($1, $2, 'invoice_export', 'made-up-l47.csv', $3)`,
    [batch, partnerId, byId],
  );
  await sql(
    `insert into work.import_record
       (partner_id, batch_id, kind, transaction_ref, invoice_ref, tax_no, record_date, amount_sar, revenue_sar,
        cost_sar, profit_sar, fully_paid, status_text, created_by)
     values ($1, $2, 'transaction', $3, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11)`,
    [
      partnerId,
      batch,
      row.number,
      row.taxNo ?? null,
      day,
      row.revenue,
      row.cost,
      row.cost === null ? null : row.revenue - row.cost,
      row.paid ?? true,
      row.status ?? 'Fully Paid',
      byId,
    ],
  );
}

test('1 · the Ledger says what each row is, By deal type filters it, a person sets a deal type — and no figure moves', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const month = await ownMonth('1962-03');
  const postpaid = await seedOrg(call, 'Postpaid Deal');
  // an organisation that holds no client ID at all: nothing settles its rows' deal type
  const bare = await call('partner_create', {
    p_partner: { trade_name_en: `Made Up No Client Id Org ${tag()}`, sides: [{ side: 'client', type: 'corporate' }] },
  });
  const a = rowNo();
  const withDpin = rowNo();
  const unset = rowNo();
  await seedImported(postpaid.id, admin.id, month.mid, [{ number: a, revenue: 700, cost: 200 }]);
  await seedImportedRow(postpaid.id, admin.id, month.mid, {
    number: withDpin,
    revenue: 300,
    cost: 100,
    taxNo: `DPIN-T-${withDpin.slice(-6)}`,
  });
  await seedImportedRow(bare.id!, admin.id, month.mid, { number: unset, revenue: 250, cost: 50 });

  await openFinance(page, month.url);
  // the figure is waited for, never read once: on a slow machine the strip is drawn a moment before its rows are in
  await expect.poll(() => stripNumber(page, 'revenue'), { message: 'the month counts the three rows' }).toBe(1250);
  const revenue = 1250;

  // each row says what it is
  await expect(
    ledgerRow(page, a).locator('[data-ledger-deal-type]'),
    'a row of a postpaid organisation',
  ).toHaveAttribute('data-ledger-deal-type', 'postpaid');
  await expect(ledgerRow(page, a).locator('[data-ledger-receivable]'), 'is paid but receivable').toHaveText(
    'Paid · receivable',
  );
  await expect(
    ledgerRow(page, a).locator('[data-ledger-tax-invoice-issued]'),
    'a row with no DPIN does not say its tax invoice is issued',
  ).toHaveCount(0);
  await expect(
    ledgerRow(page, withDpin).locator('[data-ledger-tax-invoice-issued]'),
    'a row carrying a DPIN says its tax invoice is issued',
  ).toHaveText('Tax invoice issued');
  const unsetType = ledgerRow(page, unset).locator('[data-ledger-deal-type]');
  await expect(unsetType, 'a row nothing settles says so').toHaveAttribute('data-ledger-deal-type', 'none');
  await expect(unsetType).toHaveText('Deal type not set');

  // by deal type: the database's lines, and the filter over the list
  const line = (k: string) => page.locator(`[data-ledger-deal-line="${k}"] [data-ledger-deal-revenue]`);
  await expect.poll(async () => num(await line('postpaid').innerText()), { message: 'postpaid: 700 + 300' }).toBe(1000);
  await expect.poll(async () => num(await line('none').innerText()), { message: 'not set: 250' }).toBe(250);
  await page.locator('[data-ledger-deal-filter-option="none"]').click();
  await expect(page.locator('[data-finance-ledger-row]'), 'the filter keeps the row that is not set').toHaveCount(1);
  await expect(ledgerRow(page, unset), 'and it is that row').toBeVisible();
  expect(await stripNumber(page, 'revenue'), 'the filter moves no figure').toBe(revenue);
  await page.locator('[data-ledger-deal-filter-option="postpaid"]').click();
  await expect(page.locator('[data-finance-ledger-row]'), 'postpaid: the two rows').toHaveCount(2);
  await page.locator('[data-ledger-deal-filter-option="all"]').click();
  await expect(page.locator('[data-finance-ledger-row]'), 'all: the three rows').toHaveCount(3);

  // the agreement card and the held card
  const verdict = page.locator('[data-finance-reconciliation] [data-reconcile-verdict]');
  await expect(verdict, 'Finance agrees with itself for the month').toHaveAttribute(
    'data-reconcile-verdict',
    'agrees',
    {
      timeout: 45_000,
    },
  );
  const held = page.locator('[data-finance-held] [data-held-reason="no_client_id"]');
  await expect(
    held.locator(`[data-held-row][data-number="${unset}"]`),
    'the row whose organisation holds no client ID is held in view',
  ).toBeVisible({ timeout: 45_000 });
  await expect(held.locator(`[data-held-row][data-number="${unset}"]`), 'and still counts').toContainText('Counted');

  // a person sets the deal type, with a reason
  await ledgerRow(page, unset).locator('[data-ledger-set-deal-type]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog, 'the box names the row').toContainText(unset);
  await dialog.locator('button[role=combobox]').click();
  await page.getByRole('option', { name: 'Tender', exact: true }).click();
  const save = dialog.locator('[data-reason-save]');
  await expect(save, 'the button waits for a reason').toBeDisabled();
  await dialog.locator('[data-reason]').fill('made up e2e: this booking is under the tender');
  await save.click();
  await expect(dialog, 'the box closes once saved').toHaveCount(0);
  await expect(
    ledgerRow(page, unset).locator('[data-ledger-deal-type]'),
    'the row says what the person set',
  ).toHaveAttribute('data-ledger-deal-type', 'tender', { timeout: 30_000 });
  await expect(ledgerRow(page, unset).locator('[data-ledger-deal-type]')).toHaveAttribute(
    'data-ledger-deal-type-by',
    'person',
  );
  expect(await stripNumber(page, 'revenue'), 'setting a deal type moves no figure').toBe(revenue);
});

test('2 · what is owed and how old: on the Finance page and on the organisation’s own tab', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const org = await seedOrg(call, 'Owing');
  const pending = rowNo();
  await call('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: pending,
      kind: 'transaction',
      status: 'Pending',
      created_on: daysAgo(40),
      total_sar: 1000,
      client_id: org.cid,
    },
    p_reason: 'made up e2e',
  });
  const old = rowNo();
  await seedImportedRow(org.id, admin.id, daysAgo(100), {
    number: old,
    revenue: 500,
    cost: null,
    paid: false,
    status: 'Pending Payment',
  });
  const paid = rowNo();
  await seedImportedRow(org.id, admin.id, daysAgo(95), { number: paid, revenue: 800, cost: 100 });

  await openFinance(page, '/finance');
  const card = page.locator('[data-finance-ageing]');
  await expect(card, 'the pursue list opens on postpaid').toHaveAttribute('data-ageing-scope', 'postpaid');
  const row = (n: string) => card.locator(`[data-ageing-row][data-number="${n}"]`);
  await expect(row(pending), 'the Pending invoice is owed').toBeVisible({ timeout: 45_000 });
  await expect(row(pending), 'it is 40 days old').toContainText('40 days');
  await expect(row(pending), 'in the 31–60 bucket').toHaveAttribute('data-ageing-row', 'days_31_60');
  expect(num(await row(pending).locator('[data-ageing-row-outstanding] bdi').innerText()), 'it owes its 1,000').toBe(
    1000,
  );
  await expect(row(old), 'the imported row, 100 days old, is over 90').toHaveAttribute(
    'data-ageing-row',
    'days_over_90',
  );
  await expect(row(paid), 'a paid row is not owed').toHaveCount(0);
  const company = card.locator(`[data-ageing-company]:has(a[href="/partners/${org.id}"])`);
  expect(
    num(await company.locator('[data-ageing-company-outstanding]').innerText()),
    'the organisation owes 1,000 + 500',
  ).toBe(1500);
  await expect(company.locator('[data-ageing-company-oldest]'), 'its oldest is 100 days').toHaveText('100 days');

  // the organisation's own Finance tab: the same two documents
  await page.goto(`/partners/${org.id}?tab=finance`);
  await hydrated(page);
  const own = page.locator('[data-partner-finance] [data-finance-ageing]');
  await expect(own.locator(`[data-ageing-row][data-number="${pending}"]`), 'on its own tab too').toBeVisible({
    timeout: 45_000,
  });
  await expect(own.locator('[data-ageing-row]'), 'only its own two documents').toHaveCount(2);
  expect(num(await own.locator('[data-ageing-total="outstanding"] > span').nth(1).innerText()), 'it owes 1,500').toBe(
    1500,
  );
});

test('3 · the organisation’s tab: a postpaid organisation shows no top-up; a contract lists its payments by month and quarter', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const org = await seedOrg(call, 'Contract');
  const march1 = rowNo();
  const march2 = rowNo();
  const may = rowNo();
  await seedImported(org.id, admin.id, '1963-03-05', [{ number: march1, revenue: 300, cost: 100 }]);
  await seedImported(org.id, admin.id, '1963-03-20', [{ number: march2, revenue: 200, cost: 50 }]);
  await seedImported(org.id, admin.id, '1963-05-10', [{ number: may, revenue: 400, cost: 100 }]);
  await seedImported(org.id, admin.id, '1963-08-01', [{ number: rowNo(), revenue: 999, cost: 1 }]);
  const title = `Made-up travel contract ${tag()}`;
  await call('contract_save', {
    p_partner: org.id,
    p_id: null,
    p_values: { side: 'client', title, start_on: '1963-03-01', end_on: '1963-06-30' },
  });

  await page.goto(`/partners/${org.id}?tab=finance`);
  await hydrated(page);
  // A12: postpaid — no wallet top-up
  const wallet = page.locator('[data-partner-finance-wallet]');
  await expect(
    wallet.locator('[data-partner-finance-wallet-postpaid]'),
    'a postpaid organisation says so',
  ).toContainText('no wallet top-up', { timeout: 45_000 });
  await expect(wallet, 'and shows no top-up row').not.toContainText('Topped up');

  // A13: the contract's payments
  const contract = page.locator('[data-partner-finance-contracts] [data-contract-payments]').filter({ hasText: title });
  await contract.locator('[data-contract-payments-open]').click();
  const period = (start: string) => contract.locator(`[data-contract-period="${start}"]`);
  await expect(period('1963-03-01'), 'March is named').toContainText('March 1963', { timeout: 45_000 });
  expect(
    num(await period('1963-03-01').locator('[data-contract-period-total] bdi').innerText()),
    'March: 300 + 200',
  ).toBe(500);
  await expect(period('1963-03-01').locator('[data-contract-invoice]'), 'with its two invoices under it').toHaveCount(
    2,
  );
  await expect(period('1963-03-01').locator(`[data-contract-invoice="${march1}"]`)).toBeVisible();
  expect(num(await period('1963-05-01').locator('[data-contract-period-total] bdi').innerText()), 'May: 400').toBe(400);
  await expect(contract.locator('[data-contract-period]'), 'nothing outside the term').toHaveCount(2);
  expect(num(await contract.locator('[data-contract-total] bdi').first().innerText()), 'the term: 900').toBe(900);
  // by quarter
  await contract.locator('[data-contract-grain="quarter"]').click();
  await expect(period('1963-01-01'), 'the first quarter is named').toContainText('Q1 1963', { timeout: 45_000 });
  expect(num(await period('1963-01-01').locator('[data-contract-period-total] bdi').innerText()), 'Q1: 500').toBe(500);
  expect(num(await period('1963-04-01').locator('[data-contract-period-total] bdi').innerText()), 'Q2: 400').toBe(400);
});

test('4 · a commission typed by hand carries its proof, and its Ledger row says which commission it is', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signedInAdmin(page);
  const month = await ownMonth('1962-07');
  const number = rowNo();
  await page.goto('/finance/new');
  await hydrated(page);
  await page.getByLabel('Transaction no.').fill(number);
  await page.getByLabel('Status', { exact: true }).first().click();
  await page.getByRole('option', { name: 'Fully Paid', exact: true }).click();
  await page.getByLabel('Created').fill(month.mid);
  await page.getByRole('textbox', { name: 'Total', exact: true }).fill('5000');
  const commission = page.locator('[data-new-invoice-commission]');
  await commission.locator('button[role=combobox]').click();
  await page.getByRole('option', { name: 'Airlines', exact: true }).click();
  // no proof yet: the form says so on the proof field and saves nothing
  await page.locator('[data-save-new]').click();
  const proof = commission.locator('[data-new-invoice-commission-proof]');
  await expect(proof, 'the proof is asked for').toHaveAttribute('aria-invalid', 'true');
  expect(
    (await sql(`select 1 from finance.invoice where ref = $1`, [number])).length,
    'nothing was saved without the proof',
  ).toBe(0);
  await proof.fill('Made-up airline statement, July');
  await page.locator('[data-save-new]').click();
  await expect(page.locator('[data-last-saved-record]'), 'saved').toHaveAttribute('data-ref', number, {
    timeout: 30_000,
  });
  const kept = await sql<{ commission_type: string; commission_proof: string }>(
    `select commission_type, commission_proof from finance.invoice where ref = $1 and deleted_at is null`,
    [number],
  );
  expect(kept[0], 'the invoice keeps the commission and its proof').toEqual({
    commission_type: 'airlines',
    commission_proof: 'Made-up airline statement, July',
  });
  await openFinance(page, month.url);
  await expect(
    ledgerRow(page, number).locator('[data-ledger-commission-type]'),
    'the Ledger row says which commission it is',
  ).toHaveText('Commission · Airlines');
});

test('5 · an expense file: a repeated line counts once, a tax invoice number is held, Confirm stores what the preview showed', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const org = await seedOrg(call, 'Expense File');
  const txn = rowNo();
  await seedImported(org.id, admin.id, '1964-02-10', [{ number: txn, revenue: 1000, cost: null }]);
  await page.goto('/finance?period=custom&from=1964-02-01&to=1964-02-29');
  await hydrated(page);
  const section = page.locator('[data-finance-import-section]');
  await section.scrollIntoViewIfNeeded();
  await section.locator('[data-partner-search]').fill(org.name);
  await section.locator(`[data-partner-hit="${org.id}"]`).click();
  const file = [
    'Invoice#,Amount (SAR),Expense Type,Status,Created At,Approval/Rejection Date',
    `${txn},100.00,Hotel,Approved,1964-02-11,1964-02-11 10:00`,
    `${txn},100.00,Hotel,Approved,1964-02-11,1964-02-11 10:00`,
    `${txn},50.00,Visa,Approved,1964-02-12,1964-02-12 09:30`,
    `DPIN-T-${txn.slice(-6)},80.00,Hotel,Approved,1964-02-12,1964-02-12 09:30`,
  ].join('\n');
  await section
    .locator('[data-import-file]')
    .setInputFiles({ name: 'made-up-expenses.csv', mimeType: 'text/csv', buffer: Buffer.from(file, 'utf8') });
  // an expense file needs no code: the preview is drawn as soon as the file is read
  const preview = section.locator('[data-import-preview]');
  await expect(preview, 'the line keyed to a tax invoice number is held, in words').toContainText(
    'an expense is never matched to a tax invoice',
    { timeout: 45_000 },
  );
  await expect(preview, 'the cost shown counts the repeated line once: 150, not 250').toContainText('150');
  await expect(preview, 'never the file’s own sum').not.toContainText('250');
  await section.locator('[data-import-confirm]').click();
  await expect(section.locator('[data-import-confirmed]'), 'confirmed').toBeVisible({ timeout: 45_000 });
  const stored = await sql<{ cost_sar: string; keys: number }>(
    `select cost_sar, cardinality(expense_keys) as keys from work.import_record
      where partner_id = $1 and transaction_ref = $2 and deleted_at is null`,
    [org.id, txn],
  );
  expect(Number(stored[0]!.cost_sar), 'Confirm stored the cost the preview showed').toBe(150);
  expect(stored[0]!.keys, 'as two expenses').toBe(2);
  expect(
    (await sql(`select 1 from work.import_record where partner_id = $1 and transaction_ref like 'DPIN-T-%'`, [org.id]))
      .length,
    'no row was written for the tax invoice number',
  ).toBe(0);
});

test('6 · the speed gate: the four new Finance reads answer in under 3 s in total for every role; no role, no read', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const d = today();
  const year = { p_from: `${d.slice(0, 4)}-01-01`, p_to: d };
  const READS: [string, Record<string, unknown>][] = [
    ['finance_unified_ledger', year],
    ['finance_reconciliation', year],
    ['finance_ageing', { p_all: true }],
    ['finance_held_rows', year],
  ];
  const out: Record<string, Record<string, number | string>> = {};
  for (const role of ['admin', 'head', 'manager', 'member', 'viewer', 'none'] as const) {
    const person = await personAs(role);
    const who = await signedInAs(browser, person);
    try {
      out[role] = {};
      let total = 0;
      for (const [fn, args] of READS) {
        const t0 = Date.now();
        const r = await callAs(who.context, fn, args);
        const ms = Date.now() - t0;
        if (role === 'none') {
          expect(r.status, `${fn}: a person with no role is refused, not answered`).toBe(403);
          out[role]![fn] = `refused (${r.status})`;
        } else {
          expect(r.status, `${fn} as ${role}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
          if (fn === 'finance_unified_ledger')
            expect(
              Array.isArray((r.body as { by_deal_type?: unknown }).by_deal_type),
              `the Ledger answers its deal-type lines to ${role}`,
            ).toBe(true);
          total += ms;
          out[role]![fn] = ms;
        }
      }
      if (role !== 'none') {
        expect(total, `the Finance reads as ${role} took ${total} ms in total`).toBeLessThan(3000);
        out[role]!.total = total;
      }
      // setting a deal type is for Full on Finance: a viewer (View) and a person with no role are refused
      const set = await callAs(who.context, 'finance_deal_type_set', {
        p_partner: null,
        p_number: 'MADE-UP-NOT-THERE',
        p_type: 'tender',
        p_reason: 'made up e2e',
      });
      if (role === 'viewer' || role === 'none')
        expect(set.status, `finance_deal_type_set as ${role}: refused`).toBe(403);
      else expect(set.status, `finance_deal_type_set as ${role}: allowed, and the row is not there`).not.toBe(403);
      console.log(`[l47-speed] ${role} · ${JSON.stringify(out[role])}`);
    } finally {
      await who.context.close();
    }
  }
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/l47-speed.json', JSON.stringify({ period: year, limit_ms: 3000, roles: out }, null, 2));
});
