// Sabotages for the Architect's small ask of 16 Oct on Achievements: the deal value reads only a number, the page says
// its title and its All once, and Done (never Cancelled) offers the achievement.
const E2E = 'e2e:tests/e2e/achievement-sense.spec.ts';
const LIST = 'src/modules/perf/screens/AchievementList.tsx';
const STATUS = 'src/modules/tasks/screens/StatusControl.tsx';

export const sabotages = [
  {
    name: 'deal-value-takes-any-text',
    breaks: [E2E],
    expect: 'is refused',
    edits: [
      {
        file: 'src/modules/perf/screens/LogAchievement.tsx',
        find: 'if (!/^[\\d,]*\\.?\\d*$/.test(plain) || !/\\d/.test(plain)) return null;',
        replace: 'if (!plain) return null;',
      },
    ],
  },
  {
    name: 'achievements-title-repeats',
    breaks: [E2E],
    expect: 'the title is said once on the page',
    edits: [
      {
        file: LIST,
        find: "<PageHeader\n        title={t('title')}",
        replace: "<PageHeader\n        crumbs={[{ label: tc('nav.kpis'), href: '/kpis' }]}\n        title={t('title')}",
      },
    ],
  },
  {
    name: 'two-all-filters',
    breaks: [E2E],
    expect: 'one All among the filters',
    edits: [{ file: LIST, find: "label: t('filters.allCategories')", replace: "label: t('filters.all')" }],
  },
  {
    name: 'done-offers-nothing',
    breaks: [E2E],
    expect: 'Done offers the achievement',
    edits: [
      {
        file: STATUS,
        find: '      finished && canLog\n',
        replace: '      false && finished && canLog\n',
      },
    ],
  },
  {
    name: 'cancel-offers-the-achievement',
    breaks: [E2E],
    expect: 'Cancelled offers nothing',
    edits: [
      {
        file: STATUS,
        find: "move.kind === 'status' && move.status.meaning === 'done');",
        replace: "move.kind === 'status');",
      },
    ],
  },
];
