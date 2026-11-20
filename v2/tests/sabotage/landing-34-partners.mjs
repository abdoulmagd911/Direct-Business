// Landing 34 (test-round fixes), Partners: the list's search, Archived choice, row Actions and whole names; a failed
// read that says why with a Try again that works; the record that shows what was just saved; Watch that is pressable;
// a hover card that never takes the click; the Codes / Finance tabs that ask for their own summary. Each sabotage
// takes one of those back, and the test named must go red.
const FILTERS = 'src/modules/partners/list/filters.ts';
const COLUMNS = 'src/modules/partners/list/columns.ts';
const FRESH = 'src/modules/partners/list/freshness.ts';
const OVERLAY = 'src/modules/partners/screens/record/saved-overlay.ts';
const FAILURE = 'src/modules/partners/read-failure.ts';
const LIST = 'src/modules/partners/screens/PartnersList.tsx';
const READ_FAILED = 'src/modules/partners/screens/ReadFailed.tsx';
const SUMMARY = 'src/modules/partners/screens/record/SummaryTabs.tsx';
const HOVER = 'src/ui/HoverCard.tsx';
const TABLE = 'src/ui/DataTable.tsx';
const FOLLOW = 'src/ui/FollowButton.tsx';
const RECORD_PAGE = 'src/ui/record/RecordPage.tsx';
const T_LOGIC = 'unit:tests/unit/partners/landing-34-the-list-search-and-the-archived-choice.test.ts';
const T_SAVED = 'unit:tests/unit/partners/landing-34-the-record-shows-what-was-saved.test.ts';
const T_ROWS = 'unit:tests/unit/partners/landing-34-every-row-has-its-actions-and-its-whole-name.test.tsx';
const T_SUMMARY = 'unit:tests/unit/partners/landing-34-the-codes-and-finance-tabs-ask-for-their-own-summary.test.tsx';
const T_HOVER = 'unit:tests/unit/ui/landing-34-a-hover-card-never-takes-the-click.test.tsx';
const T_WATCH = 'unit:tests/unit/ui/landing-34-watch-is-pressable-and-a-failed-read-tries-again.test.tsx';

