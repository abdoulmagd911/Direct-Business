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

// QA-557: the door on My day.
sabotages.push(
  {
    name: 'week-door-marks-friday',
    breaks: ['unit:tests/unit/weekly-review/thursday-is-review-day-in-riyadh.test.ts'],
    expect: 'marks Thursday',
    edits: [{ file: 'src/modules/weekly-review/logic.ts', find: '.getUTCDay() === 4', replace: '.getUTCDay() === 5' }],
  },
  {
    name: 'week-door-says-this-week',
    breaks: ['e2e:tests/e2e/week-door.spec.ts'],
    expect: 'the Weekly review row on My day opens the weekly review',
    edits: [
      {
        file: 'src/modules/weekly-review/screens/WeekDoor.tsx',
        find: "{t('pages.weeklyReview.title')}",
        replace: "{'This week'}",
      },
    ],
  },
  {
    name: 'week-door-opens-my-day',
    breaks: ['e2e:tests/e2e/week-door.spec.ts'],
    expect: 'opens the weekly review',
    edits: [
      {
        file: 'src/modules/weekly-review/screens/WeekDoor.tsx',
        find: 'href="/my-day/week"',
        replace: 'href="/my-day"',
      },
    ],
  },
);

// The weekly review in Arabic, in the one file that switches Arabic (app-settings.alone.spec.ts, after main b8ad0c3).
sabotages.push({
  name: 'weekly-review-title-is-the-review-day-word',
  breaks: ['e2e:tests/e2e/app-settings.alone.spec.ts'],
  expect: 'the weekly review reads right to left',
  edits: [
    {
      file: 'src/app/(app)/my-day/week/page.tsx',
      find: "title={t('pages.weeklyReview.title')}",
      replace: "title={t('pages.weeklyReview.reviewDay')}",
    },
  ],
});
