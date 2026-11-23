// Landing 31 (16 Nov) — Settings in the new look: the menu with its icons, People · Teams · Access as pill tabs, the
// People table without a switch column, the phone lists, and the credit limit in Settings → Finance (a manager, a head
// of department and an admin change it; a team member and a viewer only read it). Each sabotage takes one of those
// back, and the test named must go red for it.
const MIGRATION = 'supabase/migrations/20261116100000_settings_finance_credit_limit.sql';
const RULE = 'src/modules/settings/credit-limit.ts';
const CARD = 'src/modules/settings/screens/CreditLimitCard.tsx';
const PAGE = 'src/app/(app)/settings/[group]/page.tsx';
const SHELL = 'src/modules/settings/screens/SettingsShell.tsx';
const MENU = 'src/modules/settings/menu.ts';
const ORG = 'src/modules/org/screens/OrgAccess.tsx';
const CREDIT =
  'unit:tests/unit/settings/the-credit-limit-is-changed-by-managers-heads-and-admins-and-read-by-everyone.test.tsx';
const MENU_TEST = 'unit:tests/unit/settings/the-settings-menu-draws-each-group-with-its-icon.test.tsx';
const E2E = 'e2e:tests/e2e/landing-31-settings-credit-limit.alone.spec.ts';
const PEOPLE = 'unit:tests/unit/settings/the-people-table-has-no-switch-column-and-the-tabs-are-pills.test.tsx';

