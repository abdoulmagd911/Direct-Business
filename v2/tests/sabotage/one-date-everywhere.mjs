// Sabotages for "no date as 2026-10-19, no time with AM/PM" (W-daily 13, the supervisor's find after #263): the Due box,
// the 24-hour Time box, the history lines and the check that refuses a raw time input.
const FORMAT = 'unit:tests/unit/format.test.ts';
const BOX = 'unit:tests/unit/ui/a-date-box-shows-the-date-the-way-the-app-writes-it.test.tsx';
const HISTORY = 'unit:tests/unit/shell/history-writes-a-stored-date-the-one-way.test.tsx';
const CHECK = 'unit:tests/unit/checks/the-date-check-refuses-another-way-of-writing-a-date.test.ts';
const E2E = 'e2e:tests/e2e/one-date-and-time.spec.ts';

export const sabotages = [
  {
    name: 'history-prints-a-stored-date-raw',
    breaks: [HISTORY],
    expect: '> shows the day as 19 Oct 2026',
    edits: [
      {
        file: 'src/ui/record/ActivityTimeline.tsx',
        find: 'return formatStoredDate(v, locale) ?? String(v);',
        replace: 'return String(v);',
      },
    ],
  },
  {
    name: 'stored-moment-read-as-utc',
    breaks: [FORMAT],
    expect: 'no zone means Riyadh',
    edits: [
      {
        file: 'src/core/i18n/format.ts',
        find: "`${v.replace(' ', 'T')}+03:00`",
        replace: "`${v.replace(' ', 'T')}Z`",
      },
    ],
  },
  {
    name: 'pm-is-read-as-am',
    breaks: [FORMAT],
    expect: 'reads a typed time any common way',
    edits: [
      {
        file: 'src/core/i18n/format.ts',
        find: "(m[3] === 'pm' ? 12 : 0)",
        replace: '0',
      },
    ],
  },
  {
    name: 'month-word-must-be-exact',
    breaks: [FORMAT],
    expect: 'reads a month word',
    edits: [
      {
        file: 'src/core/i18n/format.ts',
        find: 'monthWords.get(/^[a-z]/.test(w) ? w.slice(0, 3) : w)',
        replace: 'monthWords.get(w)',
      },
    ],
  },
  {
    name: 'time-box-is-the-browser-clock',
    breaks: [BOX],
    expect: 'is a text box holding 09:30',
    edits: [
      {
        file: 'src/ui/Input.tsx',
        find: '      type="text"\n      inputMode="numeric"',
        replace: '      type="time"\n      inputMode="numeric"',
      },
    ],
  },
  {
    name: 'time-box-shows-the-text-as-stored',
    breaks: [BOX],
    expect: 'writes a time that is not padded as 24-hour',
    edits: [
      {
        file: 'src/ui/Input.tsx',
        find: '(parseClock(value) ? formatClock(parseClock(value)!, locale) : value)',
        replace: 'value',
      },
    ],
  },
  {
    name: 'check-lets-a-raw-time-input-through',
    breaks: [CHECK],
    expect: 'refuses a raw time input',
    edits: [
      {
        file: 'scripts/checks/one-date-format.mjs',
        find: "new Set(['date', 'datetime-local', 'time'])",
        replace: "new Set(['date', 'datetime-local'])",
      },
    ],
  },
  {
    name: 'due-box-writes-the-day-raw',
    breaks: [E2E],
    expect: 'a day typed ISO is written back as 20 Oct 2026',
    edits: [
      {
        file: 'src/modules/tasks/screens/DueDayPicker.tsx',
        find: 'const written = (d: string) => formatDate(`${d}T12:00:00+03:00`, locale);',
        replace: 'const written = (d: string) => d;',
      },
    ],
  },
  {
    name: 'time-box-ignores-what-is-typed',
    breaks: [E2E],
    expect: 'the time is read as 24-hour',
    edits: [
      {
        file: 'src/ui/Input.tsx',
        find: '          setSeen(t);\n          onChange(t);',
        replace: '          setSeen(t);',
      },
    ],
  },
];
