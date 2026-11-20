/**
 * Landing 32 (Finance F-B) — the unified Ledger says what is counted.
 * A5: with no counted cost the strip's Cost and Profit are a dash with "Not known yet" — never 0 — and so are an
 *     organisation's cost and profit in the by-organisation table.
 * A2: every row has a "Counted?" cell; a row that does not count is listed apart under "Not counted (N)" with its
 *     revenue and the reason typed, and is in no total; an admin may Exclude a counted row and Include one excluded
 *     by hand — a row a list rule catches points to Settings → Finance instead; nobody else gets a button.
 * A3: a code text that matched no code (or more than one) is a warning on the row.
 * A4: a code view shows one discount figure, the filtered one.
 * Every value is made up. Sabotage: tests/sabotage/landing-32-finance-ledger.mjs.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ledgerRowsToCsv } from '../../../src/modules/finance/ledger';
import { FinanceReport } from '../../../src/modules/finance/screens/FinanceReport';
import { ledgerReportOf } from '../../../src/modules/finance/screens/ledger-report';
import type { LedgerReport } from '../../../src/modules/finance/types';
import { unifyRows, type UnifiedInputRow } from '../../../src/modules/finance/unified';
import { byHand, byList, inWords, parts, report, row } from './landing-32-fixtures';

const html = (r: LedgerReport, opts: { toggle?: boolean; locale?: 'en' | 'ar' } = {}) =>
  renderToStaticMarkup(
    inWords(
      <FinanceReport
        report={r}
        loading={false}
        failed={false}
        onRetry={() => {}}
        onToggle={opts.toggle === false ? undefined : async () => {}}
      />,
      opts.locale,
    ),
  );
const figure = (out: string, kind: string) => parts(out, `data-finance-ledger-total="${kind}"`)[0] ?? '';
/** The strip figure only: from its own hook up to the next figure of the strip. */
const strip = (out: string, kind: string) => figure(out, kind).split('data-finance-ledger-total=')[1] ?? '';
const mainTable = (out: string) => out.split('data-finance-ledger-rows')[1]!.split('data-ledger-not-counted')[0]!;
const apart = (out: string) => parts(out, 'data-ledger-not-counted')[0]?.split('data-finance-ledger-promo')[0] ?? '';

describe('A5 — with no counted cost there is no Cost and no Profit to show', () => {
  const none = report([row(1, { cost: null, profit: null })], {
    totals: { cost: null, profit: null, without_cost: 1 } as LedgerReport['totals'],
    by_company: [
      {
        partner_id: 'p-made-up',
        units: 1,
        revenue: 43210,
        cost: null,
        profit: null,
        without_cost: 1,
        received: 0,
        remaining: 43210,
      },
    ],
  });

  it('the strip’s Cost is a dash with Not known yet — never 0', () => {
    const cost = strip(html(none), 'cost');
    expect(cost, 'the hook the browser test reads').toContain('data-ledger-cost-empty');
    expect(cost).toContain('—');
    expect(cost).toContain('Not known yet');
    expect(cost, 'never a 0').not.toMatch(/>0</);
    expect(cost, 'no unit beside a figure that is not there').not.toContain('SAR');
    expect(strip(html(none, { locale: 'ar' }), 'cost')).toContain('غير معروفة بعد');
  });

  it('the strip’s Profit is empty with it — never 0, and never red', () => {
    const profit = strip(html(none), 'profit');
    expect(profit).toContain('data-ledger-figure-empty');
    expect(profit).toContain('Not known yet');
    expect(profit).not.toMatch(/>0</);
    expect(profit).not.toContain('data-tone=');
  });

  it('a known cost is still a figure, and its strip carries no empty mark', () => {
    const out = html(report([row(1)]));
    expect(strip(out, 'cost')).toContain('30,100');
    expect(out).not.toContain('data-ledger-cost-empty');
  });

  it('an organisation with no cost shows no cost and no profit in the by-organisation table — never 0', () => {
    const out = html(none);
    const table = out.split('data-finance-ledger-companies')[1]!.split('data-finance-ledger-invoices')[0]!;
    const cost = parts(table, 'data-ledger-partner-cost')[0]!.split('</td>')[0]!;
    const profit = parts(table, 'data-ledger-partner-profit')[0]!.split('</td>')[0]!;
    for (const [name, cell] of [
      ['cost', cost],
      ['profit', profit],
    ] as const) {
      expect(cell, `${name} says it is not known`).toContain('data-not-known');
      expect(cell, `${name} is never 0`).not.toMatch(/>0</);
    }
    // the narrow card's pairs under the name say the same
    expect(table.match(/data-not-known/g)?.length).toBe(4);
  });
});

