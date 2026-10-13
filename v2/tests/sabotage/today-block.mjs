// Sabotages for the Today block (productivity stage 1, builder B): each breaks one promise of its specs.
const E2E = 'e2e:tests/e2e/today-block.spec.ts';
const UNIT = 'unit:tests/unit/my-day/the-today-block-groups-my-tasks-by-riyadh-day.test.ts';

export const sabotages = [
  {
    name: 'group-ignores-the-riyadh-day',
    breaks: [UNIT],
    expect: 'groups a task the database left ungrouped',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "t.due_on < day ? 'overdue'",
        replace: "t.due_on < day && false ? 'overdue'",
      },
    ],
  },
  {
    name: 'today-block-counts-no-overdue',
    breaks: [E2E],
    expect: 'groups my tasks, ticks one done with Undo and opens one',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: "x.key === 'overdue' ? (",
        replace: "x.key !== 'overdue' ? (",
      },
    ],
  },
  {
    name: 'today-block-row-does-not-open-the-task',
    breaks: [E2E],
    expect: 'groups my tasks, ticks one done with Undo and opens one',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: 'href={`/tasks/${task.number}`}',
        replace: 'href="/my-day"',
      },
    ],
  },
  {
    name: 'today-block-says-nothing-when-empty',
    breaks: [E2E],
    expect: 'with nothing due the block says so',
    edits: [{ file: 'src/modules/my-day/screens/TodayBlock.tsx', find: '{none ? (', replace: '{false ? (' }],
  },
];
