// Sabotages for Landing 53's browser tests — My day as the boards draw it. Each one puts a part back to what it was,
// or breaks it on the screen, in one line; the browser test named must go red for it, with the words given.
// The specs: tests/e2e/landing-53-my-day-boards.spec.ts and tests/e2e/landing-53-arabic.alone.spec.ts.
const BOARDS = 'e2e:tests/e2e/landing-53-my-day-boards.spec.ts';
const ARABIC = 'e2e:tests/e2e/landing-53-arabic.alone.spec.ts';
const BLOCK = 'src/modules/my-day/screens/TodayBlock.tsx';
const THREE = 'src/modules/my-day/screens/TodaysThree.tsx';

export const sabotages = [
  {
    // the three are one stacked list on a PC again
    name: 'e2e-l53-the-three-cards-stack-on-a-pc',
    breaks: [BOARDS],
    expect: 'PC: the three cards share one row',
    edits: [{ file: THREE, find: 'grid grid-cols-1 gap-x-4 lg:grid-cols-3', replace: 'grid grid-cols-1 gap-x-4' }],
  },
  {
    // the rest of today opens on the four boxes
    name: 'e2e-l53-the-rest-opens-on-the-boxes',
    breaks: [BOARDS],
    expect: 'it opens grouped by kind',
    edits: [
      { file: 'src/modules/my-day/screens/MyDay.tsx', find: 'initialView="kind"', replace: 'initialView="priority"' },
    ],
  },
  {
    // a phone's task rows go back to the list's own height
    name: 'e2e-l53-a-phone-row-is-short',
    breaks: [BOARDS],
    expect: 'phone: every task row is at least 56 px tall',
    edits: [
      {
        file: BLOCK,
        find: 'className="relative flex items-start gap-3 min-h-[var(--list-row-min)] py-[var(--list-row-py)] max-sm:min-h-14"\n      data-today-task={task.number}',
        replace: 'className="relative flex items-start gap-3 py-1"\n      data-today-task={task.number}',
      },
    ],
  },
  {
    // a task ticked done is drawn as if it were open
    name: 'e2e-l53-a-ticked-task-is-not-drawn-ticked',
    breaks: [BOARDS],
    expect: 'and is drawn ticked',
    edits: [{ file: BLOCK, find: "{...(task.done ? { 'data-row-done': '' } : {})}", replace: '' }],
  },
  {
    // the switch to the four boxes does nothing
    name: 'e2e-l53-the-switch-does-nothing',
    breaks: [BOARDS],
    expect: 'data-rest-view',
    edits: [
      {
        file: BLOCK,
        find: 'const choose = (v: RestView) => {\n    setMode(v);',
        replace: 'const choose = (v: RestView) => {',
      },
    ],
  },
  {
    // Arabic: the cards are not mirrored
    name: 'e2e-l53-arabic-cards-are-not-mirrored',
    breaks: [ARABIC],
    expect: 'mirrored: the first card is at the right',
    edits: [
      {
        file: THREE,
        find: '<div className="grid grid-cols-1 gap-x-4 lg:grid-cols-3">',
        replace: '<div dir="ltr" className="grid grid-cols-1 gap-x-4 lg:grid-cols-3">',
      },
    ],
  },
  {
    // Arabic: the kinds keep their English headings
    name: 'e2e-l53-arabic-kinds-read-english',
    breaks: [ARABIC],
    expect: 'اجتماعات',
    edits: [
      {
        file: BLOCK,
        find: ': t.has(`pages.myDay.kinds.task.${k.key}`)',
        replace: ': false',
      },
    ],
  },
];
