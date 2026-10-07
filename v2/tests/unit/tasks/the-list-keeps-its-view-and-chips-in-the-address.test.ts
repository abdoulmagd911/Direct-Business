import { describe, expect, it } from 'vitest';
import { apiFilter, filtersHref, keepRow, parseFilters } from '@/modules/tasks/rules';
import { ME, OTHER, row } from './fixtures';

const P = '11111111-1111-4111-8111-111111111111';

describe('the Tasks list: My work, Owned, Helping, Team; chips status, due, partner, project (§3.7, V195)', () => {
  it('My work is the default, and unknown values are dropped, never guessed', () => {
    expect(parseFilters({})).toEqual({ scope: 'my_work' });
    expect(parseFilters({ view: 'everyone', status: 'late', partner: 'drop table', q: '  ' })).toEqual({
      scope: 'my_work',
    });
  });

  it('the address round-trips', () => {
    const f = parseFilters({ view: 'team', status: 'blocked', due: 'week', partner: P, q: 'visa' });
    expect(filtersHref(f)).toBe(`/tasks?view=team&status=blocked&due=week&partner=${P}&q=visa`);
    expect(parseFilters(Object.fromEntries(new URL(`http://x${filtersHref(f)}`).searchParams))).toEqual(f);
    expect(filtersHref(f, { status: undefined, scope: 'my_work' })).toBe(`/tasks?due=week&partner=${P}&q=visa`);
  });

  it('each view asks the door for its scope', () => {
    expect(apiFilter({ scope: 'my_work' })).toEqual({ scope: 'my_work' });
    expect(apiFilter({ scope: 'owned' })).toEqual({ scope: 'mine' });
    expect(apiFilter({ scope: 'helping' })).toEqual({ scope: 'my_work' });
    expect(apiFilter({ scope: 'team' })).toEqual({ scope: 'all' });
  });

  it('the status chip asks by meaning; Blocked is In progress with its flag', () => {
    expect(apiFilter({ scope: 'team', status: 'open' }).meanings).toEqual(['not_started', 'in_progress']);
    expect(apiFilter({ scope: 'team', status: 'blocked' })).toMatchObject({ meanings: ['in_progress'], blocked: true });
    expect(apiFilter({ scope: 'team', status: 'done' }).meanings).toEqual(['done']);
    expect(apiFilter({ scope: 'team', due: 'overdue' }).overdue).toBe(true);
    expect(apiFilter({ scope: 'team', partner: P, project: P })).toMatchObject({ partner_id: P, project_id: P });
  });

  it('Helping is My work someone else owns', () => {
    expect(keepRow(row({ owner_id: ME }), { scope: 'helping' }, ME, '2026-10-10')).toBe(false);
    expect(keepRow(row({ owner_id: OTHER }), { scope: 'helping' }, ME, '2026-10-10')).toBe(true);
    expect(keepRow(row({ owner_id: ME }), { scope: 'my_work' }, ME, '2026-10-10')).toBe(true);
  });

  it('due today, this week (seven days from today) and no due day', () => {
    const today = '2026-10-10';
    const f = (due: 'today' | 'week' | 'none') => ({ scope: 'team' as const, due });
    expect(keepRow(row({ due_on: today }), f('today'), ME, today)).toBe(true);
    expect(keepRow(row({ due_on: '2026-10-11' }), f('today'), ME, today)).toBe(false);
    expect(keepRow(row({ due_on: '2026-10-16' }), f('week'), ME, today)).toBe(true);
    expect(keepRow(row({ due_on: '2026-10-17' }), f('week'), ME, today)).toBe(false);
    expect(keepRow(row({ due_on: '2026-10-09' }), f('week'), ME, today)).toBe(false);
    expect(keepRow(row({ due_on: null }), f('none'), ME, today)).toBe(true);
    expect(keepRow(row({ due_on: today }), f('none'), ME, today)).toBe(false);
  });
});
