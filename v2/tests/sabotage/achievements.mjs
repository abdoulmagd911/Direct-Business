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
  {
    name: 'list-row-centres-its-title',
    breaks: ['e2e:tests/e2e/achievements-phone.spec.ts'],
    expect: "starts at the card's padding, not centred",
    edits: [
      {
        file: 'src/modules/perf/screens/AchievementList.tsx',
        find: 'flex min-w-0 flex-col items-stretch gap-1 px-4 py-3',
        replace: 'flex min-w-0 flex-col gap-1 px-4 py-3',
      },
    ],
  },
  {
    name: 'month-box-is-only-dashes',
    breaks: ['e2e:tests/e2e/achievements-phone.spec.ts'],
    expect: 'an empty month box says Any month, not only dashes',
    edits: [{ file: 'src/modules/perf/screens/AchievementList.tsx', find: "{t('filters.anyMonth')}", replace: "{''}" }],
  },
  {
    name: 'list-switches-explain-nothing',
    breaks: ['e2e:tests/e2e/achievements-phone.spec.ts'],
    expect: 'says what it means',
    edits: [
      {
        file: 'src/modules/perf/screens/AchievementList.tsx',
        find: '{t(`filters.meaning.${k}`)}',
        replace: "{''}",
      },
    ],
  },
  {
    name: 'list-title-is-cut-to-one-line',
    breaks: ['e2e:tests/e2e/achievements-phone.spec.ts'],
    expect: 'wraps over more than one line',
    edits: [
      {
        file: 'src/modules/perf/screens/AchievementList.tsx',
        find: 'className="line-clamp-3 break-words font-medium text-text"',
        replace: 'className="block truncate font-medium text-text"',
      },
    ],
  },
  {
    name: 'record-trail-repeats-the-list',
    breaks: ['e2e:tests/e2e/achievement-record.spec.ts'],
    expect: 'two parts: the list and this record',
    edits: [
      {
        file: 'src/modules/perf/screens/AchievementRecord.tsx',
        find: '{ label: `${a.number} · ${a.title}` }]}',
        replace: "{ label: t('title'), href: '/kpis/achievements' }]}",
      },
    ],
  },
  {
    name: 'record-title-cut-on-a-phone',
    breaks: ['e2e:tests/e2e/achievement-record.spec.ts'],
    expect: 'a phone shows the whole title: no clamp, no ellipsis',
    edits: [
      {
        file: 'src/modules/perf/screens/AchievementRecord.tsx',
        find: 'titleClamp="sm:line-clamp-3"',
        replace: 'titleClamp="line-clamp-2"',
      },
    ],
  },
  {
    name: 'record-shows-evidence-twice',
    breaks: ['e2e:tests/e2e/achievement-record.spec.ts'],
    expect: 'no separate Evidence figure',
    edits: [
      {
        file: 'src/modules/perf/screens/AchievementRecord.tsx',
        find: "    { key: 'date', label: t('figures.date'),",
        replace:
          "    { key: 'refs', label: t('tabs.evidence'), value: formatNumber(a.refs.length, locale) },\n    { key: 'date', label: t('figures.date'),",
      },
    ],
  },
  {
    name: 'month-x-clears-every-filter',
    breaks: ['e2e:tests/e2e/achievement-record.spec.ts'],
    expect: 'the x clears the month and keeps Mine',
    edits: [
      {
        file: 'src/modules/perf/screens/AchievementList.tsx',
        find: 'onClick={() => go({ ...filter, month: undefined })}\n                className="absolute',
        replace: 'onClick={() => go({})}\n                className="absolute',
      },
    ],
  },
  {
    name: 'empty-list-offers-no-way-out',
    breaks: ['e2e:tests/e2e/achievement-record.spec.ts'],
    expect: 'clear',
    edits: [
      {
        file: 'src/modules/perf/screens/AchievementList.tsx',
        find: '            filtered ? (\n              <Button size="sm" variant="secondary"',
        replace: '            false ? (\n              <Button size="sm" variant="secondary"',
      },
    ],
  },
];
