/**
 * Landing 35, item 1 (the owner's live sweep of 21 Nov): "`?layout=board` still shows the List's stacked status
 * groups, one under the other — I want a real board with horizontal kanban columns."
 *  - The board is ONE ROW of columns at every width: it never wraps a column under another, it scrolls sideways inside
 *    its own frame, and on a phone it snaps to one column at a time. (The measuring is the browser spec's,
 *    tests/e2e/landing-35-tasks.spec.ts; here the drawing is pinned.)
 *  - A column keeps its name and count above its cards, and the cards scroll inside the column — every card is drawn,
 *    none is folded away.
 *  - A card says the task's number, its star when it has one, its title, its Responsible person and its due day.
 *  - `?layout=board` is kept: a person's default saved view opens only on the bare list, and a saved view that names
 *    no layout keeps the one on screen.
 * Every value is made up.
 * Sabotages: tests/sabotage/landing-35-tasks.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { defaultViewOpens, filtersHref, viewFilters, type TaskFilters } from '../../../src/modules/tasks/rules';
import { TaskListScreen } from '../../../src/modules/tasks/screens/TaskListScreen';
import { TasksSkeleton } from '../../../src/modules/tasks/screens/TasksSkeleton';
import { ME, OTHER, STATUSES, row } from './fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: '00000000-0000-4000-8000-000000000001' }, capabilities: [], levels: {} }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => []) }));

const person = (id: string, name: string) => ({
  id,
  full_name_en: name,
  full_name_ar: null,
  badge_kind: 'none',
  badge_value: null,
});
const lookups = {
  statuses: STATUSES,
  priorities: [],
  org: { departments: [], teams: [], roles: [], people: [person(ME, 'Made-up Lama'), person(OTHER, 'Made-up Nawaf')] },
  partners: [],
  projects: [],
  failed: [],
} as never;

const starred = row({
  id: 'b1',
  number: 'TSK-2026-0101',
  title: 'Made-up starred task',
  starred: true,
  due_on: '2099-03-09',
  owner_id: OTHER,
});
const plain = row({ id: 'b2', number: 'TSK-2026-0102', title: 'Made-up plain task' });
/** A long column: thirty made-up finished tasks. */
const finished = Array.from({ length: 30 }, (_, i) =>
  row({
    id: `d${i}`,
    number: `TSK-2026-02${String(i).padStart(2, '0')}`,
    title: `Made-up finished task ${i}`,
    status: 'done',
    status_en: 'Done',
    meaning: 'done',
  }),
);
const ROWS = [starred, plain, ...finished];

const draw = (filters: TaskFilters, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
      <TaskListScreen
        data={{ filters, list: { rows: ROWS, total: ROWS.length, more: false }, lookups, adding: false }}
      />
    </NextIntlClientProvider>,
  );

/** The class list of the first element that carries `hook`. */
const classesAt = (html: string, hook: string): string[] => {
  const tag = (html.match(/<[a-z0-9]+ [^>]*>/g) ?? []).find((x) => x.includes(hook));
  expect(tag, `${hook} is drawn`).toBeTruthy();
  return (/class="([^"]*)"/.exec(tag ?? '')?.[1] ?? '').split(/\s+/);
};
/** One column's own markup. */
const column = (html: string, key: string) => {
  const from = html.indexOf(`data-board-column="${key}"`);
  expect(from, `the ${key} column is drawn`).toBeGreaterThan(-1);
  return html.slice(from, html.indexOf('</section>', from));
};
const card = (html: string, number: string) => {
  const from = html.indexOf(`data-board-card="${number}"`);
  expect(from, `the card ${number} is drawn`).toBeGreaterThan(-1);
  return html.slice(from, html.indexOf('</li>', from));
};
const times = (s: string, re: RegExp) => s.match(re)?.length ?? 0;

describe('the board is one row of columns', () => {
  const html = draw({ scope: 'team', layout: 'board' });

  it('the address ?layout=board draws the board and not the list’s groups', () => {
    expect(html).toContain('data-layout-open="board"');
    expect(html).toContain('data-task-board');
    expect(html).not.toContain('data-task-group=');
    expect(html).not.toContain('data-task-rows');
  });

  it('the columns stand side by side in one row that never wraps one under another', () => {
    const frame = classesAt(html, 'data-task-board');
    expect(frame, 'a row').toContain('flex');
    expect(frame, 'not a column').not.toContain('flex-col');
    expect(frame, 'never wrapped').not.toContain('flex-wrap');
    expect(
      frame.filter((c) => /(^|:)grid/.test(c)),
      'not a grid that folds to one or two columns',
    ).toEqual([]);
    // a column keeps its width instead of being squeezed, so five of them stay five in a row
    const col = classesAt(html, 'data-board-column="not_started"');
    expect(col).toContain('shrink-0');
    expect(col).toContain('sm:min-w-[15rem]');
  });

  it('the row scrolls sideways inside its own frame, so the page does not', () => {
    const frame = classesAt(html, 'data-task-board');
    expect(frame).toContain('overflow-x-auto');
    expect(frame).toContain('min-w-0');
    expect(frame).toContain('max-w-full');
  });

  it('on a phone the row snaps to one column at a time', () => {
    const frame = classesAt(html, 'data-task-board');
    expect(frame).toContain('snap-x');
    expect(frame).toContain('snap-mandatory');
    const col = classesAt(html, 'data-board-column="not_started"');
    expect(col).toContain('snap-start');
    expect(col).toContain('snap-always');
    expect(col, 'a column is nearly the screen wide: the next one shows its edge').toContain('w-[calc(100%-2.5rem)]');
  });

  it('there is one column per status, in the settings’ order, Blocked after In progress — the same in Arabic', () => {
    const order = (h: string) => [...h.matchAll(/data-board-column="([^"]+)"/g)].map((m) => m[1]);
    expect(order(html)).toEqual(['not_started', 'in_progress', 'blocked', 'done', 'cancelled']);
    // the order in the page is the same; the row itself runs from the right under dir="rtl" (no order is forced)
    const arabic = draw({ scope: 'team', layout: 'board' }, 'ar');
    expect(order(arabic)).toEqual(['not_started', 'in_progress', 'blocked', 'done', 'cancelled']);
    const frame = classesAt(arabic, 'data-task-board');
    expect(frame.filter((c) => /flex-row-reverse|order-/.test(c))).toEqual([]);
  });
});

