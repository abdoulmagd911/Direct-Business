// Sabotages for the When chips and the Follow up entry of the sheet (productivity stage 2, PR 1, builder B).
const UNIT = 'unit:tests/unit/my-day/the-when-chips-answer-in-riyadh-time.test.ts';
const E2E = 'e2e:tests/e2e/when-chips.spec.ts';
const WHEN = 'a Reminder opens with Tomorrow chosen and says the result';
const FOLLOW = 'a door that opens the sheet with a record gets a Follow up';

export const sabotages = [
  {
    name: 'when-tomorrow-ignores-the-weekend',
    breaks: [UNIT],
    expect: 'makes Tomorrow the next working day at nine',
    edits: [
      {
        file: 'src/modules/my-day/when.ts',
        find: 'day: nextWorkingDay(riyadhNow(now).day)',
        replace: 'day: new Date(Date.parse(`${riyadhNow(now).day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)',
      },
    ],
  },
  {
    name: 'when-later-today-runs-past-the-day',
    breaks: [UNIT],
    expect: 'puts Later today three hours on',
    edits: [
      {
        file: 'src/modules/my-day/when.ts',
        find: 'Math.min(minutes + LATER_BY_MINUTES, toMinutes(WORKDAY_END))',
        replace: 'minutes + LATER_BY_MINUTES',
      },
    ],
  },
  {
    name: 'when-instant-is-read-as-utc',
    breaks: [UNIT],
    expect: 'sends the Riyadh day and time at UTC+3',
    edits: [{ file: 'src/modules/my-day/when.ts', find: ':00+03:00`;', replace: ':00Z`;' }],
  },
  {
    name: 'when-next-week-is-not-a-sunday',
    breaks: [UNIT],
    expect: 'makes Next week the next Sunday at nine',
    edits: [
      {
        file: 'src/modules/my-day/when.ts',
        find: 'while (d.getUTCDay() !== 0);',
        replace: 'while (d.getUTCDay() !== 1);',
      },
    ],
  },
  {
    name: 'when-says-no-result-line',
    breaks: [E2E],
    expect: WHEN,
    edits: [
      {
        file: 'src/modules/my-day/screens/WhenPicker.tsx',
        find: '{chosen ? (',
        replace: '{chosen && value.length < 0 ? (',
      },
    ],
  },
  {
    name: 'when-starts-on-next-week',
    breaks: [E2E],
    expect: WHEN,
    edits: [
      {
        file: 'src/modules/my-day/screens/QuickCapture.tsx',
        find: "setWhenKey('tomorrow');",
        replace: "setWhenKey('next_week');",
      },
    ],
  },
  {
    name: 'follow-up-forgets-its-record',
    breaks: [E2E],
    expect: FOLLOW,
    edits: [
      {
        file: 'src/modules/my-day/quick-capture.ts',
        find: '...(opts.about ? { about: opts.about } : {})',
        replace: '',
      },
    ],
  },
  {
    name: 'follow-up-is-shared-with-the-team',
    breaks: [E2E],
    expect: FOLLOW,
    edits: [
      {
        file: 'src/modules/my-day/screens/QuickCapture.tsx',
        find: "visibility: about ? 'private' : visibility,",
        replace: "visibility: about ? 'team' : visibility,",
      },
    ],
  },
  {
    name: 'follow-up-offers-the-kind-menu',
    breaks: [E2E],
    expect: FOLLOW,
    edits: [
      {
        file: 'src/modules/my-day/screens/QuickCapture.tsx',
        find: '{about ? (\n            <p',
        replace: '{about && busy ? (\n            <p',
      },
    ],
  },
  {
    name: 'follow-up-title-is-the-record-name',
    breaks: [E2E],
    expect: FOLLOW,
    edits: [
      {
        file: 'src/modules/my-day/screens/QuickCapture.tsx',
        find: "t('pages.myDay.quick.followUpTitle') : text;",
        replace: "`${t('pages.myDay.quick.followUp')}: ${about.label}` : text;",
      },
    ],
  },
  {
    name: 'when-next-week-is-the-same-day-as-tomorrow',
    breaks: [UNIT],
    expect: 'puts Next week on the Sunday after Tomorrow on every day of the week',
    edits: [
      {
        file: 'src/modules/my-day/when.ts',
        find: 'const d = new Date(`${nextWorkingDay(day)}T12:00:00Z`);',
        replace: 'const d = new Date(`${day}T12:00:00Z`);',
      },
    ],
  },
];
