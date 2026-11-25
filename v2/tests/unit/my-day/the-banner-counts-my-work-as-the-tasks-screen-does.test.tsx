/**
 * Landing 31 — the My day banner (the 15 Nov board: "The banner counts My work, the same name and the same number as
 * the Tasks tab, and says so"). The banner's number is read from the Tasks list's own door with the very filter the
 * Tasks page sends for its My work tab, the banner says what the number counts, and no number is drawn when it was
 * not read. Also the look this landing adds around it: the day as the boards write it, Capture on the banner from
 * 640 px up, and a named × on the date chip, the link chip and the picked organisation, 44 px on a phone.
 * Every name and number is made up. Sabotage: tests/sabotage/landing-31-my-day.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

const calls: { fn: string; args: Record<string, unknown> }[] = [];
const TOTAL = 15;
// made-up rows: 15 open (9 mine, 6 I help on) and 4 that are not open — the tab's number is the open ones
const row = (meaning: string, owner_id: string) => ({ meaning, owner_id, due_on: null, past_work: false });
const ROWS = [
  ...Array.from({ length: 9 }, () => row('not_started', 'made-up-person')),
  ...Array.from({ length: 6 }, () => row('in_progress', 'someone-else')),
  row('done', 'made-up-person'),
  row('done', 'made-up-person'),
  row('cancelled', 'made-up-person'),
  row('done', 'someone-else'),
];
let tasksFail = false;
vi.mock('@/core/db/server-rpc', () => ({
  serverRpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    if (fn === 'org') return { people: [{ id: 'made-up-person', account: 'team_member' }], departments: [] };
    if (fn === 'tasks') {
      if (tasksFail) throw new Error('made-up failure');
      return { rows: ROWS, total: ROWS.length, more: false };
    }
    if (fn === 'my_day') return { day: '2026-11-15', notes: [], reminders: [], since: [], more: false };
    return [];
  }),
}));
const me = {
  person: { id: 'made-up-person' },
  levels: { tasks: 'full', my_day: 'full' } as Record<string, string>,
  capabilities: [],
};
vi.mock('server-only', () => ({}));
vi.mock('@/core/auth/require-me', () => ({ requireMe: vi.fn(async () => me) }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (k: string) => k,
  getLocale: async () => 'en',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/my-day' }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: 'made-up-person' }, levels: {} }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => []) }));
vi.mock('@/modules/tasks/screens/TaskListScreen', () => ({ TaskListScreen: () => null }));
vi.mock('@/ui/shell/Page', () => ({ Page: ({ children }: { children: unknown }) => children }));

const { default: TasksPage } = await import('@/app/(app)/tasks/page');
const { default: MyDayPage } = await import('@/app/(app)/my-day/page');
const { myWorkCount } = await import('@/modules/my-day/server');
const { dayHeading, myWorkFilter } = await import('@/modules/my-day/my-work');
const { workCount } = await import('@/modules/tasks/my-work-count');
const { DayBanner } = await import('@/modules/my-day/screens/DayBanner');
const { MyDay } = await import('@/modules/my-day/screens/MyDay');
const { TitleDateChip } = await import('@/modules/my-day/screens/TitleDateChip');
const { PartnerPicker } = await import('@/modules/my-day/screens/PartnerPicker');

const draw = (node: ReactElement, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );
const tasksAsks = () => calls.filter((c) => c.fn === 'tasks');
/** The element that carries a marker, opening tag only. */
const tag = (html: string, marker: string) => html.match(new RegExp(`<[^>]*${marker}[^>]*>`))?.[0] ?? '';

/** What the My day page hands its screen (the page is `<Page><MyDay data /></Page>`). */
async function myDayData(): Promise<{ myWork: number | null }> {
  const page = (await MyDayPage({ searchParams: Promise.resolve({}) })) as ReactElement<{
    children: ReactElement<{ data: { myWork: number | null } }>;
  }>;
  return page.props.children.props.data;
}

beforeEach(() => {
  calls.length = 0;
  tasksFail = false;
  me.levels = { tasks: 'full', my_day: 'full' };
});

describe('the My day banner counts My work, the same count as the Tasks screen’s My work tab', () => {
  it('asks the Tasks door with the very filter the Tasks page sends for My work, and counts its open tasks as the tab does', async () => {
    await TasksPage({ searchParams: Promise.resolve({}) });
    const [fromTasks] = tasksAsks();
    expect(fromTasks, 'the Tasks page read its list').toBeDefined();
    calls.length = 0;

    expect(await myWorkCount(me as never), 'the count is the tab’s: the open tasks').toBe(TOTAL);
    expect(
      workCount(ROWS as never, '2026-11-15', 'made-up-person').open,
      'the Tasks tab’s own function says the same',
    ).toBe(TOTAL);
    const [fromBanner] = tasksAsks();
    expect(fromBanner?.args.p_filter, 'the same filter as the My work tab').toEqual(fromTasks!.args.p_filter);
    expect(myWorkFilter()).toEqual(fromTasks!.args.p_filter);
    expect(myWorkFilter().scope, 'and that filter is My work').toBe('my_work');
  });

  it('gives My day that count, read in the same round as the page', async () => {
    expect((await myDayData()).myWork).toBe(TOTAL);
    expect(tasksAsks()).toHaveLength(1);
  });

  it('asks nothing and says no number for someone who may not open Tasks', async () => {
    me.levels = { tasks: 'none', my_day: 'full' };
    expect((await myDayData()).myWork).toBeNull();
    expect(tasksAsks()).toHaveLength(0);
  });

  it('never makes a number out of a read that failed', async () => {
    tasksFail = true;
    expect(await myWorkCount(me as never)).toBeNull();
    expect((await myDayData()).myWork).toBeNull();
  });
});

