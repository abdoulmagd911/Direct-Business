// Sabotages for the Today block's four boxes and the importance star (V661), caught by
// tests/unit/my-day/the-today-block-groups-views-and-chips.test.tsx.
const BOX = 'unit:tests/unit/my-day/the-today-block-groups-views-and-chips.test.tsx';
const HEADINGS =
  'unit:tests/unit/my-day/the-today-block-lists-reminders-and-names-a-followups-record-only-to-who-may-see-it.test.tsx';
export const sabotages = [
  {
    name: 'today-boxes-in-the-wrong-order',
    breaks: [BOX],
    expect: 'draws the four boxes in order',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "export const TODAY_BOXES = ['do_now', 'plan_it', 'quick', 'later'] as const;",
        replace: "export const TODAY_BOXES = ['do_now', 'quick', 'plan_it', 'later'] as const;",
      },
    ],
  },
  {
    name: 'today-star-is-not-sent',
    breaks: [BOX],
    expect: 'a tap on the star sets it through task_star',
    edits: [
      {
        file: 'src/modules/tasks/screens/StarToggle.tsx',
        find: 'rpc(door, { p_id: id, p_starred: next })',
        replace: 'rpc(door, { p_id: id, p_starred: on })',
      },
    ],
  },
  {
    name: 'today-star-is-a-small-target',
    breaks: [BOX],
    expect: 'a task of mine has a 44 px star',
    edits: [
      {
        file: 'src/modules/tasks/screens/StarToggle.tsx',
        find: 'inline-grid size-11 shrink-0',
        replace: 'inline-grid size-7 shrink-0',
      },
    ],
  },
  {
    name: 'today-helped-task-has-a-star-button',
    breaks: [BOX],
    expect: 'a helped task has a mark and no button',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: '{helping ? (\n        <StarMark starred={!!task.starred} />',
        replace: '{false ? (\n        <StarMark starred={!!task.starred} />',
      },
    ],
  },
  {
    name: 'today-box-heading-not-in-arabic',
    breaks: [BOX],
    expect: 'names the boxes in English and in Arabic',
    edits: [
      {
        file: 'messages/ar.json',
        find: '"do_now": "افعلها الآن"',
        replace: '"do_now": "Do now"',
      },
    ],
  },
  {
    name: 'today-box-ignores-the-star',
    breaks: [BOX],
    expect: 'draws the four boxes in order',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "if (t.starred) return urgent ? 'do_now' : 'plan_it';",
        replace: "if (false) return urgent ? 'do_now' : 'plan_it';",
      },
    ],
  },
];
