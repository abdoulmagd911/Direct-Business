import { describe, expect, it } from 'vitest';
import { boardColumns, byDueDay, filtersHref, monthWeeks, parseFilters, shiftMonth } from '@/modules/tasks/rules';
import { STATUSES } from './fixtures';

// Made-up tasks (rule 7). List / Board / Calendar are one view of the same rows (§8 Tasks): the board puts every row in
// exactly one column, the calendar every dated row on its due day and the rest apart — nothing is dropped or guessed.
const row = (status: string, due_on: string | null = null) => ({ status, due_on });

describe('the board and the calendar count what the list counts', () => {
  it('the board has one column per active status, in order, and every row lands in exactly one', () => {
    const rows = [row('in_progress'), row('not_started'), row('in_progress'), row('gone_status')];
    const cols = boardColumns(rows, STATUSES);
    const active = [...STATUSES].filter((s) => s.active).sort((a, b) => a.sort - b.sort);
    expect(cols.slice(0, active.length).map((c) => c.key)).toEqual(active.map((s) => s.key));
    expect(cols.reduce((n, c) => n + c.rows.length, 0)).toBe(rows.length);
    expect(cols.find((c) => c.key === 'in_progress')?.rows).toHaveLength(2);
    // a status the settings no longer name keeps its column
    expect(cols.find((c) => c.key === 'gone_status')?.rows).toHaveLength(1);
  });

  it('the calendar puts each task on its due day and lists the undated apart', () => {
    const rows = [row('a', '2026-10-05'), row('b', '2026-10-05'), row('c', null), row('d', '2026-10-31')];
    const { days, undated } = byDueDay(rows);
    expect(days.get('2026-10-05')).toHaveLength(2);
    expect(days.get('2026-10-31')).toHaveLength(1);
    expect(undated).toHaveLength(1);
  });

  it('a month is whole weeks, Sunday first, with every day of the month once', () => {
    const weeks = monthWeeks('2026-10'); // 1 Oct 2026 is a Thursday
    expect(weeks[0]![0]).toEqual({ day: '2026-09-27', inMonth: false });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const inMonth = weeks
      .flat()
      .filter((d) => d.inMonth)
      .map((d) => d.day);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0]).toBe('2026-10-01');
    expect(inMonth.at(-1)).toBe('2026-10-31');
    expect(
      monthWeeks('2026-02')
        .flat()
        .filter((d) => d.inMonth),
    ).toHaveLength(28);
  });

  it('the month steps across a year, and the layout and month live in the address', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    const f = parseFilters({ view: 'team', layout: 'calendar', month: '2026-10' });
    expect(f).toMatchObject({ scope: 'team', layout: 'calendar', month: '2026-10' });
    expect(filtersHref(f)).toBe('/tasks?view=team&layout=calendar&month=2026-10');
    expect(filtersHref(f, { layout: 'board' })).toBe('/tasks?view=team&layout=board');
    expect(parseFilters({ layout: 'grid', month: '2026-13' })).toMatchObject({ layout: undefined, month: undefined });
  });
});