export const sabotages = [
  // ---- CCL-01: the database's own rule for the credit limit
  {
    name: 'credit-limit-only-an-admin-changes-it',
    breaks: ['sql:CCL-01'],
    expect: 'a manager is told they can change it',
    edits: [
      // Landing 40 redefines the rule (a person's own setting first, then the role): the role's part is taken out there
      {
        file: 'supabase/migrations/20261123100000_per_member_extra_access.sql',
        find: "                            r.key in ('head', 'manager')))))",
        replace: '                            false))))',
      },
    ],
  },
  {
    name: 'credit-limit-the-write-asks-nobody',
    breaks: ['sql:CCL-01'],
    expect: 'a team member cannot change the credit limit',
    edits: [{ file: MIGRATION, find: '  if not finance.credit_limit_can_change(me) then', replace: '  if false then' }],
  },
  {
    name: 'credit-limit-takes-a-fraction',
    breaks: ['sql:CCL-01'],
    expect: 'an amount with a fraction is refused',
    edits: [
      {
        file: MIGRATION,
        find: '  if p_amount is null or p_amount <> pg_catalog.trunc(p_amount) then',
        replace: '  if p_amount is null then',
      },
    ],
  },
  {
    name: 'credit-limit-changes-without-a-reason',
    breaks: ['sql:CCL-01'],
    expect: 'a change without a reason is refused',
    edits: [{ file: MIGRATION, find: '  why := core.access_reason(p_reason);', replace: '  why := p_reason;' }],
  },
  // ---- the screen's rule: who gets the edit form
  {
    name: 'credit-limit-a-viewer-is-offered-the-form',
    breaks: [CREDIT],
    expect: '> a viewer and a person with no role never are',
    edits: [
      {
        file: RULE,
        find: "export const CREDIT_LIMIT_NEVER: readonly string[] = ['viewer'];",
        replace: 'export const CREDIT_LIMIT_NEVER: readonly string[] = [];',
      },
    ],
  },
  {
    name: 'credit-limit-a-manager-is-not-offered-the-form',
    breaks: [CREDIT],
    expect: '> a manager, a head of department, an admin and a team member may be — the database says who is',
    edits: [
      {
        file: RULE,
        find: "export const CREDIT_LIMIT_NEVER: readonly string[] = ['viewer'];",
        replace: "export const CREDIT_LIMIT_NEVER: readonly string[] = ['viewer', 'manager'];",
      },
    ],
  },
  {
    name: 'credit-limit-page-trusts-the-answer-alone',
    breaks: [CREDIT],
    expect: '> a viewer stays read-only even if the answer said they may change it',
    edits: [
      {
        file: PAGE,
        find: '        canEdit={credit.can_edit && mayChangeCreditLimit(me)}',
        replace: '        canEdit={credit.can_edit}',
      },
    ],
  },
  {
    name: 'credit-limit-page-ignores-the-database',
    breaks: [CREDIT],
    expect: '> the database has the last word: a manager it refuses sees the read-only view',
    edits: [
      {
        file: PAGE,
        find: '        canEdit={credit.can_edit && mayChangeCreditLimit(me)}',
        replace: '        canEdit={mayChangeCreditLimit(me)}',
      },
    ],
  },
  {
    name: 'credit-limit-read-only-view-draws-the-form',
    breaks: [CREDIT],
    expect: '> the read-only view: the figure as SAR 1,250,000, who can change it, and no box or button',
    edits: [
      { file: CARD, find: '        {canEdit ? (\n          <form', replace: '        {amount ? (\n          <form' },
    ],
  },
  {
    name: 'credit-limit-takes-zero',
    breaks: [CREDIT],
    expect: '> is refused when empty, zero, negative, a fraction, not a number, or more than the setting takes',
    edits: [
      {
        file: RULE,
        find: '  return Number.isSafeInteger(n) && n >= 1 && n <= CREDIT_LIMIT_MAX ? n : null;',
        replace: '  return Number.isSafeInteger(n) && n <= CREDIT_LIMIT_MAX ? n : null;',
      },
    ],
  },
  {
    name: 'credit-limit-save-is-on-before-anything-changed',
    breaks: [CREDIT],
    expect: '> nothing is saved until the amount has changed: Save and Cancel start switched off',
    edits: [
      { file: CARD, find: '  const ok = typed !== null && typed !== amount;', replace: '  const ok = typed !== null;' },
    ],
  },
  {
    name: 'credit-limit-finance-stays-closed-to-everyone-else',
    breaks: [CREDIT],
    expect: '> a team member: the read-only card, Finance alone in the menu, and nothing else of Settings is read',
    edits: [
      {
        file: PAGE,
        find: "  if (!isAdmin(me) && group === 'finance')",
        replace: "  if (!isAdmin(me) && group === 'no-such-group')",
      },
    ],
  },
  {
    name: 'credit-limit-is-drawn-twice-for-an-admin',
    breaks: [CREDIT],
    expect: '> an admin: the edit form with Undo, above the other Finance settings',
    edits: [
      {
        file: PAGE,
        find: '        settings={answer.settings.filter((x) => x.key !== CREDIT_LIMIT_KEY)}',
        replace: '        settings={answer.settings}',
      },
    ],
  },
  // ---- the same rule, in the browser
  {
    name: 'e2e-credit-limit-menu-lists-the-closed-groups',
    breaks: [E2E],
    expect: 'Finance alone in the menu',
    edits: [
      {
        file: PAGE,
        find: "      <SettingsShell current={group} title={t(def.label)} only={['finance']}>",
        replace: '      <SettingsShell current={group} title={t(def.label)}>',
      },
    ],
  },
  {
    name: 'e2e-credit-limit-read-only-view-draws-the-form',
    breaks: [E2E],
    expect: 'the read-only view',
    edits: [
      { file: PAGE, find: '        canEdit={credit.can_edit && mayChangeCreditLimit(me)}', replace: '        canEdit' },
    ],
  },
  // ---- the Settings menu
  {
    name: 'settings-menu-loses-its-icons',
    breaks: [MENU_TEST],
    expect: '> draws every group as a link, each with its icon in a peach circle',
    edits: [{ file: SHELL, find: '              <Icon className="size-5" />', replace: '' }],
  },
  {
    name: 'settings-menu-a-group-falls-back-to-the-plain-circle',
    breaks: [MENU_TEST],
    expect: '> gives each group an icon of its own',
    edits: [{ file: MENU, find: '  finance: Wallet,\n', replace: '' }],
  },
  {
    name: 'settings-menu-lists-every-group-to-everyone',
    breaks: [MENU_TEST],
    expect: '> lists only what opens for someone who is not an admin',
    edits: [
      {
        file: SHELL,
        find: '  const groups = settingsGroups().filter((g) => !only || only.includes(g.slug));',
        replace: '  const groups = settingsGroups().filter((g) => !only || g.slug !== only.join());',
      },
    ],
  },
  {
    name: 'settings-menu-pills-are-shorter-than-a-finger',
    breaks: [MENU_TEST],
    expect: '> is a wrapped row of pills a finger tall on a phone, and a column from 1,280 px',
    edits: [{ file: SHELL, find: "'inline-flex min-h-11 items-center", replace: "'inline-flex min-h-8 items-center" }],
  },
  {
    name: 'settings-list-opens-on-every-browser',
    breaks: [MENU_TEST],
    expect: '> a phone does; a computer, a tablet and an unknown browser open People & access',
    edits: [
      { file: MENU, find: "  return /\\bMobi/i.test(userAgent ?? '');", replace: '  return userAgent !== null;' },
    ],
  },
  // ---- People & access
  {
    name: 'people-tabs-are-not-links',
    breaks: [PEOPLE],
    expect: '> are pill tabs, each a link, People and Teams with their counts',
    edits: [{ file: ORG, find: '            href: `/settings/org?tab=${k}`,\n', replace: '' }],
  },
  {
    // Landing 30's plant, seen red by a unit test too: the switch column is back in the wide People table
    name: 'people-table-carries-the-test-switch-column-again',
    breaks: [PEOPLE],
    expect: '> has no switch column and no Sign in as test user button',
    edits: [
      {
        file: ORG,
        find: `                {t('settings.people.status')}
              </th>
`,
        replace: `                {t('settings.people.status')}
              </th>
              {rows.some(offered) ? <th className="px-4 py-2.5" aria-hidden="true" /> : null}
`,
      },
      {
        file: ORG,
        find: `                    <PersonStatus row={p} today={today} />
                  </td>
`,
        replace: `                    <PersonStatus row={p} today={today} />
                  </td>
                  {rows.some(offered) ? (
                    <td className="px-4 py-2.5">
                      {offered(p) ? (
                        <Button onClick={() => void sw.start(p.id)} disabled={sw.busy} data-test-switch-start={p.id}>
                          {t('testSwitch.start')}
                        </Button>
                      ) : null}
                    </td>
                  ) : null}
`,
      },
    ],
  },
  {
    name: 'people-table-keeps-its-words-on-one-line-again',
    breaks: [PEOPLE],
    expect: '> is a white card that scrolls inside itself and lets its words wrap',
    edits: [
      {
        file: ORG,
        find: 'sm:block">\n        <table className="w-full table-auto text-sm">',
        replace: 'sm:block">\n        <table className="w-full text-sm whitespace-nowrap">',
      },
    ],
  },
  {
    name: 'people-phone-list-says-allowed-on-every-row',
    breaks: [PEOPLE],
    expect: '> says nothing about the everyday case, and still says Switched off',
    edits: [
      {
        file: ORG,
        find: '          {isEveryday(p, today) ? null : <PersonStatus row={p} today={today} />}',
        replace: '          <PersonStatus row={p} today={today} />',
      },
    ],
  },
  {
    name: 'people-phone-list-mixes-the-test-users-in',
    breaks: [PEOPLE],
    expect: '> keeps the TEST users apart, counted and closed until asked for',
    edits: [
      { file: ORG, find: '  const everyday = rows.filter((p) => !p.is_test);', replace: '  const everyday = rows;' },
    ],
  },
  {
    name: 'people-empty-draws-a-table-of-headings',
    breaks: [PEOPLE],
    expect: '> is one line with Add person, not a table of headings',
    edits: [{ file: ORG, find: '  if (people.length === 0)\n', replace: '  if (people.length < 0)\n' }],
  },
  {
    name: 'access-legend-names-the-levels-without-their-meaning',
    breaks: [PEOPLE],
    expect: '> says what Full, Own, View and None mean, above the matrix',
    edits: [{ file: ORG, find: ' {t(`settings.access.legend.${l}`)}', replace: '' }],
  },
];
