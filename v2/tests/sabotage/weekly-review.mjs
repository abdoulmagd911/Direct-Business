// Sabotages for the weekly review (productivity stage 3, builder E): each breaks one promise of its specs.
const E2E = 'e2e:tests/e2e/weekly-review.spec.ts';
const UNIT = 'unit:tests/unit/weekly-review/the-weekly-review-leads-each-row-home.test.ts';

export const sabotages = [
  {
    name: 'weekly-review-row-opens-the-note-page-for-a-task',
    breaks: [UNIT],
    expect: 'opens a task by its number',
    edits: [
      {
        file: 'src/modules/weekly-review/logic.ts',
        find: "i.kind === 'task' && i.number ?",
        replace: "i.kind === 'task' && false ?",
      },
    ],
  },
  {
    name: 'weekly-review-hides-how-often-it-was-carried',
    breaks: [E2E],
    expect: 'shows my done, slipped, next and notes, and opens a row',
    edits: [
      {
        file: 'src/modules/weekly-review/screens/WeeklyReview.tsx',
        find: '{item.times > 0 ? (',
        replace: '{item.times > 99 ? (',
      },
    ],
  },
  {
    name: 'weekly-review-draws-four-empty-sections',
    breaks: [E2E],
    expect: 'a week with nothing in it says so once',
    edits: [
      {
        file: 'src/modules/weekly-review/screens/WeeklyReview.tsx',
        find: 'if (weekIsEmpty(answer))',
        replace: 'if (weekIsEmpty(answer) && false)',
      },
    ],
  },
];
