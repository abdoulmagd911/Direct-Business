// Landing 47 (24 Nov) — the small fix round: the board takes a card anywhere in a column's lane and scrolls by the
// clock; a bare "@" lists the record's people at once and a finished mention opens no list; the Hand over dialog
// opens for the task's Responsible from both doors, on a PC and on a phone. Each sabotage takes one promise back, and
// the test named must go red for it.
const DRAG = 'src/modules/tasks/screens/board-drag.ts';
const BOARD = 'src/modules/tasks/screens/TaskBoard.tsx';
const EXTRAS = 'src/ui/record/CommentExtras.tsx';
const COMMENTS = 'src/ui/record/Comments.tsx';
const RECORD = 'src/modules/tasks/screens/TaskRecord.tsx';
const E2E = 'e2e:tests/e2e/landing-47-fix-round.spec.ts';
const UNIT_BOARD = 'unit:tests/unit/tasks/landing-47-a-column-takes-a-card-anywhere-in-its-lane.test.ts';
const UNIT_AT = 'unit:tests/unit/record/landing-47-a-bare-at-lists-the-people-at-once.test.tsx';

export const sabotages = [
  // ---- the board
  {
    name: 'l47-a-lane-is-only-the-columns-own-box',
    breaks: [UNIT_BOARD],
    expect: '> below a short column’s own box, level with it',
    edits: [
      {
        file: DRAG,
        find: '  for (const c of columns) if (x >= c.box.left && x <= c.box.right) return c.key;',
        replace:
          '  for (const c of columns)\n    if (x >= c.box.left && x <= c.box.right && y >= c.box.top && y <= c.box.bottom) return c.key;',
      },
    ],
  },
  {
    name: 'l47-a-lane-reaches-outside-the-board',
    breaks: [UNIT_BOARD],
    expect: '> not outside the board: above it, below it, or beside it',
    edits: [
      {
        file: DRAG,
        find: '  if (x < board.left || x > board.right || y < board.top || y > board.bottom) return null;\n',
        replace: '',
      },
    ],
  },
  {
    name: 'l47-the-board-scrolls-by-the-frame-again',
    breaks: [UNIT_BOARD],
    expect: '> the same distance in a second at 60 Hz and at 120 Hz',
    edits: [
      {
        file: DRAG,
        find: '  const px = (SCROLL_PX_S * (0.35 + 0.65 * depth) * Math.min(Math.max(ms, 0), 50)) / 1000;',
        replace: '  const px = ms < 0 ? 0 : 14 * (0.35 + 0.65 * depth);',
      },
    ],
  },
  {
    name: 'l47-the-edge-strip-has-one-speed',
    breaks: [UNIT_BOARD],
    expect: '> slower at the strip’s inner side than at the board’s edge',
    edits: [
      {
        file: DRAG,
        find: '  const px = (SCROLL_PX_S * (0.35 + 0.65 * depth) * Math.min(Math.max(ms, 0), 50)) / 1000;',
        replace: '  const px = (SCROLL_PX_S * (depth > 0 ? 1 : 0) * Math.min(Math.max(ms, 0), 50)) / 1000;',
      },
    ],
  },
  {
    name: 'e2e-l47-a-card-below-a-short-column-is-not-taken',
    breaks: [E2E],
    expect: 'a short column takes a card held below its own box (a mouse)',
    // both ways a short column reaches the card are taken back: its lane, and its full height while a card is carried
    edits: [
      {
        file: DRAG,
        find: '    return laneAt(x, y, f.getBoundingClientRect(), columns) || null;',
        replace: '    return columns.length < 0 ? laneAt(x, y, f.getBoundingClientRect(), columns) : null;',
      },
      { file: BOARD, find: "              drag && 'self-stretch',\n", replace: '' },
    ],
  },
  {
    // the lane alone still takes the card (the step before this one passes); the eye no longer sees the column
    name: 'e2e-l47-a-short-column-stays-short-while-a-card-is-carried',
    breaks: [E2E],
    expect: 'while a card is carried a short column is drawn down to where the card is held',
    edits: [{ file: BOARD, find: "              drag && 'self-stretch',\n", replace: '' }],
  },
  {
    name: 'e2e-l47-the-grip-ignores-a-finger',
    breaks: [E2E],
    expect: 'a finger on the grip carries the card',
    edits: [
      {
        file: BOARD,
        find: '              onPointerDown={down(card, true)}',
        replace: '              onPointerDown={down(card)}',
      },
    ],
  },
  // ---- "@"
  {
    name: 'l47-a-bare-at-lists-nobody',
    breaks: [UNIT_AT],
    expect: '> lists the record’s people at once, by name, never the writer and never a nameless row',
    edits: [
      {
        file: EXTRAS,
        find: '  if (term === null || term.length >= 2 || /\\s/.test(term) || !roster?.length) return [];',
        replace: '  if (term === null || term.length !== 1 || /\\s/.test(term) || !roster?.length) return [];',
      },
    ],
  },
  {
    name: 'l47-a-bare-at-offers-the-writer',
    breaks: [UNIT_AT],
    expect: '> lists the record’s people at once, by name, never the writer and never a nameless row',
    edits: [
      {
        file: EXTRAS,
        find: '    .filter((p) => p.id !== meId && !!p.name.trim())',
        replace: '    .filter((p) => !!p.name.trim())',
      },
    ],
  },
  {
    name: 'l47-one-letter-narrows-nothing',
    breaks: [UNIT_AT],
    expect: '> one letter keeps those with a name part that starts with it, whatever its case',
    edits: [
      { file: EXTRAS, find: '          .some((w) => w.startsWith(fold)),', replace: '          .some(() => true),' },
    ],
  },
  {
    name: 'l47-a-finished-mention-is-still-a-query',
    breaks: [UNIT_AT],
    expect: '> the words typed after it open no list',
    edits: [
      {
        file: EXTRAS,
        find: '  if (picked.some((name) => !!name && term.startsWith(name))) return null;\n',
        replace: '',
      },
    ],
  },
  {
    name: 'e2e-l47-the-list-waits-for-two-letters-again',
    breaks: [E2E],
    expect: 'a bare @ lists people at once',
    edits: [
      {
        file: COMMENTS,
        find: '    linking !== null ? linking.trim().length >= 2 : !!at && (at.term.trim().length >= 2 || suggest.items.length > 0);',
        replace: '    linking !== null ? linking.trim().length >= 2 : !!at && at.term.trim().length >= 2;',
      },
    ],
  },
  {
    name: 'e2e-l47-the-comment-box-hands-the-list-no-people',
    breaks: [E2E],
    expect: 'a bare @ lists people at once',
    edits: [{ file: COMMENTS, find: '    roster: people,\n', replace: '' }],
  },
  {
    name: 'e2e-l47-the-words-after-a-pick-search-again',
    breaks: [E2E],
    expect: 'the words after a picked name open no list',
    edits: [{ file: COMMENTS, find: '                      pickedPeople.map((x) => x.name),\n', replace: '' }],
  },
  // ---- Hand over
  {
    name: 'e2e-l47-the-responsible-has-no-hand-over-button',
    breaks: [E2E],
    expect: 'Hand over is offered beside Responsible',
    edits: [
      {
        file: RECORD,
        find: '              <Button size="sm" onClick={() => setDelegating(true)} data-hand-over-open>',
        replace:
          '              <Button size="sm" className="hidden" onClick={() => setDelegating(true)} data-hand-over-open>',
      },
    ],
  },
  {
    name: 'e2e-l47-the-button-opens-no-dialog',
    breaks: [E2E],
    expect: 'the Hand over dialog opens from the button',
    edits: [
      {
        file: RECORD,
        find: '              <Button size="sm" onClick={() => setDelegating(true)} data-hand-over-open>',
        replace: '              <Button size="sm" onClick={() => setDelegating(false)} data-hand-over-open>',
      },
    ],
  },
  {
    name: 'e2e-l47-the-menu-opens-no-dialog',
    breaks: [E2E],
    expect: 'the Hand over dialog opens from the ⋯ menu',
    edits: [
      {
        file: RECORD,
        find: '            <MenuItem icon={<UserPlus />} onSelect={() => setDelegating(true)} data-menu-delegate>',
        replace: '            <MenuItem icon={<UserPlus />} onSelect={() => setDelegating(false)} data-menu-delegate>',
      },
    ],
  },
  {
    name: 'e2e-l47-a-manager-who-is-the-responsible-is-not-offered-it',
    breaks: [E2E],
    expect: 'a manager who is the Responsible',
    edits: [
      {
        file: RECORD,
        find: "  const mayGive = me.capabilities.includes('tasks.assign') || me.capabilities.includes('tasks.assign_own');",
        replace:
          "  const mayGive = !me.capabilities.includes('tasks.assign') && me.capabilities.includes('tasks.assign_own');",
      },
    ],
  },
];
