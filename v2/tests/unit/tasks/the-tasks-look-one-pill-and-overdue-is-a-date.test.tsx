/**
 * Landing 31 (the 15 Nov boards), drawn: a list row and a board card each show exactly ONE status pill; overdue is the
 * due date in the danger colour with the word "Overdue:" for a screen reader, never a pill; the List / Board / Calendar
 * switch keeps the tab and every filter in its links; the board's columns and the list's groups carry the same counts;
 * the open tab carries its number only while the rows are the whole tab. Every value is made up.
 * Sabotages: tests/sabotage/landing-31-tasks-look.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { TaskFilters } from '../../../src/modules/tasks/rules';
import { TaskListScreen } from '../../../src/modules/tasks/screens/TaskListScreen';
import { TasksSkeleton } from '../../../src/modules/tasks/screens/TasksSkeleton';
import { ME, OTHER, STATUSES, row } from './fixtures';

const me = vi.hoisted(() => ({ levels: {} as Record<string, string> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: '00000000-0000-4000-8000-000000000001' }, capabilities: [], levels: me.levels }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => []) }));

const PARTNER = '11111111-1111-4111-8111-111111111111';
const priorities = [{ id: 'p1', key: 'high', name_en: 'High', name_ar: 'عالية', sort: 1, active: true }];
const person = (id: string, name: string) => ({
  id,
  full_name_en: name,
  full_name_ar: null,
  badge_kind: 'none',
  badge_value: null,
});
const lookups = {
  statuses: STATUSES,
  priorities,
  org: { departments: [], teams: [], roles: [], people: [person(ME, 'Made-up Lama'), person(OTHER, 'Made-up Nawaf')] },
  partners: [{ id: PARTNER, number: 'ORG-0001', name_en: 'Made-up Partner Co', name_ar: null }],
  projects: [],
  failed: [],
} as never;

/** In progress, blocked, overdue since 2020, with a priority — the row that used to draw three chips. */
const loud = row({
  id: 't1',
  number: 'TSK-2026-0001',
  title: 'Made-up loud task',
  status: 'in_progress',
  status_en: 'In progress',
  meaning: 'in_progress',
  blocked_reason: 'a made-up wait',
  due_on: '2020-01-05',
  priority: 'high',
  priority_en: 'High',
  partner_id: PARTNER,
  work_type: 'client',
});
const calm = row({ id: 't2', number: 'TSK-2026-0002', title: 'Made-up calm task', due_on: '2099-03-09' });
const moving = row({
  id: 't3',
  number: 'TSK-2026-0003',
  title: 'Made-up moving task',
  status: 'in_progress',
  status_en: 'In progress',
  meaning: 'in_progress',
  owner_id: OTHER,
});
const finished = row({
  id: 't4',
  number: 'TSK-2026-0004',
  title: 'Made-up finished task',
  status: 'done',
  status_en: 'Done',
  meaning: 'done',
});
const ROWS = [loud, calm, moving, finished];

const draw = (filters: TaskFilters, rows = ROWS, locale: 'en' | 'ar' = 'en', more = false) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
      <TaskListScreen data={{ filters, list: { rows, total: rows.length, more }, lookups, adding: false }} />
    </NextIntlClientProvider>,
  );

/** One row's or one card's own markup: from its hook to the end of its <li>. */
const piece = (html: string, hook: string) => {
  const from = html.indexOf(hook);
  expect(from, `${hook} is drawn`).toBeGreaterThan(-1);
  return html.slice(from, html.indexOf('</li>', from));
};
const times = (s: string, re: RegExp) => s.match(re)?.length ?? 0;
/** The number in a data-count beside a hook, e.g. the Blocked column's. */
const countAt = (html: string, hook: string) => Number(new RegExp(`${hook}[^>]*data-count="(\\d+)"`).exec(html)?.[1]);

