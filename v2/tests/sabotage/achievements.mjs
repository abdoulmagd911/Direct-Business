// Sabotages for the achievements screens (builder E, GC-4): each breaks one promise, and the named test must go red.
export const sabotages = [
  {
    name: 'filter-forgets-the-month',
    breaks: ['unit:tests/unit/achievements/the-list-filters-live-in-the-address-and-reach-the-door.test.ts'],
    expect: 'reads an address back into the same filter',
    edits: [{ file: 'src/modules/perf/types.ts', find: "  if (f.month) q.set('month', f.month);", replace: '' }],
  },
  {
    name: 'log-sends-no-reference',
    breaks: ['e2e:tests/e2e/achievements.spec.ts'],
    expect: 'MADE-UP-',
    edits: [
      {
        file: 'src/modules/perf/screens/LogAchievement.tsx',
        find: 'const refs = ref.trim() ?',
        replace: 'const refs = false ?',
      },
    ],
  },
];
