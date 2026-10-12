/**
 * The Finance Overview's own arithmetic (GC-5, V610, V620; OLD-041, OA5): a short form hides no riyal (the exact figure
 * is printed under it); a gap of 1 SAR or more between the months and the tile is named; the months run newest first,
 * a month is Open, Closed or waiting for its close; a late cost counts against profit; a bad address is the year to
 * date. Every value is made up.
 */
import { describe, expect, it } from 'vitest';
import { attention, lateCount, lateParts, monthRows, monthsGap, shortForm } from '../../../src/modules/finance/figures';
import { monthsBetween, periodAsk } from '../../../src/modules/finance/period';
import type { ClosedMonth, MonthFigure, Period } from '../../../src/modules/finance/types';

const month = (m: string, revenue: number): MonthFigure => ({
  month_on: m,
  units: 1,
  revenue,
  cost: 0,
  profit: revenue,
  provisional_units: 0,
  provisional_revenue: 0,
  provisional_profit: 0,
  losses: 0,
});
const period = (months: MonthFigure[], revenue: number): Period => ({
  from: '2026-07-01',
  to: '2026-09-30',
  units: months.length,
  revenue,
  cost: 0,
  profit: revenue,
  provisional: { units: 0, revenue: 0, cost: 0, profit: 0 },
  losses: 0,
  months,
});
const closeOf = (m: string, late: ClosedMonth['late_changes'] = []): ClosedMonth => ({
  month: m,
  closed_on: '2026-10-05',
  closed_by: 'p',
  note: null,
  frozen: { units: 1, revenue: 1, cost: 0, profit: 1 },
  late_changes: late,
});

describe('short forms', () => {
  it('gives millions two decimals, thousands one under ten thousand, and nothing under a thousand', () => {
    expect(shortForm(5_731_500)).toBe('5.73M');
    expect(shortForm(917_828)).toBe('918K');
    expect(shortForm(1_500)).toBe('1.5K');
    expect(shortForm(9_990)).toBe('10K');
    expect(shortForm(999)).toBeNull();
    expect(shortForm(-1_250_000)).toBe('-1.25M');
  });

  it('chooses its unit after rounding, so a figure just under a million is never 1000K (QA-545)', () => {
    expect(shortForm(999_499)).toBe('999K');
    expect(shortForm(999_500)).toBe('1.00M');
    expect(shortForm(999_999.99)).toBe('1.00M');
    expect(shortForm(-999_600)).toBe('-1.00M');
    expect(shortForm(1_000_000)).toBe('1.00M');
  });
});

describe('the months', () => {
  const p = period([month('2026-09-01', 100), month('2026-07-01', 50)], 150);

  it('run newest first, with a month that has no unit drawn as no figures, never zeros', () => {
    const rows = monthRows(p, [closeOf('2026-07-01')], '2026-09-01');
    expect(rows.map((r) => r.month)).toEqual(['2026-09-01', '2026-08-01', '2026-07-01']);
    expect(rows[1]!.figures).toBeNull();
  });

  it('are Open while running, Closed once closed, and ended until their close', () => {
    const rows = monthRows(p, [closeOf('2026-07-01')], '2026-09-01');
    expect(rows.map((r) => r.state)).toEqual(['open', 'ended', 'closed']);
  });

  it('name a gap of one riyal or more between the months and the tile, and no gap that is 0', () => {
    expect(monthsGap(p)).toBe(0);
    expect(monthsGap({ ...p, revenue: 151.5 })).toBe(1.5);
  });

  it('never draw a month that has not started', () => {
    const rows = monthRows(period([], 0), [], '2026-08-01');
    expect(rows.map((r) => r.month)).toEqual(['2026-08-01', '2026-07-01']);
  });
});

describe('what needs attention and what changed after a close', () => {
  const late = {
    invoice_id: 'a',
    ref: 'T-1',
    unit_kind: 'transaction',
    change: 'late_paid' as const,
    revenue_change: 9400,
    cost_change: 0,
    changed_on: '2026-08-12',
  };

  it('counts failing checks and units with no client from the health read alone, and the late lines shown', () => {
    const health = [
      { key: 'checks_failed', count: 1, amount_sar: null },
      { key: 'no_organisation', count: 3, amount_sar: null },
      { key: 'unknown_client_id', count: 1, amount_sar: null },
      { key: 'provisional', count: 18, amount_sar: null },
    ];
    const closed = [closeOf('2026-07-01', [late])];
    expect(attention(health, lateCount(closed, '2026-01-01', '2026-09-30'))).toEqual({
      checks: 1,
      noClient: 4,
      late: 1,
    });
  });

  it('says a late count it could not read is unknown, never 0, and keeps the other two (QA-543)', () => {
    const health = [{ key: 'checks_failed', count: 2, amount_sar: null }];
    expect(lateCount(null, '2026-01-01', '2026-09-30')).toBeNull();
    expect(attention(health, null)).toEqual({ checks: 2, noClient: 0, late: null });
  });

  it('counts only the closed months the period covers', () => {
    const closed = [closeOf('2026-02-01', [late]), closeOf('2026-07-01', [late, late])];
    expect(lateCount(closed, '2026-06-01', '2026-09-30')).toBe(2);
  });

  it('counts a late cost against profit and a cancelled payment as the revenue it took away', () => {
    const base = { invoice_id: 'a', ref: 'T', unit_kind: 'transaction', changed_on: null };
    expect(lateParts({ ...base, change: 'cost_changed', revenue_change: 0, cost_change: 600 })).toEqual({
      main: -600,
      other: null,
    });
    expect(lateParts({ ...base, change: 'dropped', revenue_change: -3100, cost_change: 0 }).main).toBe(-3100);
    expect(lateParts({ ...base, change: 'late_paid', revenue_change: 9400, cost_change: 0 }).main).toBe(9400);
  });

  it('shows both parts of a unit whose revenue and cost both changed (QA-544)', () => {
    const base = { invoice_id: 'a', ref: 'T', unit_kind: 'transaction', changed_on: null };
    expect(lateParts({ ...base, change: 'revenue_changed', revenue_change: 3500, cost_change: 600 })).toEqual({
      main: 3500,
      other: { of: 'cost', amount: -600 },
    });
    expect(lateParts({ ...base, change: 'cost_changed', revenue_change: 200, cost_change: 600 })).toEqual({
      main: -600,
      other: { of: 'revenue', amount: 200 },
    });
  });
});

describe('the period', () => {
  it('is month, quarter or year to date, or two dates, and anything unreadable is the year to date', () => {
    expect(periodAsk({ period: 'mtd' }, '2026-10-11')).toEqual({ key: 'mtd', from: '2026-10-01', to: '2026-10-11' });
    expect(periodAsk({ period: 'qtd' }, '2026-11-20')).toEqual({ key: 'qtd', from: '2026-10-01', to: '2026-11-20' });
    expect(periodAsk({}, '2026-10-11')).toEqual({ key: 'ytd', from: '2026-01-01', to: '2026-10-11' });
    expect(periodAsk({ period: 'custom', from: '2026-03-01', to: '2026-04-30' }, '2026-10-11').key).toBe('custom');
    expect(periodAsk({ period: 'custom', from: '2026-05-01', to: '2026-04-30' }, '2026-10-11').key).toBe('ytd');
    expect(periodAsk({ period: 'custom', from: 'x', to: 'y' }, '2026-10-11').key).toBe('ytd');
  });

  it('lists every month it covers', () => {
    expect(monthsBetween('2025-11-01', '2026-02-15')).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01']);
  });
});
