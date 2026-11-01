// Sabotage for the Reminder When box (tests/unit/my-day/the-reminder-when-box-uses-the-apps-date-and-24-hour-time-boxes.test.tsx):
// the time box goes back to a browser date-and-time box.
export const sabotages = [
  {
    name: 'reminder-when-is-one-datetime-box',
    breaks: ['unit:tests/unit/my-day/the-reminder-when-box-uses-the-apps-date-and-24-hour-time-boxes.test.tsx'],
    expect: 'has a date box and a 24-hour time box',
    edits: [
      {
        file: 'src/modules/my-day/screens/TurnDialogs.tsx',
        find: '<TimeInput',
        replace: '<Input type="datetime-local"',
      },
    ],
  },
  {
    name: 'reminder-save-ignores-the-typed-time',
    breaks: ['unit:tests/unit/my-day/the-reminder-dialog-keeps-save-off-for-a-time-that-is-not-a-time.test.tsx'],
    expect: 'keeps Save off and says what is missing',
    edits: [
      {
        file: 'src/modules/my-day/screens/TurnDialogs.tsx',
        find: 'const ok = !!f.day && timeOk && !!f.text.trim();',
        replace: 'const ok = !!f.day && !!f.text.trim();',
      },
    ],
  },
];
