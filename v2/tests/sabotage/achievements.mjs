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
  {
    name: 'log-skips-the-repeat-check',
    breaks: ['e2e:tests/e2e/achievements.spec.ts'],
    expect: 'Logged before?',
    edits: [
      {
        file: 'src/modules/perf/screens/LogAchievement.tsx',
        find: '    if (found.length) setRepeats(found);',
        replace: '    if (false) setRepeats(found);',
      },
    ],
  },
  {
    name: 'held-typed-read-as-a-report',
    breaks: ['unit:tests/unit/achievements/the-grid-reads-held-keys-and-categories-as-the-door-answers.test.ts'],
    expect: 'reads a report, a typed value and a blank one apart',
    edits: [
      {
        file: 'src/modules/perf/backfill.ts',
        find: "from: r.typed ? 'typed' :",
        replace: "from: false ? 'typed' :",
      },
    ],
  },
  {
    name: 'capped-achievements-say-nothing',
    breaks: ['unit:tests/unit/achievements/the-list-says-when-it-shows-only-the-first-rows.test.tsx'],
    expect: 'says it shows 200 of 230',
    edits: [
      {
        file: 'src/modules/perf/screens/AchievementList.tsx',
        find: '{page ? <CappedNote shown={page.rows.length} total={page.total} /> : null}',
        replace: '{null}',
      },
    ],
  },
  {
    name: 'log-offers-no-categories',
    breaks: ['e2e:tests/e2e/achievements.spec.ts'],
    expect: 'the seven starting categories',
    edits: [
      {
        file: 'src/modules/perf/screens/LogAchievement.tsx',
        find: 'const live = categories.filter((c) => c.active);',
        replace: 'const live = categories.filter(() => false);',
      },
    ],
  },
  {
    name: 'no-plan-offers-no-way-on',
    breaks: ['e2e:tests/e2e/achievements.spec.ts'],
    expect: 'an admin opens the plan here',
    edits: [
      {
        file: 'src/modules/perf/screens/LogAchievement.tsx',
        find: '{!department.id ? null : canOpenPlan ? (',
        replace: '{!department.id ? null : false ? (',
      },
    ],
  },
  {
    name: 'note-turns-into-no-achievement',
    breaks: ['e2e:tests/e2e/achievements-from-note.spec.ts'],
    expect: 'Achievement from note opens from Turn into',
    edits: [
      {
        file: 'src/modules/my-day/screens/NotePage.tsx',
        find: "open={turning === 'achievement'}",
        replace: 'open={false}',
      },
    ],
  },
  {
    name: 'achievement-forgets-its-note',
    breaks: ['e2e:tests/e2e/achievements-from-note.spec.ts'],
    expect: 'the achievement says it came from the note',
    edits: [
      {
        file: 'src/modules/perf/screens/AchievementRecord.tsx',
        find: '{data.fromNote ? <FromNoteChip note={data.fromNote} /> : null}',
        replace: '{null}',
      },
    ],
  },
  {
    // V381: the achievement's Turn into flag is set once its dialog and its door are in; without it the menu leaves it out
    name: 'achievement-turn-into-waits-on-a-flag-nobody-sets',
    breaks: ['unit:tests/unit/my-day/my-day-turns-a-note-into-what-has-landed-and-wraps-up-the-day.test.tsx'],
    expect: 'the achievement Turn into is switched on',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "new Set(['kpis.turn_into', 'tasks.turn_into_task'])",
        replace: "new Set(['tasks.turn_into_task'])",
      },
    ],
  },
  {
    name: 'no-department-offers-a-dead-button',
    breaks: ['unit:tests/unit/achievements/log-says-what-to-fix-when-there-is-no-plan.test.tsx'],
    expect: 'no Open button without a department',
    edits: [
      {
        file: 'src/modules/perf/screens/LogAchievement.tsx',
        find: '{!department.id ? null : canOpenPlan ? (',
        replace: '{canOpenPlan ? (',
      },
    ],
  },
];
