import type { ClosedMonth, HealthEntry, LateChange, MonthFigure, Period } from './types';
import { monthsBetween } from './period';

/**
 * A big figure in its short form (5.73M, 918K, 1.5K), or null when it has none (under a thousand). A tile that shows a short
 * form prints its exact figure under it, so the short form hides no riyal (OLD-041, OA5).
 */
export function shortForm(n: number): string | null {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
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

/** The riyals a late-change line adds to the month's profit: paid late and revenue changes by their revenue, a late cost by minus its cost. */
export function lateAmount(c: LateChange): number {
  return c.change === 'cost_changed' ? -(c.cost_change ?? 0) : (c.revenue_change ?? 0);
}

/** The three counts of the Needs attention strip. Late changes are counted over the months the period shows. */
export function attention(health: HealthEntry[], rows: MonthRow[]) {
  const n = (key: string) => health.find((h) => h.key === key)?.count ?? 0;
  return {
    checks: n('checks_failed'),
    noClient: n('no_organisation') + n('unknown_client_id'),
    late: rows.reduce((sum, r) => sum + r.late.length, 0),
  };
}

/** The whole riyals the months do not add up to the period's tile (OA5): a gap of 1 SAR or more is named. */
export function monthsGap(period: Period): number {
  const sum = period.months.reduce((s, m) => s + m.revenue, 0);
  return Math.round((period.revenue - sum) * 100) / 100;
}
