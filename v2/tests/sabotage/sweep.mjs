// Sabotages for the 12 Oct production sweep (builder B): each breaks one promise of tests/e2e/sweep-12-oct.spec.ts and
// the named test must go red for that reason.
const E2E = 'e2e:tests/e2e/sweep-12-oct.spec.ts';
const RECORD = 'src/modules/partners/screens/PartnerRecord.tsx';

export const sabotages = [
  {
    name: 'overview-tab-repeats-the-timeline',
    breaks: [E2E],
    expect: 'Overview does not repeat the timeline',
    edits: [
      { file: RECORD, find: "{tab === 'activity' ? (", replace: "{tab === 'activity' || tab === 'overview' ? (" },
    ],
  },
  {
    name: 'activity-tab-repeats-the-details',
    breaks: [E2E],
    expect: 'Activity does not repeat the details',
    edits: [
      { file: RECORD, find: "{tab === 'overview' ? (", replace: "{tab === 'overview' || tab === 'activity' ? (" },
    ],
  },
  {
    name: 'client-page-says-partner-added',
    breaks: [E2E],
    expect: 'a client’s timeline says Client added',
    edits: [
      {
        file: RECORD,
        find: "partner: side === 'client' ? t('partners.side.client') : t('partners.side.supplier_partner'),",
        replace: "partner: 'Partner',",
      },
    ],
  },
  {
    name: 'empty-figure-says-not-measured',
    breaks: [E2E],
    expect: 'a client with no activity says so',
    edits: [
      {
        file: 'src/ui/record/KeyFigures.tsx',
        find: '{f.value ?? f.empty ?? notMeasured}',
        replace: '{f.value ?? notMeasured}',
      },
    ],
  },
  {
    name: 'one-organisations',
    breaks: [E2E],
    expect: '1 organisation, not 1 organisations',
    edits: [
      {
        file: 'messages/en.json',
        find: '"count": "{count, plural, one {# organisation} other {# organisations}}"',
        replace: '"count": "{count} organisations"',
      },
    ],
  },
  {
    name: 'page-ends-under-the-plus',
    breaks: [E2E],
    expect: 'the page keeps the + clear',
    edits: [
      {
        file: 'src/ui/shell/AppShell.tsx',
        find: 'px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-6',
        replace: 'px-4 pb-24 pt-6',
      },
    ],
  },
  {
    name: 'key-partner-switch-has-no-label',
    breaks: [E2E],
    expect: 'the switch has a visible label',
    edits: [
      {
        file: 'src/modules/partners/screens/NewPartnerDialog.tsx',
        find: '<span className="text-sm font-medium" id="new-partner-key">',
        replace: '<span className="hidden" id="new-partner-key">',
      },
    ],
  },
  {
    name: 'task-form-keeps-new-in-the-address',
    breaks: [E2E],
    expect: 'the address no longer opens the form again',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskListScreen.tsx',
        find: 'if (byAddress) {',
        replace: 'if (false) {',
      },
    ],
  },
  {
    name: 'admin-menu-loses-finance-and-settings',
    breaks: [E2E],
    expect: 'More carries Settings for',
    edits: [
      {
        file: 'src/ui/shell/nav.ts',
        find: 'return [...navFor(me), ...(isAdmin(me) ? [SETTINGS_ENTRY] : [])];',
        replace: 'return [...navFor(me)];',
      },
    ],
  },
  {
    name: 'arabic-filter-label-missing',
    breaks: ['unit:tests/unit/words/the-filter-label-exists-in-arabic-and-a-count-agrees-in-number.test.ts'],
    expect: 'the Arabic Filter label exists',
    edits: [{ file: 'messages/ar.json', find: '"filter": "تصفية"', replace: '"filterRemoved": "تصفية"' }],
  },
  {
    name: 'task-form-wipes-the-router-state',
    // updated in #269 (V284): the fault is now keeping the router's state when the form's ?new=1 is cleared, so the next
    // refresh of the list writes ?new=1 back (Tasks passes null, as Partners does)
    breaks: ['e2e:tests/e2e/sweep-15-oct.spec.ts'],
    expect: 'from the header, the address stays the list’s',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskListScreen.tsx',
        find: "window.history.replaceState(null, '', `${url.pathname}${url.search}`);",
        replace: "window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);",
      },
    ],
  },
];
