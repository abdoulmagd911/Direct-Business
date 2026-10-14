// Sabotages for Productivity Stage 2, builder B2's half (the Reminder's When, the Today block's reminders and follow-ups):
// each breaks one promise of its specs.
const WHEN = 'unit:tests/unit/my-day/when-and-today-reminders.test.ts';
const TODAY =
  'unit:tests/unit/my-day/the-today-block-lists-reminders-and-names-a-followups-record-only-to-who-may-see-it.test.tsx';

export const sabotages = [
  {
    name: 'when-thursday-reads-friday',
    breaks: [WHEN],
    expect: 'reads Sunday for Tomorrow on a Thursday',
    edits: [
      {
        file: 'src/modules/my-day/when.ts',
        find: 'const tomorrowDay = nextWorkingDay(day);',
        replace:
          'const tomorrowDay = new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);',
      },
    ],
  },
  {
    name: 'when-later-today-passes-the-end-of-the-day',
    breaks: [WHEN],
    expect: 'never past 17:30',
    edits: [
      {
        file: 'src/modules/my-day/when.ts',
        find: 'Math.min(Math.ceil((minutes + 180) / 5) * 5, DAY_END)',
        replace: 'Math.ceil((minutes + 180) / 5) * 5',
      },
    ],
  },
  {
    name: 'when-next-week-equals-tomorrow',
    breaks: [WHEN],
    expect: 'makes Next week the first Sunday after Tomorrow',
    edits: [
      {
        file: 'src/modules/my-day/when.ts',
        find: 'next: `${nextSunday(tomorrowDay)}T${MORNING}`',
        replace: 'next: `${nextSunday(day)}T${MORNING}`',
      },
    ],
  },
  {
    name: 'when-pick-with-no-day-blocks-save',
    breaks: [WHEN],
    expect: 'never leaves Save without a time',
    edits: [
      {
        file: 'src/modules/my-day/when.ts',
        find: '`${pick.day || opts.tomorrow.slice(0, 10)}T${pick.time || MORNING}`',
        replace: '`${pick.day}T${pick.time}`',
      },
    ],
  },
  {
    name: 'when-riyadh-day-from-the-browser-clock',
    breaks: [WHEN],
    expect: 'takes the day from Riyadh',
    edits: [
      {
        file: 'src/modules/my-day/when.ts',
        find: 'const r = new Date(now.getTime() + 3 * 3_600_000);',
        replace: 'const r = new Date(now.getTime());',
      },
    ],
  },
  {
    name: 'today-lists-reminders-of-later-days',
    breaks: [WHEN],
    expect: 'leaving later days out',
    edits: [
      {
        file: 'src/modules/my-day/today-reminders.ts',
        find: 'today: all.filter((r) => r.day === day)',
        replace: 'today: all.filter((r) => r.day >= day)',
      },
    ],
  },
  {
    name: 'today-lists-a-reminder-twice',
    breaks: [WHEN],
    expect: 'lists a reminder once',
    edits: [
      {
        file: 'src/modules/my-day/today-reminders.ts',
        find: 'byId.set(r.id, row(r, null))',
        replace: 'byId.set(r.id + "p", row(r, null))',
      },
    ],
  },
  {
    name: 'today-followup-names-a-record-the-reader-may-not-see',
    breaks: [TODAY],
    expect: 'says only "Follow up" when the record is not',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: '{task.about?.label',
        replace: "{(task.about?.label ?? task.partner_name ?? 'Waha Foods')",
      },
    ],
  },
  {
    name: 'today-reminder-has-no-tick',
    breaks: [TODAY],
    expect: 'a tick that says what it ends',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: 'data-reminder-done',
        replace: 'data-reminder-nothing',
      },
    ],
  },
  {
    name: 'today-failed-reminders-read-hides-the-block',
    breaks: [TODAY],
    expect: 'draws its own failed line',
    edits: [{ file: 'src/modules/my-day/screens/TodayBlock.tsx', find: '{due === null ? (', replace: '{false ? (' }],
  },
];
