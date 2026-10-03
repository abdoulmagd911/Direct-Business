import { describe, expect, it } from 'vitest';
import { apiFilter, filterOf, hrefOf } from '../../../src/modules/perf/types';

// The achievements list (GC-4): its filters — category, mine, month, Backfilled, Past work, Needs owner — live in the
// address, so a filtered list reopens from its link, and reach api.achievements in the door's own words.
// Sabotage: tests/sabotage/achievements.mjs "filter-forgets-the-month".
describe('the list filters live in the address and reach the door', () => {
  it('reads an address back into the same filter', () => {
    const f = { category: 'CONTRACT', mine: true, month: '2026-09', backfilled: true, past: true, needsOwner: true };
    const back = filterOf(Object.fromEntries(new URL(`http://x${hrefOf(f)}`).searchParams));
    expect(back).toEqual(f);
  });

  it('drops what is not a filter: a bad month, an empty category', () => {
    expect(filterOf({ month: '2026-13', category: '' })).toEqual({
      category: undefined,
      mine: undefined,
      month: undefined,
      backfilled: undefined,
      past: undefined,
      needsOwner: undefined,
    });
    expect(hrefOf({})).toBe('/kpis/achievements');
  });

  it('asks the door in its own words', () => {
    expect(apiFilter({ category: 'MOU', mine: true, month: '2026-08', past: true, needsOwner: true })).toEqual({
      category: 'MOU',
      scope: 'mine',
      month: '2026-08',
      past_work: true,
      needs_owner: true,
    });
  });
});
