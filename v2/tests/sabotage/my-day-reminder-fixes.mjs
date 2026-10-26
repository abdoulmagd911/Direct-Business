// Sabotages for the My day reminder fixes (job N): each breaks one promise of its specs.
const E2E = 'e2e:tests/e2e/my-day-reminder-fixes.spec.ts';
const UNIT = 'unit:tests/unit/my-day/today-reminders.test.ts';

export const sabotages = [
  {
    name: 'a-reminder-is-listed-twice',
    breaks: [UNIT],
    expect: 'leaves out the notes whose reminder is listed above',
    edits: [
      {
        file: 'src/modules/my-day/today-reminders.ts',
        find: 'return notes.filter((n) => !listed.has(n.id));',
        replace: 'return notes;',
      },
    ],
  },
  {
    name: 'a-reminder-note-vanishes-for-good',
    breaks: [UNIT],
    expect: 'keeps a note whose reminder is done or gone',
    edits: [
      {
        file: 'src/modules/my-day/today-reminders.ts',
        find: 'return notes.filter((n) => !listed.has(n.id));',
        replace: 'return notes.filter((n) => n.id !== "plain" && !listed.has(n.id));',
      },
    ],
  },
  {
    name: 'my-day-shows-a-reminder-in-both-blocks',
    breaks: [E2E],
    expect: 'the reminder is not also a row of My notes',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: "scope === 'me' && kind !== 'reminder'",
        replace: 'false',
      },
    ],
  },
  {
    name: 'the-reminder-filter-hides-the-reminders',
    breaks: [E2E],
    expect: 'the Reminder filter still lists it',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: "scope === 'me' && kind !== 'reminder'",
        replace: "scope === 'me'",
      },
    ],
  },
  {
    name: 'a-reminder-offers-three-audiences',
    breaks: [E2E],
    expect: 'a Reminder offers one',
    edits: [
      {
        file: 'src/modules/my-day/screens/QuickCapture.tsx',
        find: "kind === 'reminder' ? VISIBILITIES.filter((v) => v === 'private') : VISIBILITIES",
        replace: 'VISIBILITIES',
      },
    ],
  },
  {
    name: 'a-reminder-is-filed-with-the-audience-picked-before',
    breaks: [E2E],
    expect: 'filed private even though Team was picked before',
    edits: [
      {
        file: 'src/modules/my-day/screens/QuickCapture.tsx',
        find: "visibility: about || kind === 'reminder' ? 'private' : visibility,",
        replace: "visibility: about ? 'private' : visibility,",
      },
    ],
  },
  {
    name: 'the-reminders-row-squeezes-the-chip-on-a-phone',
    breaks: [E2E],
    expect: 'the chip takes most of the row',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: '<span className="min-w-0 flex-1 basis-full sm:basis-0">',
        replace: '<span className="min-w-0 flex-1">',
      },
    ],
  },
];
