// @vitest-environment jsdom
/**
 * Landing 57 — the owner's review of 26 Nov: "Tasks do not work or show as I expect." Four promises:
 *  1. Someone who gives work to others (`tasks.assign`: a manager, the admin account) opens the list on Team, where
 *     the work is; everyone else still opens on My work. The address names a tab only when it is not the person's own.
 *  2. An empty My work for someone who gives work says where the work is (Team) and goes there in one press.
 *  3. The list shows open tasks: done and cancelled ones are put away behind Show done (`?done=1`) — the count line
 *     still counts them, the board keeps its Done column, a Done or Cancelled chip still lists them, and a list whose
 *     every task is finished says so instead of "No tasks yet".
 *  4. A task Quick add leaves at Default, which the database gives to someone else, says who it went to.
 * Every value is made up.
 * Sabotages: tests/sabotage/landing-57.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import {
  filtersHref,
  hidesClosed,
  homeScope,
  parseFilters,
  queryFilters,
  savedQuery,
  type TaskFilters,
} from '../../../src/modules/tasks/rules';
import { ME, OTHER, STATUSES, row } from './fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
(globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
Element.prototype.scrollIntoView = () => {};

const TEAM = '33333333-3333-4333-8333-333333333333';
const { who, rpcMock, done } = vi.hoisted(() => ({
  who: { capabilities: [] as string[] },
  rpcMock: vi.fn(),
  done: [] as { title: string; description?: string }[],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({
    person: { id: ME, team_id: TEAM },
    capabilities: who.capabilities,
    levels: { tasks: 'full' },
  }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: rpcMock }));
vi.mock('@/ui/Toast', () => ({
  toast: {
    failed: () => {},
    done: (title: string, opts: { description?: string } = {}) => done.push({ title, description: opts.description }),
    working: () => {},
    dismiss: () => {},
  },
}));

const { TaskListScreen } = await import('../../../src/modules/tasks/screens/TaskListScreen');
const { QuickAddForm } = await import('../../../src/modules/tasks/screens/QuickAdd');

afterEach(() => {
  who.capabilities = [];
  rpcMock.mockReset();
  done.length = 0;
});

const person = (id: string, name: string) => ({
  id,
  full_name_en: name,
  full_name_ar: null,
  badge_kind: 'none',
  badge_value: null,
  team_id: TEAM,
});
const org = {
  departments: [],
  teams: [],
  roles: [],
  people: [person(ME, 'Made-up Lama'), person(OTHER, 'Made-up Nawaf')],
};
const lookups = { statuses: STATUSES, priorities: [], org, partners: [], projects: [], failed: [] } as never;

const open = row({ id: 't1', number: 'TSK-2026-0101', title: 'Made-up open task', due_on: '2099-03-09' });
const finished = row({
  id: 't2',
  number: 'TSK-2026-0102',
  title: 'Made-up finished task',
  status: 'done',
  status_en: 'Done',
  meaning: 'done',
});
const dropped = row({
  id: 't3',
  number: 'TSK-2026-0103',
  title: 'Made-up dropped task',
  status: 'cancelled',
  status_en: 'Cancelled',
  meaning: 'cancelled',
});

const draw = (filters: TaskFilters, rows = [open, finished, dropped]) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <TaskListScreen data={{ filters, list: { rows, total: rows.length, more: false }, lookups, adding: false }} />
    </NextIntlClientProvider>,
  );
const has = (html: string, hook: string) => html.includes(hook);

describe('1 · the list opens where the person’s work is', () => {
  it('someone who gives work to others opens on Team; everyone else on My work', () => {
    expect(homeScope(['tasks.assign'])).toBe('team');
    expect(homeScope([])).toBe('my_work');
    expect(parseFilters({}, homeScope(['tasks.assign'])).scope).toBe('team');
    expect(parseFilters({}).scope, 'with no home named, My work stays the default (My day reads it)').toBe('my_work');
  });

  it('the address names a tab only when it is not the person’s own', () => {
    const manager = parseFilters({}, 'team');
    expect(filtersHref(manager), 'Team is the manager’s bare list').toBe('/tasks');
    expect(filtersHref(manager, { scope: 'my_work' })).toBe('/tasks?view=my_work');
    expect(parseFilters({ view: 'my_work' }, 'team').scope, 'and that address opens My work again').toBe('my_work');
    const member = parseFilters({});
    expect(filtersHref(member)).toBe('/tasks');
    expect(filtersHref(member, { scope: 'team' })).toBe('/tasks?view=team');
  });

  it('a saved view never keeps the person’s own home tab', () => {
    expect(savedQuery(parseFilters({}, 'team'))).not.toHaveProperty('home');
    expect(savedQuery(parseFilters({}, 'team')).scope).toBe('team');
  });

  it('the Team tab is the open one on a manager’s bare list', () => {
    who.capabilities = ['tasks.assign'];
    const html = draw(parseFilters({}, 'team'));
    expect(html).toMatch(/aria-current="page"[^>]*>(?:<[^>]+>)*Team\b/);
    expect(html).not.toMatch(/aria-current="page"[^>]*>(?:<[^>]+>)*My work\b/);
  });
});

describe('2 · an empty My work says where the work is', () => {
  it('for someone who gives work: the work is under Team, and one button goes there', () => {
    who.capabilities = ['tasks.assign'];
    const html = draw(parseFilters({ view: 'my_work' }, 'team'), []);
    expect(html).toContain('Nothing is yours yet. Your team&#x27;s tasks are under Team.');
    expect(has(html, 'data-empty-open-team'), 'the Open Team button').toBe(true);
    expect(has(html, 'data-empty-add-task'), 'Add task stays').toBe(true);
  });

  it('for everyone else: the old line, with no Team button', () => {
    const html = draw(parseFilters({}), []);
    expect(html).toContain('No tasks yet.');
    expect(has(html, 'data-empty-open-team')).toBe(false);
  });
});

describe('3 · the list shows open tasks; Show done brings the rest back', () => {
  it('done and cancelled tasks are put away on the list, and the button says how many', () => {
    const html = draw(parseFilters({}));
    expect(has(html, 'data-task-row="TSK-2026-0101"'), 'the open task is listed').toBe(true);
    expect(has(html, 'data-task-row="TSK-2026-0102"'), 'the done task is put away').toBe(false);
    expect(has(html, 'data-task-row="TSK-2026-0103"'), 'the cancelled task is put away').toBe(false);
    expect(html).toMatch(/data-task-show-done="off"[^>]*>Show done \(2\)</);
  });

  it('the count line still counts the finished tasks', () => {
    expect(draw(parseFilters({}))).toMatch(/data-task-count-line[^>]*>[\s\S]*?1 done/);
  });

  it('Show done lists every task again, and the button then hides them', () => {
    const f = parseFilters({ done: '1' });
    expect(filtersHref(f)).toBe('/tasks?done=1');
    const html = draw(f);
    for (const n of ['0101', '0102', '0103']) expect(has(html, `data-task-row="TSK-2026-${n}"`), n).toBe(true);
    expect(html).toMatch(/data-task-show-done="on"[^>]*>Hide done</);
  });

  it('a Done or Cancelled chip, the board and Past work keep their finished tasks', () => {
    expect(hidesClosed(parseFilters({ status: 'done' }))).toBe(false);
    expect(has(draw(parseFilters({ status: 'done' })), 'data-task-row="TSK-2026-0102"')).toBe(true);
    expect(hidesClosed(parseFilters({ layout: 'board' }))).toBe(false);
    expect(has(draw(parseFilters({ layout: 'board' })), 'TSK-2026-0102')).toBe(true);
    expect(hidesClosed(parseFilters({ view: 'past' }))).toBe(false);
    expect(hidesClosed(parseFilters({}))).toBe(true);
  });

  it('a task ticked done on this list stays on screen, saying Done, until the list is left (V509)', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const paint = (rows: (typeof open)[]) =>
      act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
            <TaskListScreen
              data={{
                filters: parseFilters({}),
                list: { rows, total: rows.length, more: false },
                lookups,
                adding: false,
              }}
            />
          </NextIntlClientProvider>,
        );
      });
    await paint([open, finished]);
    expect(host.querySelector('[data-task-row="TSK-2026-0102"]'), 'first seen finished: put away').toBeNull();
    const ticked = row({ ...open, status: 'done', status_en: 'Done', meaning: 'done' });
    await paint([ticked, finished]);
    expect(host.querySelector('[data-task-row="TSK-2026-0101"]'), 'the ticked task is still listed').not.toBeNull();
    expect(host.querySelector('[data-task-row="TSK-2026-0102"]'), 'the old one stays put away').toBeNull();
    act(() => root.unmount());
    host.remove();
  });

  it('a saved view keeps Show done', () => {
    expect(queryFilters({ scope: 'my_work', done: true }).done).toBe(true);
  });

  it('a list whose every task is finished says so, never “No tasks yet”, and offers them back', () => {
    const html = draw(parseFilters({}), [finished, dropped]);
    expect(html).toContain('Every task here is done or cancelled.');
    expect(html).not.toContain('No tasks yet.');
    expect(has(html, 'data-empty-show-done'), 'Show done in the empty state').toBe(true);
  });
});

describe('4 · Quick add says who a task left at Default went to', () => {
  let root: Root | null = null;
  const mount = async (node: ReactNode) => {
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
          {node}
        </NextIntlClientProvider>,
      );
    });
  };
  const typeTitle = async (value: string) => {
    const el = document.querySelector('input[name="title"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const press = () =>
    act(async () => {
      (document.querySelector('[data-quick-add]') as HTMLFormElement).requestSubmit();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    });
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
  });
  const form = <QuickAddForm org={org as never} partners={[]} projects={[]} priorities={[]} onClose={() => {}} />;

  it('the database gave it to someone else: their name, and where to find it', async () => {
    rpcMock.mockImplementation(async (fn: string) =>
      fn === 'task_create' ? { id: 'made-up-id', number: 'TSK-2026-0104', request_id: null } : { owner_id: OTHER },
    );
    await mount(form);
    await typeTitle('Made-up task for a made-up client');
    await press();
    expect(rpcMock.mock.calls.map((c) => c[0])).toEqual(['task_create', 'task']);
    expect(done).toContainEqual({
      title: 'It went to Made-up Nawaf',
      description: 'It is under Team, not in your My work.',
    });
  });

  it('it stayed with the person adding it: nothing more is said', async () => {
    rpcMock.mockImplementation(async (fn: string) =>
      fn === 'task_create' ? { id: 'made-up-id', number: 'TSK-2026-0105', request_id: null } : { owner_id: ME },
    );
    await mount(form);
    await typeTitle('Made-up task of my own');
    await press();
    expect(done.map((d) => d.title)).not.toContainEqual(expect.stringContaining('It went to'));
  });
});
