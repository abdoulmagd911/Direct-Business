// Landing 35 (the owner's live sweep of 21 Nov) · Tasks. Two failures, and what each fix promises:
//   1. `?layout=board` is a real board — one row of columns side by side that scrolls sideways inside its own frame,
//      each column with its header and its own scroll, a card saying the task in short — and the address keeps it
//      (a default saved view no longer opens over it; a saved view that names no layout keeps the one on screen);
//   2. the search filters as it is typed in (a 250 ms pause, the address replaced not pushed, an emptied box drops the
//      search, Enter still asks at once), and an answer to the box's own question never rewrites the box.
// Each sabotage takes one of those back, and the test named must go red for it.
const LIST = 'src/modules/tasks/screens/TaskListScreen.tsx';
const BOARD = 'src/modules/tasks/screens/TaskBoard.tsx';
const SKELETON = 'src/modules/tasks/screens/TasksSkeleton.tsx';
const RULES = 'src/modules/tasks/rules.ts';
const DRAWN = 'unit:tests/unit/tasks/landing-35-the-board-is-columns-side-by-side.test.tsx';
const TYPED = 'unit:tests/unit/tasks/landing-35-the-search-filters-as-you-type.test.tsx';
const BROWSER = 'e2e:tests/e2e/landing-35-tasks.spec.ts';

