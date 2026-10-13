/**
 * The Today block's grouping (productivity stage 1): Overdue, Today and Next by the Riyadh day, and a task I only help
 * on stays out. The browser half is tests/e2e/today-block.spec.ts.
 * Sabotage: tests/sabotage/today-block.mjs "group-ignores-the-riyadh-day".
 */
import { describe, expect, it } from 'vitest';
import { todayGroups } from '../../../src/modules/my-day/logic';
import type { TodayTask } from '../../../src/modules/my-day/types';

const task = (n: string, due_on: string, extra: Partial<TodayTask> = {}): TodayTask =>
  ({ id: n, number: n, title: n, due_on, partner_id: null, partner_name: null, role: 'owner', ...extra }) as TodayTask;

describe('the Today block groups my tasks by the Riyadh day', () => {
  it('puts a task due before the day in Overdue, on it in Today and after it in Next', () => {
    const g = todayGroups(
      [
        task('A', '2026-10-12', { group: 'overdue' }),
        task('B', '2026-10-13', { group: 'today' }),
        task('C', '2026-10-15', { group: 'next' }),
      ],
      '2026-10-13',
    );
    expect(g.overdue.map((t) => t.number)).toEqual(['A']);
    expect(g.today.map((t) => t.number)).toEqual(['B']);
    expect(g.next.map((t) => t.number)).toEqual(['C']);
  });

  it('groups a task the database left ungrouped by comparing its due day with the Riyadh day, not the browser clock', () => {
    const rows = [task('A', '2026-10-12'), task('B', '2026-10-13'), task('C', '2026-10-14')];
    const g = todayGroups(rows, '2026-10-13');
    expect([g.overdue.length, g.today.length, g.next.length]).toEqual([1, 1, 1]);
  });

  it('leaves out a task I only help on', () => {
    const g = todayGroups(
      [task('H', '2026-10-13', { group: 'helping', role: 'helper' }), task('M', '2026-10-13', { group: 'today' })],
      '2026-10-13',
    );
    expect(g.today.map((t) => t.number)).toEqual(['M']);
  });
});
