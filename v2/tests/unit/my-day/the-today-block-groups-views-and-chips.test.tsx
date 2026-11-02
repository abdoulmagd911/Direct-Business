// @vitest-environment jsdom
/**
 * P5-7 and V661: the Today block draws a reminders list, then the four boxes of my own tasks — Do now, Plan it, Quick or hand
 * off, Later (by the star and the due day) — then Helping; the tasks I only help on have no done tick and no star button.
 * Each of my rows has a 44 px star that sets or clears it through the database. A chip per group shows only the groups
 * pressed ("Show only"); the one fixed view, All, clears them; Save view has an icon and says what it keeps; a saved view
 * marked as my default opens on its groups; seven rows, then Show all. Names are made up.
 * Sabotages: tests/sabotage/my-day-task-groups.mjs and tests/sabotage/today-boxes-and-star.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { capRows, helpingTasks, readTaskView } from '../../../src/modules/my-day/logic';
import type { TodayTask } from '../../../src/modules/my-day/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let saved: unknown[] = [];
const calls: { name: string; args: unknown }[] = [];
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: 'p1' }, levels: {} }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({
  rpc: vi.fn(async (name: string, args: unknown) => {
    calls.push({ name, args });
    return name === 'views' ? saved : { request_id: 'r1' };
  }),
}));
vi.mock('@/ui/Toast', () => ({ toast: new Proxy({}, { get: () => vi.fn(() => 't1') }) }));

const { TodayBlock } = await import('../../../src/modules/my-day/screens/TodayBlock');

const task = (n: string, due: string, extra: Partial<TodayTask> = {}): TodayTask => ({
  id: `id-${n}`,
  number: n,
  title: `Made-up task ${n}`,
  due_on: due,
  partner_id: null,
  partner_name: null,
  group: 'today',
  role: 'owner',
  ...extra,
});
// the day is 2026-10-14; urgent is overdue or due within 2 days (V661)
const tasks = [
  task('TSK-1', '2026-10-10', { group: 'overdue', starred: true }), // Do now
  task('TSK-2', '2026-10-14', { group: 'today' }), // Quick or hand off
  task('TSK-3', '2026-10-20', { group: 'next', starred: true }), // Plan it
  task('TSK-5', '2026-10-25', { group: 'next' }), // Later
  task('TSK-4', '2026-10-15', { group: 'helping', role: 'helper', starred: true }),
];

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  saved = [];
  calls.length = 0;
});
const draw = async (rows: TodayTask[] = tasks, locale: 'en' | 'ar' = 'en') => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
        <TodayBlock tasks={rows} day="2026-10-14" statuses={[]} due={{ due: [], next_at: null }} />
      </NextIntlClientProvider>,
    );
  });
};
const groups = () =>
  [...document.querySelectorAll('[data-today-group]')].map((g) => g.getAttribute('data-today-group'));
const click = (selector: string) => act(() => (document.querySelector(selector) as HTMLElement).click());
const clickAsync = (selector: string) => act(async () => (document.querySelector(selector) as HTMLElement).click());

const starCalls = () => calls.filter((c) => c.name === 'task_star');
const BOXES = ['do_now', 'plan_it', 'quick', 'later'];

describe('the Today block: the four boxes, the star, chips and views', () => {
  it('draws the four boxes in order, each task in the box its star and day give, Helping last', async () => {
    await draw();
    expect(groups()).toEqual([...BOXES, 'helping']);
    const inBox = (k: string) =>
      [...document.querySelectorAll(`[data-today-group="${k}"] [data-today-task]`)].map((r) =>
        r.getAttribute('data-today-task'),
      );
    expect(inBox('do_now')).toEqual(['TSK-1']);
    expect(inBox('plan_it')).toEqual(['TSK-3']);
    expect(inBox('quick')).toEqual(['TSK-2']);
    expect(inBox('later')).toEqual(['TSK-5']);
    expect(inBox('helping')).toEqual(['TSK-4']);
  });
  it('names the boxes in English and in Arabic', async () => {
    const headings = () =>
      [...document.querySelectorAll('[data-today-group] h3')].map((h) => h.firstChild?.textContent);
    await draw();
    expect(headings()).toEqual(['Do now', 'Plan it', 'Quick or pass to someone', 'Later', 'Helping']);
    act(() => root?.unmount());
    document.body.innerHTML = '';
    await draw(tasks, 'ar');
    expect(headings()).toEqual(['افعلها الآن', 'خطّط لها', 'سريعة أو فوّضها', 'لاحقًا', 'أساعد فيها']);
  });
  it('a task of mine has a 44 px star that is on when starred; a helped task has a mark and no button, and no done tick', async () => {
    await draw();
    const own = document.querySelector('[data-today-task="TSK-1"] button[data-star]') as HTMLElement;
    expect(own.getAttribute('data-star')).toBe('on');
    expect(own.className).toContain('size-11');
    expect((document.querySelector('[data-today-task="TSK-2"] button[data-star]') as HTMLElement).dataset.star).toBe(
      'off',
    );
    const helped = document.querySelector('[data-today-task="TSK-4"]')!;
    expect(helped.querySelector('button')).toBeNull();
    expect(helped.querySelector('[data-star="mark"]')).not.toBeNull();
    expect(helped.querySelector(':scope > span[aria-hidden="true"]')).toBeNull();
  });
  it('a tap on the star sets it through task_star, and a tap on a set star clears it', async () => {
    await draw();
    await clickAsync('[data-today-task="TSK-2"] button[data-star]');
    expect(starCalls().at(-1)).toEqual({ name: 'task_star', args: { p_id: 'id-TSK-2', p_starred: true } });
    expect((document.querySelector('[data-today-task="TSK-2"] button[data-star]') as HTMLElement).dataset.star).toBe(
      'on',
    );
    await clickAsync('[data-today-task="TSK-1"] button[data-star]');
    expect(starCalls().at(-1)).toEqual({ name: 'task_star', args: { p_id: 'id-TSK-1', p_starred: false } });
  });
  it('shows a starred task with no due day with no day on its row', async () => {
    await draw([task('TSK-8', '', { due_on: null, starred: true, group: 'next' })]);
    expect(groups()).toEqual(['plan_it']);
    expect(document.querySelector('[data-today-task="TSK-8"] .font-data')).toBeNull();
  });
  it('a chip shows only the groups pressed, and pressing it again shows all of them again', async () => {
    await draw();
    click('[data-today-chip="helping"]');
    expect(groups()).toEqual(['helping']);
    click('[data-today-chip="do_now"]');
    expect(groups()).toEqual(['do_now', 'helping']);
    click('[data-today-chip="helping"]');
    click('[data-today-chip="do_now"]');
    expect(groups()).toEqual([...BOXES, 'helping']);
  });
  it('has one view of its own, All, which clears the chips; the chips are the only place Helping is a choice', async () => {
    await draw();
    expect(
      [...document.querySelectorAll('[data-saved-views] [data-view]')].map((b) => b.getAttribute('data-view')),
    ).toEqual(['all']);
    click('[data-today-chip="helping"]');
    click('[data-view="all"]');
    expect(groups()).toHaveLength(5);
    // "Helping" is a control once (the chip); the group below it is a heading, not a second control
    const controls = [...document.querySelectorAll('[data-today-views] button')].filter((b) =>
      /^Helping/.test(b.textContent ?? ''),
    );
    expect(controls).toHaveLength(1);
  });
  it('says the chips filter ("Show only") and what Save view keeps, with an icon beside the words', async () => {
    await draw();
    expect(document.querySelector('[data-today-filter-label]')?.textContent).toBe('Show only');
    const save = document.querySelector('[data-view-save]') as HTMLElement;
    expect(save.querySelector('svg')).not.toBeNull();
    expect(save.getAttribute('title')).toBe(en.pages.myDay.today.saveHint);
  });
  it('opens on the saved view this person set as their default', async () => {
    saved = [
      {
        id: 'v1',
        name: 'Chasing',
        query: { groups: ['do_now'] },
        shared: false,
        sort: 0,
        owner_id: 'p1',
        mine: true,
        default: true,
        version: 1,
      },
    ];
    await draw();
    expect(groups()).toEqual(['do_now']);
  });
});

describe('the chips on a phone (V630)', () => {
  it('fold behind one Filter button that counts the chips pressed; the chips stay in the panel the button opens', async () => {
    await draw();
    const toggle = document.querySelector('[data-today-views] [data-filter-toggle]') as HTMLElement;
    expect(toggle.textContent).toContain('Filter');
    expect(toggle.querySelector('[data-filter-count]')).toBeNull();
    const panel = document.querySelector('[data-today-views] [data-filter-panel]')!;
    expect(panel.querySelectorAll('[data-today-chip]')).toHaveLength(6);
    expect(panel.className).toContain('max-sm:hidden');
    click('[data-today-chip="helping"]');
    click('[data-today-chip="do_now"]');
    expect(toggle.querySelector('[data-filter-count]')?.textContent).toBe('2');
    click('[data-today-views] [data-filter-toggle]');
    expect(panel.className).toContain('max-sm:flex');
    expect(panel.className).not.toContain('max-sm:hidden');
  });
});

describe('the Today block draws 5–7 rows, then Show all (V433)', () => {
  const many = Array.from({ length: 9 }, (_, i) =>
    task(`TSK-${i + 10}`, '2026-10-10', { group: 'overdue', starred: true }),
  );
  const rowsDrawn = () => document.querySelectorAll('[data-today-task]').length;
  it('draws seven of nine, keeps the true count on the box heading, and Show all draws the rest', async () => {
    await draw(many);
    expect(rowsDrawn()).toBe(7);
    expect(document.querySelector('[data-today-group="do_now"] [data-today-count]')?.textContent).toBe('9');
    const more = document.querySelector('[data-today-more]') as HTMLElement;
    expect(more.textContent).toBe('Show all (9)');
    click('[data-today-more]');
    expect(rowsDrawn()).toBe(9);
    expect((document.querySelector('[data-today-more]') as HTMLElement).textContent).toBe('Show fewer');
    click('[data-today-more]');
    expect(rowsDrawn()).toBe(7);
  });
  it('draws no Show all link when seven or fewer rows are left', async () => {
    await draw(many.slice(0, 7));
    expect(document.querySelector('[data-today-more]')).toBeNull();
    await draw();
    expect(document.querySelector('[data-today-more]')).toBeNull();
  });
  it('capRows keeps the first rows in the order drawn, reminders before tasks, and drops a group that is all cut', () => {
    const g = [
      { key: 'overdue', reminders: ['r1'], rows: ['a', 'b'] },
      { key: 'today', reminders: [], rows: ['c', 'd'] },
      { key: 'next', reminders: [], rows: ['e'] },
    ];
    expect(capRows(g, 4)).toEqual([
      { key: 'overdue', reminders: ['r1'], rows: ['a', 'b'], total: 3 },
      { key: 'today', reminders: [], rows: ['c'], total: 2 },
    ]);
    expect(capRows(g, 0)).toEqual([]);
  });
});

describe('the block helpers', () => {
  it('readTaskView keeps only known groups, in the block order; none means all', () => {
    expect(readTaskView({ groups: ['helping', 'nonsense', 'do_now', 'overdue'] })).toEqual(['do_now', 'helping']);
    expect(readTaskView({})).toEqual([]);
    expect(readTaskView(undefined)).toEqual([]);
  });
  it('helpingTasks lists the tasks I only help on, nearest day first', () => {
    const rows = [
      task('A', '2026-10-20', { role: 'helper' }),
      task('B', '2026-10-12', { role: 'helper' }),
      task('C', '2026-10-13'),
    ];
    expect(helpingTasks(rows).map((t) => t.number)).toEqual(['B', 'A']);
  });
});
