// Builder D's sabotages (the Tasks screens, P5-2's first PR): every rule the screens apply, broken one at a time, must
// turn its unit test or its browser spec red, for the planted reason. Run:
//   node scripts/sabotage.mjs --only tasks-past-work-flagged-overdue …   (or --kind unit / --kind e2e)
const unit = (file) => `unit:tests/unit/tasks/${file}.test.ts`;
const e2e = 'e2e:tests/e2e/tasks.spec.ts';
const RULES = 'src/modules/tasks/rules.ts';

export const sabotages = [
  // ---- the day (V40, V400, V491)
  {
    name: 'tasks-past-work-flagged-overdue',
    breaks: [unit('the-day-is-riyadhs-and-past-work-is-never-overdue')],
    expect: 'a closed task is never overdue; neither is past work',
    edits: [{ file: RULES, find: "  if (t.past_work) return 'later';\n", replace: '' }],
  },
  {
    name: 'tasks-day-in-the-clocks-zone',
    breaks: [unit('the-day-is-riyadhs-and-past-work-is-never-overdue')],
    expect: "today is Riyadh's day",
    edits: [{ file: RULES, find: "    timeZone: 'Asia/Riyadh',", replace: "    timeZone: 'UTC'," }],
  },
  // ---- the list's views and chips (§3.7, V195)
  {
    name: 'tasks-helping-keeps-my-own',
    breaks: [unit('the-list-keeps-its-view-and-chips-in-the-address')],
    expect: 'Helping is My work someone else owns',
    edits: [{ file: RULES, find: "  if (f.scope === 'helping' && row.owner_id === me) return false;\n", replace: '' }],
  },
  {
    name: 'tasks-team-asks-for-mine',
    breaks: [unit('the-list-keeps-its-view-and-chips-in-the-address')],
    expect: 'each view asks the door for its scope',
    edits: [
      {
        file: RULES,
        find: "f.scope === 'team' || f.scope === 'past' ? 'all' : 'my_work'",
        replace: "f.scope === 'team' ? 'mine' : f.scope === 'past' ? 'all' : 'my_work'",
      },
    ],
  },
  // ---- status (V401, V191)
  {
    name: 'tasks-blocked-without-its-reason',
    breaks: [unit('blocked-needs-its-reason-and-done-asks-about-open-items')],
    expect: 'Blocked asks for its reason',
    edits: [{ file: RULES, find: "    if (!reason) return { ask: 'reason' };\n", replace: '' }],
  },
  {
    name: 'tasks-done-leaves-items-open',
    breaks: [unit('blocked-needs-its-reason-and-done-asks-about-open-items')],
    expect: 'Done with open action items asks first',
    edits: [
      {
        file: RULES,
        find: "if (move.status.meaning === 'done' && t.open_action_items > 0) {",
        replace: "if (move.status.meaning === 'done' && t.open_action_items > 99) {",
      },
    ],
  },
  // ---- quick add (V464, V194)
  {
    name: 'tasks-owner-always-sent',
    breaks: [unit('quick-add-leaves-the-owner-to-the-default')],
    expect: 'the owner is sent only when it is someone else',
    edits: [{ file: RULES, find: 'if (input.ownerId && input.ownerId !== me)', replace: 'if (input.ownerId)' }],
  },
  {
    name: 'tasks-partner-beats-project',
    breaks: [unit('quick-add-leaves-the-owner-to-the-default')],
    expect: 'a project wins over a partner',
    edits: [
      {
        file: RULES,
        find: '  if (input.projectId) values.project_id = input.projectId;\n  else if (input.partnerId)',
        replace:
          '  if (input.projectId && !input.partnerId) values.project_id = input.projectId;\n  if (input.partnerId)',
      },
    ],
  },
  // ---- the checklist (V438, V190)
  {
    name: 'tasks-anyone-ticks',
    breaks: [unit('quick-add-leaves-the-owner-to-the-default')],
    expect: "the task's editors, the item's owner, or a helper on it",
    edits: [
      {
        file: RULES,
        find: '  return task.can_edit || item.owner_id === me || item.helpers.includes(me);',
        replace: '  return true || task.can_edit || item.owner_id === me || item.helpers.includes(me);',
      },
    ],
  },
  // ---- the browser (GC-3's acceptance test, V509)
  {
    name: 'e2e-tasks-blocked-saved-without-its-reason',
    breaks: [e2e],
    expect: 'Blocked needs its reason',
    edits: [
      {
        file: 'src/modules/tasks/screens/StatusControl.tsx',
        find: "await choose({ kind: 'block' }, { reason });",
        replace: "await choose({ kind: 'block' }, { reason: '' });",
      },
    ],
  },
  {
    name: 'e2e-tasks-done-forgets-the-open-items',
    breaks: [e2e],
    expect: 'quick add, the list, the record, an action item and Done',
    edits: [
      {
        file: 'src/modules/tasks/screens/StatusControl.tsx',
        find: 'if (closing) await choose(closing.move, { closeItems: true });',
        replace: 'if (closing) await choose(closing.move, {});',
      },
    ],
  },
  {
    name: 'e2e-tasks-list-scrolls-sideways',
    breaks: [e2e],
    expect: 'no sideways scroll',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskListScreen.tsx',
        find: '<ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised" data-task-rows>',
        replace:
          '<ul className="flex min-w-[600px] flex-col divide-y divide-border rounded-lg border border-border bg-raised" data-task-rows>',
      },
    ],
  },
  {
    name: 'e2e-tasks-my-work-shows-the-whole-team',
    breaks: [e2e],
    expect: 'a colleague’s task is not My work',
    edits: [
      {
        file: RULES,
        find: "f.scope === 'team' || f.scope === 'past' ? 'all' : 'my_work'",
        replace: "f.scope === 'team' || f.scope === 'past' ? 'all' : 'all'",
      },
    ],
  },
  // ---- the Past work grid on Tasks (V276)
  {
    name: 'tasks-past-view-shows-live-work',
    breaks: [unit('past-work-names-are-matched-exactly-never-guessed')],
    expect: 'the Past work view asks for past work only',
    edits: [{ file: RULES, find: "  if (f.scope === 'past') out.past_work = true;\n", replace: '' }],
  },
  {
    name: 'tasks-past-work-guesses-a-client',
    breaks: [unit('past-work-names-are-matched-exactly-never-guessed')],
    expect: 'one client is a match, none is unknown, two are ambiguous',
    edits: [{ file: 'src/modules/tasks/pastWork.ts', find: ': hits.size === 1', replace: ': hits.size >= 1' }],
  },
  {
    name: 'e2e-tasks-past-work-grid-not-mounted',
    breaks: [e2e],
    expect: 'the Past work grid pastes 20 made-up rows as one request with one Undo',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskListScreen.tsx',
        find: "{f.scope === 'past' && atLeastOwn(me.levels.tasks) ? (",
        replace: "{f.scope === 'past' && !atLeastOwn('full') && atLeastOwn(me.levels.tasks) ? (",
      },
    ],
  },
];
