// Settings → Targets: the plans that are open are listed, and a year a department already has a plan for is not offered again.
const E2E = 'e2e:tests/e2e/settings-targets-and-go-live.spec.ts';
export const sabotages = [
  {
    name: 'targets-offers-a-year-that-has-a-plan',
    breaks: [E2E],
    expect: 'a year with a plan is not offered',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: 'y >= FIRST_YEAR; y--) if (!held.has(y)) out.push(y);',
        replace: 'y >= FIRST_YEAR; y--) out.push(y);',
      },
    ],
  },
  {
    name: 'targets-lists-no-plan',
    breaks: [E2E],
    expect: 'data-plan-row',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: '{plans.length ? (',
        replace: '{plans.length < 0 ? (',
      },
    ],
  },
];