describe('A2 — the Counted? column and the rows listed apart', () => {
  const mixed = report([row(1), row(2), byHand(3, { revenue: 7770 }), byList(4, { revenue: 8880 })], {
    totals: { excludedUnits: 2, excludedRevenue: 16650 } as LedgerReport['totals'],
  });

  it('every counted row says Counted in its own cell', () => {
    const table = mainTable(html(mixed));
    expect(table).toContain('Counted?');
    expect(table.match(/data-ledger-counted="yes"/g)?.length).toBe(2);
    expect(parts(table, 'data-ledger-counted="yes"')[0]).toContain('>Counted<');
    expect(mainTable(html(mixed, { locale: 'ar' }))).toContain('هل يُحتسب؟');
  });

  it('a row that does not count is listed apart, never in the main table', () => {
    const out = html(mixed);
    expect(mainTable(out), 'the main table lists counted rows only').not.toContain('TX-MADE-3');
    expect(mainTable(out)).not.toContain('TX-MADE-4');
    const list = apart(out);
    expect(list, 'its heading counts the rows').toContain('Not counted (2)');
    expect(list.match(/data-ledger-not-counted-row/g)?.length).toBe(2);
    expect(list.match(/data-ledger-counted="no"/g)?.length).toBe(2);
    expect(apart(html(mixed, { locale: 'ar' }))).toContain('غير محتسب (2)');
  });

  it('a row listed apart shows its revenue and the reason typed', () => {
    const [hand, listRule] = parts(apart(html(mixed)), 'data-ledger-not-counted-row');
    expect(hand).toContain('TX-MADE-3');
    expect(hand).toContain('7,770');
    expect(hand).toContain('Made-up test booking');
    expect(listRule).toContain('8,880');
    expect(listRule).toContain('Made-up internal account');
  });

  it('a row a list rule catches says so and points to Settings — a row excluded by hand does not', () => {
    const [hand, listRule] = parts(apart(html(mixed)), 'data-ledger-not-counted-row');
    expect(listRule).toContain('Excluded by a list rule — change it in Settings → Finance');
    expect(listRule, 'and names the kind of rule').toContain('Client ID');
    expect(hand).not.toContain('Excluded by a list rule');
  });

  it('the rows listed apart are in no total: the strip shows the read’s own figures', () => {
    const out = html(mixed);
    expect(strip(out, 'revenue')).toContain('43,210');
    expect(strip(out, 'revenue')).not.toContain('59,860');
    expect(out, 'the units are the counted rows').toMatch(/Units: <b[^>]*>2<\/b>/);
  });

  it('with nothing left out there is no such section', () => {
    expect(html(report([row(1)]))).not.toContain('data-ledger-not-counted');
  });

  it('the file holds counted rows only, above the totals they are in', () => {
    const csv = ledgerRowsToCsv(
      mixed,
      {
        created: 'Created',
        company: 'Partner',
        transaction: 'Transaction no.',
        invoice: 'Invoice no.',
        kind: 'Invoice type',
        source: 'Source',
        revenue: 'Revenue',
        cost: 'Cost',
        profit: 'Profit',
        dpin: 'Tax invoice no.',
        flags: 'Flags',
        total: 'Totals',
      },
      () => 'Made-up Org',
    );
    expect(csv.split('\n')).toHaveLength(1 + 2 + 1);
    expect(csv).not.toContain('TX-MADE-3');
  });
});

