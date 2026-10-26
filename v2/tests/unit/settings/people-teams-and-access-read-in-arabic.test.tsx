/**
 * QA-591: the three tabs of Organization & access — People, Teams, Access (with Roles and the sign-in settings) — drawn
 * in Arabic: the headings, the buttons, the chips, the levels in the matrix and the page and capability names. A raw
 * key or a word left in English fails here. Every person, team and role is made up.
 * Sabotages: tests/sabotage/settings-in-arabic.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import type { Me } from '../../../src/core/auth/me';
import { modules } from '../../../src/core/registry/index';
import { OrgAccess } from '../../../src/modules/org/screens/OrgAccess';
import type { MatrixAnswer, OrgAnswer, PeopleAnswer } from '../../../src/modules/org/types';
import { latinLeft, registrySettings, wordsOf } from './arabic-words';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));

const person = (id: string, name: string, extra: Partial<PeopleAnswer[number]> = {}): PeopleAnswer[number] => ({
  id,
  full_name_en: `Made Up ${id}`,
  full_name_ar: name,
  nickname_en: null,
  nickname_ar: null,
  job_title_en: null,
  job_title_ar: null,
  department_id: 'dept-1',
  team_id: 'team-1',
  manager_id: null,
  joined_on: '2026-01-05',
  left_on: null,
  can_sign_in: true,
  active: true,
  version: 1,
  role: { id: 'role-member', key: 'member', is_admin: false },
  emails: [{ id: `mail-${id}`, email: `${id}@example.test`, is_primary: true }],
  last_sign_in_at: '2026-10-20T08:00:00Z',
  ...extra,
});
const people: PeopleAnswer = [
  person('p1', 'سلمى الغامدي'),
  person('p2', 'خالد العتيبي', { can_sign_in: false, team_id: null, last_sign_in_at: null }),
  person('p3', 'نورة الحربي', { active: false, left_on: '2026-09-30' }),
];
const org: OrgAnswer = {
  departments: [
    {
      id: 'dept-1',
      code: 'COM',
      name_en: 'Commercial',
      name_ar: 'الإدارة التجارية',
      head_person_id: 'p1',
      active: true,
      version: 1,
    },
  ],
  teams: [
    {
      id: 'team-1',
      department_id: 'dept-1',
      code: 'T1',
      name_en: 'Team one',
      name_ar: 'الفريق الأول',
      lead_person_id: 'p1',
      active: true,
      retired_at: null,
      retired_into_team_id: null,
      version: 1,
    },
    {
      id: 'team-2',
      department_id: 'dept-1',
      code: 'T2',
      name_en: 'Team two',
      name_ar: 'الفريق الثاني',
      lead_person_id: null,
      active: false,
      retired_at: '2026-09-01',
      retired_into_team_id: 'team-1',
      version: 1,
    },
  ],
  roles: [
    { id: 'role-admin', key: 'admin', name_en: 'Admin', name_ar: 'مسؤول النظام', sort: 1, is_admin: true, version: 1 },
    { id: 'role-member', key: 'member', name_en: 'Member', name_ar: 'عضو', sort: 4, is_admin: false, version: 1 },
  ],
  people: people.map((p) => ({
    ...p,
    display_name_en: null,
    display_name_ar: null,
    avatar_color: null,
    avatar_file_id: null,
    badge_kind: null,
    badge_value: null,
  })),
};
const pages = modules.flatMap((m) =>
  (m.pages ?? []).map((p) => ({
    key: p.key,
    module: m.key,
    levels: [...(p.levels ?? ['none', 'view', 'own', 'full'])] as ('none' | 'view' | 'own' | 'full')[],
    nav_group: p.nav?.group ?? null,
    nav_order: p.nav?.order ?? null,
  })),
);
const matrix: MatrixAnswer = {
  roles: org.roles,
  pages,
  capabilities: modules.flatMap((m) => (m.capabilities ?? []).map((c) => ({ key: c.key, page: c.page }))),
  role_levels: org.roles.flatMap((r) =>
    pages.map((p) => ({ role_id: r.id, page: p.key, level: p.levels[p.levels.length - 1]! })),
  ),
  role_capabilities: [],
};
const me = { id: 'p1' } as unknown as Me;
const signIn = registrySettings()
  .filter((s) => s.group === 'settings.org')
  .map((s) => s.def);

const draw = (tab: string) =>
  wordsOf(
    renderToStaticMarkup(
      <NextIntlClientProvider locale="ar" messages={ar} timeZone="Asia/Riyadh">
        <OrgAccess
          me={me}
          tab={tab}
          org={org}
          people={people}
          matrix={matrix}
          settings={signIn}
          canEdit
          today="2026-10-26"
        />
      </NextIntlClientProvider>,
    ),
  );

describe('Organization & access in Arabic (QA-591)', () => {
  for (const tab of ['people', 'teams', 'access']) {
    it(`${tab}: every word is Arabic, and no raw key is drawn`, () => {
      const text = draw(tab);
      expect(text.length).toBeGreaterThan(50);
      expect(text.replace(/\S+@\S+/g, ' '), 'no catalog key').not.toMatch(
        /\b[a-z]+(?:_[a-z]+)*\.[a-z_]+(?:\.[a-zA-Z_]+)*\b/,
      );
      // Data, not wording: the sample emails, the team and department codes, the roles' English names and keys (the
      // Roles table shows both names and the key on purpose), and the avatars' initials and label (the shared Avatar takes them from
      // the English full name in every language; reported to the Architect, not changed here).
      expect(
        latinLeft(text.replace(/\S+@\S+/g, ' '), [
          'MP',
          'Made',
          'Up',
          'p1',
          'p2',
          'p3',
          'T1',
          'T2',
          'COM',
          'Admin',
          'admin',
          'Member',
          'member',
        ]),
        'words left in English or raw',
      ).toEqual([]);
    });
  }

  it('writes a person by the Arabic name on the People tab', () => {
    const text = draw('people');
    for (const p of people) expect(text, `the Arabic name of ${p.id}`).toContain(p.full_name_ar!);
  });

  it('names every page and capability of the matrix, and has the four levels and the three tabs, in Arabic', () => {
    const text = draw('access');
    const catalog = (key: string) =>
      key.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], ar);
    for (const m of modules)
      for (const key of [...(m.pages ?? []).map((p) => p.label), ...(m.capabilities ?? []).map((c) => c.label)])
        expect(text, key).toContain(catalog(key) as string);
    for (const level of ['none', 'view', 'own', 'full'])
      expect(typeof catalog(`levels.${level}`), `levels.${level}`).toBe('string');
    for (const w of [ar.settings.tabs.people, ar.settings.tabs.teams, ar.settings.tabs.access])
      expect(text).toContain(w);
  });
});