describe('a column keeps its header and scrolls its own cards', () => {
  const html = draw({ scope: 'team', layout: 'board' });
  const doneColumn = () => column(html, 'done');

  it('the header says the status and its count, and stays above the cards', () => {
    const done = doneColumn();
    expect(html).toMatch(/data-board-column="done"[^>]*data-count="30"/);
    const head = done.slice(done.indexOf('data-board-column-head'), done.indexOf('data-board-cards'));
    expect(head).toContain('Done');
    expect(head).toMatch(/>30</);
    expect(done.indexOf('data-board-column-head'), 'the header is not inside the scrolling cards').toBeLessThan(
      done.indexOf('<ul'),
    );
  });

  it('a long column scrolls inside itself and is no taller than the screen has room for', () => {
    const done = doneColumn();
    const cards = classesAt(done, 'data-board-cards');
    expect(cards).toContain('overflow-y-auto');
    expect(cards).toContain('min-h-0');
    const col = classesAt(html, 'data-board-column="done"');
    expect(
      col.some((c) => c.startsWith('max-h-[')),
      'the column has a height limit',
    ).toBe(true);
  });

  it('every card of a long column is drawn — none is folded away', () => {
    const done = doneColumn();
    expect(times(done, /data-board-card="/g)).toBe(30);
    expect(done).not.toContain('max-sm:hidden');
    expect(html).not.toContain('data-board-see-all');
  });
});

describe('a card says the task in short', () => {
  const html = draw({ scope: 'team', layout: 'board' });

  it('the number, the title, the Responsible person and the due day', () => {
    const c = card(html, 'TSK-2026-0101');
    expect(c).toMatch(/data-board-card-number[^>]*>TSK-2026-0101</);
    expect(c).toContain('Made-up starred task');
    expect(c).toContain('Made-up Nawaf');
    expect(c).toContain('9 Mar 2099');
    expect(times(c, /data-task-pill=/g), 'and still one pill').toBe(1);
  });

  it('the star is drawn on a starred task and on no other', () => {
    expect(card(html, 'TSK-2026-0101')).toContain('data-star="mark"');
    expect(card(html, 'TSK-2026-0102')).not.toContain('data-star=');
  });
});

describe('the address keeps the board', () => {
  const board: TaskFilters = { scope: 'team', layout: 'board' };

  it('a default saved view opens only on the bare list, never over an address that chose something', () => {
    expect(defaultViewOpens({ scope: 'my_work' })).toBe(true);
    expect(defaultViewOpens({ scope: 'my_work', layout: 'board' }), '?layout=board is kept').toBe(false);
    expect(defaultViewOpens({ scope: 'team' })).toBe(false);
    expect(defaultViewOpens({ scope: 'my_work', q: 'visa' })).toBe(false);
    expect(defaultViewOpens({ scope: 'my_work', status: 'open' })).toBe(false);
  });

  it('a saved view that names no layout keeps the board on screen', () => {
    expect(filtersHref(board, viewFilters(board, { scope: 'owned', status: 'open' }))).toBe(
      '/tasks?view=owned&layout=board&status=open',
    );
  });

  it('a saved view that names a layout opens in its own, and still replaces every filter', () => {
    const on: TaskFilters = { ...board, q: 'visa', due: 'week' };
    expect(filtersHref(on, viewFilters(on, { scope: 'owned', layout: 'calendar', month: '2099-03' }))).toBe(
      '/tasks?view=owned&layout=calendar&month=2099-03',
    );
    expect(filtersHref(on, viewFilters(on, { scope: 'owned' }))).toBe('/tasks?view=owned&layout=board');
  });

  it('every layout link on the board keeps the tab, on every tab that offers the switch', () => {
    for (const scope of ['my_work', 'owned', 'helping', 'team'] as const) {
      const h = draw({ scope, layout: 'board' });
      const tag = (h.match(/<a [^>]*>/g) ?? []).find((a) => a.includes('data-layout="board"')) ?? '';
      expect(tag, scope).toContain('aria-current="page"');
      expect(/href="([^"]*)"/.exec(tag)?.[1]?.replaceAll('&amp;', '&'), scope).toBe(
        filtersHref({ scope, layout: 'board' }),
      );
    }
  });
});

describe('the board while it loads', () => {
  it('is drawn as columns in one row too, not stacked', () => {
    const html = renderToStaticMarkup(<TasksSkeleton board label="Loading tasks" />);
    expect(html).toContain('data-tasks-skeleton="board"');
    expect(html, 'no grid that folds to one or two columns').not.toMatch(/grid-cols/);
    expect(html).toContain('class="flex min-w-0 items-start gap-3 overflow-hidden"');
  });
});