describe('the banner says what it counts', () => {
  it('names My work beside the number, in English and in Arabic', () => {
    const html = draw(<DayBanner heading="Sun 15 Nov 2026" myWork={15} />);
    expect(html).toContain('My work · 15 open tasks');
    expect(html).toContain('data-banner-count="15"');
    expect(draw(<DayBanner heading="Sun 15 Nov 2026" myWork={1} />)).toContain('My work · 1 open task<');
    expect(draw(<DayBanner heading="Sun 15 Nov 2026" myWork={0} />)).toContain('My work · 0 open tasks');
    expect(draw(<DayBanner heading="الأحد، 15 نوفمبر 2026" myWork={15} />, 'ar')).toContain('عملي · 15 مهمة مفتوحة');
    expect(draw(<DayBanner heading="الأحد، 15 نوفمبر 2026" myWork={3} />, 'ar')).toContain('عملي · 3 مهام مفتوحة');
  });
  it('uses the name the Tasks tab has', () => {
    expect(en.pages.myDay.banner.myWork.startsWith(en.pages.tasks.views.my_work)).toBe(true);
    expect(ar.pages.myDay.banner.myWork.startsWith(ar.pages.tasks.views.my_work)).toBe(true);
  });
  it('draws no number when the count was not read', () => {
    const html = draw(<DayBanner heading="Sun 15 Nov 2026" myWork={null} />);
    expect(html).not.toContain('data-banner-count');
    expect(html).not.toContain('My work');
    expect(html).toContain('Sun 15 Nov 2026');
  });
  it('is the one gradient of the look, with the day as the page’s heading', () => {
    const html = draw(<DayBanner heading="Sun 15 Nov 2026" myWork={2} />);
    expect(tag(html, 'data-day-banner')).toContain('banner-fill');
    expect(html).toMatch(/<h1[^>]*data-day-heading[^>]*>Sun 15 Nov 2026<\/h1>/);
  });
  it('writes the day as the boards do', () => {
    const noon = '2026-11-15T12:00:00+03:00';
    expect(dayHeading(noon, 'en')).toBe('Sunday, 15 November 2026');
    expect(dayHeading(noon, 'ar')).toBe('الأحد، 15 نوفمبر 2026');
  });
});

describe('My day wears the banner', () => {
  const data = {
    title: 'Sun 15 Nov 2026',
    myWork: 15,
    scope: 'me' as const,
    answer: { day: '2026-11-15', notes: [], reminders: [], since: [], more: false } as never,
    all: false,
    people: [],
    statuses: [],
    due: { due: [], next_at: null },
    asks: { to_me: [], by_me: [] },
    escalated: [],
    escalatedByMe: [],
    unlogged: null,
  };
  const html = draw(<MyDay data={data} />);
  it('with the count, Wrap up, and Capture from 640 px up (a phone keeps the + as its one add control)', () => {
    const banner = html.slice(html.indexOf('data-day-banner'), html.indexOf('</header>'));
    expect(banner).toContain('My work · 15 open tasks');
    expect(banner).toContain('data-wrap-open');
    expect(tag(banner, 'data-capture-open')).toContain('max-sm:hidden');
    expect(banner).toMatch(/data-capture-open[^>]*>.*Capture<\/button>/s);
  });
  it('keeps its buttons off the words: the row wraps and the buttons never shrink', () => {
    expect(tag(html, 'data-day-banner')).toContain('flex-wrap');
    expect(tag(html, 'data-banner-actions')).toContain('shrink-0');
  });
  it('on the other tabs keeps the banner and its count, without the two buttons', () => {
    const team = draw(<MyDay data={{ ...data, scope: 'team' as const }} />);
    expect(team).toContain('My work · 15 open tasks');
    expect(team).not.toContain('data-wrap-open');
    expect(team).not.toContain('data-capture-open');
  });
});

describe('a chip in Capture has a named × that is 44 px on a phone', () => {
  it('the date read from the words', () => {
    const read = { day: '2026-11-17', time: '18:00', found: 'tomorrow 6pm' } as never;
    const html = draw(<TitleDateChip read={read} what="reminder" onRemove={() => undefined} />);
    const x = tag(html, 'data-title-date-remove');
    expect(x).toContain('aria-label="Remove date"');
    expect(x).toMatch(/\bsize-11\b/);
    const arX = tag(
      draw(<TitleDateChip read={read} what="reminder" onRemove={() => undefined} />, 'ar'),
      'data-title-date-remove',
    );
    expect(arX).toContain('aria-label="إزالة التاريخ"');
  });
  it('the picked organisation, named in the button', () => {
    const picked = { id: 'made-up-id', number: 'C-0001', trade_name_en: 'Dune Foods', trade_name_ar: 'أغذية الكثبان' };
    const x = tag(
      draw(<PartnerPicker value={picked as never} onChange={() => undefined} />),
      'data-partner-picked-remove',
    );
    expect(x).toContain('aria-label="Remove Dune Foods"');
    expect(x).toContain('max-sm:size-11');
    const arX = tag(
      draw(<PartnerPicker value={picked as never} onChange={() => undefined} />, 'ar'),
      'data-partner-picked-remove',
    );
    expect(arX).toContain('aria-label="إزالة أغذية الكثبان"');
  });
});
