// @vitest-environment jsdom
/**
 * Landing 34, item 1: My day had no Today's three. It now opens, under the banner, with a "Today's three" section — From
 * your own task lists — Important · Short · Maintenance, three rows each at most (the Today block's own row), a line
 * per group when it has none, the three source lines under it and a small streak line read from `api.my_streak`. A
 * streak that cannot be read draws nothing, never an error. The rest of my tasks stay in the Today block below. On the
 * My team tab the team's streaks are listed from `api.team_streaks`; an empty list draws nothing.
 * Item 15: a group's name and its count are apart by a real space, not by a margin alone.
 * Names are made up. Sabotage: tests/sabotage/landing-34-myday.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { MyDayAnswer, Scope, TodayTask } from '../../../src/modules/my-day/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no ResizeObserver; the tabs row uses one to know whether it scrolls
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
let streak: unknown = { days: 4, today_done: 2, target: 3, today_counts: false, last_counted_on: '2026-11-17' };
let team: unknown = [];
let streakFails = false;
const calls: string[] = [];
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/my-day' }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: 'p1' }, levels: {} }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({
  rpc: vi.fn(async (name: string) => {
    calls.push(name);
    if (name === 'my_streak') {
      if (streakFails) throw new Error('made-up failure');
      return streak;
    }
    if (name === 'team_streaks') return team;
    if (name === 'page_seen') return null;
    return [];
  }),
}));
vi.mock('@/ui/Toast', () => ({ toast: new Proxy({}, { get: () => vi.fn(() => 't1') }) }));

const { MyDay } = await import('../../../src/modules/my-day/screens/MyDay');

const DAY = '2026-11-18';
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
const tasks = [
  ...[1, 2, 3, 4].map((n) => task(n, '2026-11-19', { starred: true })), // four starred: three picked, one left
  task(11, '2026-11-18', { group: 'today' }), // short
  task(21, '2026-11-25'), // maintenance
  task(31, '2026-11-18', { role: 'helper', group: 'helping', starred: true }), // only helping
];

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  streak = { days: 4, today_done: 2, target: 3, today_counts: false, last_counted_on: '2026-11-17' };
  team = [];
  streakFails = false;
  calls.length = 0;
});
const draw = async (rows: TodayTask[] | undefined, scope: Scope = 'me', locale: 'en' | 'ar' = 'en') => {
  const answer = { scope, day: DAY, notes: [], notes_total: 0, reminders: [], since: [], more: false, tasks: rows };
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
        <MyDay
          data={{
            title: 'Wed 18 Nov 2026',
            myWork: null,
            scope,
            answer: answer as unknown as MyDayAnswer,
            all: false,
            people: [],
            statuses: [],
            due: { due: [], next_at: null },
            asks: { to_me: [], by_me: [] },
            escalated: [],
            escalatedByMe: [],
            unlogged: null,
          }}
        />
      </NextIntlClientProvider>,
    );
  });
  // the streak is asked from the browser after the first paint
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const one = (selector: string) => document.querySelector(selector);
const rowsOf = (group: string) =>
  [...document.querySelectorAll(`[data-three-group="${group}"] [data-three-row]`)].map((r) =>
    r.getAttribute('data-three-row'),
  );
const text = (selector: string) => one(selector)?.textContent?.replace(/\s+/g, ' ').trim();

describe("My day opens with Today's three", () => {
  it('sits right under the banner and the tabs, above everything else, titled and saying whose lists it reads', async () => {
    await draw(tasks);
    const section = one('[data-todays-three]')!;
    expect(section, "the Today's three section").not.toBeNull();
    expect(section.querySelector('h2')?.textContent).toBe("Today's three");
    expect(text('[data-three-own]')).toBe('From your own task lists');
    const order = [
      ...document.querySelectorAll(
        '[data-day-banner], [data-todays-three], [data-waiting-nothing], [data-today-block]',
      ),
    ];
    expect(order.indexOf(one('[data-day-banner]')!)).toBe(0);
    expect(order.indexOf(section)).toBe(1);
    expect(order.indexOf(one('[data-today-block]')!)).toBeGreaterThan(1);
  });

  it('draws Important, Short and Maintenance with at most three of my own tasks each, and keeps the rest in the Today block', async () => {
    await draw(tasks);
    expect([...document.querySelectorAll('[data-three-group]')].map((g) => g.getAttribute('data-three-group'))).toEqual(
      ['important', 'short', 'maintenance'],
    );
    expect(rowsOf('important')).toEqual(['TSK-001', 'TSK-002', 'TSK-003']);
    expect(rowsOf('short')).toEqual(['TSK-011']);
    expect(rowsOf('maintenance')).toEqual(['TSK-021']);
    // the fourth starred task and the one I only help on are below, in the Today block — and nowhere twice
    const below = [...document.querySelectorAll('[data-today-block] [data-today-task]')].map((r) =>
      r.getAttribute('data-today-task'),
    );
    expect(below).toEqual(['TSK-004', 'TSK-031']);
    expect(document.querySelectorAll('[data-today-task="TSK-001"]')).toHaveLength(1);
  });

  it("gives each row the Today block's own tick, link and star", async () => {
    await draw(tasks);
    const row = one('[data-three-row="TSK-001"]')!;
    expect(row.querySelector('[data-today-open]')?.getAttribute('href')).toBe('/tasks/TSK-001');
    expect(row.querySelector('[data-star]')?.getAttribute('data-star')).toBe('on');
    expect(row.querySelector('button[aria-label*="Made-up task 1"]')).not.toBeNull();
  });

  it('still draws the section for someone with no tasks at all, each group saying so in a line', async () => {
    for (const none of [[], undefined]) {
      await draw(none);
      expect(one('[data-todays-three]'), 'the section is there').not.toBeNull();
      expect(text('[data-three-group="important"] [data-three-empty]')).toBe('Nothing important is open');
      expect(text('[data-three-group="short"] [data-three-empty]')).toBe('Nothing short is open');
      expect(text('[data-three-group="maintenance"] [data-three-empty]')).toBe('No maintenance is open');
      expect(document.querySelectorAll('[data-three-row]')).toHaveLength(0);
      act(() => root?.unmount());
      document.body.innerHTML = '';
    }
  });

  it('lists the three source lines under the section', async () => {
    await draw(tasks);
    expect([...document.querySelectorAll('[data-three-sources] li')].map((li) => li.textContent)).toEqual([
      'Important — your starred tasks',
      'Short — due within 2 days, not starred',
      'Maintenance — the rest of your own tasks',
    ]);
  });

  it('names the section and its groups in Arabic too', async () => {
    await draw(tasks, 'me', 'ar');
    expect(one('[data-todays-three] h2')?.textContent).toBe('ثلاثة اليوم');
    expect(text('[data-three-own]')).toBe('من قوائم مهامك أنت');
    expect(text('[data-three-group="important"] h3')).toBe('المهمة 3');
  });

  it('is only on Me: the My team and Workspace tabs have no section', async () => {
    await draw(tasks, 'team');
    expect(one('[data-todays-three]')).toBeNull();
  });
});

describe('the streak line', () => {
  it('says the working days in a row and how many of the three are done today', async () => {
    await draw(tasks);
    expect(calls).toContain('my_streak');
    expect(one('[data-streak]')?.getAttribute('data-streak')).toBe('4');
    expect(text('[data-streak]')).toBe('Streak: 4 working days · 2 of 3 done today');
  });
  it('says there is no streak yet at 0 days', async () => {
    streak = { days: 0, today_done: 0, target: 3, today_counts: false, last_counted_on: null };
    await draw(tasks);
    expect(text('[data-streak]')).toBe('No streak yet — finish three today to start one · 0 of 3 done today');
  });
  it('never counts more than the three as done today', async () => {
    streak = { days: 1, today_done: 5, target: 3, today_counts: true, last_counted_on: DAY };
    await draw(tasks);
    expect(text('[data-streak]')).toBe('Streak: 1 working day · 3 of 3 done today');
  });
  it('draws nothing for the streak when it cannot be read — no error — and the section still shows', async () => {
    streakFails = true;
    await draw(tasks);
    expect(one('[data-streak]')).toBeNull();
    expect(one('[data-todays-three]')).not.toBeNull();
    expect(one('[data-todays-three] [data-state="failed"], [data-todays-three] [role="alert"]')).toBeNull();
    expect(rowsOf('important')).toHaveLength(3);
  });
  it('draws nothing for an answer that is not a streak', async () => {
    streak = { request_id: 'r1' };
    await draw(tasks);
    expect(one('[data-streak]')).toBeNull();
  });
});

describe("the team's streaks on the My team tab", () => {
  it('lists each person I manage with their working days, the longest first', async () => {
    team = [
      { person_id: 'made-up-b', full_name_en: 'Made-up Basma', full_name_ar: 'بسمة التجريبية', days: 1, today_done: 0 },
      { person_id: 'made-up-a', full_name_en: 'Made-up Adel', full_name_ar: 'عادل التجريبي', days: 6, today_done: 3 },
      { person_id: 'made-up-c', full_name_en: 'Made-up Carim', full_name_ar: null, days: 0, today_done: 0 },
    ];
    await draw(undefined, 'team');
    expect(calls).toContain('team_streaks');
    expect(
      [...document.querySelectorAll('[data-team-streaks] [data-team-streak]')].map((li) =>
        text(`[data-team-streak="${li.getAttribute('data-team-streak')}"]`),
      ),
    ).toEqual(['Made-up Adel 6 working days', 'Made-up Basma 1 working day', 'Made-up Carim No streak yet']);
  });
  it('draws nothing when the list is empty, and is not asked for on Me', async () => {
    await draw(undefined, 'team');
    expect(one('[data-team-streaks]')).toBeNull();
    act(() => root?.unmount());
    calls.length = 0;
    await draw(tasks, 'me');
    expect(calls).not.toContain('team_streaks');
    expect(one('[data-team-streaks]')).toBeNull();
  });
});

describe('a name and its count are a space apart (item 15)', () => {
  it("in Today's three and in the Today block's groups, read as text", async () => {
    await draw([...tasks, task(41, '2026-11-18'), task(42, '2026-11-18'), task(43, '2026-11-18')]);
    expect(one('[data-three-group="important"] h3')?.textContent).toBe('Important 3');
    // four short ones: three above, the fourth stays in the Today block's "Quick or pass to someone" group
    expect(one('[data-today-group="quick"] h3')?.textContent).toBe('Quick or pass to someone 1');
    expect(one('[data-today-chip="quick"]')?.textContent).toBe('Quick or pass to someone 1');
  });
});
