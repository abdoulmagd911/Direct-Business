// V647: Turn into offers an item on a task's checklist. Each sabotage plants a way it can break; the spec must go red.
const E2E = 'e2e:tests/e2e/checklist-item-from-a-note.spec.ts';
export const sabotages = [
  {
    name: 'turn-into-forgets-the-checklist-item',
    breaks: [E2E],
    expect: 'the checklist item dialog opens',
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: "new Set(['kpis.turn_into', 'tasks.turn_into_task', 'tasks.turn_into'])",
        replace: "new Set(['kpis.turn_into', 'tasks.turn_into_task'])",
      },
    ],
  },
  {
    name: 'the-task-picker-offers-tasks-out-of-reach',
    breaks: [E2E],
    expect: 'a task out of reach is not offered',
    edits: [
      {
        file: 'src/modules/my-day/screens/TaskPicker.tsx',
        find: 'hits: (a as { tasks?: TaskRef[] } | null)?.tasks ?? [] }',
        replace:
          "hits: [...((a as { tasks?: TaskRef[] } | null)?.tasks ?? []), { id: '00000000-0000-0000-0000-000000000000', number: term, title: term, closed: false }] }",
      },
    ],
  },
  {
    name: 'the-task-row-is-40-px-on-a-phone',
    breaks: [E2E],
    expect: 'a task row is a 44 px target on a phone',
    edits: [
      {
        file: 'src/modules/my-day/screens/TaskPicker.tsx',
        find: 'className="flex min-h-11 w-full items-center gap-2.5',
        replace: 'className="flex min-h-10 w-full items-center gap-2.5',
      },
    ],
  },
  {
    name: 'the-task-number-sits-beside-the-title-in-the-picker',
    breaks: [E2E],
    expect: 'the title keeps room to be read',
    edits: [
      {
        file: 'src/modules/my-day/screens/TaskPicker.tsx',
        find: '<span className="flex min-w-0 flex-1 flex-col py-0.5">',
        replace: '<span className="flex min-w-0 flex-1 flex-row items-center gap-2.5 py-0.5">',
      },
    ],
  },
];
