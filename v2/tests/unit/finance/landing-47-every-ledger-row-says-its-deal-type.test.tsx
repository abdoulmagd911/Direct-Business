/**
 * Landing 47 (Finance Part B) — what a Ledger row says beside its money.
 * A5:  every row carries its deal type — prepaid, postpaid, tender or promo — and a row nothing settles says "Deal
 *      type not set", as a warning, never a blank. "By deal type" draws the database's own lines; its filter keeps one
 *      deal type (or the rows that are not set) and its sort groups the list; neither moves a figure of the strip.
 *      A person with Full on Finance gets the control to set a row's deal type; nobody else does.
 * A12: a counted postpaid row says "Paid · receivable".
 * A14: a row whose tax invoice is issued (it carries a DPIN) says so.
 * A7:  a hand-typed commission says which commission it is.
 * The file carries the deal type in its last column. Every value is made up.
 * Sabotage: tests/sabotage/landing-47-finance.mjs.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEAL_FILTERS,
  dealTypeLinesOf,
  dealTypeOf,
  filterByDeal,
  sortByDeal,
} from '../../../src/modules/finance/deal-type';
import { ledgerRowsToCsv } from '../../../src/modules/finance/ledger';
import { DealTypeTable } from '../../../src/modules/finance/screens/DealMarks';
import { FinanceReport } from '../../../src/modules/finance/screens/FinanceReport';
import { ledgerReportOf } from '../../../src/modules/finance/screens/ledger-report';
import type { LedgerReport } from '../../../src/modules/finance/types';
import { inWords, parts, report, row } from './landing-32-fixtures';

const rows = () => [
  row(1, { deal_type: 'prepaid', deal_type_by: 'organisation' }),
  row(2, { deal_type: 'postpaid', deal_type_by: 'client_id', receivable: true }),
  row(3, { deal_type: 'tender', deal_type_by: 'person', tax_invoice_issued: true, dpin: 'DPIN-T-311' }),
  row(4, { deal_type: 'promo', deal_type_by: 'code' }),
  row(5, { deal_type: null, deal_type_by: null }),
  row(6, { deal_type: 'prepaid', deal_type_by: 'organisation', source: 'manual', commission_type: 'airlines' }),
];
const LINES = [
  { deal_type: 'prepaid' as const, units: 2, revenue: 2007, cost: 1200, profit: 807, without_cost: 0 },
  { deal_type: 'postpaid' as const, units: 1, revenue: 1002, cost: null, profit: null, without_cost: 1 },
  { deal_type: null, units: 1, revenue: 1005, cost: 600, profit: 405, without_cost: 0 },
];
const html = (r: LedgerReport, opts: { set?: boolean; locale?: 'en' | 'ar' } = {}) =>
  renderToStaticMarkup(
    inWords(
      <FinanceReport
        report={r}
        loading={false}
        failed={false}
        onRetry={() => {}}
        onSetDealType={opts.set === false ? undefined : async () => {}}
      />,
      opts.locale,
    ),
  );
const ledgerRows = (out: string) => parts(out, 'data-finance-ledger-row');
const rowOf = (out: string, n: number) => ledgerRows(out).find((r) => r.includes(`TX-MADE-${n}<`)) ?? '';

describe('A5 — every row says its deal type', () => {
  const out = html(report(rows(), { byDealType: LINES }));

  it('names the deal type on each row, and what decided it', () => {
    expect(rowOf(out, 1)).toContain('data-ledger-deal-type="prepaid"');
    expect(rowOf(out, 1)).toContain('>Prepaid<');
    expect(rowOf(out, 1)).toContain('data-ledger-deal-type-by="organisation"');
    expect(rowOf(out, 2)).toContain('>Postpaid<');
    expect(rowOf(out, 3)).toContain('>Tender<');
    expect(rowOf(out, 3)).toContain('title="Set by a person"');
    expect(rowOf(out, 4)).toContain('>Promo code<');
  });

  it('a row nothing settles says “Deal type not set” — a warning, never a blank', () => {
    const none = rowOf(out, 5);
    expect(none).toContain('data-ledger-deal-type="none"');
    expect(none).toContain('Deal type not set');
  });

  it('says it in Arabic too', () => {
    const ar = html(report(rows(), { byDealType: LINES }), { locale: 'ar' });
    expect(rowOf(ar, 2)).toContain('آجل الدفع');
    expect(rowOf(ar, 5)).toContain('نوع التعامل غير محدد');
  });

  it('an answer with a word that is not a deal type is “not set”, never that word', () => {
    expect(dealTypeOf('credit')).toBeNull();
    expect(dealTypeOf(undefined)).toBeNull();
    expect(dealTypeOf('tender')).toBe('tender');
  });
});

describe('A12, A14, A7 — the other marks', () => {
  const out = html(report(rows(), { byDealType: LINES }));

  it('a counted postpaid row says Paid · receivable; no other row does', () => {
    expect(rowOf(out, 2)).toContain('data-ledger-receivable');
    expect(rowOf(out, 2)).toContain('Paid · receivable');
    expect(rowOf(out, 1)).not.toContain('data-ledger-receivable');
  });

  it('a row whose tax invoice is issued says so; a row with none does not', () => {
    expect(rowOf(out, 3)).toContain('data-ledger-tax-invoice-issued');
    expect(rowOf(out, 3)).toContain('Tax invoice issued');
    expect(rowOf(out, 1)).not.toContain('data-ledger-tax-invoice-issued');
  });

  it('a hand-typed commission says which commission it is', () => {
    expect(rowOf(out, 6)).toContain('data-ledger-commission-type="airlines"');
    expect(rowOf(out, 6)).toContain('Commission · Airlines');
    expect(rowOf(out, 1)).not.toContain('data-ledger-commission-type');
  });
});

describe('A5 — “By deal type”: the database’s lines, the filter and the sort', () => {
  it('draws one line per deal type with the database’s own figures; a cost not known is words, never 0', () => {
    const out = html(report(rows(), { byDealType: LINES }));
    const line = (k: string) => parts(out, `data-ledger-deal-line="${k}"`)[0] ?? '';
    expect(line('prepaid')).toContain('2,007');
    expect(line('postpaid')).toContain('1,002');
    expect(line('postpaid')).toContain('Not known yet');
    expect(line('postpaid')).not.toMatch(/>0</);
    expect(line('none'), 'the rows that are not set are a line of their own').toContain('Not set');
  });

  it('offers every deal type, All and Not set as a filter, and the sort', () => {
    const out = html(report(rows(), { byDealType: LINES }));
    for (const f of DEAL_FILTERS) expect(out).toContain(`data-ledger-deal-filter-option="${f}"`);
    expect(out).toContain('data-ledger-deal-sort');
    expect(parts(out, 'data-ledger-deal-filter-option="all"')[0]).toContain('aria-pressed="true"');
  });

  it('the filter keeps one deal type, or the rows that are not set — never hiding them under another name', () => {
    const all = rows();
    expect(filterByDeal(all, 'all')).toHaveLength(6);
    expect(filterByDeal(all, 'prepaid').map((r) => r.transaction_number)).toEqual(['TX-MADE-1', 'TX-MADE-6']);
    expect(filterByDeal(all, 'postpaid').map((r) => r.transaction_number)).toEqual(['TX-MADE-2']);
    expect(filterByDeal(all, 'none').map((r) => r.transaction_number)).toEqual(['TX-MADE-5']);
  });

  it('the sort groups prepaid, postpaid, tender, promo, then not set — each group in the order it came', () => {
    const mixed = [rows()[4]!, rows()[3]!, rows()[5]!, rows()[1]!, rows()[2]!, rows()[0]!];
    expect(sortByDeal(mixed).map((r) => r.transaction_number)).toEqual([
      'TX-MADE-6',
      'TX-MADE-1',
      'TX-MADE-2',
      'TX-MADE-3',
      'TX-MADE-4',
      'TX-MADE-5',
    ]);
  });

  it('a pressed filter is drawn pressed, and a cut list says its lines add up the listed rows only', () => {
    const out = renderToStaticMarkup(
      inWords(<DealTypeTable lines={LINES} filter="postpaid" onFilter={() => {}} sorted onSort={() => {}} partial />),
    );
    expect(parts(out, 'data-ledger-deal-filter-option="postpaid"')[0]).toContain('aria-pressed="true"');
    expect(parts(out, 'data-ledger-deal-filter-option="all"')[0]).toContain('aria-pressed="false"');
    expect(parts(out, 'data-ledger-deal-sort')[0]).toContain('aria-pressed="true"');
    expect(out).toContain('data-ledger-deal-partial');
  });

  it('the strip’s figures are the database’s totals, whatever the lines say', () => {
    const out = html(report(rows(), { byDealType: LINES }));
    expect(parts(out, 'data-finance-ledger-total="revenue"')[0]).toContain('43,210');
  });

  it('reads the lines under the database’s own name, and drops a line with no count', () => {
    const read = ledgerReportOf({
      totals: {},
      rows: [],
      by_deal_type: [
        { deal_type: 'tender', units: 3, revenue: 900, cost: null, profit: null, without_cost: 3 },
        { deal_type: null, units: 1, revenue: 50, cost: 20, profit: 30, without_cost: 0 },
        { deal_type: 'promo' },
      ],
      can_set_deal_type: true,
    });
    expect(read.byDealType).toEqual([
      { deal_type: 'tender', units: 3, revenue: 900, cost: null, profit: null, without_cost: 3 },
      { deal_type: null, units: 1, revenue: 50, cost: 20, profit: 30, without_cost: 0 },
    ]);
    expect(read.canSetDealType).toBe(true);
    expect(dealTypeLinesOf('nope')).toEqual([]);
  });

  it('reads each row’s marks from the database’s names; a mark the answer does not carry is off', () => {
    const read = ledgerReportOf({
      totals: {},
      rows: [
        {
          invoice_id: 'x',
          revenue: 10,
          deal_type: 'postpaid',
          deal_type_by: 'organisation',
          receivable: true,
          tax_invoice_issued: true,
          commission_type: 'cashback',
        },
        { invoice_id: 'y', revenue: 10, deal_type: 'wallet', receivable: 'yes', commission_type: 'bonus' },
      ],
      not_yet_counted: [{ invoice_id: 'z', amount: 5, deal_type: 'tender' }],
    });
    expect(read.rows[0]).toMatchObject({
      deal_type: 'postpaid',
      deal_type_by: 'organisation',
      receivable: true,
      tax_invoice_issued: true,
      commission_type: 'cashback',
    });
    expect(read.rows[1]).toMatchObject({
      deal_type: null,
      deal_type_by: null,
      receivable: false,
      tax_invoice_issued: false,
      commission_type: null,
    });
    expect(read.notYetCounted?.[0]?.deal_type).toBe('tender');
    expect(read.canSetDealType).toBe(false);
  });
});

describe('A5 — who sets a deal type', () => {
  it('Full on Finance gets the control on each row: Set where it is not set, Change where it is', () => {
    const out = html(report(rows(), { byDealType: LINES, canSetDealType: true }));
    expect(rowOf(out, 5)).toContain('data-ledger-set-deal-type');
    expect(rowOf(out, 5)).toContain('Set deal type');
    expect(rowOf(out, 1)).toContain('>Change<');
  });

  it('nobody else is offered it — the marks are read, never a button', () => {
    const out = html(report(rows(), { byDealType: LINES, canSetDealType: false }));
    expect(out).not.toContain('data-ledger-set-deal-type');
    expect(out).toContain('data-ledger-deal-type="prepaid"');
  });

  it('with no way to save it (a page that only reads), there is no control either', () => {
    const out = html(report(rows(), { byDealType: LINES, canSetDealType: true }), { set: false });
    expect(out).not.toContain('data-ledger-set-deal-type');
  });
});

describe('A5 — a not-yet-counted document carries its deal type; the file carries it last', () => {
  it('lists the deal type on a document that is not counted yet', () => {
    const out = html(
      report(rows(), {
        byDealType: LINES,
        notYetCounted: [
          {
            invoice_id: 'w1',
            unit_kind: 'transaction',
            transaction_number: 'TX-WAIT-1',
            invoice_number: null,
            number: 'TX-WAIT-1',
            partner_id: 'p-made-up',
            partner_number: 'P-990001',
            trade_name_en: 'Made-up Org',
            trade_name_ar: null,
            created_on: '2026-10-14',
            amount: 700,
            received: null,
            remaining: 700,
            status: 'Pending',
            source: 'import',
            direct_url: null,
            deal_type: 'postpaid',
          },
        ],
      }),
    );
    const waiting = parts(out, 'data-ledger-not-yet-counted-row')[0] ?? '';
    expect(waiting).toContain('data-ledger-deal-type="postpaid"');
  });

  it('the file’s last column is the deal type; empty when not set, and every earlier column stays where it was', () => {
    const headers = {
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
    };
    const r = report(rows());
    const without = ledgerRowsToCsv(r, headers, () => 'Made-up Org').split('\n');
    const withType = ledgerRowsToCsv(r, { ...headers, dealType: 'Deal type' }, () => 'Made-up Org').split('\n');
    expect(withType[0]).toBe(`${without[0]},Deal type`);
    expect(withType[1]).toBe(`${without[1]},prepaid`);
    expect(withType[5], 'a row that is not set carries an empty cell, never a guessed word').toBe(`${without[5]},`);
    expect(withType.at(-1)).toBe(`${without.at(-1)},`);
  });
});
