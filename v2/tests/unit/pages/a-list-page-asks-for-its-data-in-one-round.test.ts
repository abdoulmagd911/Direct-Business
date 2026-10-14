import { beforeEach, describe, expect, it, vi } from 'vitest';

// W47 (V635): the three tabs people switch between most — My day, Tasks and Clients — ask the database for everything
// they show in one round after me, and the app says "Loading" at once. Every read is held open until the test lets
// go: if a page waited for one before asking the next, the next would never start. Made-up answers only.
const started: string[] = [];
const held: (() => void)[] = [];
const answer = (fn: string, args: unknown): unknown => {
  if (fn === 'org') return { people: [{ id: 'made-up-person', account: 'team_member' }], departments: [] };
  if (fn === 'partners') return { rows: [], total: 0, more: false };
  if (fn === 'tasks') return { rows: [], total: 0, more: false };
  if (fn === 'my_day') return { notes: [], reminders: [] };
  void args;
  return [];
};
vi.mock('@/core/db/server-rpc', () => ({
  serverRpc: vi.fn((fn: string, args: unknown) => {
    started.push(fn);
    return new Promise((done) => held.push(() => done(answer(fn, args))));
  }),
}));
const me = {
  person: { id: 'made-up-person' },
  levels: { tasks: 'full', clients: 'full', suppliers_partners: 'view', projects: 'view' },
  capabilities: [],
};
vi.mock('server-only', () => ({}));
vi.mock('@/core/auth/require-me', () => ({ requireMe: vi.fn(async () => me) }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (k: string) => k,
  getLocale: async () => 'en',
}));
const nothing = () => null;
vi.mock('@/modules/my-day/screens/MyDay', () => ({ MyDay: nothing }));
vi.mock('@/modules/tasks/screens/TaskListScreen', () => ({ TaskListScreen: nothing }));
vi.mock('@/modules/partners/screens/PartnersList', () => ({ PartnersList: nothing }));
vi.mock('@/ui/DataState', () => ({ DataState: nothing }));
vi.mock('@/ui/PageHeader', () => ({ PageHeader: nothing }));
vi.mock('@/ui/shell/Page', () => ({ Page: nothing }));

const { default: MyDayPage } = await import('@/app/(app)/my-day/page');
const { default: TasksPage } = await import('@/app/(app)/tasks/page');
const { PartnersListPage } = await import('@/modules/partners/screens/list-page');

/** Runs the page until no new read starts, then answers them all; the reads that had started by then. */
async function oneRound(render: () => Promise<unknown>): Promise<string[]> {
  const done = render();
  for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 0));
  const round = [...started];
  for (const let_go of held.splice(0)) let_go();
  await done;
  return round;
}

beforeEach(() => {
  started.length = 0;
  held.length = 0;
});

describe('a list page asks for all its data in one round after me', () => {
  it('My day: the day, the organisation, the statuses and the due reminders together, the organisation read once', async () => {
    const round = await oneRound(() => MyDayPage({ searchParams: Promise.resolve({}) }));
    expect(round.sort()).toEqual(['list', 'my_day', 'org', 'reminders_due']);
  });
  it('Tasks: the list, the statuses, the organisation, the clients and the projects together', async () => {
    const round = await oneRound(() => TasksPage({ searchParams: Promise.resolve({}) }));
    expect(round).toEqual(expect.arrayContaining(['tasks', 'list', 'org', 'partners', 'projects']));
    expect(round.filter((f) => f === 'org')).toHaveLength(1);
  });
  it("Clients: the list, the lookups and the other side's count together", async () => {
    const round = await oneRound(() => PartnersListPage({ side: 'client', searchParams: Promise.resolve({}) }));
    expect(round.sort()).toEqual(['list', 'list', 'list', 'org', 'partners', 'partners']);
  });
});
