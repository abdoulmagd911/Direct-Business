// Sabotages for Landing 34, the shell worker (the 19 Nov test round): a failed Add task that said nothing and a
// /tasks/new with no form (item 6), a search result that did not open (8), menu taps and record links that looked dead
// (10), the missing spaces on a phone (15), the task record's sections bar (23), switching between test users (29),
// the sign-in gap (33), "Direct Corporate" (36/38) and the phone's top bar logo (37).
const MOVE = 'unit:tests/unit/shell/landing-34-a-move-made-in-code-shows-loading-and-a-search-result-opens.test.tsx';
const FOCUS = 'unit:tests/unit/shell/landing-34-the-focus-refetch-lets-a-page-on-its-way-go-first.test.tsx';
const SWITCH = 'unit:tests/unit/shell/landing-34-a-test-user-switches-straight-to-another.test.tsx';
const BRAND = 'unit:tests/unit/shell/landing-34-the-workspace-reads-direct-corporate.test.tsx';
const SPACE = 'unit:tests/unit/ui/landing-34-words-set-side-by-side-keep-their-space.test.tsx';
const ADD = 'unit:tests/unit/tasks/landing-34-add-task-says-a-failed-save-and-opens-before-the-list.test.tsx';
const ROW = 'unit:tests/unit/tasks/landing-34-the-record-sections-stay-on-one-row.test.tsx';

