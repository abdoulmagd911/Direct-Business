// Landing 57 (27 Nov, the owner's review of 26 Nov: "Tasks do not work or show as I expect") · the Tasks defaults:
//   1. someone who gives work to others opens the list on Team; the address names a tab only when it is not theirs;
//   2. an empty My work for them says the work is under Team, with a button there;
//   3. the list shows open tasks — Show done (?done=1) brings the finished ones back; a status chip, the board and Past
//      work keep them; a list whose every task is finished says so;
//   4. Quick add says who a task left at Default went to.
// Each sabotage takes one of those back, and the test named must go red for it.
const RULES = 'src/modules/tasks/rules.ts';
const LIST = 'src/modules/tasks/screens/TaskListScreen.tsx';
const QUICK = 'src/modules/tasks/screens/QuickAdd.tsx';
const UNIT = 'unit:tests/unit/tasks/landing-57-tasks-open-where-the-work-is.test.tsx';

export const sabotages = [
  {
    name: 'l57-a-ticked-task-vanishes-at-once',
    breaks: [UNIT],
    expect: '> a task ticked done on this list stays on screen, saying Done, until the list is left (V509)',
    edits: [
      {
        file: LIST,
        find: '  const keptHere = (r: (typeof rows)[number]) => seenOpen.key === listKey && seenOpen.ids.includes(r.id);',
        replace: '  const keptHere = (r: (typeof rows)[number]) => seenOpen.key === listKey && !r;',
      },
    ],
  },
  // ---------------------------------------------------------------- 1 · the list opens where the work is
  {
    name: 'l57-a-manager-opens-on-my-work',
    breaks: [UNIT],
    expect: '> someone who gives work to others opens on Team; everyone else on My work',
    edits: [
      {
        file: RULES,
        find: "  return capabilities.includes('tasks.assign') ? 'team' : 'my_work';",
        replace: "  return capabilities.includes('tasks.assign') ? 'my_work' : 'my_work';",
      },
    ],
  },
  {
    name: 'l57-the-address-names-the-home-tab',
    breaks: [UNIT],
    expect: '> the address names a tab only when it is not the person’s own',
    edits: [
      {
        file: RULES,
        find: "  if (next.scope !== (next.home ?? 'my_work')) p.set('view', next.scope);",
        replace: "  if (next.scope !== 'my_work') p.set('view', next.scope);",
      },
    ],
  },
  {
    name: 'l57-a-saved-view-keeps-the-home-tab',
    breaks: [UNIT],
    expect: '> a saved view never keeps the person’s own home tab',
    edits: [
      {
        file: RULES,
        find: '  const { home: _home, ...rest } = f;',
        replace: '  const { ...rest } = f;\n  const _home = 0;',
      },
    ],
  },
  // ---------------------------------------------------------------- 2 · an empty My work says where the work is
  {
    name: 'l57-an-empty-my-work-points-nowhere',
    breaks: [UNIT],
    expect: '> for someone who gives work: the work is under Team, and one button goes there',
    edits: [
      {
        file: LIST,
        find: "  const emptyMyWorkPointsToTeam = f.scope === 'my_work' && me.capabilities.includes('tasks.assign');",
        replace: '  const emptyMyWorkPointsToTeam = false;',
      },
    ],
  },
  // ---------------------------------------------------------------- 3 · open tasks first, Show done for the rest
  {
    name: 'l57-the-list-draws-done-tasks-again',
    breaks: [UNIT],
    expect: '> done and cancelled tasks are put away on the list, and the button says how many',
    edits: [
      {
        file: LIST,
        find: '  const listed = rows.filter((r) => !hidden(r));',
        replace: '  const listed = rows;',
      },
    ],
  },
  {
    name: 'l57-show-done-is-not-in-the-address',
    breaks: [UNIT],
    expect: '> Show done lists every task again, and the button then hides them',
    edits: [{ file: RULES, find: "  if (next.done) p.set('done', '1');\n", replace: '' }],
  },
  {
    name: 'l57-the-board-loses-its-done-column',
    breaks: [UNIT],
    expect: '> a Done or Cancelled chip, the board and Past work keep their finished tasks',
    edits: [
      {
        file: RULES,
        find: "  return (f.layout ?? 'list') === 'list' && !f.status && !f.done && f.scope !== 'past';",
        replace: "  return !f.status && !f.done && f.scope !== 'past';",
      },
    ],
  },
  {
    name: 'l57-a-saved-view-forgets-show-done',
    breaks: [UNIT],
    expect: '> a saved view keeps Show done',
    edits: [{ file: RULES, find: '    done: query.done === true || undefined,\n', replace: '' }],
  },
  {
    name: 'l57-an-all-done-list-says-no-tasks-yet',
    breaks: [UNIT],
    expect: '> a list whose every task is finished says so, never “No tasks yet”, and offers them back',
    edits: [
      {
        file: LIST,
        find: "      ) : rows.length > 0 && listed.length === 0 && layout === 'list' ? (",
        replace: '      ) : false ? (',
      },
    ],
  },
  // ---------------------------------------------------------------- 4 · Quick add says who it went to
  {
    name: 'l57-quick-add-says-nothing-about-the-owner',
    breaks: [UNIT],
    expect: '> the database gave it to someone else: their name, and where to find it',
    edits: [
      {
        file: QUICK,
        find: '          if (res && !fromNote && !r.values.owner_id) void sayWhoOwnsIt(res.id);',
        replace: '          if (res && !fromNote && !r.values.owner_id) void 0;',
      },
    ],
  },
];
