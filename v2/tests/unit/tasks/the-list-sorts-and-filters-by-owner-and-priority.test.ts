import { describe, expect, it } from 'vitest';
import { apiFilter, filtersHref, keepRow, parseFilters, queryFilters, sortRows } from '@/modules/tasks/rules';
import { ME, OTHER, row } from './fixtures';

// FIX-01: the Tasks list sorts (a menu where the columns are not sortable) and filters by owner and priority;
// FIX-12: a saved view's whole query applies. Every value is made up (rule 7).
// Sabotages: tests/sabotage/tasks.mjs "sort-swaps-equal-rows", "priority-filter-keeps-another-key".
const OWNER = '11111111-1111-4111-8111-111111111111';
const PRIORITIES = [
  { key: 'executive_directive', sort: 0 },
  { key: 'high', sort: 1 },
  { key: 'medium', sort: 2 },
  { key: 'low', sort: 3 },
];

const rows = [
  row({ id: 't1', title: 'Beta', priority: 'low', due_on: '2026-10-12', logged_at: '2026-10-01T06:00:00Z' }),
  row({ id: 't2', title: 'Alpha', priority: 'high', due_on: '2026-10-10', logged_at: '2026-10-02T06:00:00Z' }),
  row({ id: 't3', title: 'Gamma', priority: null, due_on: null, logged_at: '2026-10-03T06:00:00Z' }),
  row({ id: 't4', title: 'Alpha', priority: 'high', due_on: '2026-10-10', logged_at: '2026-10-02T06:00:00Z' }),
];

describe('the Tasks list sorts and filters by owner and priority (FIX-01)', () => {
  it('reads owner, priority and sort from the address, and drops what is not one', () => {
    expect(parseFilters({ owner: OWNER, priority: 'high', sort: 'due' })).toMatchObject({
      owner: OWNER,
      priority: 'high',
      sort: 'due',
    });
    expect(parseFilters({ owner: 'not-a-person', priority: 'high!', sort: 'random' })).toEqual({
      scope: 'my_work',
    });
  });

  it('the address round-trips the new filters', () => {
    const f = parseFilters({ owner: OWNER, priority: 'high', sort: 'priority' });
    expect(filtersHref(f)).toBe(`/tasks?owner=${OWNER}&priority=high&sort=priority`);
    expect(parseFilters(Object.fromEntries(new URL(`http://x${filtersHref(f)}`).searchParams))).toEqual(f);
  });

  it('asks the door for the owner; the priority is judged on the rows', () => {
    expect(apiFilter({ scope: 'team', owner: OWNER })).toMatchObject({ owner_id: OWNER });
    expect(keepRow(row({ priority: 'high' }), { scope: 'my_work', priority: 'high' }, ME, '2026-10-10')).toBe(true);
    expect(keepRow(row({ priority: 'low' }), { scope: 'my_work', priority: 'high' }, ME, '2026-10-10')).toBe(false);
    expect(keepRow(row({ priority: null }), { scope: 'my_work', priority: 'high' }, ME, '2026-10-10')).toBe(false);
  });

  it('newest is added-at, newest first; oldest is the reverse', () => {
    expect(sortRows(rows, 'newest', PRIORITIES).map((r) => r.id)).toEqual(['t3', 't2', 't4', 't1']);
    expect(sortRows(rows, 'oldest', PRIORITIES).map((r) => r.id)).toEqual(['t1', 't2', 't4', 't3']);
  });

  it('due puts the undated last; title and priority break ties by added-at, then id', () => {
    expect(sortRows(rows, 'due', PRIORITIES).map((r) => r.id)).toEqual(['t2', 't4', 't1', 't3']);
    expect(sortRows(rows, 'title', PRIORITIES).map((r) => r.id)).toEqual(['t2', 't4', 't1', 't3']);
    expect(sortRows(rows, 'priority', PRIORITIES).map((r) => r.id)).toEqual(['t2', 't4', 't1', 't3']);
  });

  it('a task with no priority and an unknown key sit after every prioritised one, in added-at order', () => {
    const mixed = [
      row({ id: 'a', priority: null, logged_at: '2026-10-05T06:00:00Z' }),
      row({ id: 'b', priority: 'retired', logged_at: '2026-10-04T06:00:00Z' }),
      row({ id: 'c', priority: 'low', logged_at: '2026-10-03T06:00:00Z' }),
    ];
    expect(sortRows(mixed, 'priority', PRIORITIES).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('no sort keeps the server order', () => {
    expect(sortRows(rows, undefined, PRIORITIES).map((r) => r.id)).toEqual(['t1', 't2', 't3', 't4']);
  });
});

describe('a saved view applies its whole query (FIX-12)', () => {
  it('reads every filter a view keeps, and drops what is not one', () => {
    expect(
      queryFilters({
        scope: 'team',
        status: 'done',
        due: 'today',
        partner: OWNER,
        project: OWNER,
        q: ' visa ',
        owner: OTHER,
        priority: 'low',
        sort: 'title',
        starred: true,
        escalated: false,
        layout: 'board',
        month: '2026-10',
        nope: 'dropped',
      }),
    ).toEqual({
      scope: 'team',
      layout: 'board',
      month: '2026-10',
      status: 'done',
      due: 'today',
      partner: OWNER,
      project: OWNER,
      q: 'visa',
      starred: true,
      escalated: undefined,
      owner: OTHER,
      priority: 'low',
      sort: 'title',
    });
    expect(queryFilters({ scope: 'everyone', status: 'late', owner: 'x', sort: 'random' })).toEqual({
      scope: undefined,
      layout: undefined,
      month: undefined,
      status: undefined,
      due: undefined,
      partner: undefined,
      project: undefined,
      q: undefined,
      starred: undefined,
      escalated: undefined,
      owner: undefined,
      priority: undefined,
      sort: undefined,
    });
  });
});
