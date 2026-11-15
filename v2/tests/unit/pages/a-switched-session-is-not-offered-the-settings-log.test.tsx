/**
 * Landing 28: while signed in as a test user the Activity page does not offer the settings log. api.settings_log
 * begins with authz.require_admin(), which refuses every switched session (42501 test_switch.no_access_change)
 * whatever the test user's role; the page offered the tab by role and awaited its reads with no catch, so the refusal
 * drew the full-page error. Now the address lands on the default tab, the read is never sent, the tab is not drawn —
 * and a read that does fail leaves the page standing, saying which kind of failure it was. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';
import { DbError } from '../../../src/core/db/errors';

const { calls, state } = vi.hoisted(() => ({
  calls: [] as string[],
  state: { switched: true, refuse: '' },
}));

const admin = (switched: boolean) =>
  ({
    status: 'ok',
    session: {
      device_id: 'd1',
      signed_in_at: '2026-11-01T00:00:00Z',
      last_seen_at: '2026-11-01T00:00:00Z',
      email: 'made.up@example.test',
    },
    person: {
      id: 'made-up-person',
      kind: 'staff',
      full_name_en: 'Made Up Admin',
      full_name_ar: null,
      nickname_en: null,
      nickname_ar: null,
      job_title_en: null,
      job_title_ar: null,
      department_id: 'd1',
      team_id: null,
      manager_id: null,
      role: { id: 'r1', key: 'admin', name_en: 'Admin', name_ar: null, is_admin: true },
    },
    levels: { activity: 'full', 'settings.org': 'full' },
    capabilities: [],
    departments: [],
    profile: null,
    test_switch: switched
      ? { by_id: 'made-up-owner', by_name_en: 'Made Up Owner', by_name_ar: null, since: '2026-11-15T09:00:00Z' }
      : null,
  }) as unknown as Me;

vi.mock('server-only', () => ({}));
vi.mock('@/core/db/server-rpc', () => ({
  serverRpc: vi.fn(async (fn: string) => {
    calls.push(fn);
    // the database's own answer to a switched session that asks for the settings log
    if (fn === 'settings_log' && state.switched) throw new DbError('PermissionDenied', 'test_switch.no_access_change');
    if (fn === state.refuse) throw new DbError('PermissionDenied', 'access.denied');
    if (fn === 'org') return { departments: [], teams: [], roles: [], people: [] };
    if (fn === 'activity_total') return 0;
    return [];
  }),
}));
vi.mock('@/core/auth/require-me', () => ({ requireMe: vi.fn(async () => admin(state.switched)) }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => '/activity',
}));
vi.mock('@/ui/shell/Page', () => ({ Page: ({ children }: { children: ReactElement }) => children }));

const { default: ActivityPage } = await import('@/app/(app)/activity/page');

const page = (q: Record<string, string>) => ActivityPage({ searchParams: Promise.resolve(q) });
const html = (el: unknown) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {el as ReactElement}
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  calls.length = 0;
  state.switched = true;
  state.refuse = '';
});

describe('a switched session is not offered the settings log', () => {
  it('the settings address lands on the default tab, and the settings log is never asked for', async () => {
    await expect(page({ tab: 'settings' })).rejects.toThrow('NEXT_REDIRECT /activity');
    expect(calls, 'no read is sent for a tab that is not offered').toEqual([]);
  });

  it('and it keeps the Who and Since filters on the way', async () => {
    await expect(page({ tab: 'settings', actor: 'made-up-actor', since: '2026-11-01' })).rejects.toThrow(
      'NEXT_REDIRECT /activity?actor=made-up-actor&since=2026-11-01',
    );
    expect(calls).not.toContain('settings_log');
  });

  it('the tab row of a switched session has no Settings tab; the other three stay', async () => {
    const out = html(await page({}));
    expect(calls).not.toContain('settings_log');
    expect(out).not.toContain('href="/activity?tab=settings"');
    for (const tab of ['changes', 'signIns', 'deleted']) expect(out).toContain(`href="/activity?tab=${tab}"`);
  });

  it('the real admin, not switched, is still offered the settings log and it is read', async () => {
    state.switched = false;
    const out = html(await page({ tab: 'settings' }));
    expect(calls).toContain('settings_log');
    expect(out).toContain('href="/activity?tab=settings"');
    expect(out).toContain('data-activity-settings');
  });
});

describe('one failing read never takes the Activity page down', () => {
  it('a refused tab read leaves the tab row standing and says what failed', async () => {
    state.switched = false;
    state.refuse = 'settings_log';
    const out = html(await page({ tab: 'settings' }));
    expect(out).toContain('data-state="failed"');
    expect(out, 'the kind and the key of the refusal').toContain('PermissionDenied · access.denied');
    expect(out, 'the tab row is still there').toContain('href="/activity?tab=changes"');
    expect(out).not.toContain('data-activity-settings');
  });

  it('a failed changes read does the same on the default tab', async () => {
    state.refuse = 'activity';
    const out = html(await page({}));
    expect(out).toContain('data-state="failed"');
    expect(out).toContain('data-activity-error');
    expect(out).not.toContain('data-activity-changes');
  });

  it('a failed organisation read is a failed state with Try again, not a thrown page', async () => {
    state.refuse = 'org';
    const out = html(await page({ tab: 'signIns' }));
    expect(out).toContain('data-state="failed"');
    expect(out).toContain('data-retry');
    expect(out).toContain('href="/activity?tab=signIns"');
  });

  it('a failed priority list alone changes nothing on screen', async () => {
    state.refuse = 'list';
    const out = html(await page({}));
    expect(out).not.toContain('data-state="failed"');
    expect(out).toContain('data-activity-changes');
  });
});
