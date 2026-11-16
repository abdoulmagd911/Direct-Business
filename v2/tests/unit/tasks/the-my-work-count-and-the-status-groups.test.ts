/**
 * Landing 31 (the 15 Nov boards). Two rules behind the Tasks look, pinned without drawing anything:
 *  - `workCount` is the ONE count behind the Tasks tab's number, its count line and My day's banner;
 *  - `statusGroups` is the ONE answer for the board's columns and the list's groups — every task in exactly one, a
 *    blocked task under Blocked (after In progress), so the column counts add up to the list.
 * Every value is made up. Sabotages: tests/sabotage/landing-31-tasks-look.mjs.
 */
import { describe, expect, it } from 'vitest';
import { MY_WORK_FILTER, workCount } from '@/modules/tasks/my-work-count';
import { listFilter } from '@/modules/tasks/rules';
import { pillOf, statusGroups, whereOf } from '@/modules/tasks/screens/look';
import { ME, OTHER, STATUSES, row } from './fixtures';

const TODAY = '2026-11-15';

describe('the My work count is one function (the Tasks tab, its count line, My day’s banner)', () => {
  const rows = [
    row({ id: 'a', meaning: 'not_started', due_on: TODAY }),
    row({ id: 'b', meaning: 'in_progress', status: 'in_progress', due_on: '2026-11-14' }),
    row({ id: 'c', meaning: 'in_progress', status: 'in_progress', blocked_reason: 'made-up wait', due_on: null }),
    row({ id: 'd', meaning: 'not_started', owner_id: OTHER, due_on: '2026-12-01' }),
    row({ id: 'e', meaning: 'done', status: 'done', due_on: '2026-11-01' }),
    row({ id: 'f', meaning: 'cancelled', status: 'cancelled', due_on: '2026-11-01' }),
  ];

  it('open is Not started + In progress (a blocked task is open); done and cancelled are not', () => {
    const c = workCount(rows, TODAY, ME);
    expect(c.open).toBe(4);
    expect(c.done).toBe(1);
  });

  it('owned and helping split the open ones by who is Responsible, and add up to open', () => {
    const c = workCount(rows, TODAY, ME);
    expect(c.owned).toBe(3);
    expect(c.helping).toBe(1);
    expect(c.owned + c.helping).toBe(c.open);
  });

  it('due today and overdue count open tasks only — a closed task is never overdue, nor is past work', () => {
    const c = workCount(rows, TODAY, ME);
    expect(c.dueToday).toBe(1);
    expect(c.overdue).toBe(1);
    expect(workCount([row({ meaning: 'not_started', due_on: '2026-01-01', past_work: true })], TODAY, ME).overdue).toBe(
      0,
    );
  });

  it('the filter it is read with is the Tasks page’s own default for My work', () => {
    expect(listFilter(MY_WORK_FILTER)).toEqual({ scope: 'my_work' });
  });
});

describe('the board’s columns and the list’s groups are one answer', () => {
  const rows = [
    row({ id: '1', status: 'not_started', meaning: 'not_started' }),
    row({ id: '2', status: 'in_progress', meaning: 'in_progress' }),
    row({ id: '3', status: 'in_progress', meaning: 'in_progress', blocked_reason: 'made-up wait' }),
    row({ id: '4', status: 'in_progress', meaning: 'in_progress', blocked_reason: 'another made-up wait' }),
    row({ id: '5', status: 'done', meaning: 'done' }),
  ];

  it('one group per status the app has, in the settings’ order, with Blocked right after In progress', () => {
    expect(statusGroups(rows, STATUSES).map((g) => g.key)).toEqual([
      'not_started',
      'in_progress',
      'blocked',
      'done',
      'cancelled',
    ]);
  });

  it('a blocked task is counted under Blocked, not under In progress, and every task is counted once', () => {
    const groups = statusGroups(rows, STATUSES);
    const count = (key: string) => groups.find((g) => g.key === key)!.rows.length;
    expect(count('in_progress')).toBe(1);
    expect(count('blocked')).toBe(2);
    expect(count('not_started')).toBe(1);
    expect(count('done')).toBe(1);
    expect(count('cancelled')).toBe(0);
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(rows.length);
  });

  it('a status the settings no longer name keeps its group, so no task is ever dropped', () => {
    const groups = statusGroups([...rows, row({ id: '6', status: 'gone_status' })], STATUSES);
    expect(groups.find((g) => g.key === 'gone_status')?.rows).toHaveLength(1);
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(rows.length + 1);
  });

  it('the one pill is Blocked for a blocked task, else the task’s own status', () => {
    expect(pillOf(row({ meaning: 'in_progress', blocked_reason: 'made-up wait' }))).toBe('blocked');
    expect(pillOf(row({ meaning: 'in_progress', blocked_reason: null }))).toBe('in_progress');
    expect(pillOf(row({ meaning: 'done', blocked_reason: 'an old reason' }))).toBe('done');
  });
});

describe('what a task is about, in names', () => {
  const names = {
    project: (id: string | null) => (id === 'p' ? 'Made-up project' : id ? '—' : ''),
    partner: (id: string | null) => (id === 'c' ? 'Made-up partner' : id ? '—' : ''),
  };
  it('says the project and the partner, one of them, or Internal', () => {
    expect(whereOf(row({ project_id: 'p', partner_id: 'c' }), names, 'Internal').parts).toEqual([
      'Made-up project',
      'Made-up partner',
    ]);
    expect(whereOf(row({ partner_id: 'c' }), names, 'Internal')).toEqual({
      kind: 'partner',
      parts: ['Made-up partner'],
    });
    expect(whereOf(row({ work_type: 'internal' }), names, 'Internal')).toEqual({
      kind: 'internal',
      parts: ['Internal'],
    });
  });
  it('never calls work Internal when it names a partner the reader may not see', () => {
    expect(whereOf(row({ partner_id: 'hidden', work_type: 'internal' }), names, 'Internal').kind).toBe('none');
  });
});
