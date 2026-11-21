/**
 * Landing 34, item 1, and Landing 34b (the owner's live check, 20 Nov): Today's three is the daily practice at the top
 * of My day — 3 important + 3 short + 3 maintenance from the person's OWN open tasks. The DATABASE picks them
 * (`api.my_day` → `three`, my.my_three) out of all the person's own open tasks, in one fixed order; the screen only
 * reads that pick: it keeps the order as given, draws a row once, holds at most three per group, reads `totals` with
 * care and leaves in `rest` exactly the Today-list tasks that were not picked. An answer without `three` (an older
 * database) or with a broken one gives three empty groups, never a crash. The streak line reads `api.my_streak` and
 * the My team tab `api.team_streaks`; an answer that is not one draws nothing.
 * Every value is made up. Sabotage: tests/sabotage/landing-34-myday.mjs.
 */
import { describe, expect, it } from 'vitest';
import { readStreak, readTeamStreaks, threeMore, todaysThree } from '../../../src/modules/my-day/logic';
import type { MyDayAnswer, TodayTask } from '../../../src/modules/my-day/types';

type Three = NonNullable<MyDayAnswer['three']>;
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
/** The database's answer: the three lists as given, and each group's total (its own length when none is named). */
const pick = (
  important: TodayTask[],
  short: TodayTask[],
  maintenance: TodayTask[],
  totals: Partial<Three['totals']> = {},
): Three => ({
  important,
  short,
  maintenance,
  totals: { important: important.length, short: short.length, maintenance: maintenance.length, ...totals },
});
const EMPTY = {
  important: [],
  short: [],
  maintenance: [],
  rest: [],
  totals: { important: 0, short: 0, maintenance: 0 },
};

