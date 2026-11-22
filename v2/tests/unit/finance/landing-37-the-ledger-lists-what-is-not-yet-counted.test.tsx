/**
 * Landing 37 (Finance F-C, A6) — the Ledger lists what is not yet counted.
 * A Pending or Draft invoice (and an imported row not confirmed paid) is a row of its own under "Not yet counted (N)":
 * its number, its amount as not yet counted, what is left on it, its status word and — an imported row — its Direct
 * link. It is in no figure: the strip's Revenue is the database's own total and is the same with the list as without
 * it, the row is not in the counted table and not in the exported file. A view that holds only such rows is not
 * "nothing here". The database's own names (`not_yet_counted`, `not_yet_counted_units` …) are read once, in the mapper.
 * Every value is made up. Sabotage: tests/sabotage/landing-37-finance.mjs.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ledgerRowsToCsv } from '../../../src/modules/finance/ledger';
import { FinanceReport } from '../../../src/modules/finance/screens/FinanceReport';
import { ledgerReportOf } from '../../../src/modules/finance/screens/ledger-report';
import type { LedgerReport, NotYetCountedRow } from '../../../src/modules/finance/types';
import { inWords, parts, report, row } from './landing-32-fixtures';

const waiting = (n: number, over: Partial<NotYetCountedRow> = {}): NotYetCountedRow => ({
  invoice_id: `wait-${n}`,
  unit_kind: 'transaction',
  transaction_number: `99037000${n}`,
  invoice_number: null,
  number: `99037000${n}`,
  partner_id: 'p-made-up',
  partner_number: 'P-990001',
  trade_name_en: 'Made-up Org',
  trade_name_ar: 'جهة مختلقة',
  created_on: '2026-10-08',
  amount: 100,
  received: 0,
  remaining: 100,
  status: 'Pending',
  source: 'manual',
  direct_url: null,
  ...over,
});

const html = (r: LedgerReport, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(inWords(<FinanceReport report={r} loading={false} failed={false} onRetry={() => {}} />, locale));
const block = (out: string) => parts(out, 'data-ledger-not-yet-counted')[0]?.split('data-ledger-not-counted=')[0] ?? '';
const rowsOf = (out: string) => parts(out, 'data-ledger-not-yet-counted-row');
const strip = (out: string, kind: string) =>
  ((parts(out, `data-finance-ledger-total="${kind}"`)[0] ?? '').split('data-finance-ledger-total=')[1] ?? '').split(
    '</small>',
  )[0] ?? '';

const WAITING = [
  waiting(12),
  waiting(13, { status: 'Draft', partner_id: null, trade_name_en: null, trade_name_ar: null, partner_number: null }),
  waiting(14, {
    source: 'import',
    amount: 300,
    received: null,
    remaining: 300,
    status: 'Waiting for Issuing',
    direct_url: 'https://example.invalid/t/9903700014',
  }),
];
const withList = report([row(1), row(2)], {
  notYetCounted: WAITING,
  totals: { notYetCountedUnits: 3, notYetCountedAmount: 500 } as LedgerReport['totals'],
});
const without = report([row(1), row(2)]);

describe('the Ledger lists what is not yet counted', () => {
  it('a Pending and a Draft invoice are rows of their own under Not yet counted (N)', () => {
    const out = html(withList);
    expect(block(out), 'the block is titled with its count').toContain('Not yet counted (3)');
    const rows = rowsOf(out);
    expect(rows.length, 'one row per document that waits').toBe(3);
    expect(rows[0], 'the row names its number').toContain('9903700012');
    expect(rows[0], 'its amount is said as not yet counted').toMatch(/Not yet counted\s*<\/span><bdi[^>]*>100</);
    expect(rows[0], 'and what is left on it').toMatch(/Remaining\s*<\/span><bdi[^>]*>100</);
    expect(rows[0], 'it says its status word').toContain('Pending');
    expect(rows[0], 'it is marked not counted yet').toContain('Not counted yet');
    expect(rows[0], 'its organisation is a link to its record').toContain('href="/partners/p-made-up"');
    expect(rows[1], 'the Draft says so').toContain('Draft');
    expect(rows[1], 'a row of nobody known says so, with no link').toContain('No partner');
    expect(rows[1]).not.toContain('href="/partners/');
  });

  it('an imported row says where it came from and carries its Direct link', () => {
    const imported = rowsOf(html(withList))[2]!;
    expect(imported).toContain('data-ledger-not-yet-counted-row="import"');
    expect(imported, 'the Imported pill').toContain('Imported');
    expect(imported, 'the Direct link of the record').toContain('href="https://example.invalid/t/9903700014"');
    expect(imported).toContain('Open in Direct');
    expect(rowsOf(html(withList))[0], 'a row with no link offers none').not.toContain('data-ledger-direct-link');
  });

  it('Revenue and every figure of the strip are the same with the list as without it', () => {
    const a = html(withList);
    const b = html(without);
    for (const kind of ['revenue', 'cost', 'profit', 'received', 'remaining']) {
      expect(strip(a, kind), `${kind} is unchanged by what waits`).toBe(strip(b, kind));
    }
    expect(strip(a, 'revenue'), 'Revenue is the database’s own total').toContain('43,210<');
    expect(block(a), 'what waits is totalled apart').toMatch(/Total not yet counted[^<]*<bdi[^>]*>500</);
  });

  it('a row that waits is not in the counted table and not in the file', () => {
    const out = html(withList);
    const counted = out.split('data-finance-ledger-rows')[1]!.split('data-ledger-not-yet-counted')[0]!;
    expect(counted, 'the counted table holds the two counted rows only').not.toContain('9903700012');
    expect(counted.match(/data-finance-ledger-row=/g)?.length).toBe(2);
    const csv = ledgerRowsToCsv(
      withList,
      {
        created: 'Created',
        company: 'Partner',
        transaction: 'Transaction',
        invoice: 'Invoice',
        kind: 'Kind',
        source: 'Source',
        revenue: 'Revenue',
        cost: 'Cost',
        profit: 'Profit',
        dpin: 'DPIN',
        flags: 'Flags',
        total: 'Total',
      },
      () => 'Made-up Org',
    );
    expect(csv, 'the file is the counted view: no row that waits').not.toContain('9903700012');
    expect(csv.split('\n').length, 'heading, two rows, the totals line').toBe(4);
  });

  it('no block when nothing waits, and a view that holds only waiting rows is not “nothing here”', () => {
    expect(html(without)).not.toContain('data-ledger-not-yet-counted');
    const only = report([], {
      by_company: [],
      companies: [],
      notYetCounted: [waiting(12)],
      totals: { revenue: 0, cost: null, profit: null, received: 0, remaining: 0 } as LedgerReport['totals'],
    });
    const out = html(only);
    expect(out, 'the report is drawn').not.toContain('data-empty');
    expect(rowsOf(out).length).toBe(1);
    expect(strip(out, 'revenue'), 'Revenue stays 0: the waiting 100 is not in it').toMatch(/>0<small/);
    expect(strip(out, 'revenue')).not.toContain('100');
  });

  it('reads in Arabic, with the organisation’s Arabic name', () => {
    const out = html(withList, 'ar');
    expect(block(out)).toContain('لم تُحتسب بعد (3)');
    expect(rowsOf(out)[0]).toContain('جهة مختلقة');
  });
});

describe('the mapper reads the database’s own names', () => {
  const answer = {
    totals: { units: 1, revenue: 1000, not_yet_counted_units: 2, not_yet_counted_amount: 400 },
    rows: [],
    not_yet_counted: [
      {
        invoice_id: 'a',
        unit_kind: 'transaction',
        transaction_number: '9903700012',
        invoice_number: null,
        number: '9903700012',
        partner_id: null,
        created_on: '2026-11-08',
        amount: 100,
        received: 0,
        remaining: 100,
        status: 'Pending',
        source: 'manual',
        direct_url: null,
      },
      {
        invoice_id: 'import:9903700014',
        unit_kind: 'transaction',
        number: '9903700014',
        created_on: '2026-11-09',
        amount: 300,
        received: null,
        remaining: 300,
        status: 'Waiting for Issuing',
        source: 'import',
        direct_url: 'javascript:alert(1)',
      },
      { invoice_id: 'no-amount', number: 'X', created_on: '2026-11-09', amount: null, source: 'manual' },
    ],
  };
  const r = ledgerReportOf(answer);

  it('the list and its two totals arrive under the report’s names', () => {
    expect(r.notYetCounted?.map((n) => n.number)).toEqual(['9903700012', '9903700014']);
    expect(r.totals.notYetCountedUnits).toBe(2);
    expect(r.totals.notYetCountedAmount).toBe(400);
    expect(r.totals.revenue, 'Revenue is read as it was answered').toBe(1000);
  });

  it('a row with no amount is no row, and a link that is not a web address is no link', () => {
    expect(r.notYetCounted?.some((n) => n.number === 'X')).toBe(false);
    expect(r.notYetCounted?.[1]?.direct_url).toBeNull();
    expect(r.notYetCounted?.[1]?.received, 'an imported row’s receipts are not known: empty, never 0').toBeNull();
  });

  it('an older answer with no such part is an empty list', () => {
    expect(ledgerReportOf({ totals: {}, rows: [] }).notYetCounted).toEqual([]);
  });
});
