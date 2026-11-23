// Landing 44 (23 Nov) — the Activity page's What filter narrows the list and an entry shows only its changes of the
// chosen kind, and the Landing 33 phone drag is steadied. Each sabotage takes one promise back, and the test named
// must go red for it. (The read ignoring What is no longer a plant here: the screen now narrows what it is given
// too, so the list stays right either way; the read's own filter is the database's.)
const SCREEN = 'src/modules/settings/screens/ActivityScreen.tsx';
const E2E = 'e2e:tests/e2e/landing-44-activity-what-filter.spec.ts';
const UNIT = 'unit:tests/unit/shell/the-activity-what-filter-shows-only-the-chosen-kind-inside-an-entry.test.ts';

export const sabotages = [
  {
    name: 'activity-a-filtered-entry-shows-every-change',
    breaks: [UNIT],
    expect: '> a request that wrote many kinds at once shows its comment changes only',
    edits: [
      {
        file: SCREEN,
        find: '    .map((r) => ({ ...r, changes: r.changes.filter((c) => c.entity !== undefined && keys.includes(c.entity)) }))',
        replace: '    .map((r) => ({ ...r }))',
      },
    ],
  },
  {
    name: 'activity-the-screen-forgets-to-narrow-inside-an-entry',
    breaks: [E2E],
    expect: 'no entry is named Organisation added',
    edits: [
      {
        file: SCREEN,
        find: "  const allRows = onlyWhat(merged, current === 'changes' ? filters.entity : '');",
        replace: '  const allRows = merged;',
      },
    ],
  },
  {
    name: 'e2e-l44-what-writes-nothing-to-the-address',
    breaks: [E2E],
    expect: 'the choice is in the address',
    edits: [
      {
        file: SCREEN,
        find: '                  onValueChange={(v) => setFilter({ entity: v })}',
        replace: '                  onValueChange={() => setFilter({})}',
      },
    ],
  },
];
