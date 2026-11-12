/**
 * F-B5-11 (FIX-20): /profile's Start page picker shows "Default" when the start page is the default. Before, the
 * stored value was null, the picker value was '' and Radix read the empty value as the placeholder case — with no
 * placeholder passed, the closed picker showed blank. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';
import { MeProvider } from '../../../src/core/auth/me-context';
import { MyProfile } from '../../../src/modules/org/screens/MyProfile';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
// the screen's password section is a server action: keep it out of this render test
vi.mock('@/core/auth/password-actions', () => ({ changePassword: vi.fn() }));

const me = {
  status: 'ok',
  session: {
    device_id: 'd1',
    signed_in_at: '2026-01-01T00:00:00Z',
    last_seen_at: '2026-01-01T00:00:00Z',
    email: 'made.up@example.test',
  },
  person: {
    id: 'p1',
    kind: 'staff',
    full_name_en: 'Made Up',
    full_name_ar: null,
    nickname_en: null,
    nickname_ar: null,
    job_title_en: null,
    job_title_ar: null,
    department_id: 'd1',
    team_id: null,
    manager_id: null,
    role: { id: 'r1', key: 'member', name_en: 'Member', name_ar: 'عضو', is_admin: false },
  },
  levels: {},
  capabilities: [],
  departments: ['d1'],
  profile: {
    display_name_en: 'Made Up',
    display_name_ar: null,
    avatar_file_id: null,
    avatar_color: null,
    badge_kind: 'none',
    badge_value: null,
    theme: null,
    density: null,
    locale: null,
    start_page: null,
    drawer_pinned: null,
    notify: null,
    version: 1,
  },
} as unknown as Me;

const draw = () =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <MeProvider me={me}>
        <MyProfile me={me} devices={[]} />
      </MeProvider>
    </NextIntlClientProvider>,
  );

describe('the profile start-page picker (F-B5-11)', () => {
  it('shows Default on the closed picker when no start page is stored', () => {
    const html = draw();
    expect(html).toContain('Start page');
    expect(html).toContain('Default');
  });
});
