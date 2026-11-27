// Landing 57 (27 Nov) — the Tasks defaults in the browser (tests/e2e/landing-57-tasks-open-where-the-work-is.spec.ts).
// Each sabotage takes one promise back on the real page, and the spec must go red for it with the words named.
const RULES = 'src/modules/tasks/rules.ts';
const LIST = 'src/modules/tasks/screens/TaskListScreen.tsx';
const PAGE = 'src/app/(app)/tasks/page.tsx';
const E2E = 'e2e:tests/e2e/landing-57-tasks-open-where-the-work-is.spec.ts';

export const sabotages = [
  {
    name: 'e2e-l57-a-manager-opens-on-my-work',
    breaks: [E2E],
    expect: 'a manager opens on Team',
    edits: [
      {
        file: PAGE,
        find: '  const filters = parseFilters(params, homeScope(me.capabilities));\n  const [list,',
        replace: '  const filters = parseFilters(params);\n  const [list,',
      },
    ],
  },
  {
    name: 'e2e-l57-an-empty-my-work-says-no-tasks-yet',
    breaks: [E2E],
    expect: 'an empty My work says where the work is',
    edits: [
      {
        file: LIST,
        find: "  const emptyMyWorkPointsToTeam = f.scope === 'my_work' && me.capabilities.includes('tasks.assign');",
        replace: '  const emptyMyWorkPointsToTeam = false;',
      },
    ],
  },
  {
    name: 'e2e-l57-the-done-task-stays-on-the-list',
    breaks: [E2E],
    expect: 'the done task is put away',
    edits: [
      {
        file: LIST,
        find: '  const listed = rows.filter((r) => !hidden(r));',
        replace: '  const listed = rows;',
      },
    ],
  },
  {
    name: 'e2e-l57-show-done-does-not-bring-it-back',
    breaks: [E2E],
    expect: 'Show done lists the done task',
    edits: [
      {
        file: RULES,
        find: "  return (f.layout ?? 'list') === 'list' && !f.status && !f.done && f.scope !== 'past';",
        replace: "  return (f.layout ?? 'list') === 'list' && !f.status && f.scope !== 'past';",
      },
    ],
  },
];
