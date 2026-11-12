/**
 * The /activity Settings log (F-B5-13(c), O1 — Landing 15 Group C): a setting change names the setting and its
 * value before → after in words — "Arabic: No → Yes" — never the raw key or its columns. Every value is made up.
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

const me: Me = {
  status: 'ok',
  session: {
    device_id: 'd1',
    signed_in_at: '2026-11-01T00:00:00Z',
    last_seen_at: '2026-11-01T00:00:00Z',
    email: 'test@example.com',
  },
  person: {
    id: 'person-1',
    kind: 'staff',
    full_name_en: 'TEST Admin',
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
  levels: {},
  capabilities: [],
  departments: [],
  profile: null,
};
const org: OrgAnswer = {
  departments: [],
  teams: [],
  roles: [],
  people: [
    {
      id: 'person-1',
      full_name_en: 'TEST Admin',
      full_name_ar: null,
      nickname_en: null,
      nickname_ar: null,
      display_name_en: null,
      display_name_ar: null,
      job_title_en: null,
      job_title_ar: null,
      department_id: 'd1',
      team_id: null,
      manager_id: null,
      avatar_color: null,
      avatar_file_id: null,
      badge_kind: null,
      badge_value: null,
    },
  ],
};

const row = (request_id: string, label_key: string, changes: HistoryRow['changes']): HistoryRow => ({
  request_id,
  at: '2026-11-07T09:00:00Z',
  actor_id: 'person-1',
  kind: 'ui',
  label_key,
  label_args: null,
  reason: 'made up',
  undone: false,
  undo_of: null,
  changes,
});

const rows: HistoryRow[] = [
  row('r1', 'setting.changed', [
    {
      entity: 'setting',
      action: 'remove',
      fields: ['deleted_at', 'deleted_by', 'delete_reason'],
      before: { key: 'app.arabic_enabled', value: false, valid_from: '2026-11-07', reason: 'made up' },
      after: { key: 'app.arabic_enabled', deleted_at: '2026-11-07T09:00:00Z' },
    },
    {
      entity: 'setting',
      action: 'insert',
      fields: ['id', 'key', 'value', 'valid_from', 'reason'],
      before: null,
      after: { key: 'app.arabic_enabled', value: true, valid_from: '2026-11-07', reason: 'made up' },
    },
  ]),
  row('r2', 'setting.changed', [
    {
      entity: 'setting',
      action: 'insert',
      fields: ['id', 'key', 'value', 'valid_from', 'reason'],
      before: null,
      after: {
        key: 'notify.kinds_enabled',
        value: ['assigned', 'mentioned'],
        valid_from: '2026-11-07',
        reason: 'made up',
      },
    },
  ]),
];

const html = () =>
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
  );

describe('the Settings log names its settings', () => {
  it('says the setting and its value before → after, never the raw key or its columns', () => {
    const out = html();
    expect(out).toContain('Arabic');
    expect(out).toContain('No → Yes');
    expect(out).toContain('Notifications sent');
    expect(out).toContain('Assigned to me, Mentioned');
    expect(out).not.toContain('app.arabic_enabled');
    expect(out).not.toContain('notify.kinds_enabled');
    expect(out).not.toContain('id, key, value');
  });
});
