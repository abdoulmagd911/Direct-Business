/**
 * Landing 32 (Finance F-B), A2 — the "Is it counted?" card: by month with a total row per year — Counted and Not
 * counted (rows and revenue), and what is not counted split into Excluded · Not fully paid · Promo pool. The year
 * rows are the database's own totals, never summed on the screen. Loading, failed and empty each say so; a failed
 * read is never an empty table. Every value is made up.
 * Sabotage: tests/sabotage/landing-32-finance-ledger.mjs "counted-table-swaps-its-columns",
 * "year-total-is-summed-on-screen", "failed-counted-table-reads-empty".
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CountedTableView, countedByMonthOf } from '../../../src/modules/finance/screens/CountedTable';
import type { CountedByMonth } from '../../../src/modules/finance/types';
import { inWords, parts } from './landing-32-fixtures';

const figures = (n: number) => ({
  counted_units: n,
  counted_revenue: n * 1111,
  not_counted_units: n + 1,
  not_counted_revenue: n * 222,
  excluded_units: n + 2,
  excluded_revenue: n * 33,
  not_paid_units: n + 3,
  not_paid_revenue: n * 44,
  promo_pool_units: n + 4,
  promo_pool_revenue: n * 55,
});
// what api.finance_counted_by_month answers (made-up figures; the 2026 total is deliberately NOT the months' sum)
const answer = {
  from: '2025-12-01',
  to: '2026-02-28',
  months: [
    { month_on: '2025-12-01', ...figures(3) },
    { month_on: '2026-01-01', ...figures(4) },
    { month_on: '2026-02-01', ...figures(5) },
  ],
  years: [
    { year: 2025, ...figures(3) },
    { year: 2026, ...figures(80) },
  ],
};

const html = (
  props: { data: CountedByMonth | null; loading?: boolean; failed?: boolean },
  locale: 'en' | 'ar' = 'en',
) =>
  renderToStaticMarkup(
    inWords(
      <CountedTableView data={props.data} loading={!!props.loading} failed={!!props.failed} onRetry={() => {}} />,
      locale,
    ),
  );
const cell = (rowOut: string, name: string) => parts(rowOut, `data-counted-cell="${name}"`)[0]!.split('</td>')[0]!;

describe('the "Is it counted?" table', () => {
  const data = countedByMonthOf(answer)!;
  const out = html({ data });

  it('is its own card, named', () => {
    expect(out).toContain('data-counted-table');
    expect(out).toContain('Is it counted?');
    expect(html({ data }, 'ar')).toContain('هل يُحتسب؟');
  });

  it('lists each month, then its year’s total row', () => {
    const order = [...out.matchAll(/data-counted-(month|year)="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
    expect(order).toEqual(['month:2025-12', 'year:2025', 'month:2026-01', 'month:2026-02', 'year:2026']);
    expect(parts(out, 'data-counted-month="2026-01"')[0]).toContain('January 2026');
    expect(parts(out, 'data-counted-year="2026"')[0]).toContain('2026 total');
  });

  it('a month shows Counted and Not counted, each with its rows and its revenue', () => {
    const jan = parts(out, 'data-counted-month="2026-01"')[0]!.split('</tr>')[0]!;
    expect(cell(jan, 'counted')).toContain('4,444');
    expect(cell(jan, 'counted')).toContain('Rows 4');
    expect(cell(jan, 'not-counted')).toContain('888');
    expect(cell(jan, 'not-counted')).toContain('Rows 5');
  });

  it('what is not counted is split: Excluded · Not fully paid · Promo pool', () => {
    for (const heading of ['Excluded', 'Not fully paid', 'Promo pool']) expect(out).toContain(`>${heading}</th>`);
    const jan = parts(out, 'data-counted-month="2026-01"')[0]!.split('</tr>')[0]!;
    expect(cell(jan, 'excluded')).toContain('132');
    expect(cell(jan, 'excluded')).toContain('Rows 6');
    expect(cell(jan, 'not-paid')).toContain('176');
    expect(cell(jan, 'not-paid')).toContain('Rows 7');
    expect(cell(jan, 'promo-pool')).toContain('220');
    expect(cell(jan, 'promo-pool')).toContain('Rows 8');
  });

  it('a year’s total is the database’s own, never the months summed here', () => {
    const year = parts(out, 'data-counted-year="2026"')[0]!.split('</tr>')[0]!;
    expect(cell(year, 'counted')).toContain('88,880');
    expect(cell(year, 'counted')).toContain('Rows 80');
    expect(cell(year, 'counted'), 'not January + February').not.toContain('9,999');
  });

  it('no table scrolls sideways: the split sits under the first cell where the card is narrow', () => {
    expect(out).not.toMatch(/overflow-x-auto|min-w-\[\d/);
    const jan = parts(out, 'data-counted-month="2026-01"')[0]!.split('</tr>')[0]!;
    expect(jan.split('</td>')[0]).toContain('@min-[860px]:hidden');
  });

  it('there is revenue only: no cost, no profit, no VAT', () => {
    expect(out).not.toMatch(/Cost|Profit|VAT/);
  });
});

describe('the table’s states', () => {
  it('loading and failed each say so, and a failed read offers Try again', () => {
    expect(html({ data: null, loading: true })).toContain('data-state="loading"');
    const failed = html({ data: null, failed: true });
    expect(failed).toContain('The counted table could not be loaded');
    expect(failed).toContain('Try again');
    expect(failed).not.toContain('<table');
  });

  it('a period with nothing in it is one line', () => {
    const empty = html({ data: { from: '2026-01-01', to: '2026-01-31', months: [], years: [] } });
    expect(empty).toContain('data-counted-empty');
    expect(empty).not.toContain('<table');
  });

  it('an answer that is not the table’s shape is no table — never read as an empty one', () => {
    expect(countedByMonthOf(null)).toBeNull();
    expect(countedByMonthOf({ months: 'x' })).toBeNull();
    expect(countedByMonthOf({ months: [], years: [] })).toEqual({ from: '', to: '', months: [], years: [] });
  });
});