describe('A2 — Exclude and Include are for admins, and only where allowed', () => {
  const rows = [
    row(1),
    row(2, { number: null }),
    row(5, { source_partner_id: null }),
    byHand(3),
    byList(4),
    byHand(6, { number: null }),
  ];
  const admin = html(report(rows, { canToggle: true }));

  it('an admin gets Exclude on a counted row that names itself', () => {
    const cells = parts(mainTable(admin), 'data-ledger-counted="yes"').map((c) => c.split('</td>')[0]!);
    expect(cells).toHaveLength(3);
    expect(cells[0], 'the row with its number and its organisation').toContain('data-ledger-exclude');
    expect(cells[0]).toContain('>Exclude<');
    expect(cells[1], 'no number, no action').not.toContain('data-ledger-exclude');
    expect(cells[2], 'no organisation, no action').not.toContain('data-ledger-exclude');
  });

  it('an admin gets Include only on a row excluded by hand', () => {
    const [hand, listRule, noNumber] = parts(apart(admin), 'data-ledger-not-counted-row');
    expect(hand).toContain('data-ledger-include');
    expect(hand).toContain('>Include<');
    expect(listRule, 'a list rule is changed in Settings, never from the row').not.toContain('data-ledger-include');
    expect(noNumber, 'no number, no action').not.toContain('data-ledger-include');
    expect(admin.match(/data-ledger-include/g)?.length).toBe(1);
  });

  it('anyone else reads the column and the reasons, with no button', () => {
    const out = html(report(rows, { canToggle: false }));
    expect(out).not.toContain('data-ledger-exclude');
    expect(out).not.toContain('data-ledger-include');
    expect(out).toContain('data-ledger-counted="yes"');
    expect(apart(out)).toContain('Made-up test booking');
  });

  it('a page that cannot run the change offers no button either', () => {
    const out = html(report(rows, { canToggle: true }), { toggle: false });
    expect(out).not.toContain('data-ledger-exclude');
    expect(out).not.toContain('data-ledger-include');
  });
});

describe('A3 — a code that has not been found is said on the row', () => {
  it('a row flagged code_not_found carries the warning, and the flag is not repeated as text', () => {
    const out = html(report([row(1, { flags: ['code_not_found'] }), row(2)]));
    const table = mainTable(out);
    expect(table.match(/data-ledger-code-state="not_found"/g)?.length).toBe(1);
    expect(table.match(/Code has not been found/g)?.length, 'said once').toBe(1);
    expect(html(report([row(1, { flags: ['code_not_found'] })]), { locale: 'ar' })).toContain('لم يُعثر على الكود');
  });

  it('a row whose text more than one code carries says it is held', () => {
    const out = mainTable(html(report([row(1, { flags: ['code_held'] })])));
    expect(out).toContain('data-ledger-code-state="ambiguous"');
    expect(out).toContain('Held: more than one code carries this text');
  });

  it('a discount-code row says the same from what its code matched', () => {
    const promo = {
      id: 'promo-1',
      partner_id: 'p-made-up',
      transaction_number: 'TX-MADE-9',
      invoice_number: '9990000009',
      created_on: '2026-10-05',
      code: 'MADEUP10',
      discount_sar: 100,
      revenue: 1500,
      cost: null,
      profit: null,
      counted: true,
      direct_url: null,
    };
    const out = html(
      report([row(1)], {
        promoRows: [
          { ...promo, code_state: 'not_found' },
          { ...promo, id: 'promo-2', transaction_number: 'TX-MADE-10', code_state: 'found' },
        ],
      }),
    );
    const rowsOut = parts(out, 'data-finance-ledger-promo-row');
    expect(rowsOut[0]).toContain('Code has not been found');
    expect(rowsOut[1], 'a code that was found says nothing').not.toContain('data-ledger-code-state');
  });
});

describe('A4 — a code view shows one discount figure', () => {
  it('the filtered discount is drawn once, and no second figure beside it', () => {
    const out = html(report([row(1, { isPromo: true, discountSar: 55 })], { code: 'MADEUP10', codeDiscount: 3456 }));
    expect(out.match(/data-finance-ledger-code-discount/g)?.length).toBe(1);
    const line = parts(out, 'data-finance-ledger-code-discount')[0]!.split('</p>')[0]!;
    expect(line.match(/<b/g)?.length, 'one figure on the line').toBe(1);
    expect(line).toContain('3,456');
    expect(out.match(/3,456/g)?.length, 'and nowhere else').toBe(1);
  });

  it('without a code asked for there is no such line', () => {
    expect(html(report([row(1)], { codeDiscount: 3456 }))).not.toContain('data-finance-ledger-code-discount');
  });
});

