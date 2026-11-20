/**
 * Landing 34, item 1: Today's three is the daily practice at the top of My day — 3 important + 3 short + 3 maintenance
 * from the person's OWN open tasks, the rest below. No new stored field: important = starred (Do now + Plan it),
 * short = not starred and urgent (Quick), maintenance = the other own tasks (Later). The streak line reads
 * `api.my_streak` and the My team tab `api.team_streaks`; an answer that is not one draws nothing.
 * Every value is made up. Sabotage: tests/sabotage/landing-34-myday.mjs.
 */
import { describe, expect, it } from 'vitest';
import { readStreak, readTeamStreaks, todaysThree } from '../../../src/modules/my-day/logic';
import type { TodayTask } from '../../../src/modules/my-day/types';

const DAY = '2026-11-18'; // a Wednesday in Riyadh; urgent = overdue or due by 2026-11-20
const task = (n: number, due: string | null, extra: Partial<TodayTask> = {}): TodayTask => ({
  id: `id-${n}`,
  number: `TSK-${String(n).padStart(3, '0')}`,
  title: `Made-up task ${n}`,
  due_on: due,
  partner_id: null,
  partner_name: null,
  group: 'next',
  role: 'owner',
  ...extra,
});
const numbers = (rows: TodayTask[]) => rows.map((t) => t.number);

describe("Today's three", () => {
  it('puts my starred tasks in Important, the urgent unstarred ones in Short and the other own tasks in Maintenance', () => {
    const three = todaysThree(
      [
        task(1, '2026-11-17', { starred: true }), // starred and overdue (Do now)
        task(2, '2026-11-30', { starred: true }), // starred, not urgent (Plan it)
        task(3, null, { starred: true }), // starred with no day (Plan it)
        task(4, '2026-11-18'), // due today, not starred (Quick)
        task(5, '2026-11-20'), // due within 2 days (Quick)
        task(6, '2026-11-21'), // 3 days away (Later)
        task(7, null), // no day, no star (Later)
      ],
      DAY,
    );
    expect(numbers(three.important)).toEqual(['TSK-001', 'TSK-002', 'TSK-003']);
    expect(numbers(three.short)).toEqual(['TSK-004', 'TSK-005']);
    expect(numbers(three.maintenance)).toEqual(['TSK-006', 'TSK-007']);
    expect(three.rest).toEqual([]);
  });

  it('holds at most three in each group and leaves every other own task in the rest, none lost and none twice', () => {
    const mine = [
      ...[1, 2, 3, 4, 5].map((n) => task(n, '2026-11-19', { starred: true })),
      ...[11, 12, 13, 14].map((n) => task(n, '2026-11-18')),
      ...[21, 22, 23, 24, 25, 26].map((n) => task(n, '2026-11-25')),
    ];
    const three = todaysThree(mine, DAY);
    expect(numbers(three.important)).toEqual(['TSK-001', 'TSK-002', 'TSK-003']);
    expect(numbers(three.short)).toEqual(['TSK-011', 'TSK-012', 'TSK-013']);
    expect(numbers(three.maintenance)).toEqual(['TSK-021', 'TSK-022', 'TSK-023']);
    expect(numbers(three.rest)).toEqual(['TSK-004', 'TSK-005', 'TSK-014', 'TSK-024', 'TSK-025', 'TSK-026']);
    const all = [...three.important, ...three.short, ...three.maintenance, ...three.rest];
    expect(numbers(all).sort()).toEqual(numbers(mine).sort());
  });

  it('never takes a task I only help on — not into a group and not into the rest', () => {
    const three = todaysThree(
      [
        task(1, '2026-11-18', { starred: true, role: 'helper', group: 'helping' }),
        task(2, '2026-11-18', { role: 'helper' }),
        task(3, '2026-11-25', { group: 'helping' }),
        task(4, '2026-11-18', { starred: true }),
      ],
      DAY,
    );
    expect(numbers(three.important)).toEqual(['TSK-004']);
    expect([...three.short, ...three.maintenance, ...three.rest]).toEqual([]);
  });

  it('sorts each group by due day then number, a task with no day last — across Do now and Plan it too', () => {
    const three = todaysThree(
      [
        task(9, null, { starred: true }),
        task(8, '2026-12-01', { starred: true }), // Plan it, later
        task(7, '2026-11-19', { starred: true }), // Do now
        task(6, '2026-11-25', { starred: true }), // Plan it, sooner than TSK-008
        task(5, '2026-11-19', { starred: true }), // Do now, same day as TSK-007: the lower number first
        task(3, '2026-11-18'),
        task(2, '2026-11-18'),
        task(1, '2026-11-10'),
      ],
      DAY,
    );
    expect(numbers(three.important)).toEqual(['TSK-005', 'TSK-007', 'TSK-006']);
    expect(numbers(three.short)).toEqual(['TSK-001', 'TSK-002', 'TSK-003']);
    expect(numbers(three.rest)).toEqual(['TSK-008', 'TSK-009']);
  });

  it('with no tasks at all answers three empty groups and an empty rest', () => {
    expect(todaysThree([], DAY)).toEqual({ important: [], short: [], maintenance: [], rest: [] });
  });
});

describe('the streak answers, read with care', () => {
  it("reads api.my_streak's days, what is done today and the target", () => {
    expect(
      readStreak({ days: 4, today_done: 2, target: 3, today_counts: false, last_counted_on: '2026-11-17' }),
    ).toEqual({ days: 4, today_done: 2, target: 3 });
    expect(readStreak({ days: 0, today_done: 0, target: 3 })).toEqual({ days: 0, today_done: 0, target: 3 });
  });
  it('answers no streak for anything that is not one, so the line is not drawn', () => {
    for (const raw of [null, undefined, [], 'made-up', { request_id: 'r1' }, { days: '4' }, { days: -1 }])
      expect(readStreak(raw), JSON.stringify(raw)).toBeNull();
  });
  it("reads api.team_streaks' people, the longest streak first, and nothing from an answer that is not a list", () => {
    const rows = readTeamStreaks([
      { person_id: 'made-up-b', full_name_en: 'Made-up Basma', full_name_ar: null, days: 2, today_done: 1 },
      { person_id: 'made-up-a', full_name_en: 'Made-up Adel', full_name_ar: null, days: 6, today_done: 0 },
      { full_name_en: 'no id', days: 3 },
    ]);
    expect(rows.map((r) => [r.person_id, r.days])).toEqual([
      ['made-up-a', 6],
      ['made-up-b', 2],
    ]);
    expect(readTeamStreaks({ rows: [] })).toEqual([]);
    expect(readTeamStreaks(null)).toEqual([]);
  });
});
