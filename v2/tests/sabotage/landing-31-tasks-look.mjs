// Landing 31 (16 Nov): the Tasks screen's look, from the 15 Nov boards — one status pill per row and per card, overdue
// as the due date in the danger colour (never a pill), the List / Board / Calendar switch keeping the tab and the
// filters, one count per board column and per list group, and ONE "My work" count shared with My day. Each sabotage
// takes one of those back, and the test named must go red for it.
const LIST = 'src/modules/tasks/screens/TaskListScreen.tsx';
const BOARD = 'src/modules/tasks/screens/TaskBoard.tsx';
const BITS = 'src/modules/tasks/screens/TaskBits.tsx';
const LOOK = 'src/modules/tasks/screens/look.ts';
const COUNT = 'src/modules/tasks/my-work-count.ts';
const SKELETON = 'src/modules/tasks/screens/TasksSkeleton.tsx';
const DRAWN = 'unit:tests/unit/tasks/the-tasks-look-one-pill-and-overdue-is-a-date.test.tsx';
const RULES = 'unit:tests/unit/tasks/the-my-work-count-and-the-status-groups.test.ts';

export const sabotages = [
  // ---- one status pill per row and per card
  {
    name: 'list-row-draws-overdue-as-a-second-pill',
    breaks: [DRAWN],
    expect: '> a blocked, overdue, prioritised task draws one pill, and it says Blocked',
    edits: [
      {
        file: LIST,
        find: '          <StatusChip tone={STATUS_TONE[view]} className="max-w-full">',
        replace:
          '          {due === \'overdue\' ? <StatusChip tone="danger">{t(\'status.overdue\')}</StatusChip> : null}\n          <StatusChip tone={STATUS_TONE[view]} className="max-w-full">',
      },
    ],
  },
  {
    name: 'list-row-draws-the-priority-as-a-second-pill',
    breaks: [DRAWN],
    expect: '> a blocked, overdue, prioritised task draws one pill, and it says Blocked',
    edits: [
      {
        file: LIST,
        find: "              {t('pages.tasks.look.priority', { priority })}",
        replace: '              <StatusChip tone="info">{priority}</StatusChip>',
      },
    ],
  },
  {
    name: 'list-row-pill-forgets-blocked',
    breaks: [DRAWN],
    expect: '> a blocked, overdue, prioritised task draws one pill, and it says Blocked',
    edits: [{ file: LIST, find: '  const view = pillOf(row);', replace: '  const view = row.meaning;' }],
  },
  {
    name: 'list-row-drops-the-responsible-person',
    breaks: [DRAWN],
    expect: '> the row names the partner and the Responsible person',
    edits: [
      {
        file: LIST,
        find: "          <ResponsibleMark row={row} lookups={lookups} names={names} label={t('pages.tasks.look.colResponsible')} />",
        replace: '',
      },
    ],
  },
  {
    name: 'board-card-draws-a-second-pill',
    breaks: [DRAWN],
    expect: '> shows exactly one status pill — the status menu — even when blocked and overdue',
    edits: [
      {
        file: BOARD,
        find: '        <span className="relative z-10 shrink-0" data-task-pill={view} data-no-drag>',
        replace:
          '        <span data-task-pill="overdue">{t(\'status.overdue\')}</span>\n        <span className="relative z-10 shrink-0" data-task-pill={view} data-no-drag>',
      },
    ],
  },
  {
    name: 'board-card-drops-the-partner',
    breaks: [DRAWN],
    expect: '> shows the partner, the due date (red when overdue) and the Responsible person',
    edits: [{ file: BOARD, find: '      <WhereMark row={r} names={names} first />\n', replace: '' }],
  },
  // ---- overdue is a date, not a pill
  {
    name: 'overdue-date-loses-its-word',
    breaks: [DRAWN],
    expect: '> the overdue date is drawn in the danger colour and says "Overdue:" to a screen reader',
    edits: [
      {
        file: BITS,
        find: '        {late ? <span className="sr-only">{t(\'pages.tasks.look.overdueLabel\')} </span> : null}\n',
        replace: '',
      },
    ],
  },
  {
    name: 'overdue-date-is-not-in-the-danger-colour',
    breaks: [DRAWN],
    expect: '> the overdue date is drawn in the danger colour and says "Overdue:" to a screen reader',
    edits: [
      { file: BITS, find: "        late && 'font-medium text-danger',", replace: "        late && 'font-medium'," },
    ],
  },
  {
    name: 'every-date-is-called-overdue',
    breaks: [DRAWN],
    expect: '> a date that is not overdue is neither red nor called overdue',
    edits: [{ file: BITS, find: "  const late = due === 'overdue';", replace: "  const late = due !== 'closed';" }],
  },
  // ---- the view switch keeps the tab and the filters
  {
    name: 'view-switch-drops-the-tab-and-the-filters',
    breaks: [DRAWN],
    expect: '> each layout link carries the tab, every chip, the search and the sort',
    edits: [
      {
        file: LIST,
        find: 'href={filtersHref(filters, { layout: l })}',
        replace: "href={filtersHref({ scope: 'my_work' }, { layout: l })}",
      },
    ],
  },
  // ---- the counts
  {
    name: 'board-column-counts-the-whole-list',
    breaks: [DRAWN],
    expect: '> each board column carries its count, a blocked task under Blocked, and they add up to the list',
    edits: [{ file: BOARD, find: 'data-count={c.rows.length}', replace: 'data-count={rows.length}' }],
  },
  {
    name: 'list-group-counts-the-whole-list',
    breaks: [DRAWN],
    expect: '> the list’s group rows carry the same counts (a group with no task is not drawn)',
    edits: [{ file: LIST, find: 'data-count={g.rows.length}', replace: 'data-count={rows.length}' }],
  },
  {
    name: 'blocked-tasks-are-counted-under-in-progress',
    breaks: [RULES, DRAWN],
    expect: 'a blocked task',
    edits: [
      {
        file: LOOK,
        find: "    const stuck = c.rows.filter((r) => statusView(r) === 'blocked');",
        replace: '    const stuck = c.rows.filter(() => false);',
      },
    ],
  },
  {
    name: 'blocked-tasks-are-counted-twice',
    breaks: [RULES],
    expect: '> a blocked task is counted under Blocked, not under In progress, and every task is counted once',
    edits: [
      {
        file: LOOK,
        find: "      rows: stuck.length ? c.rows.filter((r) => statusView(r) !== 'blocked') : c.rows,",
        replace: '      rows: c.rows,',
      },
    ],
  },
  {
    name: 'my-work-count-counts-done-as-open',
    breaks: [RULES, DRAWN],
    expect: 'open',
    edits: [
      {
        file: COUNT,
        find: "    if (r.meaning !== 'not_started' && r.meaning !== 'in_progress') continue;",
        replace: "    if (r.meaning === 'cancelled') continue;",
      },
    ],
  },
  {
    name: 'my-work-count-calls-a-closed-task-overdue',
    breaks: [RULES],
    expect: '> due today and overdue count open tasks only — a closed task is never overdue, nor is past work',
    edits: [
      {
        file: COUNT,
        find: "    if (due === 'overdue') out.overdue += 1;",
        replace: "    if (due === 'overdue' || r.past_work) out.overdue += 1;",
      },
    ],
  },
  {
    name: 'tab-number-shows-a-part-as-the-whole',
    breaks: [DRAWN],
    expect: '> and carries no number once a chip is on, or past the first page — a part is never shown as the whole',
    edits: [
      {
        file: LIST,
        find: "count: s === f.scope && s !== 'past' && wholeTab ? counts.open : undefined,",
        replace: 'count: s === f.scope ? counts.open : undefined,',
      },
    ],
  },
  // ---- the states
  {
    name: 'empty-tasks-offers-no-add-task',
    breaks: [DRAWN],
    expect: '> an empty tab says so in one line and offers Add task to someone who may add',
    edits: [
      {
        file: LIST,
        find: "            atLeastOwn(me.levels.tasks) && f.scope !== 'past' && !isFiltered(f) && !f.starred && !f.escalated ? (",
        replace: '            false ? (',
      },
    ],
  },
  {
    name: 'tasks-skeleton-says-nothing-to-a-screen-reader',
    breaks: [DRAWN],
    expect: '> the loading skeleton says what is loading, in the list’s shape or the board’s',
    edits: [{ file: SKELETON, find: '      <span className="sr-only">{label}</span>\n', replace: '' }],
  },
];