describe('a task on the list shows exactly one status pill', () => {
  const html = draw({ scope: 'my_work' });
  const rowOf = (number: string) => piece(html, `data-task-row="${number}"`);

  it('a blocked, overdue, prioritised task draws one pill, and it says Blocked', () => {
    const r = rowOf('TSK-2026-0001');
    expect(times(r, /data-task-pill=/g), 'one pill on the row').toBe(1);
    expect(r).toContain('data-task-pill="blocked"');
    expect(r).toContain('>Blocked<');
    // nothing else on the row is drawn as a chip of its own: no Overdue chip, no priority chip
    expect(times(r, />Overdue</g), 'no Overdue pill').toBe(0);
    expect(times(r, />High</g), 'no priority pill').toBe(0);
  });

  it('what left the pills is still on the row in words: the priority under the title', () => {
    expect(rowOf('TSK-2026-0001')).toContain('Priority: High');
    expect(rowOf('TSK-2026-0002')).not.toContain('Priority:');
  });

  it('every row has its one pill, with its status’s own name', () => {
    for (const [number, view, word] of [
      ['TSK-2026-0002', 'not_started', 'Not started'],
      ['TSK-2026-0003', 'in_progress', 'In progress'],
      ['TSK-2026-0004', 'done', 'Done'],
    ] as const) {
      const r = rowOf(number);
      expect(times(r, /data-task-pill=/g), `${number}: one pill`).toBe(1);
      expect(r).toContain(`data-task-pill="${view}"`);
      expect(r).toContain(`>${word}<`);
    }
  });

  it('the row names the partner and the Responsible person', () => {
    const r = rowOf('TSK-2026-0001');
    expect(r).toContain('Made-up Partner Co');
    expect(r).toContain('Made-up Lama');
    expect(rowOf('TSK-2026-0003')).toContain('Made-up Nawaf');
    expect(rowOf('TSK-2026-0002'), 'work with no partner or project is Internal').toContain('Internal');
  });
});

describe('overdue is the due date, not a pill', () => {
  const html = draw({ scope: 'my_work' });

  it('the overdue date is drawn in the danger colour and says "Overdue:" to a screen reader', () => {
    const r = piece(html, 'data-task-row="TSK-2026-0001"');
    expect(r).toContain('data-due="overdue"');
    const due = r.slice(r.indexOf('data-task-due="overdue"') - 200, r.indexOf('data-task-due="overdue"') + 600);
    expect(due).toContain('text-danger');
    expect(due).toMatch(/<span class="sr-only">Overdue: ?<\/span>\s*5 Jan 2020/);
  });

  it('a date that is not overdue is neither red nor called overdue', () => {
    const r = piece(html, 'data-task-row="TSK-2026-0002"');
    expect(r).toContain('9 Mar 2099');
    expect(r).not.toContain('text-danger');
    expect(r).not.toContain('Overdue');
  });

  it('in Arabic the word is the boards’ «متأخرة:»', () => {
    const r = piece(draw({ scope: 'my_work' }, ROWS, 'ar'), 'data-task-row="TSK-2026-0001"');
    expect(r).toContain('<span class="sr-only">متأخرة: </span>');
    expect(times(r, /data-task-pill=/g)).toBe(1);
  });
});

describe('a card on the board', () => {
  const html = draw({ scope: 'my_work', layout: 'board' });
  const card = (number: string) => piece(html, `data-board-card="${number}"`);

  it('shows exactly one status pill — the status menu — even when blocked and overdue', () => {
    const c = card('TSK-2026-0001');
    expect(times(c, /data-task-pill=/g), 'one pill on the card').toBe(1);
    expect(times(c, /data-task-status=/g), 'and it is the status control').toBe(1);
    expect(c).toContain('data-task-pill="blocked"');
    expect(times(c, />Overdue</g), 'no Overdue pill').toBe(0);
  });

  it('shows the partner, the due date (red when overdue) and the Responsible person', () => {
    const c = card('TSK-2026-0001');
    expect(c).toContain('Made-up Partner Co');
    expect(c).toMatch(/<span class="sr-only">Overdue: ?<\/span>\s*5 Jan 2020/);
    expect(c).toContain('text-danger');
    expect(c).toContain('Made-up Lama');
    expect(card('TSK-2026-0003')).toContain('Made-up Nawaf');
  });
});

