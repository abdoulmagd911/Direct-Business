/**
 * The /activity Settings log offers Revert only where it works: Revert writes the setting again, which needs Full on the
 * setting's page (admins only, V97). A head or manager reads the log (Activity · View) but was offered Revert and then
 * refused; and a change already undone offered Revert too, though its value no longer stands. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';
import type { OrgAnswer } from '../../../src/modules/org/types';
import { ActivityScreen } from '../../../src/modules/settings/screens/ActivityScreen';
import type { HistoryRow } from '../../../src/ui/record/history';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => '/activity',
}));

const person = (role: { key: string; is_admin: boolean }, levels: Me['levels']): Me => ({
  status: 'ok',
  session: {
    device_id: 'd1',
    signed_in_at: '2026-11-01T00:00:00Z',
    last_seen_at: '2026-11-01T00:00:00Z',
    email: 'made.up@example.test',
  },
  person: {
    id: 'person-1',
    kind: 'staff',
    full_name_en: 'Made Up Person',
    full_name_ar: null,
    nickname_en: null,
    nickname_ar: null,
    job_title_en: null,
    job_title_ar: null,
    department_id: 'd1',
    team_id: null,
    manager_id: null,
    role: { id: 'r1', key: role.key, name_en: role.key, name_ar: null, is_admin: role.is_admin },
  },
  levels,
  capabilities: [],
  departments: [],
  profile: null,
});

const org: OrgAnswer = { departments: [], teams: [], roles: [], people: [] };

const change = (request_id: string, undone: boolean): HistoryRow => ({
  request_id,
  at: '2026-11-07T09:00:00Z',
  actor_id: null,
  kind: 'ui',
  label_key: 'setting.changed',
  label_args: null,
  reason: 'made up',
  undone,
  undo_of: null,
  changes: [
    {
      entity: 'setting',
      action: 'insert',
      fields: ['id', 'key', 'value', 'valid_from', 'reason'],
      before: null,
      after: { key: 'nudge.weekly_time', value: '10:00', valid_from: '2026-11-07', reason: 'made up' },
    },
  ],
});

const reverts = (me: Me, rows: HistoryRow[]) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <ActivityScreen
        me={me}
        tab="settings"
        org={org}
        rows={rows}
        signIns={[]}
        deleted={[]}
        filters={{ actor: '', entity: '', since: '', person: '' }}
        priorities={[]}
      />
    </NextIntlClientProvider>,
  ).match(/data-setting-revert/g)?.length ?? 0;

describe('the Settings log offers Revert only where it works', () => {
  it('offers it to whoever holds Full on the setting’s page', () => {
    const admin = person({ key: 'admin', is_admin: true }, { activity: 'full', 'settings.app': 'full' });
    expect(reverts(admin, [change('a', false)])).toBe(1);
  });

  it('never to a head who only reads the log', () => {
    const head = person({ key: 'head', is_admin: false }, { activity: 'view' });
    expect(reverts(head, [change('a', false)])).toBe(0);
  });

  it('not on a change already undone', () => {
    const admin = person({ key: 'admin', is_admin: true }, { activity: 'full', 'settings.app': 'full' });
    expect(reverts(admin, [change('a', true), change('b', false)])).toBe(1);
  });
});
