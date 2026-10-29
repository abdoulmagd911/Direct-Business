// Sabotages for the My day reminder fixes (job N): each breaks one promise of its specs.
const E2E = 'e2e:tests/e2e/my-day-reminder-fixes.spec.ts';
const TODAY =
  'unit:tests/unit/my-day/the-today-block-lists-reminders-and-names-a-followups-record-only-to-who-may-see-it.test.tsx';
const UNIT = 'unit:tests/unit/my-day/a-later-reminder-says-done-and-wraps-its-title.test.tsx';

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
  {
    name: 'the-reminder-time-drops-under-its-words',
    breaks: [E2E],
    expect: 'the words and their time stay together on one line',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: '<span className="flex items-baseline gap-3" data-reminder-line>',
        replace: '<span className="flex flex-col gap-1" data-reminder-line>',
      },
    ],
  },
  {
    name: 'the-reminder-line-loses-its-time',
    breaks: [UNIT],
    expect: 'keeps its words and its time together on one line',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: "{formatDate(r.remind_at, locale, { dateStyle: 'medium', timeStyle: 'short' })}",
        replace: '{null}',
      },
    ],
  },
  {
    name: 'the-today-reminder-time-moves-after-the-chip',
    breaks: [TODAY],
    expect: 'keeps a due reminder',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: "{overdue ? formatDate(r.remind_at, locale, { dateStyle: 'medium', timeStyle: 'short' }) : r.time}",
        replace: '{null}',
      },
    ],
  },
  {
    name: 'the-today-chip-sits-beside-the-words',
    breaks: [E2E],
    expect: 'the record chip is on its own line under them',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: '<span className="flex min-w-0 flex-col">',
        replace: '<span className="flex min-w-0 flex-row items-start">',
      },
    ],
  },
];
