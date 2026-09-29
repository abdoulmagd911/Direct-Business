import type { AvatarColor, BadgeKind } from '@/ui/Avatar';

export type OrgDepartment = {
  id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
  head_person_id: string | null;
  active: boolean;
  version: number;
};
export type OrgTeam = {
  id: string;
  department_id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
  lead_person_id: string | null;
  active: boolean;
  retired_at: string | null;
  retired_into_team_id: string | null;
  version: number;
};
export type OrgRole = {
  id: string;
  key: string;
  name_en: string;
  name_ar: string | null;
  sort: number;
  is_admin: boolean;
  version?: number;
};
export type OrgPerson = {
  id: string;
  full_name_en: string;
  full_name_ar: string | null;
  nickname_en: string | null;
  nickname_ar: string | null;
  display_name_en: string | null;
  display_name_ar: string | null;
  job_title_en: string | null;
  job_title_ar: string | null;
  department_id: string;
  team_id: string | null;
  manager_id: string | null;
  avatar_color: string | null;
  avatar_file_id: string | null;
  badge_kind: BadgeKind | null;
  badge_value: string | null;
  /** 'staff', or 'admin_account' / 'test_account' (V444, V445) once api.org serves it. */
  kind?: string | null;
};
/** api.org(): the structure everyone may read — no emails, no access (V132). */
export type OrgAnswer = { departments: OrgDepartment[]; teams: OrgTeam[]; roles: OrgRole[]; people: OrgPerson[] };

/** api.people(): the people list for Organization & access · View (V132). */
export type PersonRow = {
  id: string;
  full_name_en: string;
  full_name_ar: string | null;
  nickname_en: string | null;
  nickname_ar: string | null;
  job_title_en: string | null;
  job_title_ar: string | null;
  department_id: string;
  team_id: string | null;
  manager_id: string | null;
  joined_on: string | null;
  left_on: string | null;
  can_sign_in: boolean;
  active: boolean;
  version: number;
  /** 'staff', or the owner's 'admin_account' / the 'test_account' (V444, V445) once api.people serves it. */
  kind?: string | null;
  role: { id: string; key: string; is_admin: boolean } | null;
  emails: { id: string; email: string; is_primary: boolean }[];
  last_sign_in_at: string | null;
};
export type PeopleAnswer = PersonRow[];

/** api.access_matrix(): roles × pages and capabilities (V125). */
export type MatrixAnswer = {
  roles: OrgRole[];
  pages: {
    key: string;
    module: string;
    levels: ('none' | 'view' | 'own' | 'full')[];
    nav_group: string | null;
    nav_order: number | null;
  }[];
  capabilities: { key: string; page: string }[];
  role_levels: { role_id: string; page: string; level: 'none' | 'view' | 'own' | 'full' }[];
  role_capabilities: { role_id: string; capability: string; granted: boolean }[];
};

/** api.access_of_person(): one person's effective levels and their overrides (V125). */
export type PersonAccess = {
  person_id: string;
  role: { id: string; key: string; is_admin: boolean } | null;
  levels: Record<string, 'none' | 'view' | 'own' | 'full'>;
  capabilities: string[];
  level_overrides: {
    page: string;
    level: 'none' | 'view' | 'own' | 'full';
    reason: string | null;
    set_by: string | null;
    set_at: string;
  }[];
  capability_overrides: {
    capability: string;
    granted: boolean;
    reason: string | null;
    set_by: string | null;
    set_at: string;
  }[];
};

export type Level = 'none' | 'view' | 'own' | 'full';
export const LEVELS: Level[] = ['none', 'view', 'own', 'full'];

export function nameOf(
  p: {
    full_name_en: string;
    full_name_ar?: string | null;
    display_name_en?: string | null;
    display_name_ar?: string | null;
    nickname_en?: string | null;
  },
  locale: 'en' | 'ar',
) {
  if (locale === 'ar')
    return p.display_name_ar ?? p.full_name_ar ?? p.display_name_en ?? p.nickname_en ?? p.full_name_en;
  return p.display_name_en ?? p.nickname_en ?? p.full_name_en;
}

export function avatarOf(p: OrgPerson, locale: 'en' | 'ar') {
  return {
    displayName: nameOf(p, locale),
    fullName: p.full_name_en,
    avatarUrl: null,
    avatarColor: (p.avatar_color && /^c[1-6]$/.test(p.avatar_color) ? p.avatar_color : 'c3') as AvatarColor,
    badge: { kind: p.badge_kind ?? 'none', value: p.badge_value },
  };
}

/** A field's value in words, from api.org(): a department's, team's, role's or person's name for its id. */
export function describeWith(org: OrgAnswer, locale: 'en' | 'ar'): (field: string, value: unknown) => string | null {
  const pick = (x: { name_en: string; name_ar: string | null } | undefined) =>
    x ? (locale === 'ar' && x.name_ar ? x.name_ar : x.name_en) : null;
  return (field, value) => {
    if (typeof value !== 'string') return null;
    if (field === 'department_id') return pick(org.departments.find((d) => d.id === value));
    if (field === 'team_id' || field === 'retired_into_team_id') return pick(org.teams.find((x) => x.id === value));
    if (field === 'role_id') return pick(org.roles.find((r) => r.id === value));
    if (/(^|_)(person|manager|owner|actor|deleted_by|set_by)(_id)?$/.test(field)) {
      const p = org.people.find((x) => x.id === value);
      return p ? nameOf(p, locale) : null;
    }
    return null;
  };
}

/** An added record in words from api.org(): a person by name, department and manager. */
export function summarizeWith(
  org: OrgAnswer,
  locale: 'en' | 'ar',
  reportsTo: (name: string) => string,
): (entity: string | undefined, id: string | undefined) => string | null {
  const describe = describeWith(org, locale);
  return (entity, id) => {
    if (entity !== 'person' || !id) return null;
    const p = org.people.find((x) => x.id === id);
    if (!p) return null;
    const parts = [nameOf(p, locale), describe('department_id', p.department_id), describe('team_id', p.team_id)];
    const manager = p.manager_id ? describe('manager_id', p.manager_id) : null;
    if (manager) parts.push(reportsTo(manager));
    return parts.filter(Boolean).join(' · ');
  };
}
