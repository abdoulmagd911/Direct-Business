/**
 * Landing 31 — the unified ledger's report in the V21 look. Revenue is the one green figure of its strip and a loss
 * is red; a row with no cost says "Not known yet" for its cost and its profit — never 0; the Imported pill is on
 * imported rows only; no table scrolls sideways or holds a minimum width (the 640–1280 cramp) — a column with no room
 * moves under the row's first cell; a narrow place lists five rows and offers the rest; loading, failed and empty
 * each have their own state. Every value is made up.
 * Sabotage: tests/sabotage/landing-31-finance.mjs "ledger-revenue-loses-its-green", "no-cost-row-reads-zero",
 * "recorded-rows-get-the-imported-pill", "ledger-table-scrolls-sideways", "narrow-ledger-lists-every-row",
 * "failed-ledger-has-no-try-again".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { FinanceReport } from '../../../src/modules/finance/screens/FinanceReport';
import type { LedgerReport, LedgerRow } from '../../../src/modules/finance/types';

const row = (n: number, over: Partial<LedgerRow> = {}): LedgerRow => ({
  invoice_id: `inv-${n}`,
  unit_kind: 'transaction',
  transaction_number: `TX-MADE-${n}`,
  invoice_number: `IN-MADE-${n}`,
  partner_id: 'p1',
  created_on: '2026-10-12',
  revenue: 1000 + n,
  cost: 600,
  profit: 400 + n,
  dpin: null,
  flags: [],
  source: 'manual',
  isPromo: false,
  discountSar: null,
  ...over,
});

const report = (rows: LedgerRow[], totals: Partial<LedgerReport['totals']> = {}): LedgerReport => ({
  from: '2026-10-01',
  to: '2026-10-31',
  partner: null,
  client_id: null,
  kind: null,
  code: null,
  project: null,
  totals: {
    units: rows.length,
    revenue: 152800,
    cost: 135480,
    profit: 17320,
    without_cost: 1,
    received: 107100,
    remaining: 47600,
    manualUnits: 1,
    importUnits: 1,
    ...totals,
  },
  companies: [
    { partner_id: 'p1', partner_number: 'P-0001', trade_name_en: 'Made Up Trading', trade_name_ar: null, units: 2 },
  ],
  by_company: [
    {
      partner_id: 'p1',
      units: 2,
      revenue: 2000,
      cost: 600,
      profit: 400,
      without_cost: 1,
      received: 1000,
      remaining: 1000,
    },
  ],
  invoices: [],
  rows,
  truncated: false,
  promoRows: [],
  codeDiscount: null,
});

const html = (
  props: { report: LedgerReport | null; loading?: boolean; failed?: boolean },
  locale: 'en' | 'ar' = 'en',
) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
      <FinanceReport report={props.report} loading={!!props.loading} failed={!!props.failed} onRetry={() => {}} />
    </NextIntlClientProvider>,
  );

/** One ledger row's own markup, by its transaction number. */
const rowOf = (out: string, ref: string) => {
  const rows = out.split('<tr').filter((r) => r.includes(`>${ref}<`));
  expect(rows.length, `the row ${ref} is listed once`).toBe(1);
  return rows[0]!;
};
const total = (out: string, kind: string) =>
  new RegExp(`<span[^>]*data-finance-ledger-total="${kind}"[^>]*>`).exec(out)?.[0] ?? '';

const two = [row(1), row(2, { source: 'import', cost: null, profit: null })];

describe('the ledger strip', () => {
  it('names the unified ledger, and Revenue is the one green figure', () => {
    const out = html({ report: report(two) });
    for (const label of ['Revenue — Unified ledger', 'Cost — Unified ledger', 'Profit — Unified ledger'])
      expect(out, label).toContain(label);
    expect(total(out, 'revenue'), 'Revenue is green').toContain('data-tone="success"');
    for (const kind of ['cost', 'profit', 'received', 'remaining'])
      expect(total(out, kind), `${kind} stays neutral`).not.toContain('data-tone=');
    expect(out, 'whole riyals').toContain('152,800');
    const arabic = html({ report: report(two) }, 'ar');
    expect(arabic).toContain('الإيرادات — السجل الموحّد');
    expect(arabic).toContain('الربح — السجل الموحّد');
  });

  it('a loss is red', () => {
    const out = html({ report: report(two, { profit: -350 }) });
    expect(total(out, 'profit')).toContain('data-tone="danger"');
  });
});

