// Sabotages for the My day reminder fixes (job N): each breaks one promise of its specs.
const E2E = 'e2e:tests/e2e/my-day-reminder-fixes.spec.ts';

export const sabotages = [
  {
    name: 'the-reminder-filter-repeats-the-reminders-block',
    breaks: [E2E],
    expect: 'the Reminders block is not drawn above it',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: "scope === 'me' && !kind && later.length ? (",
        replace: "scope === 'me' && later.length ? (",
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