describe("Today's three", () => {
  it("draws the database's pick as it is: its starred tasks in Important, its Short and its Maintenance — an overdue and an undated task where the database put them", () => {
    const three = todaysThree(
      pick(
        [task(1, '2026-11-17', { starred: true }), task(2, '2026-11-30', { starred: true })],
        [task(4, '2026-11-18'), task(5, '2026-11-20')],
        // overdue since long ago, due later, and with no due day: Maintenance, never Short
        [task(8, '2025-03-02', { group: 'overdue' }), task(6, '2026-11-25'), task(7, null)],
      ),
      [],
    );
    expect(numbers(three.important)).toEqual(['TSK-001', 'TSK-002']);
    expect(numbers(three.short)).toEqual(['TSK-004', 'TSK-005']);
    expect(numbers(three.maintenance)).toEqual(['TSK-008', 'TSK-006', 'TSK-007']);
    expect(three.totals).toEqual({ important: 2, short: 2, maintenance: 3 });
    expect(three.rest).toEqual([]);
  });

  it("keeps the database's order as given — the screen sorts nothing again, not by day, not by number", () => {
    // on purpose NOT in due-day or number order: whatever order the database answers is the order drawn
    const three = todaysThree(
      pick(
        [
          task(9, null, { starred: true }),
          task(7, '2026-11-19', { starred: true }),
          task(5, '2026-11-19', { starred: true }),
        ],
        [task(3, '2026-11-20'), task(2, '2026-11-18')],
        [task(30, null), task(20, '2026-12-01'), task(10, '2025-01-05')],
      ),
      [],
    );
    expect(numbers(three.important)).toEqual(['TSK-009', 'TSK-007', 'TSK-005']);
    expect(numbers(three.short)).toEqual(['TSK-003', 'TSK-002']);
    expect(numbers(three.maintenance)).toEqual(['TSK-030', 'TSK-020', 'TSK-010']);
    // and the same answer read twice gives the same three, row for row
    const again = todaysThree(
      pick(
        [
          task(9, null, { starred: true }),
          task(7, '2026-11-19', { starred: true }),
          task(5, '2026-11-19', { starred: true }),
        ],
        [task(3, '2026-11-20'), task(2, '2026-11-18')],
        [task(30, null), task(20, '2026-12-01'), task(10, '2025-01-05')],
      ),
      [],
    );
    expect(again).toEqual(three);
  });

  it('holds at most three in each group even when the answer holds more, and counts the others in the total', () => {
    const three = todaysThree(
      pick(
        [1, 2, 3, 4, 5].map((n) => task(n, '2026-11-19', { starred: true })),
        [11, 12, 13, 14].map((n) => task(n, '2026-11-18')),
        [21, 22, 23, 24, 25, 26].map((n) => task(n, '2026-11-25')),
      ),
      [],
    );
    expect(numbers(three.important)).toEqual(['TSK-001', 'TSK-002', 'TSK-003']);
    expect(numbers(three.short)).toEqual(['TSK-011', 'TSK-012', 'TSK-013']);
    expect(numbers(three.maintenance)).toEqual(['TSK-021', 'TSK-022', 'TSK-023']);
    expect(three.totals).toEqual({ important: 5, short: 4, maintenance: 6 });
  });

  it('draws a row repeated across the groups, or inside one, once — in the first group that holds it', () => {
    const twice = task(2, '2026-11-18', { starred: true });
    const three = todaysThree(
      pick(
        [task(1, '2026-11-18', { starred: true }), twice, twice],
        [twice, task(4, '2026-11-19')],
        [task(4, '2026-11-19'), task(6, null)],
      ),
      [],
    );
    expect(numbers(three.important)).toEqual(['TSK-001', 'TSK-002']);
    expect(numbers(three.short)).toEqual(['TSK-004']);
    expect(numbers(three.maintenance)).toEqual(['TSK-006']);
    const all = [...three.important, ...three.short, ...three.maintenance].map((t) => t.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('leaves in the rest exactly the Today-list tasks that were not picked — mine and the ones I help on — and none that was picked', () => {
    const picked = pick(
      [
        task(1, '2026-11-19', { starred: true }),
        task(2, '2026-11-19', { starred: true }),
        task(3, '2026-11-19', { starred: true }),
      ],
      [task(11, '2026-11-18', { group: 'today' })],
      [task(21, null)], // undated: in the three, but never on the Today list
      { important: 4 },
    );
    const today = [
      task(31, '2026-11-18', { role: 'helper', group: 'helping', starred: true }), // only helping: below, never above
      task(1, '2026-11-19', { starred: true }),
      task(2, '2026-11-19', { starred: true }),
      task(3, '2026-11-19', { starred: true }),
      task(4, '2026-11-19', { starred: true }), // the fourth starred one
      task(11, '2026-11-18', { group: 'today' }),
      task(32, '2026-11-25', { role: 'helper', group: 'helping' }),
    ];
    const three = todaysThree(picked, today);
    // in the Today list's own order, nothing sorted
    expect(numbers(three.rest)).toEqual(['TSK-031', 'TSK-004', 'TSK-032']);
    const above = new Set([...three.important, ...three.short, ...three.maintenance].map((t) => t.id));
    expect(three.rest.filter((t) => above.has(t.id))).toEqual([]);
    // none lost: every Today-list task is above or below, once
    expect([...above, ...three.rest.map((t) => t.id)].filter((id) => today.some((t) => t.id === id)).sort()).toEqual(
      today.map((t) => t.id).sort(),
    );
    // a task I only help on is never in a group, whatever the Today list says
    expect([...above]).not.toContain('id-31');
  });

  it('reads a missing, empty or broken answer (an older database) as three empty groups and keeps every task in the rest — never a crash', () => {
    const today = [task(1, '2026-11-18', { starred: true }), task(2, null, { role: 'helper', group: 'helping' })];
    const broken: unknown[] = [
      undefined,
      null,
      {},
      [],
      'made-up',
      7,
      { request_id: 'r1' },
      { important: null, short: 'x', maintenance: { id: 'id-1' }, totals: null },
      { important: [null, undefined, 'x', 4, {}, { id: 9 }], short: [], maintenance: [], totals: 'many' },
      { totals: { important: 'x', short: null, maintenance: Number.NaN } },
    ];
    for (const raw of broken) {
      const three = todaysThree(raw as MyDayAnswer['three'], today);
      expect(three, JSON.stringify(raw)).toEqual({ ...EMPTY, rest: today });
    }
    expect(todaysThree(undefined, [])).toEqual(EMPTY);
    expect(todaysThree(pick([], [], []), [])).toEqual(EMPTY);
  });

  it('never says a total below what is drawn, and reads a total that is not a whole number with care', () => {
    const rows = [1, 2, 3].map((n) => task(n, '2026-11-19', { starred: true }));
    const three = todaysThree(
      pick(rows, [task(11, '2026-11-18')], [task(21, null), task(22, null)], {
        important: 1,
        short: -4,
        maintenance: 5.9,
      }),
      [],
    );
    expect(three.totals).toEqual({ important: 3, short: 1, maintenance: 5 });
    // a total with no rows under it is still the database's count
    expect(todaysThree(pick([], [], [], { short: 2 }), []).totals).toEqual({ important: 0, short: 2, maintenance: 0 });
  });

  it('says how many of a group are not drawn — the total less what is drawn, never below nothing', () => {
    const three = todaysThree(
      pick(
        [1, 2, 3].map((n) => task(n, '2026-11-19', { starred: true })),
        [task(11, '2026-11-18')],
        [],
        { important: 7, short: 1, maintenance: 0 },
      ),
      [],
    );
    expect(threeMore(three, 'important')).toBe(4);
    expect(threeMore(three, 'short')).toBe(0);
    expect(threeMore(three, 'maintenance')).toBe(0);
    // four rows answered: three drawn, one more
    expect(
      threeMore(
        todaysThree(
          pick(
            [1, 2, 3, 4].map((n) => task(n, null)),
            [],
            [],
          ),
          [],
        ),
        'important',
      ),
    ).toBe(1);
    expect(threeMore({ ...three, totals: { important: 1, short: 0, maintenance: 0 } }, 'important')).toBe(0);
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