export const sabotages = [
  // ---------------------------------------------------------------- 1 · the board is one row of columns
  {
    name: 'l35-the-board-address-draws-the-list',
    breaks: [DRAWN],
    expect: '> the address ?layout=board draws the board and not the list’s groups',
    edits: [
      { file: LIST, find: "          {layout === 'board' ? (", replace: "          {layout === 'board' && !rows ? (" },
    ],
  },
  {
    name: 'l35-the-board-wraps-its-columns-under-each-other',
    breaks: [DRAWN],
    expect: '> the columns stand side by side in one row that never wraps one under another',
    edits: [
      {
        file: BOARD,
        find: "  'flex min-w-0 max-w-full snap-x",
        replace: "  'flex flex-wrap min-w-0 max-w-full snap-x",
      },
    ],
  },
  {
    name: 'l35-the-board-does-not-scroll-inside-its-frame',
    breaks: [DRAWN],
    expect: '> the row scrolls sideways inside its own frame, so the page does not',
    edits: [{ file: BOARD, find: 'overflow-x-auto overscroll-x-contain', replace: 'overscroll-x-contain' }],
  },
  {
    name: 'l35-the-phone-board-does-not-snap-to-a-column',
    breaks: [DRAWN],
    expect: '> on a phone the row snaps to one column at a time',
    edits: [{ file: BOARD, find: 'shrink-0 snap-start snap-always flex-col', replace: 'shrink-0 flex-col' }],
  },
  {
    name: 'l35-the-arabic-board-is-turned-round-twice',
    breaks: [DRAWN],
    expect: '> there is one column per status, in the settings’ order, Blocked after In progress — the same in Arabic',
    edits: [
      {
        file: BOARD,
        find: "  'flex min-w-0 max-w-full snap-x",
        replace: "  'flex rtl:flex-row-reverse min-w-0 max-w-full snap-x",
      },
    ],
  },
  {
    name: 'l35-a-board-column-loses-its-count',
    breaks: [DRAWN],
    expect: '> the header says the status and its count, and stays above the cards',
    edits: [{ file: BOARD, find: '              <CountBadge count={c.rows.length} />\n', replace: '' }],
  },
  {
    name: 'l35-a-long-column-is-as-tall-as-its-cards',
    breaks: [DRAWN],
    expect: '> a long column scrolls inside itself and is no taller than the screen has room for',
    edits: [{ file: BOARD, find: 'flex-col gap-2 overflow-y-auto p-1', replace: 'flex-col gap-2 p-1' }],
  },
  {
    name: 'l35-a-long-column-shows-two-cards',
    breaks: [DRAWN],
    expect: '> every card of a long column is drawn — none is folded away',
    edits: [{ file: BOARD, find: '{c.rows.map((r) => (', replace: '{c.rows.slice(0, 2).map((r) => (' }],
  },
  {
    name: 'l35-a-board-card-drops-the-number',
    breaks: [DRAWN],
    expect: '> the number, the title, the Responsible person and the due day',
    edits: [
      {
        file: BOARD,
        find: '          {r.number}\n        </span>\n        <span className="flex shrink-0',
        replace: '        </span>\n        <span className="flex shrink-0',
      },
    ],
  },
  {
    name: 'l35-every-board-card-wears-a-star',
    breaks: [DRAWN],
    expect: '> the star is drawn on a starred task and on no other',
    edits: [{ file: BOARD, find: '<StarMark starred={r.starred} />', replace: '<StarMark starred />' }],
  },
  {
    name: 'l35-a-default-view-opens-over-the-board-address',
    breaks: [DRAWN],
    expect: '> a default saved view opens only on the bare list, never over an address that chose something',
    edits: [
      {
        file: RULES,
        find: "export const defaultViewOpens = (f: TaskFilters): boolean => filtersHref(f) === '/tasks';",
        replace: 'export const defaultViewOpens = (f: TaskFilters): boolean => !!f;',
      },
    ],
  },
  {
    name: 'l35-a-saved-view-throws-the-board-back-to-the-list',
    breaks: [DRAWN],
    expect: '> a saved view that names no layout keeps the board on screen',
    edits: [{ file: RULES, find: '  return next.layout ? next : {', replace: '  return next.layout || f ? next : {' }],
  },
  {
    name: 'l35-a-saved-views-own-layout-is-ignored',
    breaks: [DRAWN],
    expect: '> a saved view that names a layout opens in its own, and still replaces every filter',
    edits: [{ file: RULES, find: '  return next.layout ? next : {', replace: '  return !f ? next : {' }],
  },
  {
    name: 'l35-the-layout-switch-does-not-mark-the-open-layout',
    breaks: [DRAWN],
    expect: '> every layout link on the board keeps the tab, on every tab that offers the switch',
    edits: [{ file: LIST, find: "            aria-current={on ? 'page' : undefined}\n", replace: '' }],
  },
  {
    name: 'l35-the-loading-board-is-stacked',
    breaks: [DRAWN],
    expect: '> is drawn as columns in one row too, not stacked',
    edits: [
      {
        file: SKELETON,
        find: '<div className="flex min-w-0 items-start gap-3 overflow-hidden">',
        replace: '<div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">',
      },
    ],
  },
  // ---------------------------------------------------------------- 2 · the search asks as it is typed in
  {
    name: 'l35-the-search-waits-for-enter',
    breaks: [TYPED],
    expect: '> typing alone moves the address to the box’s words after a short pause — no Enter',
    edits: [
      {
        file: LIST,
        find: 'setTimeout(() => searchLater(wanted), SEARCH_DEBOUNCE_MS)',
        replace: 'setTimeout(() => {}, SEARCH_DEBOUNCE_MS)',
      },
    ],
  },
  {
    name: 'l35-the-search-pause-is-over-a-second',
    breaks: [TYPED],
    expect: '> the pause is about a quarter of a second',
    edits: [
      {
        file: RULES,
        find: 'export const SEARCH_DEBOUNCE_MS = 250;',
        replace: 'export const SEARCH_DEBOUNCE_MS = 1200;',
      },
    ],
  },
  {
    name: 'l35-the-search-pushes-every-pause-into-back',
    breaks: [TYPED],
    expect: '> the address is replaced, never pushed, so Back is not walked through every letter',
    edits: [
      {
        file: LIST,
        find: 'router.replace(href, { scroll: false });',
        replace: 'router.push(href, { scroll: false });',
      },
    ],
  },
  {
    name: 'l35-the-search-asks-for-every-letter',
    breaks: [TYPED],
    expect: '> letters typed quickly are one question, for the last text',
    edits: [
      {
        file: LIST,
        find: '    return () => clearTimeout(timer);\n  }, [wanted, inFlight]);',
        replace: '  }, [wanted, inFlight]);',
      },
    ],
  },
  {
    name: 'l35-an-emptied-search-box-keeps-the-search',
    breaks: [TYPED],
    expect: '> emptying the box drops the search',
    edits: [
      {
        file: RULES,
        find: '  return term === f.q ? null : filtersHref(f, { q: term });',
        replace: '  return term === f.q || !term ? null : filtersHref(f, { q: term });',
      },
    ],
  },
  {
    name: 'l35-enter-in-the-search-does-nothing',
    breaks: [TYPED],
    expect: '> Enter asks at once, and the timer does not ask the same again',
    edits: [{ file: LIST, find: '              if (wanted) search(wanted);', replace: '' }],
  },
  {
    name: 'l35-the-search-asks-for-what-the-address-already-holds',
    breaks: [TYPED],
    expect: '> a box that says what the address holds asks nothing',
    edits: [
      {
        file: RULES,
        find: '  return term === f.q ? null : filtersHref(f, { q: term });',
        replace: '  return filtersHref(f, { q: term });',
      },
    ],
  },
  {
    name: 'l35-the-search-drops-the-tab-and-the-board',
    breaks: [TYPED],
    expect: '> the tab, the board and the chips stay in the address — on every tab and layout',
    edits: [
      {
        file: RULES,
        find: '  return term === f.q ? null : filtersHref(f, { q: term });',
        replace: '  return term === f.q ? null : filtersHref({ scope: f.scope }, { q: term });',
      },
    ],
  },
  {
    name: 'l35-an-older-answer-rewrites-the-search-box',
    breaks: [TYPED],
    expect: '> an older answer arriving after more was typed leaves the box, its focus and its caret alone',
    edits: [{ file: LIST, find: "    if (on.follow) setQ(f.q ?? '');", replace: "    setQ(f.q ?? '');" }],
  },
  {
    name: 'l35-the-search-box-is-drawn-anew-with-every-answer',
    breaks: [TYPED],
    expect: '> the same input element lives through an answer (it is not drawn anew)',
    edits: [
      {
        file: LIST,
        find: '            role="search"\n',
        replace: '            role="search"\n            key={f.q}\n',
      },
    ],
  },
  {
    name: 'l35-the-search-box-ignores-a-search-set-elsewhere',
    breaks: [TYPED],
    expect: '> a search set by another hand (Clear all, a saved view, Back) is shown in the box',
    edits: [{ file: LIST, find: "    if (on.follow) setQ(f.q ?? '');\n", replace: '' }],
  },
  {
    name: 'l35-the-search-asks-for-the-spaces-too',
    breaks: [TYPED],
    expect: '> the words asked for are the box’s, trimmed and no longer than the address keeps',
    edits: [
      { file: RULES, find: 'typed.trim().slice(0, 100) || undefined;', replace: 'typed.slice(0, 100) || undefined;' },
    ],
  },
  {
    name: 'l35-the-search-has-an-address-to-move-to-at-all-times',
    breaks: [TYPED],
    expect: '> there is an address to move to only when the box and the address differ',
    edits: [
      {
        file: RULES,
        find: '  return term === f.q ? null : filtersHref(f, { q: term });',
        replace: '  return term !== f.q ? null : filtersHref(f, { q: term });',
      },
    ],
  },
  {
    name: 'l35-the-search-box-never-forgets-what-it-asked',
    breaks: [TYPED],
    expect: '> an answer the box asked for never moves the box; once the newest is answered the older are forgotten',
    edits: [
      {
        file: RULES,
        find: 'asked: asked[asked.length - 1] === q ? [q] : [...asked] };',
        replace: 'asked: [...asked] };',
      },
    ],
  },
  {
    name: 'l35-the-search-box-keeps-its-memory-over-another-hands-search',
    breaks: [TYPED],
    expect: '> a search the box did not ask for moves it, and starts the memory again',
    edits: [
      {
        file: RULES,
        find: '  if (!asked.includes(q)) return { follow: true, asked: [] };',
        replace: '  if (!asked.includes(q)) return { follow: true, asked: [...asked] };',
      },
    ],
  },
  // ---------------------------------------------------------------- the same two, measured in the browser
  {
    // the columns are laid one under another again (the stacked groups the owner saw)
    name: 'e2e-l35-the-board-stacks-its-columns',
    breaks: [BROWSER],
    expect: 'the columns share one top',
    edits: [
      { file: BOARD, find: "  'flex min-w-0 max-w-full snap-x", replace: "  'flex flex-col min-w-0 max-w-full snap-x" },
    ],
  },
  {
    // the box only keeps its own text: nothing asks until Enter
    name: 'e2e-l35-the-search-waits-for-enter',
    breaks: [BROWSER],
    expect: 'typing alone filters the list — no Enter',
    edits: [
      {
        file: LIST,
        find: 'setTimeout(() => searchLater(wanted), SEARCH_DEBOUNCE_MS)',
        replace: 'setTimeout(() => {}, SEARCH_DEBOUNCE_MS)',
      },
    ],
  },
];
