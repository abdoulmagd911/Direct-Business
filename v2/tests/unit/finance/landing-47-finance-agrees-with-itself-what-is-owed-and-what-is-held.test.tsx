/**
 * Landing 47 (Finance Part B) — the three cards beside the Ledger.
 * A10: "Does Finance agree with itself?" draws the two sides figure by figure and every gap; no gap is "Agrees", said
 *      in words; a gap of 1 SAR or more is marked as a failure and a smaller one is still listed. An answer that is
 *      not the card's shape is a failed read — never "Agrees".
 * A6:  "Outstanding and how old" draws what is owed by bucket, by organisation and by invoice with its age; it opens
 *      as the postpaid pursue list and says so; a row whose deal type is not set is on it, marked.
 * A11: "Held — to tie" lists the held rows under their reason with the reason's own total; a reason the card does
 *      not know fails the read rather than dropping the row.
 * Every value is made up. Sabotage: tests/sabotage/landing-47-finance.mjs.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ageingOf, heldOf, reconciliationOf } from '../../../src/modules/finance/checks';
import {
  FinanceAgeingView,
  FinanceHeldView,
  FinanceReconciliationView,
} from '../../../src/modules/finance/screens/FinanceChecks';
import { inWords, parts } from './landing-32-fixtures';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const SIDES = {
  overview: { units: 4, revenue: 2900, cost: 500, profit: 800 },
  ledger: { units: 4, revenue: 2900, cost: 500, profit: 800 },
};

describe('A10 — does Finance agree with itself?', () => {
  const draw = (answer: unknown, locale: 'en' | 'ar' = 'en') =>
    renderToStaticMarkup(
      inWords(
        <FinanceReconciliationView data={reconciliationOf(answer)} loading={false} failed={false} onRetry={() => {}} />,
        locale,
      ),
    );

  it('with no gap it says Agrees, in words, and shows the two sides figure by figure', () => {
    const out = draw({ ...SIDES, gaps: [], agrees: true, failing: 0 });
    expect(out).toContain('data-reconcile-verdict="agrees"');
    expect(out).toContain('>Agrees<');
    expect(out).not.toContain('data-reconcile-gaps');
    const revenue = parts(out, 'data-reconcile-figure="revenue"')[0]!;
    expect(parts(revenue, 'data-reconcile-overview')[0]).toContain('2,900.00');
    expect(parts(revenue, 'data-reconcile-ledger')[0]).toContain('2,900.00');
    expect(parts(out, 'data-reconcile-figure="units"')[0]).toContain('>4<');
  });

  it('never takes “agrees” on trust: an answer that says so but lists a gap is drawn as a gap', () => {
    const read = reconciliationOf({
      ...SIDES,
      agrees: true,
      gaps: [{ kind: 'row_profit', number: 'TX-MADE-1', left: 450, right: 400, difference: 50, failing: true }],
    })!;
    expect(read.agrees).toBe(false);
    expect(read.failing).toBe(1);
  });

  it('lists every gap with what it is, both figures and the difference; 1 SAR or more is a failure', () => {
    const out = draw({
      overview: { ...SIDES.overview, profit: 850 },
      ledger: SIDES.ledger,
      gaps: [
        { kind: 'sides', figure: 'profit', left: 850, right: 800, difference: 50, failing: true },
        { kind: 'row_profit', number: 'TX-MADE-1', left: 450.4, right: 450, difference: 0.4, failing: false },
        { kind: 'cost_lines', number: 'TX-MADE-2', left: 300, right: 260, difference: 40, failing: true },
        { kind: 'organisations', figure: 'revenue', left: 2800, right: 2900, difference: -100, failing: true },
      ],
    });
    expect(out).toContain('data-reconcile-verdict="gaps"');
    expect(out).toContain('4 gaps');
    expect(out).toContain('3 of 1 SAR or more.');
    const gaps = parts(out, 'data-reconcile-gap');
    expect(gaps).toHaveLength(4);
    expect(gaps[0]).toContain('Profit: the Finance page and the ledger differ');
    expect(gaps[0]).toContain('1 SAR or more');
    expect(gaps[1]).toContain('TX-MADE-1: profit is not revenue less cost');
    expect(parts(gaps[1]!, 'data-reconcile-difference')[0], 'a gap under 1 SAR shows its halalas').toContain('0.40');
    expect(gaps[1]).toContain('Under 1 SAR');
    expect(gaps[2]).toContain('TX-MADE-2: cost is not the sum of its expense lines');
    expect(gaps[3]).toContain('lines do not add up to the ledger');
  });

  it('a cost with nothing behind it is a dash on both sides, never 0 — also when the page’s own read answers 0', () => {
    // the Finance page's read answers 0 where no counted row has a cost; the Ledger answers nothing
    const out = draw({
      overview: { units: 1, revenue: 100, cost: 0, profit: 0 },
      ledger: { units: 1, revenue: 100, cost: null, profit: null },
      gaps: [],
    });
    for (const figure of ['cost', 'profit']) {
      const line = parts(out, `data-reconcile-figure="${figure}"`)[0]!.split('data-reconcile-figure=')[1]!;
      expect(parts(line, 'data-reconcile-overview')[0], `${figure}: the page’s side is a dash`).toContain('—');
      expect(parts(line, 'data-reconcile-ledger')[0], `${figure}: the Ledger’s side is a dash`).toContain('—');
      expect(line, `${figure}: never 0`).not.toMatch(/>0(\.00)?</);
    }
    // a real 0 beside a real figure is a figure: it is shown, and it would be a gap for the database to list
    const real = reconciliationOf({
      overview: { units: 1, revenue: 100, cost: 0, profit: 100 },
      ledger: { units: 1, revenue: 100, cost: 40, profit: 60 },
      gaps: [],
    })!;
    expect(real.overview.cost).toBe(0);
    expect(real.overview.profit).toBe(100);
  });

  it('an answer that is not the card’s shape is a failed read — never “Agrees”', () => {
    expect(reconciliationOf(null)).toBeNull();
    expect(reconciliationOf({ ...SIDES })).toBeNull();
    expect(reconciliationOf({ ...SIDES, gaps: [{ kind: 'mystery', difference: 1 }] })).toBeNull();
    expect(reconciliationOf({ gaps: [] })).toBeNull();
    const out = renderToStaticMarkup(
      inWords(<FinanceReconciliationView data={null} loading={false} failed onRetry={() => {}} />),
    );
    expect(out).not.toContain('data-reconcile-verdict');
    expect(out).toContain('Try again');
  });

  it('says it in Arabic', () => {
    const out = draw({ ...SIDES, gaps: [] }, 'ar');
    expect(out).toContain('هل تتطابق أرقام المالية؟');
    expect(out).toContain('متطابقة');
  });
});

const AGEING = {
  as_of: '2026-11-24',
  all: false,
  outstanding: 1920,
  units: 3,
  buckets: { days_0_30: 350, days_31_60: 1000, days_61_90: 70, days_over_90: 500 },
  companies: [
    {
      partner_id: 'p-1',
      partner_number: 'P-990001',
      trade_name_en: 'Made-up Postpaid Org',
      trade_name_ar: 'جهة مختلقة',
      units: 2,
      outstanding: 1500,
      oldest_days: 100,
      days_0_30: 0,
      days_31_60: 1000,
      days_61_90: 0,
      days_over_90: 500,
    },
  ],
  rows: [
    {
      source: 'import',
      number: 'TX-OWED-1',
      partner_id: 'p-1',
      partner_number: 'P-990001',
      trade_name_en: 'Made-up Postpaid Org',
      trade_name_ar: 'جهة مختلقة',
      issued_on: '2026-08-16',
      outstanding: 500,
      age_days: 100,
      bucket: 'days_over_90',
      deal_type: 'postpaid',
    },
    {
      source: 'manual',
      number: 'TX-OWED-2',
      partner_id: 'p-1',
      partner_number: 'P-990001',
      trade_name_en: 'Made-up Postpaid Org',
      trade_name_ar: null,
      issued_on: '2026-10-15',
      outstanding: 1000,
      age_days: 40,
      bucket: 'days_31_60',
      deal_type: 'postpaid',
    },
    {
      source: 'import',
      number: 'TX-OWED-3',
      partner_id: null,
      issued_on: '2026-11-19',
      outstanding: 420,
      age_days: 5,
      bucket: 'days_0_30',
      deal_type: null,
    },
    { source: 'import', number: 'TX-PAID', outstanding: 0, bucket: 'days_0_30' },
  ],
  truncated: false,
};

describe('A6 — outstanding and how old', () => {
  const draw = (over: { all?: boolean; onePartner?: boolean; answer?: unknown } = {}) =>
    renderToStaticMarkup(
      inWords(
        <FinanceAgeingView
          data={ageingOf(over.answer ?? AGEING)}
          all={over.all ?? false}
          onAll={() => {}}
          onePartner={over.onePartner ?? false}
          loading={false}
          failed={false}
          onRetry={() => {}}
        />,
      ),
    );

  it('draws what is owed in all and by bucket; the over-90 bucket is the one in red', () => {
    const out = draw();
    expect(parts(out, 'data-ageing-total="outstanding"')[0]).toContain('1,920');
    expect(parts(out, 'data-ageing-total="days_31_60"')[0]).toContain('1,000');
    const old = parts(out, 'data-ageing-total="days_over_90"')[0]!.split('data-ageing-companies')[0]!;
    expect(old).toContain('500');
    expect(old).toContain('text-danger');
    // the figure itself only: from its own hook up to the next figure of the strip
    const young = parts(out, 'data-ageing-total="days_0_30"')[0]!.split('data-ageing-total=')[1]!;
    expect(young).toContain('350');
    expect(young).not.toContain('text-danger');
  });

  it('by organisation: what it owes, how old its oldest is, and how many invoices', () => {
    const co = parts(draw(), 'data-ageing-company')[0]!;
    expect(co).toContain('Made-up Postpaid Org');
    expect(co).toContain('href="/partners/p-1"');
    expect(parts(co, 'data-ageing-company-outstanding')[0]).toContain('1,500');
    expect(parts(co, 'data-ageing-company-oldest')[0]).toContain('100 days');
    expect(co).toContain('2 invoices');
  });

  it('by invoice: its number, its age, its deal type and what it owes — a row with nothing owed is no row', () => {
    const rows = parts(draw(), 'data-ageing-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('TX-OWED-1');
    expect(rows[0]).toContain('100 days');
    expect(rows[0]).toContain('data-ageing-row="days_over_90"');
    expect(parts(rows[0]!, 'data-ageing-row-outstanding')[0]).toContain('500');
    expect(rows[1]).toContain('40 days');
    expect(draw()).not.toContain('TX-PAID');
  });

  it('a row whose deal type is not set is on the pursue list, and says so', () => {
    const row = parts(draw(), 'data-ageing-row').find((r) => r.includes('TX-OWED-3'))!;
    expect(row).toContain('Deal type not set');
    expect(row).toContain('No partner');
  });

  it('opens as the postpaid pursue list and says so; one press away is every deal type', () => {
    const postpaid = draw();
    expect(postpaid).toContain('data-ageing-scope="postpaid"');
    expect(postpaid).toContain('Postpaid, and rows whose deal type is not set.');
    expect(parts(postpaid, 'data-ageing-all')[0]).toContain('All deal types');
    const all = draw({ all: true });
    expect(all).toContain('data-ageing-scope="all"');
    expect(all).toContain('Every deal type.');
    expect(parts(all, 'data-ageing-all')[0]).toContain('Postpaid only');
  });

  it('on one organisation’s own tab the by-organisation table is left out', () => {
    const out = draw({ onePartner: true });
    expect(out).not.toContain('data-ageing-companies');
    expect(parts(out, 'data-ageing-row')).toHaveLength(3);
  });

  it('nothing owed says so; an answer that is not the card’s shape is a failed read, never “nothing owed”', () => {
    const none = draw({ answer: { ...AGEING, outstanding: 0, units: 0, rows: [], companies: [] } });
    expect(none).toContain('data-ageing-empty');
    expect(none).toContain('Nothing outstanding for postpaid.');
    expect(ageingOf({ rows: [] })).toBeNull();
    expect(ageingOf({ rows: [], companies: [] })).toBeNull();
    expect(ageingOf(null)).toBeNull();
  });
});

const HELD = {
  units: 3,
  totals: {
    no_organisation: { units: 1, amount: 300 },
    same_number: { units: 2, amount: 270 },
  },
  rows: [
    {
      reason: 'no_organisation',
      source: 'manual',
      number: 'TX-HELD-1',
      created_on: '2026-10-12',
      amount: 300,
      counted: true,
    },
    {
      reason: 'same_number',
      source: 'manual',
      number: 'TX-HELD-2',
      partner_id: 'p-1',
      trade_name_en: 'Made-up Org A',
      created_on: '2026-10-12',
      amount: 200,
      counted: true,
    },
    {
      reason: 'same_number',
      source: 'import',
      number: 'TX-HELD-2',
      partner_id: 'p-2',
      trade_name_en: 'Made-up Org B',
      created_on: '2026-10-12',
      amount: 70,
      counted: false,
    },
  ],
  truncated: false,
};

describe('A11 — held, never dropped', () => {
  const draw = (answer: unknown) =>
    renderToStaticMarkup(
      inWords(<FinanceHeldView data={heldOf(answer)} loading={false} failed={false} onRetry={() => {}} />),
    );

  it('lists the held rows under their reason, with the reason’s own count and amount', () => {
    const out = draw(HELD);
    const none = parts(out, 'data-held-reason="no_organisation"')[0]!;
    expect(none).toContain('No partner matched');
    expect(parts(none, 'data-held-reason-total')[0]).toContain('1 row · SAR 300');
    const same = parts(out, 'data-held-reason="same_number"')[0]!;
    expect(same).toContain('One number under more than one partner');
    expect(parts(same, 'data-held-reason-total')[0]).toContain('2 rows · SAR 270');
    expect(parts(same, 'data-held-row')).toHaveLength(2);
    expect(out, 'a reason with no row draws no heading').not.toContain('data-held-reason="no_client_id"');
  });

  it('each row says its number, its organisation, its amount and whether it counts', () => {
    const rows = parts(draw(HELD), 'data-held-row');
    expect(rows[0]).toContain('TX-HELD-1');
    expect(rows[0]).toContain('No partner');
    expect(parts(rows[0]!, 'data-held-amount')[0]).toContain('300');
    expect(rows[0]).toContain('>Counted<');
    expect(rows[2]).toContain('Made-up Org B');
    expect(rows[2]).toContain('Not counted yet');
    expect(rows[2]).toContain('Imported');
  });

  it('nothing held says so', () => {
    const out = draw({ units: 0, totals: {}, rows: [], truncated: false });
    expect(out).toContain('data-held-empty');
    expect(out).toContain('Nothing is held in this period.');
  });

  it('a reason the card does not know fails the read — the row is never silently dropped', () => {
    expect(heldOf({ rows: [{ reason: 'mystery', number: 'TX-X', amount: 1 }] })).toBeNull();
    expect(heldOf({ totals: {} })).toBeNull();
  });
});
