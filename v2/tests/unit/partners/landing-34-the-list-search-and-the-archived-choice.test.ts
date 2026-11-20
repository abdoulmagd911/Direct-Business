/**
 * Landing 34 (test-round fixes), the partners list's logic:
 *  - item 30: the Status chip offers Archived; it writes the address's archived view (the read's archived_only),
 *    never a status;
 *  - item 7: the search box writes its words into the address as typed (trimmed), keeps every other filter, and the
 *    read is asked for those words;
 *  - item 13: whatever view is on, a row's status is counted and the Active / Prospects cards filter — nothing
 *    blanks a status the read gave;
 *  - item 25: the row's Actions button has its own place in the table's plan, so the table still fits;
 *  - item 31: a list restored from before a change knows it is stale, one read once.
 * Made-up values only. Sabotage: tests/sabotage/landing-34-partners.mjs.
 */
import { describe, expect, it } from 'vitest';
import { ACTIONS_WIDTH, CARDS_UNDER, columnPlan } from '../../../src/modules/partners/list/columns';
import {
  ARCHIVED_PICK,
  addressOf,
  emptyFilters,
  filtersOf,
  readFilters,
  searchText,
  statusPicks,
  withSearch,
  withStatusPicks,
} from '../../../src/modules/partners/list/filters';
import { clearStale, listIsStale, markPartnersChanged, sawList } from '../../../src/modules/partners/list/freshness';
import { countsFromRows, kpiOf, pressKpi } from '../../../src/modules/partners/list/kpi';

const query = (address: string) => Object.fromEntries(new URL(address, 'https://made-up.example').searchParams);

describe('the Status chip offers Archived', () => {
  it('ticking Archived writes the archived view, not a status', () => {
    const f = withStatusPicks(emptyFilters(), [ARCHIVED_PICK]);
    expect(f.archived).toBe(true);
    expect(f.statuses).toEqual([]);
    expect(addressOf('/partners', f)).toBe('/partners?archived=1');
  });
  it('the read is then asked for archived organisations only', () => {
    const f = withStatusPicks(emptyFilters(), [ARCHIVED_PICK]);
    expect(readFilters('client', f)).toEqual({ side: 'client', archived_only: true });
  });
  it('Archived ticks beside a status, and each goes to its own place', () => {
    const f = withStatusPicks(emptyFilters(), ['lost', ARCHIVED_PICK]);
    expect(f.statuses).toEqual(['lost']);
    expect(f.archived).toBe(true);
    expect(readFilters('client', f)).toEqual({ side: 'client', statuses: ['lost'], archived_only: true });
  });
  it('the chip shows Archived ticked when the address is the archived view', () => {
    expect(statusPicks(filtersOf({ archived: '1', status: 'active' }))).toEqual(['active', ARCHIVED_PICK]);
    expect(statusPicks(emptyFilters())).toEqual([]);
  });
  it('unticking Archived leaves the archived view and keeps the statuses', () => {
    const f = withStatusPicks({ ...emptyFilters(), statuses: ['active'], archived: true }, ['active']);
    expect(f.archived).toBe(false);
    expect(f.statuses).toEqual(['active']);
  });
});

describe('the search box drives the list through the address', () => {
  it('the typed words go into the address, without the spaces around them', () => {
    expect(searchText('  Made-up   Web Round ')).toBe('Made-up Web Round');
    const f = withSearch(emptyFilters(), '  Made-up   Web Round ');
    expect(query(addressOf('/partners', f))).toEqual({ q: 'Made-up Web Round' });
  });
  it('the address reads back to the same words, and the read is asked for them', () => {
    const f = filtersOf(query(addressOf('/partners', withSearch(emptyFilters(), 'Made-up Web Round'))));
    expect(f.q).toBe('Made-up Web Round');
    expect(readFilters('client', f)).toEqual({ side: 'client', q: 'Made-up Web Round' });
  });
  it('a search keeps every other filter and lets a saved view’s name go', () => {
    const before = { ...emptyFilters(), types: ['corporate'], stale: true, archived: true, view: 'made-up-view' };
    const f = withSearch(before, 'Made-up');
    expect(f).toEqual({ ...before, q: 'Made-up', view: '' });
  });
  it('an emptied box clears the search', () => {
    const f = withSearch({ ...emptyFilters(), q: 'Made-up' }, '   ');
    expect(addressOf('/partners', f)).toBe('/partners');
  });
});

describe('a status the read gave is counted and filtered whatever view is on', () => {
  const rows = [
    { status: 'active' as const, flags: [] },
    { status: 'active' as const, flags: ['stale'] },
    { status: 'prospect' as const, flags: [] },
    { status: null, flags: [] },
  ];
  it('Active and Prospects are counted from the rows’ own status', () => {
    expect(countsFromRows(rows, 4)).toMatchObject({ all: 4, active: 2, prospects: 1, stale: 1 });
  });
  it('the Active and Prospects cards filter the All view', () => {
    const all = emptyFilters();
    expect(addressOf('/partners', pressKpi(all, 'active'))).toBe('/partners?status=active');
    expect(addressOf('/partners', pressKpi(all, 'prospects'))).toBe('/partners?status=prospect');
    expect(kpiOf(pressKpi(all, 'active'))).toBe('active');
  });
  it('and they filter the archived view too, which stays on', () => {
    const f = pressKpi({ ...emptyFilters(), archived: true }, 'active');
    expect(f.archived).toBe(true);
    expect(readFilters('client', f)).toEqual({ side: 'client', statuses: ['active'], archived_only: true });
  });
});

describe('the row’s Actions button has its own place in the table', () => {
  const NEED: Record<string, number> = { type: 136, owner_id: 200, last_activity_on: 136 };
  const needed = (width: number, selectable: boolean) => {
    const plan = columnPlan(width, selectable);
    const shown = Object.keys(NEED).filter((c) => !(plan.hidden as string[]).includes(c));
    return (
      (selectable ? 44 : 0) + 120 + 168 + 26 + ACTIONS_WIDTH + plan.nameMax + shown.reduce((s, c) => s + NEED[c]!, 0)
    );
  };
  it('with the Actions column counted, the table never asks for more room than its place has', () => {
    for (const selectable of [true, false])
      for (let w = CARDS_UNDER; w <= 1600; w += 7)
        expect(needed(w, selectable), `${w}px, selectable ${selectable}`).toBeLessThanOrEqual(w);
  });
  it('the Actions column is never one of the columns dropped for room', () => {
    for (let w = CARDS_UNDER; w <= 1600; w += 50)
      expect(columnPlan(w, true).hidden as string[], `${w}px`).not.toContain('actions');
  });
});

describe('a list from before a change reads again, once', () => {
  it('the list on screen when a partner is added is stale; a newer read is not', () => {
    clearStale();
    sawList('made-up-read-1');
    expect(listIsStale('made-up-read-1')).toBe(false);
    markPartnersChanged();
    expect(listIsStale('made-up-read-1'), 'restored from before the add').toBe(true);
    expect(listIsStale('made-up-read-2'), 'a read made after the add').toBe(false);
  });
  it('once it has been read again it is no longer stale', () => {
    sawList('made-up-read-3');
    markPartnersChanged();
    clearStale();
    expect(listIsStale('made-up-read-3')).toBe(false);
  });
  it('a change made on a record marks the list last seen, though it is not on screen', () => {
    clearStale();
    sawList('made-up-read-4');
    // the record is open now; the list is not mounted
    markPartnersChanged();
    expect(listIsStale('made-up-read-4')).toBe(true);
  });
});
