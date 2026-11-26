// Landing 54 (25 Nov) — Reports → KPI pace in the browser (tests/e2e/landing-54-kpi-pace.spec.ts and its Arabic
// twin). Each sabotage takes one promise back on the real page, and the spec must go red for it with the words named.
const SCREEN = 'src/modules/perf/screens/KpiPace.tsx';
const REPORTS = 'src/modules/perf/screens/ReportSummary.tsx';
const E2E = 'e2e:tests/e2e/landing-54-kpi-pace.spec.ts';
const ARABIC = 'e2e:tests/e2e/landing-54-kpi-pace-arabic.alone.spec.ts';

export const sabotages = [
  {
    name: 'e2e-l54-reports-has-no-way-to-kpi-pace',
    breaks: [E2E],
    expect: 'Reports has the way to KPI pace',
    edits: [{ file: REPORTS, find: '              data-report-kpi-pace\n', replace: '' }],
  },
  {
    name: 'e2e-l54-today-is-not-marked',
    breaks: [E2E],
    expect: 'the current month marks today',
    edits: [{ file: SCREEN, find: '            data-pace-today\n', replace: '' }],
  },
  {
    name: 'e2e-l54-the-drawing-is-not-mirrored-in-arabic',
    breaks: [ARABIC],
    expect: 'the drawing is mirrored',
    edits: [
      {
        file: SCREEN,
        find: 'className="block h-44 w-full overflow-visible rtl:-scale-x-100"',
        replace: 'className="block h-44 w-full overflow-visible"',
      },
    ],
  },
];
