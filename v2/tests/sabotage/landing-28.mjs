// Landing 28 (15 Nov): the broken-pages fix — the Discount Codes reads run with JIT off, a failed code detail says
// what failed, and the Activity page neither offers the settings log to a switched session nor falls when one of
// its reads fails. Each sabotage takes one of those back, and the test named must go red for it.
const MIGRATION = 'supabase/migrations/20261115100000_codes_reads_no_jit.sql';
const ACTIVITY_PAGE = 'src/app/(app)/activity/page.tsx';
const CODES_PAGE = 'src/app/(app)/codes/page.tsx';
const SWITCHED = 'unit:tests/unit/pages/a-switched-session-is-not-offered-the-settings-log.test.tsx';
const CODES_ERROR = 'unit:tests/unit/pages/a-failed-codes-detail-says-what-failed.test.tsx';
const E2E = 'e2e:tests/e2e/landing-28-codes-detail-and-switched-activity.spec.ts';

export const sabotages = [
  // ---- JIT-05: each drops the setting for one function from the migration
  {
    name: 'codes-list-loses-jit-off',
    breaks: ['sql:JIT-05'],
    expect: 'finance.codes_list runs with JIT off',
    edits: [{ file: MIGRATION, find: 'alter function finance.codes_list() set jit = off;', replace: '' }],
  },
  {
    name: 'codes-detail-loses-jit-off',
    breaks: ['sql:JIT-05'],
    expect: 'finance.codes_detail runs with JIT off',
    edits: [{ file: MIGRATION, find: 'alter function finance.codes_detail(uuid) set jit = off;', replace: '' }],
  },
  {
    name: 'codes-by-company-loses-jit-off',
    breaks: ['sql:JIT-05'],
    expect: 'finance.codes_by_company runs with JIT off',
    edits: [{ file: MIGRATION, find: 'alter function finance.codes_by_company() set jit = off;', replace: '' }],
  },
  // ---- the switched session and the settings log
  {
    name: 'switched-session-asks-for-the-settings-log',
    breaks: [SWITCHED],
    expect: '> the settings address lands on the default tab, and the settings log is never asked for',
    edits: [
      {
        file: ACTIVITY_PAGE,
        find: "  if (me.test_switch && tab === 'settings') {",
        replace: "  if (me.test_switch && tab === 'never') {",
      },
    ],
  },
  {
    name: 'switched-session-is-drawn-the-settings-tab',
    breaks: [SWITCHED],
    expect: '> the tab row of a switched session has no Settings tab; the other three stay',
    edits: [
      {
        file: 'src/modules/settings/screens/ActivityScreen.tsx',
        find: "me.test_switch ? TABS.filter((k) => k !== 'settings') : TABS",
        replace: 'TABS',
      },
    ],
  },
  // ---- one failing read never takes the page down
  {
    name: 'activity-tab-read-is-not-caught',
    breaks: [SWITCHED],
    expect: '> a refused tab read leaves the tab row standing and says what failed',
    edits: [{ file: ACTIVITY_PAGE, find: '    readAgain(tabRead, keep),', replace: '    tabRead(),' }],
  },
  // ---- a failed code detail says what failed
  {
    name: 'codes-detail-drops-its-error',
    breaks: [CODES_ERROR],
    expect: '> a statement cancelled for time shows its kind and its code',
    edits: [{ file: CODES_PAGE, find: '            detailFailure.ref = failureRef(e);', replace: '' }],
  },
  // ---- the same two, in the browser
  {
    name: 'e2e-codes-detail-drops-its-error',
    breaks: [E2E],
    expect: 'the failed detail says what failed',
    edits: [{ file: CODES_PAGE, find: '            detailFailure.ref = failureRef(e);', replace: '' }],
  },
  {
    name: 'e2e-switched-session-is-offered-the-settings-log',
    breaks: [E2E],
    expect: 'the settings address lands on the default tab',
    edits: [
      {
        file: ACTIVITY_PAGE,
        find: "  if (me.test_switch && tab === 'settings') {",
        replace: "  if (me.test_switch && tab === 'never') {",
      },
    ],
  },
];
