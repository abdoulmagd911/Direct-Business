// Sabotages for V627's one exception to "a setting list is edited on a settings page" (V97, V138).
// Run: node scripts/sabotage.mjs --kind unit
const target = 'unit:tests/unit/registry/a-list-kept-on-its-modules-own-page.test.ts';

export const sabotages = [
  {
    name: 'a-kept-list-leaves-settings',
    breaks: [target],
    expect: '> keeps the three Finance lists on the finance page, shown under Settings › Finance',
    edits: [
      {
        file: 'src/modules/settings/groups.ts',
        find: '(e.page === pageKey || e.shownIn === pageKey)',
        replace: '(e.page === pageKey)',
      },
    ],
  },
  {
    name: 'any-page-keeps-a-list',
    breaks: [target],
    expect: "> refuses a list on any page but its module's own, or kept there without a Settings group",
    edits: [
      {
        file: 'src/core/registry/snapshot.ts',
        find: "e.page === m.key && (e.shownIn ?? '')",
        replace: "e.page !== null && (e.shownIn ?? '')",
      },
    ],
  },
];