export const sabotages = [
  // ---- items 8 and 10: a move made in code, the search, a notice, the focus refetch
  {
    // the search closes and never asks for the record's page
    name: 'l34-a-search-result-just-closes-the-search',
    breaks: [MOVE],
    expect: 'a click on an organisation asks the router for its page first, shows Loading, then closes the search',
    edits: [
      {
        file: 'src/ui/shell/CommandPalette.tsx',
        find: '    if (navStartedTo(route)) router.push(route);\n    close(false);',
        replace: '    void navStartedTo;\n    void router;\n    void route;\n    close(false);',
      },
    ],
  },
  {
    // a move made in code tells the shell nothing: no bar, no words, as before
    name: 'l34-a-move-made-in-code-shows-nothing',
    breaks: [MOVE],
    expect: 'to another address: a move is on its way from the address we are on, until the page arrives',
    edits: [
      {
        file: 'src/ui/shell/nav-pending.ts',
        find: '  navStarted();\n  return true;',
        replace: '  return true;',
      },
    ],
  },
  {
    // only the 4 px bar again: the wait is never said in words
    name: 'l34-the-wait-is-never-said-in-words',
    breaks: [MOVE],
    expect: 'the shell shows the bar and the words Loading for a move made in code, and takes them away when it lands',
    edits: [
      {
        file: 'src/ui/shell/NavProgress.tsx',
        find: '      <PendingPill label={label} />\n',
        replace: '',
      },
    ],
  },
  {
    // a notice waits for "mark read" to be written before its page is asked for
    name: 'l34-a-notice-waits-for-mark-read',
    breaks: [MOVE],
    expect: 'the page is asked for first; the write goes beside it',
    edits: [
      {
        file: 'src/ui/shell/NotificationsPanel.tsx',
        find: '    if (navStartedTo(href)) router.push(href);\n    onOpenChange(false);\n    if (ids.length) await act(() => markRead(ids));',
        replace:
          '    if (ids.length) await act(() => markRead(ids));\n    onOpenChange(false);\n    if (navStartedTo(href)) router.push(href);',
      },
    ],
  },
  {
    // the window's return re-reads the page being left although another page is on its way
    name: 'l34-the-focus-refetch-races-a-page-on-its-way',
    breaks: [FOCUS],
    expect: 'the tap that brought the window back was a tap on a link: the page being left is not read again',
    edits: [
      {
        file: 'src/ui/shell/RefetchBridge.tsx',
        find: '        if (navPending()) return;\n',
        replace: '',
      },
    ],
  },
  {
    // the focus refetch runs under a write again (F131)
    name: 'l34-the-focus-refetch-runs-under-a-write',
    breaks: [FOCUS],
    expect: 'a write in flight still holds the refetch back (F131)',
    edits: [
      {
        file: 'src/ui/shell/RefetchBridge.tsx',
        find: '        if (commandBusy()) return;\n',
        replace: '',
      },
    ],
  },
  // ---- item 29: from one test user straight to another
  {
    // the direct switch is offered on a real colleague's row
    name: 'l34-the-direct-switch-reaches-a-real-person',
    breaks: [SWITCH],
    expect: 'is never offered on the TEST user the device already is, nor on a real colleague',
    edits: [
      {
        file: 'src/core/test-switch/offer.ts',
        find: 'return !!me.test_switch && row.is_test === true && !!row.id && row.id !== me.person?.id;',
        replace: 'return !!me.test_switch && !!row.id && row.id !== me.person?.id;',
      },
    ],
  },
  {
    // anyone is offered the direct switch, switched or not
    name: 'l34-the-direct-switch-is-offered-to-anyone',
    breaks: [SWITCH],
    expect: 'is not offered to a device that is not switched',
    edits: [
      {
        file: 'src/core/test-switch/offer.ts',
        find: 'return !!me.test_switch && row.is_test === true && !!row.id && row.id !== me.person?.id;',
        replace: 'return row.is_test === true && !!row.id && row.id !== me.person?.id;',
      },
    ],
  },
  {
    // the direct switch asks to switch on from inside a switch, which the database always refuses
    name: 'l34-the-direct-switch-skips-back-to-my-account',
    breaks: [SWITCH],
    expect: 'goes back to my account, then signs in as the other TEST user, then starts the app over',
    edits: [
      {
        file: 'src/core/test-switch/use-test-switch.ts',
        find: '  await rpc(END, {} as never);\n  try {',
        replace: '  void END;\n  try {',
      },
    ],
  },
  {
    // a refused second step still starts the app as if it had gone through
    name: 'l34-a-refused-direct-switch-still-starts-the-app',
    breaks: [SWITCH],
    expect: 'a refusal of the second step says the device is back on its own account',
    edits: [
      {
        file: 'src/core/test-switch/use-test-switch.ts',
        find: '    throw new SwitchedBack(e);',
        replace: '    void e;',
      },
    ],
  },
  {
    // the bar's rows carry no id: nothing to press for
    name: 'l34-the-bar-lists-test-users-without-their-id',
    breaks: [SWITCH],
    expect: 'each TEST user is a row that carries their id',
    edits: [
      {
        file: 'src/ui/shell/TestSwitchBar.tsx',
        find: '<MenuItem key={p.id} onSelect={() => onPick(p.id)} data-test-switch-to={p.id}>',
        replace: '<MenuItem key={p.id} onSelect={() => onPick(p.id)}>',
      },
    ],
  },
  {
    // the bar has only Back to my account again
    name: 'l34-the-bar-offers-no-other-test-user',
    breaks: [SWITCH],
    expect: 'draws the way to the other TEST users before Back to my account',
    edits: [
      {
        file: 'src/ui/shell/TestSwitchBar.tsx',
        find: '        {others}\n',
        replace: '',
      },
    ],
  },
  // ---- items 33, 36–38: Direct Corporate, the phone's top bar, the sign-in gap
  {
    // the tab title says the old department word
    name: 'l34-the-tab-title-says-commercial',
    breaks: [BRAND],
    expect: 'is "<Page> · Direct Corporate", and "Direct Corporate" alone where a page names none',
    edits: [
      {
        file: 'src/app/layout.tsx',
        find: "const name = (await getTranslations())('app.short');",
        replace: "void getTranslations;\n  const name = 'Commercial';",
      },
    ],
  },
  {
    // the wordmark stands alone: no "Corporate" beside it
    name: 'l34-the-wordmark-stands-alone',
    breaks: [BRAND],
    expect: 'draws the wordmark image, then "Corporate" as text — never smaller than 12 px',
    edits: [
      {
        file: 'src/ui/BrandLogo.tsx',
        find: '        {word}\n',
        replace: '',
      },
    ],
  },
  {
    // the slate wordmark on Turquoise's dark ground
    name: 'l34-the-slate-wordmark-on-a-dark-theme',
    breaks: [BRAND],
    expect: 'on a ground that follows the theme, the white wordmark shows on every dark theme',
    edits: [
      {
        file: 'src/ui/BrandLogo.tsx',
        find: "'[[data-theme=dark]_&]:block [[data-theme=turquoise]_&]:block ",
        replace: "'[[data-theme=dark]_&]:block ",
      },
    ],
  },
  {
    // the phone's top bar has no logo again
    name: 'l34-the-phone-top-bar-has-no-logo',
    breaks: [BRAND],
    expect: 'starts with the wordmark and "Corporate", a way to My day, shown under 640 px only',
    edits: [
      {
        file: 'src/ui/shell/TopBar.tsx',
        find: "          <BrandLockup height={20} label={say('app.brand')} word={say('app.corporate')} />\n",
        replace: '',
      },
    ],
  },
  {
    // the sign-in card is centred in the height on a phone again: the empty quarter above it
    name: 'l34-the-sign-in-card-floats-in-the-middle-on-a-phone',
    breaks: [BRAND],
    expect: 'on a phone the card sits under the band; from 640 px it is centred both ways (item 33)',
    edits: [
      {
        file: 'src/modules/org/screens/DoorFrame.tsx',
        find: 'door-card door-column mx-auto mb-auto flex',
        replace: 'door-card door-column m-auto flex',
      },
    ],
  },
  // ---- item 15: words set side by side keep their space
  {
    // a tab's name and its count are two flex children again
    name: 'l34-a-tab-name-and-its-count-lose-their-space',
    breaks: [SPACE],
    expect: 'read "Action items 0", with a real space, on link tabs',
    edits: [
      {
        file: 'src/ui/Tabs.tsx',
        find: '        {t.label} {count(t.count)}',
        replace: '        {t.label}\n        {count(t.count)}',
      },
    ],
  },
  {
    // the record's two counts are flex children again
    name: 'l34-the-record-counts-are-flex-children',
    breaks: [SPACE],
    expect: 'read "0 comments · 0 files" in English and keep the spaces round the dot in Arabic',
    edits: [
      {
        file: 'src/ui/record/Comments.tsx',
        find: '    <p className="text-sm" data-record-counts>',
        replace: '    <p className="flex flex-wrap items-center gap-x-1 text-sm" data-record-counts>',
      },
    ],
  },
  {
    // every phone link is a flex box again, whatever it holds
    name: 'l34-every-phone-link-is-a-flex-box',
    breaks: [SPACE],
    expect: 'makes a link that holds more than plain words an inline block instead, so its spaces stay',
    edits: [
      {
        file: 'src/ui/globals.css',
        find: '      display: inline-block;\n      align-content: center;',
        replace: '      display: inline-flex;',
      },
    ],
  },
  // ---- items 6 and 23: Add task, /tasks/new, the task record's sections bar
  {
    // a failed save is a toast only: the form says nothing
    name: 'l34-a-failed-add-task-says-nothing-in-the-form',
    breaks: [ADD],
    expect:
      'a server that never answered: the timeout’s words stay in the form, the typing stays, Add task works again',
    edits: [
      {
        file: 'src/modules/tasks/screens/QuickAdd.tsx',
        find: '          setFailed(line);\n',
        replace: '',
      },
    ],
  },
  {
    // /tasks/new opens the list's own form too: the form waits for the list again, and there are two
    name: 'l34-the-new-task-form-waits-for-the-list',
    breaks: [ADD],
    expect:
      'the page’s first answer holds the form OUTSIDE the part that arrives late, and the list under it is closed',
    edits: [
      {
        file: 'src/app/(app)/tasks/page.tsx',
        find: 'params={{ ...params, new: undefined }}',
        replace: 'params={params}',
      },
    ],
  },
  {
    // the names that arrive later never reach the open form
    name: 'l34-the-new-task-form-never-gets-its-pickers',
    breaks: [ADD],
    expect: 'the form is there at once, and what is typed stays when the names arrive',
    edits: [
      {
        file: 'src/modules/tasks/screens/NewTaskEntry.tsx',
        find: '        if (live) setKnown(n);',
        replace: '        void n;',
      },
    ],
  },
  {
    // a save from /tasks/new stays on the spent address
    name: 'l34-a-new-task-save-goes-nowhere',
    breaks: [ADD],
    expect: 'a save moves on to the new task’s page and spends the address',
    edits: [
      {
        file: 'src/modules/tasks/screens/NewTaskEntry.tsx',
        find: '        if (!o) spendNewTaskAddress(closedOnAddress);',
        replace: '        void spendNewTaskAddress;',
      },
    ],
  },
  {
    // the task record's sections wrap to a second row on a phone again
    name: 'l34-the-task-sections-wrap-on-a-phone',
    breaks: [ROW],
    expect: 'is one row: the record page is told so',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: '        tabsOneRow\n',
        replace: '',
      },
    ],
  },
];