describe('the ledger rows', () => {
  it('a row with no cost says Not known yet for cost and profit — never 0', () => {
    const out = html({ report: report(two) });
    const noCost = rowOf(out, 'TX-MADE-2');
    // the Cost cell, the Profit cell, and the profit under Revenue where the card is narrow
    expect(noCost.match(/data-not-known/g)?.length, 'cost and profit both say so').toBe(3);
    expect(noCost).toContain('Not known yet');
    expect(noCost, 'never a 0').not.toMatch(/>0</);
    expect(rowOf(out, 'TX-MADE-1'), 'a row with a cost shows it').not.toContain('data-not-known');
    expect(rowOf(html({ report: report(two) }, 'ar'), 'TX-MADE-2')).toContain('غير معروفة بعد');
  });

  it('the Imported pill is on imported rows only', () => {
    const out = html({ report: report(two) });
    expect(rowOf(out, 'TX-MADE-2'), 'an imported row carries the pill').toContain('bg-info-soft');
    expect(rowOf(out, 'TX-MADE-1'), 'a recorded row carries none').not.toContain('bg-info-soft');
    expect(rowOf(out, 'TX-MADE-1')).toContain('data-finance-ledger-row="manual"');
  });

  it('no table scrolls sideways or holds a minimum width', () => {
    const many = Array.from({ length: 8 }, (_, i) => row(i + 1, { flags: ['cost_pending'] }));
    const full: LedgerReport = {
      ...report(many),
      invoices: [
        {
          invoice_id: 'v1',
          invoice_number: 'IN-MADE-1',
          kind: 'billing',
          partner_id: 'p1',
          total_sar: 1000,
          received_sar: 400,
          remaining_sar: 600,
          dpin: 'DP-MADE-1',
          transactions: ['TX-MADE-1'],
        },
      ],
      promoRows: [
        {
          id: 'pr1',
          partner_id: 'p1',
          transaction_number: 'TX-MADE-P',
          invoice_number: null,
          created_on: '2026-10-14',
          code: 'MADEUP10',
          discount_sar: 50,
          revenue: 450,
          cost: null,
          profit: null,
          counted: true,
          direct_url: null,
        },
      ],
    };
    const out = html({ report: full });
    expect(out.match(/<table/g)?.length, 'the four tables').toBe(4);
    expect(out, 'nothing scrolls sideways').not.toContain('overflow-x-auto');
    expect(out, 'no table holds a minimum width').not.toMatch(/min-w-\[\d/);
    // the columns a narrow card has no room for are put away by the card's own width, never the window's
    expect(out).toContain('hidden @min-[600px]:table-cell');
    expect(out).not.toMatch(/(?:sm|md|lg|xl):table-cell/);
  });

  it('a narrow place lists five rows and offers the rest', () => {
    const many = Array.from({ length: 8 }, (_, i) => row(i + 1));
    const out = html({ report: report(many) });
    expect(out.match(/@max-\[599px\]:hidden/g)?.length, 'rows six to eight are put away where it is narrow').toBe(3);
    expect(out).toContain('See all 8');
    const few = html({ report: report(two) });
    expect(few, 'five or fewer need no See all').not.toContain('data-finance-ledger-see-all');
  });
});

describe('the ledger states', () => {
  it('loading is a skeleton, failed says so with Try again, and nothing is one line', () => {
    const loading = html({ report: null, loading: true });
    expect(loading).toContain('data-state="loading"');
    expect(loading, 'soft bars, not figures').toContain('shimmer');
    expect(loading).not.toContain('data-finance-ledger-totals');
    const failed = html({ report: null, failed: true });
    expect(failed).toContain('data-state="failed"');
    expect(failed).toContain('The ledger could not be loaded');
    expect(failed, 'a failed read offers Try again').toContain('Try again');
    const empty = html({ report: { ...report([]), by_company: [] } });
    expect(empty).toContain('data-empty');
    expect(empty).toContain('Nothing fully paid matches these filters.');
    expect(empty, 'never five figures of 0').not.toContain('data-finance-ledger-totals');
  });
});
