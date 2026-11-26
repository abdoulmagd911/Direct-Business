// Landing 54 (25 Nov) — Reports → KPI pace on the screen: each KPI's pill, bar, Responsible, initiatives and
// pencil, the counts, and the curve. Each sabotage takes one promise back, and the test named must go red for it.
// The pace rule itself, the read and the three-KPIs-per-person rule are proven in supabase/tests/sabotage.
const SCREEN = 'src/modules/perf/screens/KpiPace.tsx';
const PACE = 'src/modules/perf/pace.ts';
const UNIT = 'unit:tests/unit/perf/landing-54-kpi-pace-shows-each-kpi-its-pace-and-status.test.tsx';

export const sabotages = [
  {
    name: 'l54-every-status-pill-is-green',
    breaks: [UNIT],
    expect: '> the status is in words, in its own colour',
    edits: [
      {
        file: SCREEN,
        find: '<StatusChip tone={STATUS_TONE[r.status]} className="mt-0.5">',
        replace: '<StatusChip tone="success" className="mt-0.5">',
      },
    ],
  },
  {
    name: 'l54-the-bar-runs-past-its-end',
    breaks: [UNIT],
    expect: '> the bar is filled to the pace, in the status colour, and never past the whole bar',
    edits: [{ file: PACE, find: '  return Math.max(0, Math.min(100, pace));', replace: '  return pace;' }],
  },
  {
    name: 'l54-a-kpi-with-nobody-responsible-says-nothing',
    breaks: [UNIT],
    expect: '> a KPI with nobody Responsible says Not set',
    edits: [
      {
        file: SCREEN,
        find: '<span className="text-muted">{t(\'noResponsible\')}</span>',
        replace: '<span className="text-muted" />',
      },
    ],
  },
  {
    name: 'l54-everyone-gets-the-pencil',
    breaks: [UNIT],
    expect: '> only for a person who may edit targets',
    edits: [
      {
        file: SCREEN,
        find: '                      {answer.can_edit ? (',
        replace: '                      {answer ? (',
      },
    ],
  },
  {
    name: 'l54-view-them-leads-where-the-person-may-not-go',
    breaks: [UNIT],
    expect: '> View them is only for a person who may open Projects',
    edits: [
      {
        file: SCREEN,
        find: '                          {answer.can_see_projects ? (',
        replace: '                          {answer ? (',
      },
    ],
  },
  {
    name: 'l54-the-year-buttons-lose-the-month',
    breaks: [UNIT],
    expect: '> the year selector offers the three years',
    edits: [{ file: SCREEN, find: 'href={hrefOf(inYear(month, y))}', replace: 'href={hrefOf(`${y}-01`)}' }],
  },
  {
    name: 'l54-the-actual-line-runs-past-today',
    breaks: [UNIT],
    expect: '> the curve: the target follows each day’s share; the actual runs to today and stops',
    edits: [
      {
        file: PACE,
        find: '    if (i <= upTo) actual.push({ x: at(i), y: running / max });',
        replace: '    actual.push({ x: at(i), y: running / max });',
      },
    ],
  },
  {
    name: 'l54-the-drawing-is-not-mirrored-in-arabic',
    breaks: [UNIT],
    expect: '> the drawing is mirrored and the arrows turn',
    edits: [
      {
        file: SCREEN,
        find: 'className="block h-44 w-full overflow-visible rtl:-scale-x-100"',
        replace: 'className="block h-44 w-full overflow-visible"',
      },
    ],
  },
];
