/** The filters a partners list address carries (a saved view is one of these, under a name). */
export type ListFilters = {
  q: string;
  types: string[];
  owners: string[];
  statuses: string[];
  tiers: string[];
  priorities: string[];
  key_partner: boolean;
  stale: boolean;
  quiet: boolean;
  archived: boolean;
  view: string;
};

/** No filter at all: the whole list of the side. */
export function emptyFilters(): ListFilters {
  return {
    q: '',
    types: [],
    owners: [],
    statuses: [],
    tiers: [],
    priorities: [],
    key_partner: false,
    stale: false,
    quiet: false,
    archived: false,
    view: '',
  };
}

/** The address of a set of filters: what a saved view keeps, what the chips and the cards write. */
export function addressOf(base: string, f: ListFilters): string {
  const q = new URLSearchParams();
  if (f.q) q.set('q', f.q);
  if (f.types.length) q.set('type', f.types.join(','));
  if (f.owners.length) q.set('owner', f.owners.join(','));
  if (f.statuses.length) q.set('status', f.statuses.join(','));
  if (f.tiers.length) q.set('tier', f.tiers.join(','));
  if (f.priorities.length) q.set('priority', f.priorities.join(','));
  if (f.key_partner) q.set('key', '1');
  if (f.stale) q.set('stale', '1');
  if (f.quiet) q.set('quiet', '1');
  if (f.archived) q.set('archived', '1');
  if (f.view) q.set('view', f.view);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
const many = (v: string) => (v ? v.split(',').filter(Boolean) : []);

/** The filters an address carries: the reverse of `addressOf`. */
export function filtersOf(q: Record<string, string | string[] | undefined>): ListFilters {
  return {
    q: str(q.q),
    types: many(str(q.type)),
    owners: many(str(q.owner)),
    statuses: many(str(q.status)),
    tiers: many(str(q.tier)),
    priorities: many(str(q.priority)),
    key_partner: str(q.key) === '1',
    stale: str(q.stale) === '1',
    quiet: str(q.quiet) === '1',
    archived: str(q.archived) === '1',
    view: str(q.view),
  };
}

/**
 * What the list asks the database for, from the filters of its address. The archived view shows only archived
 * partners (FIX-31): archived_only, not the mixed include_archived.
 */
export function readFilters(side: string, f: ListFilters): Record<string, unknown> {
  const p: Record<string, unknown> = { side };
  if (f.q) p.q = f.q;
  if (f.types.length) p.types = f.types;
  if (f.owners.length) p.owners = f.owners;
  if (f.statuses.length) p.statuses = f.statuses;
  if (f.tiers.length) p.tiers = f.tiers;
  if (f.priorities.length) p.priorities = f.priorities;
  if (f.key_partner) p.key_partner = true;
  if (f.stale) p.stale = true;
  if (f.quiet) p.quiet = true;
  if (f.archived) p.archived_only = true;
  return p;
}

/**
 * The Status chip's "Archived" choice (Landing 34): the chip offers it beside the four statuses and "No status", so a
 * restore no longer needs the record's address. Archived is the organisation's own state, not a side's status, so it
 * is never sent as a status: it is the address's `archived=1` (the read's `archived_only`).
 */
export const ARCHIVED_PICK = 'archived';

/** What the Status chip has ticked: the statuses of the address, and Archived when the address is the archived view. */
export function statusPicks(f: Pick<ListFilters, 'statuses' | 'archived'>): string[] {
  return f.archived ? [...f.statuses, ARCHIVED_PICK] : [...f.statuses];
}

/** The filters after the Status chip is applied: Archived goes to `archived`, every other tick stays a status. */
export function withStatusPicks(f: ListFilters, picks: string[]): ListFilters {
  return { ...f, statuses: picks.filter((p) => p !== ARCHIVED_PICK), archived: picks.includes(ARCHIVED_PICK) };
}

/** The search as the address holds it: what was typed, without the spaces around it or doubled inside it. */
export function searchText(typed: string): string {
  return typed.trim().replace(/\s+/g, ' ');
}

/** The filters after the search box is submitted: the typed words replace the search; a saved view's name goes. */
export function withSearch(f: ListFilters, typed: string): ListFilters {
  return { ...f, q: searchText(typed), view: '' };
}
