import { describe, expect, it } from 'vitest';
import { addDays, dueState, riyadhDay } from '@/modules/tasks/rules';
import { row } from './fixtures';

describe('due days read in Riyadh days; past work is never overdue (V40, V400, V491, V514)', () => {
  it("today is Riyadh's day, whatever the clock zone", () => {
    expect(riyadhDay(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01'); // 01:30 on 1 Oct in Riyadh
    expect(riyadhDay(new Date('2026-10-01T20:59:00Z'))).toBe('2026-10-01');
  });

  it('days move across month and year ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('an open task is overdue the day after its due day, today on it, soon within two days', () => {
    const today = '2026-10-10';
    expect(dueState(row({ due_on: '2026-10-09' }), today)).toBe('overdue');
    expect(dueState(row({ due_on: '2026-10-10' }), today)).toBe('today');
    expect(dueState(row({ due_on: '2026-10-12' }), today)).toBe('soon');
    expect(dueState(row({ due_on: '2026-10-13' }), today)).toBe('later');
    expect(dueState(row({ due_on: null }), today)).toBe('none');
  });

  it('a closed task is never overdue; neither is past work', () => {
    const today = '2026-10-10';
    expect(dueState(row({ due_on: '2026-01-01', meaning: 'done' }), today)).toBe('closed');
    expect(dueState(row({ due_on: '2026-01-01', meaning: 'cancelled' }), today)).toBe('closed');
    expect(dueState(row({ due_on: '2025-03-01', past_work: true }), today)).toBe('later');
  });
});