export const sabotages = [
  // ---- item 30: Archived is a choice of the Status chip
  {
    name: 'l34-partners-archived-pick-is-dropped',
    breaks: [T_LOGIC],
    expect: '> ticking Archived writes the archived view, not a status',
    edits: [{ file: FILTERS, find: 'archived: picks.includes(ARCHIVED_PICK) };', replace: 'archived: f.archived };' }],
  },
  {
    name: 'l34-partners-archived-pick-is-sent-as-a-status',
    breaks: [T_LOGIC],
    expect: '> Archived ticks beside a status, and each goes to its own place',
    edits: [
      { file: FILTERS, find: 'statuses: picks.filter((p) => p !== ARCHIVED_PICK),', replace: 'statuses: picks,' },
    ],
  },
  // ---- item 7: the search box drives the list
  {
    name: 'l34-partners-search-keeps-its-spaces',
    breaks: [T_LOGIC],
    expect: '> the typed words go into the address, without the spaces around them',
    edits: [{ file: FILTERS, find: "return typed.trim().replace(/\\s+/g, ' ');", replace: 'return typed;' }],
  },
  {
    name: 'l34-partners-search-drops-the-other-filters',
    breaks: [T_LOGIC],
    expect: '> a search keeps every other filter and lets a saved view’s name go',
    edits: [
      {
        file: FILTERS,
        find: "return { ...f, q: searchText(typed), view: '' };",
        replace: 'return { ...emptyFilters(), q: searchText(typed) };',
      },
    ],
  },
  {
    name: 'l34-partners-search-box-is-not-a-search-field',
    breaks: [T_ROWS],
    expect: '> Enter and the phone’s Search key submit it',
    edits: [{ file: LIST, find: 'type="search"', replace: 'type="text"' }],
  },
  // ---- item 25: the row's Actions
  {
    name: 'l34-partners-actions-column-is-not-counted',
    breaks: [T_LOGIC],
    expect: '> with the Actions column counted, the table never asks for more room than its place has',
    edits: [{ file: COLUMNS, find: 'NEED.flags + NAME_PAD + ACTIONS_WIDTH;', replace: 'NEED.flags + NAME_PAD;' }],
  },
  {
    name: 'l34-partners-a-row-loses-its-actions',
    breaks: [T_ROWS],
    expect: '> one Actions button on each row, named for its organisation',
    edits: [
      {
        file: LIST,
        find: '<RowActions row={r} mayArchive={full} onOpen={open} words={words} />',
        replace: '{null}',
      },
    ],
  },
  // ---- items 26/34: a name is read whole
  {
    name: 'l34-partners-a-name-is-cut-again',
    breaks: [T_ROWS],
    expect: '> a long name is drawn in full and is not cut with an ellipsis',
    edits: [
      {
        file: LIST,
        find: '<bdi className="min-w-0 break-words">{tradeName(r, locale)}</bdi>',
        replace: '<bdi className="min-w-0 truncate">{tradeName(r, locale)}</bdi>',
      },
    ],
  },
  // ---- item 31: the list reads again after an add
  {
    name: 'l34-partners-a-change-does-not-mark-the-list',
    breaks: [T_LOGIC],
    expect: '> the list on screen when a partner is added is stale; a newer read is not',
    edits: [{ file: FRESH, find: '  stale = seen;', replace: '  stale = null;' }],
  },
  // ---- items 2/3: a failed read says why, and Try again works
  {
    name: 'l34-partners-a-timeout-is-not-told',
    breaks: [T_SAVED],
    expect: '> a read the database stopped for time is a timeout, with its code',
    edits: [
      { file: FAILURE, find: "return { kind: 'timeout', ref };", replace: "return { kind: 'unavailable', ref };" },
    ],
  },
  {
    name: 'l34-partners-a-failed-list-gives-no-reason',
    breaks: [T_ROWS],
    expect: '> a read stopped for time: the reason, its reference and Try again',
    edits: [
      {
        file: READ_FAILED,
        find: 'message={failure && message ? `${message} ${t(`partners.read.${failure.kind}`)}` : message}',
        replace: 'message={message}',
      },
    ],
  },
  {
    name: 'l34-partners-a-refusal-is-drawn-as-a-failed-read',
    breaks: [T_ROWS],
    expect: '> a refusal is said as no access, with no Try again',
    edits: [{ file: LIST, find: "{failed && failure?.kind === 'refused' ? (", replace: '{failed && !failure ? (' }],
  },
  {
    name: 'l34-partners-a-failed-lookup-is-not-said',
    breaks: [T_ROWS],
    expect: '> a read beside the list that failed does not take the list down',
    edits: [{ file: LIST, find: '      {partial ? (', replace: '      {partial && failed ? (' }],
  },
  {
    name: 'l34-partners-try-again-does-nothing',
    breaks: [T_WATCH],
    expect: '> Try again reads again, and a read that fails again says it was tried',
    edits: [{ file: READ_FAILED, find: 'start(() => router.refresh());', replace: 'start(() => {});' }],
  },
  // ---- items 17 and 32: the record shows what was just saved
  {
    name: 'l34-partners-unarchive-waits-for-the-re-read',
    breaks: [T_SAVED],
    expect: '> Unarchive shows at once, though the card read still says archived',
    edits: [{ file: OVERLAY, find: 'return said ?? !!archivedAt;', replace: 'return !!archivedAt;' }],
  },
  {
    name: 'l34-partners-a-saved-note-waits-for-the-re-read',
    breaks: [T_SAVED],
    expect: '> the saved note shows before the re-read lands',
    edits: [
      { file: OVERLAY, find: 'return { ...card, ...saved.changes, version: saved.version };', replace: 'return card;' },
    ],
  },
  {
    name: 'l34-partners-a-saved-edit-hides-a-newer-read',
    breaks: [T_SAVED],
    expect: '> the re-read replaces the overlay: a card of that version or newer is shown as read',
    edits: [
      {
        file: OVERLAY,
        find: 'if (!saved || card.version >= saved.version) return card;',
        replace: 'if (!saved) return card;',
      },
    ],
  },
  // ---- item 21: Watch
  {
    name: 'l34-watch-is-disabled-while-it-reads',
    breaks: [T_WATCH],
    expect: '> is not disabled while its own read is still out',
    edits: [{ file: FOLLOW, find: 'disabled={viewer}', replace: 'disabled={on === null || viewer}' }],
  },
  {
    name: 'l34-watch-disabled-for-a-viewer-says-nothing',
    breaks: [T_WATCH],
    expect: '> a Viewer’s button is disabled and says why, on the page and as its tooltip',
    edits: [
      { file: FOLLOW, find: '  if (!viewer) return button;', replace: '  if (viewer || !viewer) return button;' },
    ],
  },
  // ---- item 9: the hover card
  {
    name: 'l34-hover-card-opens-on-loading',
    breaks: [T_HOVER],
    expect: '> a resting mouse asks for the content, and the card opens only once it has been read',
    edits: [{ file: HOVER, find: 'if (settled.current) setOpen(true);', replace: 'setOpen(true);' }],
  },
  {
    name: 'l34-hover-card-opens-for-a-finger',
    breaks: [T_HOVER],
    expect: '> a finger never opens it: touch has no hover',
    edits: [{ file: HOVER, find: "return pointerType === 'mouse';", replace: 'return pointerType.length > 0;' }],
  },
  {
    name: 'l34-hover-card-stays-over-a-click',
    breaks: [T_HOVER],
    expect: '> a press on the name closes the card that is open',
    edits: [{ file: HOVER, find: '        onClick={dismiss}\n', replace: '' }],
  },
  {
    name: 'l34-a-link-in-a-row-opens-the-record-twice',
    breaks: [T_HOVER],
    expect: '> the name’s link, and anything inside it',
    edits: [{ file: TABLE, find: "const OWN_CONTROL = 'a, button,", replace: "const OWN_CONTROL = 'button," }],
  },
  // ---- item 20: the record's sections in one row on a phone
  {
    name: 'l34-record-tabs-wrap-on-a-phone-again',
    breaks: [T_WATCH],
    expect: '> with it, the row does not wrap on a phone and scrolls inside itself',
    edits: [
      { file: RECORD_PAGE, find: 'className={tabsOneRow ? ONE_ROW : undefined}', replace: 'className={undefined}' },
    ],
  },
  // ---- the Codes / Finance tabs ask for their own summary
  {
    name: 'l34-partners-summary-is-asked-on-every-tab',
    breaks: [T_SUMMARY],
    expect: '> the Overview asks for nothing and draws nothing of it',
    edits: [
      {
        file: SUMMARY,
        find: 'if (!deferred || !wanted || answered.current === key) return;',
        replace: 'if (!deferred || answered.current === key) return;',
      },
    ],
  },
  {
    name: 'l34-partners-summary-is-asked-again-on-every-tab-change',
    breaks: [T_SUMMARY],
    expect: '> what was read is kept: Finance after Codes, and away and back, ask nothing again',
    edits: [{ file: SUMMARY, find: '        answered.current = key;\n', replace: '' }],
  },
  {
    name: 'l34-partners-summary-try-again-does-nothing',
    breaks: [T_SUMMARY],
    expect: '> a summary that does not load says why inside the tab, and Try again reads again',
    edits: [
      {
        file: SUMMARY,
        find: 'onClick={() => setAttempt((n) => n + 1)}\n                className="ms-auto"',
        replace: 'onClick={() => setAttempt((n) => n)}\n                className="ms-auto"',
      },
    ],
  },
  {
    name: 'l34-partners-summary-is-not-read-again-after-a-change',
    breaks: [T_SUMMARY],
    expect: '> after a change on the record the summary is read again, the old one staying until it lands',
    edits: [
      {
        file: SUMMARY,
        find: 'const key = `${card.id}:${stamp}:${attempt}`;',
        replace: 'const key = `${card.id}:${attempt}`;',
      },
    ],
  },
];
