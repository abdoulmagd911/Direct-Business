import type { ClosedMonth, HealthEntry, LateChange, MonthFigure, Period } from './types';
import { monthsBetween } from './period';

/**
 * A big figure in its short form (5.73M, 918K, 1.5K), or null when it has none (under a thousand). A tile that shows a short
 * form prints its exact figure under it, so the short form hides no riyal (OLD-041, OA5).
 */
export function shortForm(n: number): string | null {
  const a = Math.abs(n);
  // the unit is chosen after rounding, so 999,500 reads 1.00M and never 1000K
  const thousands = Math.round(a / 1_000);
  if (a >= 1_000_000 || thousands >= 1_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (a >= 1_000) return `${(Math.round(n / 100) / 10).toString()}K`;
  return null;
}

/** What the Overview draws for one month of the period. */
export type MonthRow = {
  month: string;
  /** Null when the month has no unit at all: drawn as a dash, never as 0. */
  figures: MonthFigure | null;
  state: 'open' | 'ended' | 'closed';
  closed: ClosedMonth | null;
  late: LateChange[];
};

/**
 * The months table: every month the period covers, newest first so this month is the first row (the 30-second rule),
 * each with its close and its late changes. A month is Open while it is the running one, Closed once a close exists,
 * and otherwise ended and waiting for its close (V620).
 */
export function monthRows(period: Period, closed: ClosedMonth[], thisMonth: string): MonthRow[] {
  const byMonth = new Map(period.months.map((m) => [m.month_on, m]));
  const closes = new Map(closed.map((c) => [c.month, c]));
  return monthsBetween(period.from, period.to)
    .filter((m) => m <= thisMonth)
    .map((month): MonthRow => {
      const close = closes.get(month) ?? null;
      return {
        month,
        figures: byMonth.get(month) ?? null,
        state: close ? 'closed' : month < thisMonth ? 'ended' : 'open',
        closed: close,
        late: close?.late_changes ?? [],
      };
    })
    .reverse();
}

/**
 * What a late-change line adds to the month's profit, in its two parts: the main amount (a payment or cancellation by
 * its revenue, a late cost by minus its cost) and, when the same unit changed on the other side too, that part as
 * well — so a unit whose revenue and cost both moved shows both (QA-544).
 */
export function lateParts(c: LateChange): { main: number; other: { of: 'cost' | 'revenue'; amount: number } | null } {
  const revenue = c.revenue_change ?? 0;
  const cost = -(c.cost_change ?? 0);
  if (c.change === 'cost_changed')
    return { main: cost, other: revenue !== 0 ? { of: 'revenue', amount: revenue } : null };
  return { main: revenue, other: cost !== 0 ? { of: 'cost', amount: cost } : null };
}

/** The late lines of the closed months a period covers; null when the closed months could not be read (QA-543). */
export function lateCount(closed: ClosedMonth[] | null, from: string, to: string): number | null {
  if (!closed) return null;
  const first = `${from.slice(0, 7)}-01`;
  return closed.filter((c) => c.month >= first && c.month <= to).reduce((sum, c) => sum + c.late_changes.length, 0);
}

/**
 * The three counts of the Needs attention strip. Checks failing and No client come from the health read alone; Late
 * changes needs the closed months and is null (unknown) when they could not be read.
 */
export function attention(health: HealthEntry[], late: number | null) {
  const n = (key: string) => health.find((h) => h.key === key)?.count ?? 0;
  return {
    checks: n('checks_failed'),
    noClient: n('no_organisation') + n('unknown_client_id'),
    late,
  };
}

/** The whole riyals the months do not add up to the period's tile (OA5): a gap of 1 SAR or more is named. */
export function monthsGap(period: Period): number {
  const sum = period.months.reduce((s, m) => s + m.revenue, 0);
  return Math.round((period.revenue - sum) * 100) / 100;
}
