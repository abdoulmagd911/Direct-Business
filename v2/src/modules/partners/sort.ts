import type { PartnerRow } from './types';

/**
 * FIX-01 (D28): the partners list's sort, stated once — two rows that sort the same keep their order by added-at
 * (`created_at`), then id, so they never swap. The Owner column sorts by the owner's name, the Flags column by its
 * joined words; the other columns sort on their own values over the server's order, which is already name, then id.
 */
export function byAddedAt(a: Pick<PartnerRow, 'created_at' | 'id'>, b: Pick<PartnerRow, 'created_at' | 'id'>): number {
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? -1 : 1;
}

/** The Owner column: by the owner's name as it reads, then added-at, then id. */
export function compareOwner(a: PartnerRow, b: PartnerRow, nameOf: (r: PartnerRow) => string): number {
  return nameOf(a).localeCompare(nameOf(b)) || byAddedAt(a, b);
}

/** The Flags column: by the flags' joined words, then added-at, then id. */
export function compareFlags(a: PartnerRow, b: PartnerRow): number {
  return a.flags.join(' ').localeCompare(b.flags.join(' ')) || byAddedAt(a, b);
}
