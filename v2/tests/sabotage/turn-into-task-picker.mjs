// Sabotage for the Turn into task picker (tests/unit/my-day/the-turn-into-task-picker-offers-only-tasks-one-may-edit.test.tsx):
// the picker offers a task the person can only view.
export const sabotages = [
  {
    name: 'task-picker-offers-view-only-tasks',
    breaks: ['unit:tests/unit/my-day/the-turn-into-task-picker-offers-only-tasks-one-may-edit.test.tsx'],
    expect: 'draws the tasks one may edit',
    edits: [
      {
        file: 'src/modules/my-day/screens/TaskPicker.tsx',
        find: '!h.closed && h.can_edit !== false',
        replace: '!h.closed',
      },
    ],
  },
  {
    name: 'task-picker-hides-a-task-whose-row-does-not-say',
    breaks: ['unit:tests/unit/my-day/the-turn-into-task-picker-offers-only-tasks-one-may-edit.test.tsx'],
    expect: 'keeps a task whose row does not say',
    edits: [
      {
        file: 'src/modules/my-day/screens/TaskPicker.tsx',
        find: 'h.can_edit !== false',
        replace: 'h.can_edit === true',
      },
    ],
  },
];
