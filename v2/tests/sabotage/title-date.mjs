// Sabotages for a date typed in a title (V639 (1)).
const UNIT = 'unit:tests/unit/my-day/a-date-typed-in-a-title-is-read-in-riyadh-time.test.ts';
const E2E = 'e2e:tests/e2e/title-date.spec.ts';

export const sabotages = [
  {
    name: 'title-date-counts-the-computers-day',
    breaks: [UNIT],
    expect: 'counts the day in Riyadh time',
    edits: [
      {
        file: 'src/modules/my-day/title-date.ts',
        find: 'const { day: today, minutes } = riyadhNow(now);',
        replace:
          'const { day: today, minutes } = { day: now.toISOString().slice(0, 10), minutes: now.getUTCHours() * 60 };',
      },
    ],
  },
  {
    name: 'title-date-reads-a-bare-number-as-a-time',
    breaks: [UNIT],
    expect: 'does not read a time that has gone',
    edits: [
      {
        file: 'src/modules/my-day/title-date.ts',
        find: '(?:(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)|',
        replace: '(?:(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?|',
      },
    ],
  },
  {
    name: 'reminder-ignores-the-date-in-its-words',
    breaks: [E2E],
    expect: 'a date typed in a Reminder is read as a chip',
    edits: [
      {
        file: 'src/modules/my-day/screens/QuickCapture.tsx',
        find: "const typed = kind === 'reminder' ? readDateInTitle(text, new Date()) : null;",
        replace: 'const typed = null as ReturnType<typeof readDateInTitle>;',
      },
    ],
  },
  {
    name: 'new-task-ignores-the-date-in-its-title',
    breaks: [E2E],
    expect: 'a date typed in a New task title sets its due day',
    edits: [
      {
        file: 'src/modules/tasks/screens/QuickAdd.tsx',
        find: 'quickAddValues(read ? { ...f, due: read.day } : f,',
        replace: 'quickAddValues(f,',
      },
    ],
  },
];
