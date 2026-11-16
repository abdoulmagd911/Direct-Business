import type { PartnerRow, PartnersAnswer } from '../types';
import type { ListFilters } from './filters';

/**
 * The four cards over the list (Landing 31). Each card is one of the list's own filters, so pressing it writes the
 * address the Status chip or More filters would write — nothing new is counted or filtered here:
 *   Active    = status Active            (`status=active`)
 *   Prospects = status Prospect          (`status=prospect`)
 *   Stale     = the list's Stale flag    (`stale=1`: past `partner.stale_after_days` with no activity and no next step)
 *   Quiet     = the list's Quiet flag    (`quiet=1`: no fully paid invoice for `finance.quiet_client_days` — the
 *               daily alert's own rule, read by the list since 20261116110000). It is a Finance fact: a reader below
 *               View on Finance is told none of it, and the card then shows "—" and cannot be pressed.
 */
export const KPIS = ['active', 'prospects', 'stale', 'quiet'] as const;
export type Kpi = (typeof KPIS)[number];
/** The cards a press can filter by: all four. */
export type PressableKpi = Kpi;

type CardFilters = Pick<ListFilters, 'statuses' | 'stale' | 'quiet'>;

/** The card that is on: the address holds exactly that card's filter in the cards' dimension (status, stale, quiet). */
export function kpiOf(f: CardFilters): PressableKpi | null {
  if (f.stale && f.quiet) return null;
  if (f.stale) return f.statuses.length === 0 ? 'stale' : null;
  if (f.quiet) return f.statuses.length === 0 ? 'quiet' : null;
  if (f.statuses.length !== 1) return null;
  return f.statuses[0] === 'active' ? 'active' : f.statuses[0] === 'prospect' ? 'prospects' : null;
}

/** True when the address filters by status, stale or quiet at all — a card, or the Status chip's own choice. */
export const cardDimensionOn = (f: CardFilters) => f.statuses.length > 0 || f.stale || f.quiet;

/**
 * The filters after a card is pressed: the card's own filter replaces whatever status / stale / quiet filter was
 * there; the search and every other filter stay. Pressing the card that is on (or `null`, the phone's All) clears it.
 * A saved view's name goes, as with any filter change: the filters are no longer that view's.
 */
export function pressKpi(f: ListFilters, k: PressableKpi | null): ListFilters {
  const off: ListFilters = { ...f, statuses: [], stale: false, quiet: false, view: '' };
  if (k === null || kpiOf(f) === k) return off;
  if (k === 'stale') return { ...off, stale: true };
  if (k === 'quiet') return { ...off, quiet: true };
  return { ...off, statuses: [k === 'active' ? 'active' : 'prospect'] };
}

/** The figures on the cards; null is "not known" (no answer, or Quiet below View on Finance): "—", never 0. */
export type KpiCounts = {
  all: number | null;
  active: number | null;
  prospects: number | null;
  stale: number | null;
  quiet: number | null;
};

export const NO_COUNTS: KpiCounts = { all: null, active: null, prospects: null, stale: null, quiet: null };

/**
 * What the list read is asked for so that it counts the cards itself: `counts` makes the one read answer
 * {all, active, prospect, stale, quiet} over the search and every other filter, without the cards' own choice — so a
 * list render stays one partners read whatever card is on (FIX-45), and each row carries its Quiet flag.
 */
export const withCounts = (read: Record<string, unknown>): Record<string, unknown> => ({ ...read, counts: true });

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** The cards' figures as the list read answered them; a figure it did not give is "not known". */
export function countsOf(answer: Pick<PartnersAnswer, 'counts'> | null): KpiCounts | null {
  const c = answer?.counts;
  if (!c) return null;
  return {
    all: num(c.all),
    active: num(c.active),
    prospects: num(c.prospect),
    stale: num(c.stale),
    quiet: num(c.quiet),
  };
}

/**
 * The fallback for an answer that carries no counts (a database not yet on 20261116110000): the three groups counted
 * from the rows already read — exact only when those rows are the whole, unfiltered list. Quiet is not known there.
 */
export function countsFromRows(rows: Pick<PartnerRow, 'status' | 'flags'>[], total: number): KpiCounts {
  return {
    all: total,
    active: rows.filter((r) => r.status === 'active').length,
    prospects: rows.filter((r) => r.status === 'prospect').length,
    stale: rows.filter((r) => r.flags.includes('stale')).length,
    quiet: null,
  };
}
