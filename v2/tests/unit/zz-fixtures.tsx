import type { Me } from '../../src/core/auth/me';
import { modules } from '../../src/core/registry/index';
import type { MatrixAnswer, OrgAnswer, PeopleAnswer } from '../../src/modules/org/types';
import type { ListEntry } from '../../src/modules/settings/screens/ListEditor';
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

export const fx = {
  me, org, people, matrix,
  departments: [{ id: 'dept-1', name_en: 'Commercial', name_ar: 'الإدارة التجارية' }],
  entries: (key: string): ListEntry[] =>
    ['client', 'supplier_partner', 'at_risk', 'lost'].map((v, i) => ({
      id: `${key}-${i}`, key: `entry_${i}`, name_en: `Entry ${i}`, name_ar: `بند ${i + 1}`, sort: i + 1, active: true, version: 1,
      side: i < 2 ? v : undefined, status: i >= 2 ? v : undefined,
    })),
};
