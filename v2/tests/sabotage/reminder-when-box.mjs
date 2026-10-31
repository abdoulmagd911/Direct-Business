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
        find: '{(p) => <TimeInput {...p} value={f.time}',
        replace: '{(p) => <Input type="datetime-local" {...p} value={f.time}',
      },
    ],
  },
];
