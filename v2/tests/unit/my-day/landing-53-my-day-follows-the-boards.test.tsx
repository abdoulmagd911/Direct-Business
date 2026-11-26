// @vitest-environment jsdom
/**
 * Landing 53 — My day as the boards of the design session draw it (Batch 1 English, Batch 2 Arabic).
 *  1. The banner's day is written in full: "Friday, 13 November 2026", «الجمعة، 13 نوفمبر 2026».
 *  2. Today's three: each group has its plain sub-line; a row says its kind in a tag (the task's own type from Settings);
 *     a task finished today keeps its place, ticked, with no done button; the streak line counts the ticked rows.
 *  3. "The rest of today (N)" sits right under the three and opens grouped BY KIND — the board's kinds first, then any
 *     other type by name, Other last; a task with no type under Other; a follow-up reminder with the Follow-ups, marked
 *     "Only me"; a plain reminder under Reminders, first. A kind draws seven rows at most, then one "Show all".
 *  4. One switch turns it to BY PRIORITY — the four boxes, Do now · Plan it · Quick or hand off · Later — and back.
 * Names are made up. Sabotage: tests/sabotage/landing-53-my-day.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { restByKind, threeProgress, todaysThree } from '../../../src/modules/my-day/logic';
import { dayHeading } from '../../../src/modules/my-day/my-work';
import type { MyDayAnswer, PendingReminder, TodayTask } from '../../../src/modules/my-day/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/my-day' }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: 'p1' }, levels: {} }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({
  rpc: vi.fn(async (name: string) => (name === 'my_streak' ? { days: 6, today_done: 7, target: 3 } : [])),
}));
vi.mock('@/ui/Toast', () => ({ toast: new Proxy({}, { get: () => vi.fn(() => 't1') }) }));

const { MyDay } = await import('../../../src/modules/my-day/screens/MyDay');

const DAY = '2026-11-18';
const TYPES: Record<string, [string, string]> = {
  meeting: ['Meeting', 'اجتماع'],
  call: ['Call', 'مكالمة'],
  follow_up: ['Follow-up', 'متابعة'],
  made_up_kind: ['Made-up kind', 'نوع تجريبي'],
  other: ['Other', 'أخرى'],
};
const task = (n: number, type: string | null, extra: Partial<TodayTask> = {}): TodayTask => ({
  id: `id-${n}`,
  number: `TSK-${String(n).padStart(3, '0')}`,
  title: `Made-up task ${n}`,
  due_on: DAY,
  partner_id: null,
  partner_name: null,
  group: 'today',
  role: 'owner',
  type,
  type_en: type ? TYPES[type]![0] : null,
  type_ar: type ? TYPES[type]![1] : null,
  ...extra,
});
const three = {
  important: [
    task(1, 'meeting', { starred: true, done: true }),
    task(2, 'follow_up', { starred: true }),
    task(3, null),
  ],
  short: [task(4, 'call', { done: true })],
  maintenance: [],
  totals: { important: 3, short: 1, maintenance: 0 },
};
const rest = [
  task(11, null),
  task(12, 'made_up_kind'),
  task(13, 'call'),
  task(14, 'meeting', { due_on: '2026-11-20', group: 'next' }),
  task(15, 'meeting', { due_on: '2026-11-19', group: 'next' }),
  task(16, 'follow_up', { role: 'helper', group: 'helping' }),
  task(17, 'other'),
];
const reminders: PendingReminder[] = [
  { id: 'r-plain', note_id: null, remind_at: '2026-11-18T09:00:00+03:00', text: 'Made-up plain reminder' },
  {
    id: 'r-follow',
    note_id: null,
    remind_at: '2026-11-18T10:00:00+03:00',
    text: 'Follow-up',
    about: { entity: 'partner', id: 'pa-1', label: 'Made-up Rimal Authority' },
  },
];

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  window.localStorage.clear();
});
const draw = async (locale: 'en' | 'ar' = 'en', rows: TodayTask[] = rest, pending = reminders) => {
  const answer = {
    scope: 'me',
    day: DAY,
    notes: [],
    notes_total: 0,
    reminders: pending,
    since: [],
    more: false,
    tasks: [...three.important, ...three.short, ...rows],
    three,
  };
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
        <MyDay
          data={{
            title: dayHeading('2026-11-13T12:00:00+03:00', locale),
            myWork: null,
            scope: 'me',
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
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const one = (selector: string) => document.querySelector(selector);
const all = (selector: string) => [...document.querySelectorAll(selector)];
const text = (selector: string) => one(selector)?.textContent?.replace(/\s+/g, ' ').trim();
const press = async (selector: string) => {
  await act(async () => {
    (one(selector) as HTMLButtonElement).click();
  });
};

describe('the banner writes the day in full', () => {
  it('in English and in Arabic, Latin digits', () => {
    expect(dayHeading('2026-11-13T12:00:00+03:00', 'en')).toBe('Friday, 13 November 2026');
    expect(dayHeading('2026-11-13T12:00:00+03:00', 'ar')).toBe('الجمعة، 13 نوفمبر 2026');
    // Riyadh's day, whatever the clock elsewhere says
    expect(dayHeading('2026-11-13T22:30:00Z', 'en')).toBe('Saturday, 14 November 2026');
  });
});

describe("Today's three as the board draws it", () => {
  it('gives each group its plain sub-line, in both languages', async () => {
    await draw();
    expect(all('[data-three-sub]').map((p) => p.textContent)).toEqual([
      'Highest priority',
      'Under 15 minutes',
      'Routine tasks',
    ]);
    act(() => root?.unmount());
    document.body.innerHTML = '';
    await draw('ar');
    expect(text('[data-todays-three] h2')).toBe('ثلاث مهام اليوم');
    expect(all('[data-three-group] h3 span:first-child').map((p) => p.textContent)).toEqual([
      'مهمة',
      'سريعة',
      'روتينية',
    ]);
    expect(all('[data-three-sub]').map((p) => p.textContent)).toEqual([
      'أولوية قصوى',
      'أقل من 15 دقيقة',
      'مهام روتينية',
    ]);
  });

  it("says each row's kind in a tag — the task's own type, in the page's language — and none for a task without one", async () => {
    await draw();
    expect(text('[data-three-row="TSK-001"] [data-row-kind]')).toBe('Meeting');
    expect(text('[data-three-row="TSK-002"] [data-row-kind]')).toBe('Follow-up');
    expect(one('[data-three-row="TSK-003"] [data-row-kind]')).toBeNull();
    act(() => root?.unmount());
    document.body.innerHTML = '';
    await draw('ar');
    expect(text('[data-three-row="TSK-001"] [data-row-kind]')).toBe('اجتماع');
  });

  it('keeps a task finished today in its place, ticked, with nothing to press; an open row keeps its controls', async () => {
    await draw();
    expect(all('[data-three-group="important"] [data-three-row]').map((r) => r.getAttribute('data-three-row'))).toEqual(
      ['TSK-001', 'TSK-002', 'TSK-003'],
    );
    const done = one('[data-three-row="TSK-001"]')!;
    expect(done.hasAttribute('data-row-done')).toBe(true);
    expect(done.querySelector('button'), 'a done row has no button: neither a tick nor a star to press').toBeNull();
    expect(done.querySelector('[data-today-open]')?.className).toContain('line-through');
    const open = one('[data-three-row="TSK-002"]')!;
    expect(open.hasAttribute('data-row-done')).toBe(false);
    expect(open.querySelector('button[aria-label*="Made-up task 2"]'), 'an open row keeps its star').not.toBeNull();
  });

  it('counts the ticked rows in the streak line, beside the heading: "6-day streak · 2 of 4 done today"', async () => {
    await draw();
    expect(text('[data-streak-line]')).toBe('6-day streak · 2 of 4 done today');
    expect(threeProgress(todaysThree(three, []))).toEqual({ done: 2, total: 4 });
    act(() => root?.unmount());
    document.body.innerHTML = '';
    await draw('ar');
    expect(text('[data-streak-line]')).toBe('سلسلة 6 أيام · 2 من 4 مكتملة اليوم');
  });
});

describe('the rest of today, grouped by kind', () => {
  it('sits right under the three, headed with its count, and opens by kind', async () => {
    await draw();
    const order = all('[data-todays-three], [data-today-block], [data-waiting-nothing]');
    expect(order.indexOf(one('[data-today-block]')!)).toBe(order.indexOf(one('[data-todays-three]')!) + 1);
    // seven tasks and two reminders
    expect(text('[data-today-block] h2')).toBe('The rest of today (9)');
    expect(one('[data-today-block]')?.getAttribute('data-rest-view')).toBe('kind');
    expect(one('[data-today-views]'), 'no chips or saved views in the by-kind view').toBeNull();
  });

  it('orders the kinds as the board does, then any other type by name, Other last — each with its count', async () => {
    await draw();
    expect(all('[data-rest-kind] h3').map((h) => h.textContent)).toEqual([
      'Reminders 1',
      'Meetings 2',
      'Calls 1',
      'Follow-ups 2',
      'Made-up kind 1',
      'Other 2',
    ]);
    // inside a kind: the nearest due day first
    expect(all('[data-rest-kind="meeting"] [data-today-task]').map((r) => r.getAttribute('data-today-task'))).toEqual([
      'TSK-015',
      'TSK-014',
    ]);
    // a task with no type and a task typed Other share the one Other group
    expect(all('[data-rest-kind="other"] [data-today-task]').map((r) => r.getAttribute('data-today-task'))).toEqual([
      'TSK-011',
      'TSK-017',
    ]);
    // under its kind's heading a row does not repeat the kind in a tag
    expect(one('[data-rest-kind="meeting"] [data-row-kind]')).toBeNull();
  });

  it('lists a follow-up reminder with the Follow-ups, marked "Only me"; a task I only help on has nothing to press', async () => {
    await draw();
    const follow = one('[data-rest-kind="follow_up"]')!;
    expect(follow.querySelector('[data-today-reminder="r-follow"]')).not.toBeNull();
    expect(follow.querySelector('[data-today-reminder="r-follow"] [data-only-me]')?.textContent).toBe('Only me');
    expect(one('[data-rest-kind="reminders"] [data-today-reminder="r-plain"]')).not.toBeNull();
    expect(one('[data-today-task="TSK-016"] button'), 'not mine to finish or to star').toBeNull();
    expect(one('[data-today-task="TSK-013"] button')).not.toBeNull();
  });

  it('gives each kind its small icon, and mirrors the Follow-up arrow in Arabic only', async () => {
    await draw();
    expect(all('[data-rest-kind]').every((k) => k.querySelector('h3 [data-kind-icon]'))).toBe(true);
    expect(one('[data-kind-icon="follow_up"]')?.getAttribute('class')).not.toContain('-scale-x-100');
    act(() => root?.unmount());
    document.body.innerHTML = '';
    await draw('ar');
    expect(one('[data-kind-icon="follow_up"]')?.getAttribute('class')).toContain('-scale-x-100');
    expect(one('[data-kind-icon="meeting"]')?.getAttribute('class')).not.toContain('-scale-x-100');
  });

  it('names the kinds in Arabic', async () => {
    await draw('ar');
    expect(text('[data-today-block] h2')).toBe('بقية اليوم (9)');
    expect(all('[data-rest-kind] h3 span:first-of-type').map((h) => h.textContent)).toEqual([
      'التذكيرات',
      'اجتماعات',
      'مكالمات',
      'متابعات',
      'نوع تجريبي',
      'أخرى',
    ]);
  });

  it('draws seven rows of a kind at most, then one Show all for the block', async () => {
    const many = Array.from({ length: 9 }, (_, i) => task(30 + i, null));
    await draw('en', many, []);
    expect(all('[data-rest-kind="other"] [data-today-task]')).toHaveLength(7);
    expect(text('[data-rest-kind="other"] h3')).toBe('Other 9');
    expect(text('[data-rest-more]')).toBe('Show all (9)');
    await press('[data-rest-more]');
    expect(all('[data-rest-kind="other"] [data-today-task]')).toHaveLength(9);
    expect(text('[data-rest-more]')).toBe('Show fewer');
  });

  it('says "Nothing due today" when there is nothing left, and has no Show all', async () => {
    await draw('en', [], []);
    expect(text('[data-today-block] h2')).toBe('The rest of today (0)');
    expect(one('[data-today-block]')?.textContent).toContain('Nothing due today');
    expect(one('[data-rest-more]')).toBeNull();
  });

  it('groups by pure rule: restByKind', () => {
    const groups = restByKind(rest, [
      { id: 'x', about: null },
      { id: 'y', about: { label: 'Made-up' } },
    ]);
    expect(groups.map((g) => [g.key, g.rows.length, g.reminders.length])).toEqual([
      ['reminders', 0, 1],
      ['meeting', 2, 0],
      ['call', 1, 0],
      ['follow_up', 1, 1],
      ['made_up_kind', 1, 0],
      ['other', 2, 0],
    ]);
    expect(restByKind([], [])).toEqual([]);
  });
});

describe('one switch turns the rest of today to the four boxes and back', () => {
  it('by priority draws Do now · Plan it · Quick or hand off · Later with the chips; by kind draws the kinds again', async () => {
    await draw();
    expect(all('[data-rest-view-option]').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['By kind', 'true'],
      ['By priority', 'false'],
    ]);
    await press('[data-rest-view-option="priority"]');
    expect(one('[data-today-block]')?.getAttribute('data-rest-view')).toBe('priority');
    expect(one('[data-rest-kind]')).toBeNull();
    expect(all('[data-today-chip]').map((c) => c.getAttribute('data-today-chip'))).toEqual([
      'reminders',
      'do_now',
      'plan_it',
      'quick',
      'later',
      'helping',
    ]);
    expect(text('[data-today-chip="quick"]')).toBe('Quick or hand off 6');
    // in the boxes a row says its kind in a tag again
    expect(text('[data-today-task="TSK-013"] [data-row-kind]')).toBe('Call');
    await press('[data-rest-view-option="kind"]');
    expect(one('[data-rest-kind="meeting"]')).not.toBeNull();
    expect(one('[data-today-views]')).toBeNull();
  });

  it('remembers the choice in this browser', async () => {
    await draw();
    await press('[data-rest-view-option="priority"]');
    act(() => root?.unmount());
    document.body.innerHTML = '';
    await draw();
    expect(one('[data-today-block]')?.getAttribute('data-rest-view')).toBe('priority');
  });
});
