// Settings → Targets: the plans that are open are listed, and a year a department already has a plan for is not offered again.
const E2E = 'e2e:tests/e2e/settings-targets-and-go-live.spec.ts';
const UNIT = 'unit:tests/unit/settings/targets-plans-read-in-the-pages-language.test.tsx';
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
  {
    name: 'targets-greyed-open-gives-no-reason',
    breaks: [E2E],
    expect: 'a greyed Open says why',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: '{dept && !years.length ? (',
        replace: '{false && dept && !years.length ? (',
      },
    ],
  },
  {
    name: 'targets-plan-name-stays-english',
    breaks: [UNIT],
    expect: 'reads an unrenamed plan in the page language',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: 'return d && p.name === `${d.name_en} ${p.year}` ?',
        replace: 'return false && d && p.name === `${d.name_en} ${p.year}` ?',
      },
    ],
  },
  {
    name: 'targets-no-department-gives-no-reason',
    breaks: [UNIT],
    expect: 'says why Open is grey when there is no department',
    edits: [
      {
        file: 'src/modules/perf/screens/TargetsScreen.tsx',
        find: '{live.length ? null : (',
        replace: '{true ? null : (',
      },
    ],
  },
];