describe('the board’s columns and the list’s groups count the same tasks', () => {
  it('each board column carries its count, a blocked task under Blocked, and they add up to the list', () => {
    const html = draw({ scope: 'my_work', layout: 'board' });
    const counts = ['not_started', 'in_progress', 'blocked', 'done', 'cancelled'].map((k) =>
      countAt(html, `data-board-column="${k}"`),
    );
    expect(counts).toEqual([1, 1, 1, 1, 0]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(ROWS.length);
  });

  it('the list’s group rows carry the same counts (a group with no task is not drawn)', () => {
    const html = draw({ scope: 'my_work' });
    for (const k of ['not_started', 'in_progress', 'blocked', 'done'])
      expect(countAt(html, `data-task-group="${k}"`), k).toBe(1);
    expect(html).not.toContain('data-task-group="cancelled"');
    expect(times(html, /data-task-row="/g)).toBe(ROWS.length);
  });
});

describe('switching between list, board and calendar keeps the tab and the filters', () => {
  const f: TaskFilters = { scope: 'team', status: 'open', due: 'week', partner: PARTNER, q: 'visa', sort: 'due' };
  /** The address of one layout link: its whole <a …> tag, whatever order its attributes are written in. */
  const href = (html: string, layout: string) => {
    const tag = (html.match(/<a [^>]*>/g) ?? []).find((a) => a.includes(`data-layout="${layout}"`));
    return /href="([^"]*)"/.exec(tag ?? '')?.[1]?.replaceAll('&amp;', '&');
  };

  it('each layout link carries the tab, every chip, the search and the sort', () => {
    const html = draw(f);
    const rest = `status=open&due=week&partner=${PARTNER}&q=visa&sort=due`;
    expect(href(html, 'board')).toBe(`/tasks?view=team&layout=board&${rest}`);
    expect(href(html, 'calendar')).toBe(`/tasks?view=team&layout=calendar&${rest}`);
    expect(href(html, 'list')).toBe(`/tasks?view=team&${rest}`);
  });

  it('and from the board the way back to the list keeps them too; the calendar stays reachable', () => {
    const html = draw({ ...f, layout: 'board' });
    expect(href(html, 'list')).toBe(`/tasks?view=team&status=open&due=week&partner=${PARTNER}&q=visa&sort=due`);
    expect(href(html, 'calendar')).toContain('layout=calendar');
    expect(html).toContain('data-layout-open="board"');
  });
});

describe('the count line and the open tab’s number', () => {
  it('the line counts the rows on screen: open, due today, overdue, done', () => {
    const html = draw({ scope: 'my_work' });
    expect(html).toContain('data-open="3"');
    expect(html).toMatch(/My work<\/b> · 3 open tasks · 0 due today · 1 overdue · 1 done/);
  });

  it('the open tab carries the open count while the rows are the whole tab', () => {
    expect(draw({ scope: 'my_work' })).toMatch(/My work (<[^>]+>)+3</);
  });

  it('and carries no number once a chip is on, or past the first page — a part is never shown as the whole', () => {
    expect(draw({ scope: 'my_work', status: 'open' })).not.toMatch(/My work (<[^>]+>)+3</);
    const paged = draw({ scope: 'my_work' }, ROWS, 'en', true);
    expect(paged).not.toMatch(/My work (<[^>]+>)+3</);
    expect(paged, 'nor a count line of the first page only').not.toContain('data-task-count-line');
  });
});

describe('the other states', () => {
  it('an empty tab says so in one line and offers Add task to someone who may add — on the list and on the board', () => {
    me.levels = { tasks: 'own' };
    for (const layout of [undefined, 'board'] as const) {
      const html = draw({ scope: 'my_work', layout }, []);
      expect(html).toContain('data-state="empty"');
      expect(html).toContain('No tasks yet.');
      expect(html).toContain('data-empty-add-task');
    }
    me.levels = {};
    expect(draw({ scope: 'my_work' }, []), 'not to someone who may not').not.toContain('data-empty-add-task');
  });

  it('the loading skeleton says what is loading, in the list’s shape or the board’s', () => {
    const list = renderToStaticMarkup(<TasksSkeleton label="Loading Tasks" />);
    expect(list).toContain('role="status"');
    expect(list).toContain('Loading Tasks');
    expect(list).toContain('data-tasks-skeleton="list"');
    expect(renderToStaticMarkup(<TasksSkeleton board label="Loading Tasks" />)).toContain(
      'data-tasks-skeleton="board"',
    );
  });
});
