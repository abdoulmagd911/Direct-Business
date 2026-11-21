// @vitest-environment jsdom
/**
 * Landing 34b — the search of the People list (Settings → People & access). The owner typed "Sara", "Ahmad" and
 * "Alotaibi" on the live site and was told "No people match this search" with those people in the list.
 * The rule is now one pure function (src/modules/org/people-search.ts) that the wide table and the phone cards both
 * draw from: every word typed must be somewhere in the person's English name, Arabic name, nicknames, job titles or
 * e-mails (or their department's or team's name), in any order, whatever the capitals — and nothing a keyboard or a
 * pasted cell can leave unseen (a no-break space, a direction mark) or a field that is empty can make it miss.
 * Every person is made up.
 * Sabotage: tests/sabotage/landing-34b-people.mjs "people-search-compares-capitals",
 * "people-search-wants-the-words-in-order", "people-search-keeps-unseen-marks", "people-search-skips-the-job-title",
 * "people-search-skips-the-arabic-name", "people-search-skips-the-nickname", "people-search-skips-the-emails",
 * "people-search-reads-an-empty-field-as-a-word", "people-list-ignores-the-search",
 * "people-list-forgets-the-department-and-team", "people-no-match-is-never-said",
 * "test-users-stay-folded-under-a-search", "test-users-are-always-unfolded".
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';
import { foldForSearch, matchesPerson, searchPeople, searchWords } from '../../../src/modules/org/people-search';
import { OrgAccess } from '../../../src/modules/org/screens/OrgAccess';
import type { MatrixAnswer, OrgAnswer, PeopleAnswer } from '../../../src/modules/org/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const person = (id: string, name: string, extra: Partial<PeopleAnswer[number]> = {}): PeopleAnswer[number] => ({
  id,
  full_name_en: name,
  full_name_ar: null,
  nickname_en: null,
  nickname_ar: null,
  job_title_en: null,
  job_title_ar: null,
  department_id: 'dept-1',
  team_id: null,
  manager_id: null,
  joined_on: '2026-01-05',
  left_on: null,
  can_sign_in: true,
  active: true,
  version: 1,
  role: { id: 'role-member', key: 'member', is_admin: false },
  emails: [{ id: `mail-${id}`, email: `${id}@example.test`, is_primary: true }],
  last_sign_in_at: null,
  ...extra,
});

const sara = person('sara', 'Made-up Sara Alotaibi', {
  full_name_ar: 'سارة العتيبي المختلقة',
  job_title_en: 'Made-up Reservations Lead',
  job_title_ar: 'مسؤولة الحجوزات',
  emails: [
    { id: 'm1', email: 'sara.madeup@example.test', is_primary: true },
    { id: 'm2', email: 'bookings.desk@example.test', is_primary: false },
  ],
});
const ahmad = person('ahmad', 'Made-up Ahmad Zedan', { nickname_en: 'Abu Fulan', nickname_ar: 'أبو فلان' });
// a name with a hyphen, an accent, a no-break space, and a direction mark left by a pasted cell
const hyphen = person('hyphen', 'Made-up\u00A0Nawaf Al-Otaibi\u200F', { job_title_en: 'Café Host' });
// people who have only part of their fields: an Arabic name and an empty English one, or nothing but a nickname
const arabicOnly = person('arabic', '', { full_name_ar: 'منى الأحمدي', emails: [] });
const nicknameOnly = {
  ...person('nick', ''),
  full_name_en: null as unknown as string,
  nickname_en: 'Zizo',
  emails: null as unknown as PeopleAnswer[number]['emails'],
};
const test = person('test', 'TEST Made-up Sara Tester', { is_test: true });
const everyone: PeopleAnswer = [sara, ahmad, hyphen, arabicOnly, nicknameOnly, test];
const found = (typed: string) => searchPeople(everyone, typed).map((p) => p.id);

describe('the People search, as a rule', () => {
  it('finds the three things the owner typed: Sara, Ahmad, Alotaibi', () => {
    expect(found('Sara')).toEqual(['sara', 'test']);
    expect(found('Ahmad')).toEqual(['ahmad']);
    expect(found('Alotaibi')).toEqual(['sara', 'hyphen']);
  });

  it('does not mind capitals, and trims what is typed', () => {
    expect(found('sara')).toEqual(['sara', 'test']);
    expect(found('SARA')).toEqual(['sara', 'test']);
    expect(found('  aLoTaIbI  ')).toEqual(['sara', 'hyphen']);
    expect(found('Sara ')).toEqual(['sara', 'test']);
  });

  it('takes several words in any order — each must be found', () => {
    expect(found('alotaibi sara')).toEqual(['sara']);
    expect(found('sara alotaibi')).toEqual(['sara']);
    expect(found('sara   made-up')).toEqual(['sara', 'test']);
    expect(found('sara zedan'), 'two words of two different people find nobody').toEqual([]);
  });

  it('matches any part of a word', () => {
    expect(found('otai')).toEqual(['sara', 'hyphen']);
    expect(found('zed')).toEqual(['ahmad']);
  });

  it('reads the Arabic name, the nicknames, the job titles and every e-mail', () => {
    expect(found('العتيبي'), 'the Arabic name').toEqual(['sara']);
    expect(found('سارة'), 'the Arabic name').toEqual(['sara']);
    expect(found('abu fulan'), 'the English nickname').toEqual(['ahmad']);
    expect(found('فلان'), 'the Arabic nickname').toEqual(['ahmad']);
    expect(found('reservations'), 'the English job title').toEqual(['sara']);
    expect(found('الحجوزات'), 'the Arabic job title').toEqual(['sara']);
    expect(found('sara.madeup@example.test'), 'the first e-mail').toEqual(['sara']);
    expect(found('bookings.desk'), 'a second e-mail').toEqual(['sara']);
    expect(found('lead sara'), 'a job title and a name together').toEqual(['sara']);
  });

  it('is not put off by what cannot be seen, a hyphen in a name or an accent', () => {
    expect(found('nawaf alotaibi'), 'a no-break space and a hyphen in the stored name').toEqual(['hyphen']);
    expect(found('Al-Otaibi'), 'a hyphen typed').toEqual(['sara', 'hyphen']);
    expect(found('\u200ESara\u200F'), 'direction marks around what is typed').toEqual(['sara', 'test']);
    expect(found('Sara\u00A0Alotaibi'), 'a no-break space typed').toEqual(['sara']);
    expect(found('cafe')).toEqual(['hyphen']);
    expect(found('\u200Fسارة العتيبي'), 'Arabic typed after a direction mark').toEqual(['sara']);
    expect(found('منى الأحمدي'), 'Arabic is compared as it is written').toEqual(['arabic']);
  });

  it('a person with only an Arabic name, or only a nickname, is found and never breaks the search', () => {
    expect(found('الأحمدي')).toEqual(['arabic']);
    expect(found('zizo')).toEqual(['nick']);
    expect(() => found('anything')).not.toThrow();
    expect(found('null'), 'an empty field is not the word "null"').toEqual([]);
    expect(found('undefined')).toEqual([]);
  });

  it('an empty or blank box keeps everyone, in the order given', () => {
    expect(found('')).toEqual(everyone.map((p) => p.id));
    expect(found('   ')).toEqual(everyone.map((p) => p.id));
    expect(searchWords(' \u200F ')).toEqual([]);
    expect(matchesPerson(sara, null)).toBe(true);
  });

  it('reads what the screen adds for a person — the department and the team, both languages', () => {
    expect(matchesPerson(ahmad, 'commercial')).toBe(false);
    expect(matchesPerson(ahmad, 'commercial', ['Made-up Commercial', 'التجاري'])).toBe(true);
    expect(matchesPerson(ahmad, 'التجاري ahmad', ['Made-up Commercial', 'التجاري'])).toBe(true);
    expect(searchPeople(everyone, 'commercial', (p) => (p.id === 'ahmad' ? ['Made-up Commercial'] : []))).toEqual([
      ahmad,
    ]);
  });

  it('folds both sides the same way', () => {
    expect(foldForSearch('  Al-Otaibi\u00A0 SARA\u200F ')).toBe('alotaibi sara');
    expect(foldForSearch(' سارة\u00A0العتيبي ')).toBe('سارة العتيبي');
    expect(foldForSearch(null)).toBe('');
  });
});

// ---- the screen ------------------------------------------------------------------------------------------------------

const org: OrgAnswer = {
  departments: [
    {
      id: 'dept-1',
      code: 'COM',
      name_en: 'Made-up Commercial',
      name_ar: 'التجاري',
      head_person_id: null,
      active: true,
      version: 1,
    },
  ],
  teams: [],
  roles: [{ id: 'role-member', key: 'member', name_en: 'Member', name_ar: null, sort: 4, is_admin: false, version: 1 }],
  people: [],
};
const matrix: MatrixAnswer = { roles: org.roles, pages: [], capabilities: [], role_levels: [], role_capabilities: [] };
// on screen the list is what the database answers: a name and a list of e-mails are always there
const listed: PeopleAnswer = everyone.map((p) =>
  p.id === 'nick'
    ? { ...p, full_name_en: 'Made-up Q', emails: [] }
    : p.id === 'arabic'
      ? { ...p, full_name_en: 'Made-up M' }
      : p,
);
const admin = { test_switch: null, person: { id: 'me', role: { id: 'role-admin', key: 'admin', is_admin: true } } };

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const draw = () => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <OrgAccess
          me={admin as unknown as Me}
          tab="people"
          org={org}
          people={listed}
          matrix={matrix}
          settings={[]}
          canEdit
          today="2026-11-20"
        />
      </NextIntlClientProvider>,
    );
  });
};
const type = (text: string) => {
  const box = document.querySelector('[data-people-filter]') as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    set.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const tableRows = () =>
  [...document.querySelectorAll('[data-person-row]')].map((r) => r.getAttribute('data-person-row'));
const phoneCards = () =>
  [...document.querySelectorAll('[data-person-card]')].map((r) => r.getAttribute('data-person-card'));
const openTestUsers = () =>
  act(() => (document.querySelector('[data-people-test-users-toggle]') as HTMLButtonElement | null)?.click());
const saysNoMatch = () => document.querySelector('[data-people-no-match]') !== null;

describe('the People list on screen', () => {
  it('the search box is the list’s own, named for the tests', () => {
    draw();
    const box = document.querySelector('[data-people-filter]') as HTMLInputElement;
    expect(box.getAttribute('placeholder')).toBe('Search by name or email');
    expect(tableRows()).toHaveLength(everyone.length);
    expect(saysNoMatch()).toBe(false);
  });

  it.each([
    ['Sara', ['sara', 'test']],
    ['Ahmad', ['ahmad']],
    ['Alotaibi', ['hyphen', 'sara']],
    ['alotaibi sara', ['sara']],
    ['  RESERVATIONS  ', ['sara']],
    ['سارة', ['sara']],
    ['zizo', ['nick']],
    ['commercial ahmad', ['ahmad']],
  ])('typing "%s" keeps the same people in the wide table and in the phone cards', (typed, ids) => {
    draw();
    type(typed);
    expect(tableRows().sort()).toEqual([...ids].sort());
    // a TEST user the search found is shown at once on the phone: the Test users list opens under a search
    expect(phoneCards().sort(), 'the phone layout uses the same filter').toEqual([...ids].sort());
    expect(saysNoMatch(), 'nobody is told "No people match" while people are shown').toBe(false);
  });

  it('without a search the phone keeps the TEST users folded until asked for', () => {
    draw();
    expect(phoneCards()).not.toContain('test');
    openTestUsers();
    expect(phoneCards()).toContain('test');
  });

  it('says No people match this search only when nobody is kept, and clearing the box brings everyone back', () => {
    draw();
    type('nobody-by-this-name');
    expect(tableRows()).toEqual([]);
    expect(phoneCards()).toEqual([]);
    expect(saysNoMatch()).toBe(true);
    expect(document.querySelector('[data-people-no-match]')!.textContent).toContain('No people match this search.');
    type('');
    expect(tableRows()).toHaveLength(everyone.length);
    expect(saysNoMatch()).toBe(false);
  });
});
