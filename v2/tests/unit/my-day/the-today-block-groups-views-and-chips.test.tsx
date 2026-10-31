// @vitest-environment jsdom
/**
 * P5-7: the Today block draws Overdue, Due today, Next 7 days and Helping; the tasks I only help on sit in Helping with no
 * done tick (they are not mine to finish); a chip per group shows only the groups pressed (the chips say "Show only", and
 * Helping is a control once); the one fixed view, All, clears them; Save view has an icon and says what it keeps; a saved view marked as my default opens on its groups. Names are made up.
 * Sabotage: tests/sabotage/my-day-task-groups.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { helpingTasks, readTaskView } from '../../../src/modules/my-day/logic';
import type { TodayTask } from '../../../src/modules/my-day/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let saved: unknown[] = [];
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: 'p1' }, levels: {} }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => saved) }));

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
const tasks = [
  task('TSK-1', '2026-10-10', { group: 'overdue' }),
  task('TSK-2', '2026-10-14', { group: 'today' }),
  task('TSK-3', '2026-10-16', { group: 'next' }),
  task('TSK-4', '2026-10-15', { group: 'helping', role: 'helper' }),
];

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  saved = [];
});
const draw = async () => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <TodayBlock tasks={tasks} day="2026-10-14" statuses={[]} due={{ due: [], next_at: null }} />
      </NextIntlClientProvider>,
    );
  });
};
const groups = () =>
  [...document.querySelectorAll('[data-today-group]')].map((g) => g.getAttribute('data-today-group'));
const click = (selector: string) => act(() => (document.querySelector(selector) as HTMLElement).click());

describe('the Today block: groups, chips and views', () => {
  it('draws all four groups, Helping last, and no done tick on a task I only help on', async () => {
    await draw();
    expect(groups()).toEqual(['overdue', 'today', 'next', 'helping']);
    const helping = document.querySelector('[data-today-group="helping"]')!;
    expect(helping.textContent).toContain('Made-up task TSK-4');
    // a task of mine draws the round tick (here the plain circle, as no statuses are given); a helped one draws none
    expect(helping.querySelector('[data-today-task] > span[aria-hidden="true"]')).toBeNull();
    expect(
      document.querySelector('[data-today-group="today"] [data-today-task] > span[aria-hidden="true"]'),
    ).not.toBeNull();
  });
  it('a chip shows only the groups pressed, and pressing it again shows all four again', async () => {
    await draw();
    click('[data-today-chip="helping"]');
    expect(groups()).toEqual(['helping']);
    click('[data-today-chip="overdue"]');
    expect(groups()).toEqual(['overdue', 'helping']);
    click('[data-today-chip="helping"]');
    click('[data-today-chip="overdue"]');
    expect(groups()).toEqual(['overdue', 'today', 'next', 'helping']);
  });
  it('has one view of its own, All, which clears the chips; the chips are the only place Helping is a choice', async () => {
    await draw();
    expect(
      [...document.querySelectorAll('[data-saved-views] [data-view]')].map((b) => b.getAttribute('data-view')),
    ).toEqual(['all']);
    click('[data-today-chip="helping"]');
    click('[data-view="all"]');
    expect(groups()).toHaveLength(4);
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
        query: { groups: ['overdue'] },
        shared: false,
        sort: 0,
        owner_id: 'p1',
        mine: true,
        default: true,
        version: 1,
      },
    ];
    await draw();
    expect(groups()).toEqual(['overdue']);
  });
});

describe('the block helpers', () => {
  it('readTaskView keeps only known groups, in the block order; none means all', () => {
    expect(readTaskView({ groups: ['helping', 'nonsense', 'overdue'] })).toEqual(['overdue', 'helping']);
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
