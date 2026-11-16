/**
 * Landing 31 — People & access in the new look (boards settings-pc-*, settings-access-pc-*, x-ph-people-*).
 * People · Teams · Access are pill tabs with their counts. The wide People table carries no "Sign in as test user"
 * column or button, even with a TEST person listed (Landing 30, QA-592: that column pushed the table past its box in
 * Arabic) — the button lives on the phone list, under Test users, and on the person's record. The phone list says
 * nothing about the everyday case (no Allowed pill), still says Switched off, and keeps the TEST users apart. Access
 * explains its four levels above the matrix. Nobody yet is one line with Add person. Every person is made up.
 * Sabotages: tests/sabotage/landing-31-settings.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';
import { OrgAccess, isEveryday } from '../../../src/modules/org/screens/OrgAccess';
import type { MatrixAnswer, OrgAnswer, PeopleAnswer } from '../../../src/modules/org/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));

const person = (id: string, name: string, extra: Partial<PeopleAnswer[number]> = {}): PeopleAnswer[number] => ({
  id,
  full_name_en: name,
  full_name_ar: null,
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
  person('p1', 'Made Up Salma'),
  person('p2', 'Made Up Khalid', { can_sign_in: false }),
  person('p3', 'TEST Made Up Member', { is_test: true }),
];
const orgOf = (rows: PeopleAnswer): OrgAnswer => ({
  departments: [
    { id: 'dept-1', code: 'COM', name_en: 'Commercial', name_ar: null, head_person_id: null, active: true, version: 1 },
  ],
  teams: [
    {
      id: 'team-1',
      department_id: 'dept-1',
      code: 'T1',
      name_en: 'Team one',
      name_ar: null,
      lead_person_id: null,
      active: true,
      retired_at: null,
      retired_into_team_id: null,
      version: 1,
    },
  ],
  roles: [
    { id: 'role-admin', key: 'admin', name_en: 'Admin', name_ar: null, sort: 1, is_admin: true, version: 1 },
    { id: 'role-member', key: 'member', name_en: 'Member', name_ar: null, sort: 4, is_admin: false, version: 1 },
  ],
  people: rows.map((p) => ({
    ...p,
    display_name_en: null,
    display_name_ar: null,
    avatar_color: null,
    avatar_file_id: null,
    badge_kind: null,
    badge_value: null,
  })),
});
const matrix: MatrixAnswer = {
  roles: orgOf([]).roles,
  pages: [{ key: 'tasks', module: 'tasks', levels: ['none', 'view', 'own', 'full'], nav_group: 'main', nav_order: 1 }],
  capabilities: [],
  role_levels: [],
  role_capabilities: [],
};
// an admin who has not switched: the one person who is offered Sign in as test user (V656)
const admin = { test_switch: null, person: { id: 'me', role: { id: 'role-admin', key: 'admin', is_admin: true } } };

const draw = (tab: string, rows: PeopleAnswer = people) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <OrgAccess
        me={admin as unknown as Me}
        tab={tab}
        org={orgOf(rows)}
        people={rows}
        matrix={matrix}
        settings={[]}
        canEdit
        today="2026-10-26"
      />
    </NextIntlClientProvider>,
  );
const between = (html: string, from: string, to: string) => {
  const a = html.indexOf(from);
  return a < 0 ? '' : html.slice(a, html.indexOf(to, a) + to.length);
};

describe('People · Teams · Access', () => {
  it('are pill tabs, each a link, People and Teams with their counts', () => {
    const html = draw('people');
    const row = between(html, '<nav aria-label="People &amp; access"', '</nav>');
    expect(row).toContain('data-tabs');
    const tabs = [...row.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map((m) => ({
      tab: m[1]!.match(/href="\/settings\/org\?tab=(\w+)"/)?.[1],
      look: m[1]!.match(/class="([^"]*)"/)?.[1] ?? '',
      inner: m[2]!,
    }));
    expect(tabs.map((x) => x.tab)).toEqual(['people', 'teams', 'access']);
    for (const x of tabs) expect(x.look, x.tab).toContain('rounded-pill');
    expect(tabs[0]!.inner).toMatch(/^People<span[^>]*>3<\/span>/);
    expect(tabs[1]!.inner).toMatch(/^Teams<span[^>]*>1<\/span>/);
    expect(tabs[2]!.inner).toMatch(/^Access/);
    expect(row.match(/aria-current="page"/g)).toHaveLength(1);
  });
});

describe('the wide People table', () => {
  const html = draw('people');
  const table = between(html, '<table', '</table>');
  it('lists everyone, the TEST person too', () => {
    for (const p of people) expect(table).toContain(`data-person-row="${p.id}"`);
  });
  it('has no switch column and no Sign in as test user button — seven columns, Status the last', () => {
    expect(table).not.toContain('data-test-switch-start');
    expect(table).not.toContain('Sign in as test user');
    const heads = [...between(table, '<thead', '</thead>').matchAll(/<th [^>]*>(.*?)<\/th>/g)].map((m) => m[1]);
    expect(heads).toEqual(['Name', 'Role', 'Department', 'Team', 'Allowed emails', 'Last sign-in', 'Status']);
    for (const row of table.split('<tr').slice(2)) expect(row.match(/<td/g)).toHaveLength(7);
  });
  it('is a white card that scrolls inside itself and lets its words wrap', () => {
    expect(html).toMatch(
      /<div class="hidden overflow-x-auto rounded-lg border border-border bg-raised shadow-1 sm:block"><table class="w-full table-auto text-sm">/,
    );
    expect(table).not.toContain('whitespace-nowrap px-4 py-2.5 text-start');
  });
});

describe('the People list on a phone', () => {
  const html = draw('people');
  const list = between(html, '<ul class="divide-y', '</ul>');
  it('says nothing about the everyday case, and still says Switched off', () => {
    expect(list).toContain('data-people-cards');
    expect(list).toContain('data-person-card="p1"');
    expect(list).not.toContain('Allowed');
    expect(between(list, 'data-person-card="p2"', '</li>')).toContain('Switched off');
  });
  it('shows the role and the team under the name', () => {
    expect(between(list, 'data-person-card="p1"', '</li>')).toContain('Member · Team one');
  });
  it('keeps the TEST users apart, counted and closed until asked for', () => {
    expect(list).not.toContain('data-person-card="p3"');
    const test = between(html, 'data-people-test-users', '</div>');
    expect(test).toMatch(/<button[^>]*aria-expanded="false"[^>]*data-people-test-users-toggle/);
    expect(test).toContain('Test users');
    expect(test).toMatch(/<span[^>]*>1<\/span>/);
  });
  it('puts Add person first, the whole width, a finger tall', () => {
    expect(html).toMatch(
      /<button[^>]*class="[^"]*max-sm:order-first[^"]*max-sm:min-h-11[^"]*max-sm:w-full[^"]*"[^>]*data-person-add/,
    );
  });
  it('the everyday case is: works here, may sign in, has a role', () => {
    expect(isEveryday(people[0]!, '2026-10-26')).toBe(true);
    expect(isEveryday(people[1]!, '2026-10-26')).toBe(false);
    expect(isEveryday(person('p4', 'Made Up Left', { left_on: '2026-09-30' }), '2026-10-26')).toBe(false);
    expect(isEveryday(person('p5', 'Made Up Leaving', { left_on: '2026-12-31' }), '2026-10-26')).toBe(true);
    expect(isEveryday(person('p6', 'Made Up No Role', { role: null }), '2026-10-26')).toBe(false);
  });
});

describe('nobody yet', () => {
  it('is one line with Add person, not a table of headings', () => {
    const html = draw('people', []);
    expect(html).toContain('data-state="empty"');
    expect(html).toContain('No one has been added yet.');
    expect(html).toMatch(/<button[^>]*data-person-add/);
    expect(html).not.toContain('<table');
  });
});

describe('Access', () => {
  it('says what Full, Own, View and None mean, above the matrix', () => {
    const html = draw('access');
    const legend = between(html, '<p class="flex flex-wrap gap-x-5', '</p>');
    expect(legend).toContain('data-access-legend');
    expect(legend.replace(/<[^>]+>/g, '')).toBe(
      'Full see and change allOwn only their own and shared recordsView read onlyNone page hidden',
    );
    expect(html.indexOf('data-access-legend')).toBeLessThan(html.indexOf('data-access-matrix'));
  });
});
