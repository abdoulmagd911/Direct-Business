import { beforeEach, describe, expect, it, vi } from 'vitest';

// W47: a tab of Settings or Activity asks the database for everything it shows in one round after me — never one read
// after another, since each server read may wait seconds at the gateway (W43). Every read here is held open until the
// test lets go: if the page waited for one before asking the next, the next would never start.
const started: string[] = [];
const held: (() => void)[] = [];
vi.mock('@/core/db/server-rpc', () => ({
  serverRpc: vi.fn((fn: string) => {
    started.push(fn);
    return new Promise((done) =>
      held.push(() =>
        done(fn === 'settings' ? { settings: [], can_edit: true } : fn === 'org' ? { departments: [] } : []),
      ),
    );
  }),
}));
vi.mock('@/core/auth/require-me', () => ({
  requireMe: vi.fn(async () => ({ person: { id: 'made-up-person' }, levels: { activity: 'full' }, is_admin: true })),
}));
vi.mock('@/ui/shell/nav', () => ({ isAdmin: () => true }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
const nothing = () => null;
vi.mock('@/modules/settings/screens/ActivityScreen', () => ({ ActivityScreen: nothing }));
vi.mock('@/modules/settings/screens/SettingsGroup', () => ({ SettingsGroup: nothing }));
vi.mock('@/modules/settings/screens/SettingsShell', () => ({ SettingsShell: nothing }));
vi.mock('@/modules/settings/screens/ListEditor', () => ({}));
vi.mock('@/modules/org/screens/OrgAccess', () => ({ OrgAccess: nothing }));
vi.mock('@/ui/DataState', () => ({ DataState: nothing }));
vi.mock('@/ui/PageHeader', () => ({ PageHeader: nothing }));
vi.mock('@/ui/shell/Page', () => ({ Page: nothing }));

const { default: ActivityPage } = await import('@/app/(app)/activity/page');
const { default: SettingsGroupPage } = await import('@/app/(app)/settings/[group]/page');
const { listsOf } = await import('@/modules/settings/groups');

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

describe('a tab asks for all its data in one round after me', () => {
  it('Activity: the organisation and the tab read together, on every tab', async () => {
    for (const [tab, read] of [
      ['changes', 'activity'],
      ['deleted', 'recently_deleted'],
      ['signIns', 'sign_in_log'],
      ['settings', 'settings_log'],
    ] as const) {
      started.length = 0;
      const round = await oneRound(() => ActivityPage({ searchParams: Promise.resolve({ tab }) }));
      expect(round.sort(), tab).toEqual(['org', read].sort());
    }
  });
  it('Settings: the settings, the organisation and every list together', async () => {
    const lists = listsOf('settings.partners');
    expect(lists.length, 'the partners group has lists').toBeGreaterThan(1);
    const round = await oneRound(() =>
      SettingsGroupPage({ params: Promise.resolve({ group: 'partners' }), searchParams: Promise.resolve({}) }),
    );
    expect(round.sort()).toEqual(['org', 'settings', ...lists.map(() => 'list')].sort());
  });
  it('Organization & access: the people and the access matrix in the same round', async () => {
    const round = await oneRound(() =>
      SettingsGroupPage({
        params: Promise.resolve({ group: 'org' }),
        searchParams: Promise.resolve({ tab: 'people' }),
      }),
    );
    expect(round).toEqual(expect.arrayContaining(['settings', 'org', 'people', 'access_matrix']));
  });
});
