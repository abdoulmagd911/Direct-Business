// Sabotages for the new-task form's Due (the Architect's ruling of 16 Oct, V286; builder D).
const E2E = 'e2e:tests/e2e/new-task-due.spec.ts';
const UNIT = 'unit:tests/unit/tasks/a-typed-due-day-is-read-whatever-the-computer.test.ts';

export const sabotages = [
  {
    // typed digits are not read: 20261020 is no day, as when the browser's date box put them in the wrong parts
    name: 'due-typed-digits-are-junk',
    breaks: [E2E],
    expect: 'typing 20261020 gives 20 October 2026',
    edits: [
      {
        file: 'src/modules/tasks/rules.ts',
        find: '  const ymd = /^(\\d{4})(\\d{2})(\\d{2})$/.exec(s) ?? ',
        replace: '  const ymd = ',
      },
    ],
  },
  {
    // Today names the wrong day
    name: 'due-today-chip-is-tomorrow',
    breaks: [E2E],
    expect: 'Today is the Riyadh day',
    edits: [
      {
        file: 'src/modules/tasks/screens/DueDayPicker.tsx',
        find: "{ key: 'today', day: riyadhNow(now).day,",
        replace: "{ key: 'today', day: tomorrow(now).day,",
      },
    ],
  },
  {
    // no way back to no due day
    name: 'due-has-no-clear',
    breaks: [E2E],
    expect: 'Clear empties Due',
    edits: [
      {
        file: 'src/modules/tasks/screens/DueDayPicker.tsx',
        find: "onClick={() => set('')} data-due-clear",
        replace: 'onClick={() => undefined} data-due-clear',
      },
    ],
  },
  {
    // a day typed day first (20/10/2026, as Saudi dates are written) is read as if the year came first
    name: 'due-day-first-is-read-year-first',
    breaks: [UNIT],
    expect: 'reads the day with dashes, slashes or dots',
    edits: [
      {
        file: 'src/modules/tasks/rules.ts',
        find: '? [dmy[3], dmy[2], dmy[1]]',
        replace: '? [dmy[1], dmy[2], dmy[3]]',
      },
    ],
  },
];
