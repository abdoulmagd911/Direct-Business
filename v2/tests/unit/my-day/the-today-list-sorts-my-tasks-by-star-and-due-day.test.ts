/**
 * V661 (V514): the Today list sorts my tasks into four boxes by the importance star and the due day. Starred and due
 * within 2 days or overdue = Do now; starred and due later or undated = Plan it; unstarred and due within 2 days =
 * Quick or hand off; everything else = Later. A task I only help on is in no box. Each box is by due day, then number.
 * Sabotage: tests/sabotage/today-boxes.mjs.
 */
import { describe, expect, it } from 'vitest';
import { URGENT_WITHIN_DAYS, todayBox, todayBoxes } from '../../../src/modules/my-day/logic';
import type { TodayTask } from '../../../src/modules/my-day/types';

const task = (n: string, due_on: string, starred: boolean, extra: Partial<TodayTask> = {}): TodayTask =>
  ({
    id: n,
    number: n,
    title: n,
    due_on,
    starred,
    partner_id: null,
    partner_name: null,
    role: 'owner',
    ...extra,
  }) as TodayTask;

const day = '2026-11-01';

describe('the Today list sorts my tasks by star and due day', () => {
  it('names 2 days as urgent', () => {
    expect(URGENT_WITHIN_DAYS).toBe(2);
  });

  it('puts a starred task due within 2 days or overdue in Do now, and a starred one due later or undated in Plan it', () => {
    expect(todayBox({ starred: true, due_on: '2026-10-30' }, day)).toBe('do_now');
    expect(todayBox({ starred: true, due_on: '2026-11-01' }, day)).toBe('do_now');
    expect(todayBox({ starred: true, due_on: '2026-11-03' }, day)).toBe('do_now');
    expect(todayBox({ starred: true, due_on: '2026-11-04' }, day)).toBe('plan_it');
    expect(todayBox({ starred: true, due_on: null }, day)).toBe('plan_it');
  });

  it('puts an unstarred task due within 2 days in Quick or hand off, and the rest in Later', () => {
    expect(todayBox({ starred: false, due_on: '2026-10-29' }, day)).toBe('quick');
    expect(todayBox({ starred: false, due_on: '2026-11-03' }, day)).toBe('quick');
    expect(todayBox({ starred: false, due_on: '2026-11-04' }, day)).toBe('later');
    expect(todayBox({ due_on: null }, day)).toBe('later');
  });

  it('sorts each box by due day then number, and leaves out what I only help on', () => {
    const b = todayBoxes(
      [
        task('T-3', '2026-11-02', true),
        task('T-1', '2026-11-02', true),
        task('T-2', '2026-10-31', true),
        task('T-4', '2026-11-06', true),
        task('T-5', '2026-11-01', false),
        task('T-6', '2026-11-07', false),
        task('T-7', '2026-11-01', true, { role: 'helper', group: 'helping' }),
      ],
      day,
    );
    expect(b.do_now.map((t) => t.number)).toEqual(['T-2', 'T-1', 'T-3']);
    expect(b.plan_it.map((t) => t.number)).toEqual(['T-4']);
    expect(b.quick.map((t) => t.number)).toEqual(['T-5']);
    expect(b.later.map((t) => t.number)).toEqual(['T-6']);
  });
});
