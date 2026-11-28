// Landing 40 (23 Nov) — per-member settings (the owner's approved design of 22 Nov 2026): three extras on a person's
// record — Import files on Finance, Edit someone else's work, Change credit limits — each As their role, Allowed or
// View only; a Viewer stays view-only. Each sabotage takes one promise back, and the test named must go red for it.
// The database's own rules are proven in supabase/tests/sabotage (XTR-01 to XTR-04).
const RULE = 'src/modules/org/extra-access.ts';
const IMPORT_RULE = 'src/modules/finance/may-import.ts';
const RECORD = 'src/modules/org/screens/PersonRecord.tsx';
const LIVE = 'src/modules/finance/screens/FinanceOverviewLive.tsx';
const UNIT = 'unit:tests/unit/org/the-three-extras-on-a-persons-record-and-who-is-offered-the-import.test.ts';
const E2E = 'e2e:tests/e2e/landing-40-per-member-settings.spec.ts';

export const sabotages = [
  // ---- the rule for the screen
  {
    name: 'extras-view-only-reads-as-allowed',
    breaks: [UNIT],
    expect: '> read a person’s own setting: none is As their role, granted is Allowed, not granted is View only',
    edits: [
      {
        file: RULE,
        find: "  return own ? (own.granted ? 'allowed' : 'view_only') : 'as_role';",
        replace: "  return own ? 'allowed' : 'as_role';",
      },
    ],
  },
  {
    name: 'extras-credit-row-sets-the-wrong-capability',
    breaks: [UNIT],
    expect: '> are Import, Edit someone else’s work and Change credit limits, each one capability',
    edits: [{ file: RULE, find: "  credit: 'finance.credit_control',", replace: "  credit: 'finance.credit'," }],
  },
  {
    name: 'import-section-offered-to-a-viewer',
    breaks: [UNIT],
    expect: '> never a Viewer, whatever they hold, nor a person with no role',
    edits: [
      {
        file: IMPORT_RULE,
        find: "  return role.key !== 'viewer' && me.capabilities.includes('finance.import');",
        replace: "  return me.capabilities.includes('finance.import');",
      },
    ],
  },
  {
    name: 'import-section-offered-on-the-level-alone',
    breaks: [UNIT],
    expect: '> nobody without it: a team member and a manager with Finance at Full are not',
    edits: [
      {
        file: IMPORT_RULE,
        find: "  return role.key !== 'viewer' && me.capabilities.includes('finance.import');",
        replace: "  return role.key !== 'viewer';",
      },
    ],
  },
  // ---- the real stack
  {
    name: 'e2e-l40-the-import-section-ignores-the-extra',
    breaks: [E2E],
    expect: 'a member is not offered the import by role',
    edits: [
      {
        file: LIVE,
        find: '  const imports = mayType && mayImport;',
        replace: '  const imports = mayType;',
      },
    ],
  },
  {
    name: 'e2e-l40-a-viewer-is-offered-the-pickers',
    breaks: [E2E],
    expect: 'and says a Viewer stays view-only',
    edits: [
      { file: RECORD, find: "          ) : access.role?.key === 'viewer' ? (", replace: '          ) : false ? (' },
    ],
  },
  {
    name: 'e2e-l40-as-their-role-keeps-the-setting',
    breaks: [E2E],
    expect: 'the row is back at As their role',
    edits: [
      {
        file: RECORD,
        find: "          ? rpc('access_clear_person_capability', { p_person: person.id, p_capability: capability, p_reason: reason })",
        replace:
          "          ? rpc('access_set_person_capability', { p_person: person.id, p_capability: capability, p_granted: false, p_reason: reason })",
      },
    ],
  },
  {
    name: 'e2e-l40-the-record-does-not-say-who-set-it',
    breaks: [E2E],
    expect: 'and who set it',
    edits: [
      {
        file: RECORD,
        find: '                              name: nameOf(setter, locale),',
        replace: "                              name: '',",
      },
    ],
  },
];
