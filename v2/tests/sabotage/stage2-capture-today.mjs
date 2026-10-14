// Sabotages for Productivity Stage 2, builder B2's half (the reminders and follow-up tags in the Today block): each breaks
// one promise of its specs.
const GROUP = 'unit:tests/unit/my-day/today-reminders.test.ts';
const TODAY =
  'unit:tests/unit/my-day/the-today-block-lists-reminders-and-names-a-followups-record-only-to-who-may-see-it.test.tsx';
const E2E = 'e2e:tests/e2e/stage2-capture-today.spec.ts';

export const sabotages = [
  {
    name: 'today-lists-reminders-of-later-days',
    breaks: [GROUP],
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
    breaks: [GROUP],
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
    name: 'today-riyadh-day-from-the-browser-clock',
    breaks: [GROUP],
    expect: 'reads the day in Riyadh',
    edits: [
      {
        file: 'src/modules/my-day/today-reminders.ts',
        find: 'Date.parse(iso) + 3 * 3_600_000',
        replace: 'Date.parse(iso)',
      },
    ],
  },
  {
    name: 'today-followup-names-a-record-the-reader-may-not-see',
    breaks: [TODAY],
    expect: 'says only "Reminder" when the record is not',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: '{r.about?.label',
        replace: "{(r.about?.label ?? 'Waha Foods')",
      },
    ],
  },
  {
    name: 'today-followup-is-titled-by-its-record',
    breaks: [TODAY],
    expect: 'never takes the record',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: 'const title = r.text ||',
        replace: 'const title = r.text || r.about?.label ||',
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
  {
    name: 'today-reminder-tick-does-nothing',
    breaks: [E2E],
    expect: 'a reminder due today shows in Today',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: 'onClick={() => void done()}',
        replace: 'onClick={() => undefined}',
      },
    ],
  },
  {
    name: 'today-reminder-listed-in-both-blocks',
    breaks: [GROUP],
    expect: 'keeps in the Reminders block only the ones for a later day',
    edits: [
      {
        file: 'src/modules/my-day/today-reminders.ts',
        find: 'riyadhParts(r.remind_at).day > day',
        replace: 'riyadhParts(r.remind_at).day >= day',
      },
    ],
  },
];