describe('the ledger’s answer is read under the database’s names', () => {
  const answer = {
    can_toggle: true,
    totals: {
      units: 1,
      revenue: 900,
      cost: null,
      profit: null,
      without_cost: 1,
      received: 0,
      remaining: 900,
      excluded_units: 1,
      excluded_revenue: 450,
    },
    by_company: [{ partner_id: 'p-made-up', units: 1, revenue: 900, cost: null, profit: null }],
    rows: [
      { invoice_id: 'a', unit_kind: 'transaction', revenue: 900, cost: null, profit: null, counted: true, flags: [] },
      {
        invoice_id: 'b',
        unit_kind: 'transaction',
        revenue: 450,
        cost: 300,
        profit: 150,
        counted: false,
        excluded_by: 'invoice',
        not_counted_reason: 'Made-up reason',
        excluded_row_level: true,
        number: 'TX-MADE-8',
        source_partner_id: 'p-source',
        partner_id: 'p-made-up',
        merged_by: 'client_id',
        code_state: 'not_found',
        flags: ['code_not_found'],
      },
    ],
  };

  it('an empty cost stays empty — never read as 0', () => {
    const r = ledgerReportOf(answer);
    expect(r.totals.cost).toBeNull();
    expect(r.totals.profit).toBeNull();
    expect(r.by_company[0]).toMatchObject({ cost: null, profit: null });
  });

  it('reads who may toggle, what is left out, and each row’s own state', () => {
    const r = ledgerReportOf(answer);
    expect(r.canToggle).toBe(true);
    expect(r.totals).toMatchObject({ excludedUnits: 1, excludedRevenue: 450 });
    expect(r.rows[0]).toMatchObject({ counted: true, excluded_row_level: false, number: null });
    expect(r.rows[1]).toMatchObject({
      counted: false,
      excluded_by: 'invoice',
      not_counted_reason: 'Made-up reason',
      excluded_row_level: true,
      number: 'TX-MADE-8',
      source_partner_id: 'p-source',
      merged_by: 'client_id',
      code_state: 'not_found',
    });
  });

  it('a row that does not count carries no cost and no profit', () => {
    expect(ledgerReportOf(answer).rows[1]).toMatchObject({ cost: null, profit: null });
  });

  it('an older answer with no such parts counts every row and lets nobody toggle', () => {
    const r = ledgerReportOf({ totals: { units: 1 }, rows: [{ invoice_id: 'a', revenue: 10 }] });
    expect(r.canToggle).toBe(false);
    expect(r.rows[0]!.counted).toBe(true);
  });
});

describe('the tested copy of the rules never totals a row that is left out', () => {
  const input = (key: string, over: Partial<UnifiedInputRow> = {}): UnifiedInputRow => ({
    key,
    source: 'import',
    partnerId: 'p-made-up',
    createdOn: '2026-10-12',
    transactionNumber: key,
    invoiceNumber: null,
    revenue: 1000,
    cost: 600,
    profit: 400,
    counted: true,
    isPromo: false,
    code: null,
    discount: null,
    ...over,
  });

  it('an excluded row is listed apart with its revenue, out of every total', () => {
    const { rows, excludedRows, totals } = unifyRows([input('TX-MADE-1'), input('TX-MADE-2', { excluded: true })]);
    expect(rows.map((r) => r.key)).toEqual(['TX-MADE-1']);
    expect(excludedRows.map((r) => r.key)).toEqual(['TX-MADE-2']);
    expect(totals).toMatchObject({
      units: 1,
      revenue: 1000,
      cost: 600,
      profit: 400,
      excludedUnits: 1,
      excludedRevenue: 1000,
    });
  });

  it('an excluded discount-code row is not a promo row either', () => {
    const { promoRows, totals } = unifyRows([input('TX-MADE-3', { excluded: true, isPromo: true, code: 'MADEUP10' })]);
    expect(promoRows).toEqual([]);
    expect(totals.promoUnits).toBe(0);
    expect(totals.excludedUnits).toBe(1);
  });
});
