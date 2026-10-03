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
  // ---- past work for someone in no team needs a named owner (V605)
  {
    name: 'past-work-no-team-sends-unowned-rows',
    breaks: [unit('past-work-in-no-team-needs-a-named-owner')],
    expect: 'with no Owner column and no owner picked, no row is sent',
    edits: [
      {
        file: 'src/ui/grid/rows.ts',
        find: "      else if (!person || person.unknown) problems.push('owner_needed');\n",
        replace: '',
      },
    ],
  },
  {
    name: 'past-work-no-team-ignores-the-picked-owner',
    breaks: [unit('past-work-in-no-team-needs-a-named-owner')],
    expect: 'one picked owner covers every row that names none',
    edits: [
      {
        file: 'src/ui/grid/rows.ts',
        find: "if ((!person || person.unknown === 'missing') && o.fallbackOwner)",
        replace: "if (person && person.unknown === 'missing' && o.fallbackOwner)",
      },
    ],
  },
  {
    name: 'past-work-says-could-not-save',
    breaks: [unit('past-work-in-no-team-needs-a-named-owner')],
    expect: 'reads "Pick an owner"',
    edits: [
      {
        file: 'src/modules/tasks/pastWork.ts',
        find: "e.key === 'task.team_required' ?",
        replace: "e.key === 'task.never' ?",
      },
    ],
  },
  // ---- a locked area says why (V605)
  {
    name: 'locked-activity-says-only-activity',
    breaks: [unit('a-locked-area-says-why')],
    expect: 'a locked area with no reason',
    edits: [
      {
        file: 'src/app/(app)/activity/page.tsx',
        find: " message={t('activity.locked')} />",
        replace: ' />',
      },
    ],
  },
  {
    name: 'e2e-locked-activity-says-only-activity',
    breaks: ['e2e:tests/e2e/locked-areas-say-why.spec.ts'],
    expect: 'the Activity page says who it is for',
    edits: [
      {
        file: 'src/app/(app)/activity/page.tsx',
        find: " message={t('activity.locked')} />",
        replace: " message={t('nav.activity')} />",
      },
    ],
  },
  // ---- quick add for someone in no team (V277)
  {
    name: 'tasks-no-team-offered-default',
    breaks: [unit('someone-in-no-team-must-pick-an-owner')],
    expect: 'someone in no team gets no Default',
    edits: [{ file: RULES, find: '  const offerDefault = myTeam !== null;', replace: '  const offerDefault = true;' }],
  },
  {
    name: 'tasks-no-team-offers-people-in-no-team',
    breaks: [unit('someone-in-no-team-must-pick-an-owner')],
    expect: 'someone in no team gets no Default',
    edits: [{ file: RULES, find: 'assignable.filter((p) => p.team_id !== null)', replace: 'assignable' }],
  },
  {
    name: 'tasks-no-team-saves-without-an-owner',
    breaks: [unit('someone-in-no-team-must-pick-an-owner')],
    expect: 'with no Default, quick add refuses until an owner is picked',
    edits: [
      {
        file: RULES,
        find: "  if (opts.ownerRequired && !input.ownerId) return { error: 'owner_required' };\n",
        replace: '',
      },
    ],
  },
  {
    name: 'tasks-no-team-says-needs-a-team',
    breaks: [unit('someone-in-no-team-must-pick-an-owner')],
    expect: 'reads as "Pick an owner"',
    edits: [{ file: RULES, find: "key === 'errors.task.team_required' ?", replace: "key === 'errors.task.never' ?" }],
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
  {
    name: 'e2e-tasks-past-work-no-team-offers-no-owner',
    breaks: [e2e],
    expect: 'an admin in no team pastes rows with no Owner column, picks one owner and saves',
    edits: [
      {
        file: 'src/modules/tasks/screens/PastWorkPanel.tsx',
        find: '        ownerNeeded={ownerNeeded}\n',
        replace: '',
      },
    ],
  },
  {
    name: 'e2e-tasks-no-team-quick-add-keeps-default',
    breaks: [e2e],
    expect: 'an admin in no team must pick an owner',
    edits: [
      {
        file: 'src/modules/tasks/screens/QuickAdd.tsx',
        find: '  const owners = quickAddOwners(me.person.team_id, org?.people ?? []);',
        replace: "  const owners = quickAddOwners('anything', org?.people ?? []);",
      },
    ],
  },
  {
    // QA-521: someone in no team without tasks.assign got a form that could only be refused
    name: 'no-team-without-assign-gets-a-dead-form',
    breaks: ['unit:tests/unit/tasks/someone-in-no-team-without-assign-is-told-why.test.tsx'],
    expect: 'Quick add says to ask for a team',
    edits: [
      {
        file: 'src/modules/tasks/rules.ts',
        find: 'myTeam === null && !canAssign;',
        replace: 'false && myTeam === null && !canAssign;',
      },
    ],
  },
];
