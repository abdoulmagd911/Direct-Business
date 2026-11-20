// Landing 34 (the fixes of the test round of 19 Nov) in the browser. Each sabotage takes one fix of the landing back
// on the screen, in one line, and the browser test named must go red for it, with the words given.
// The specs: tests/e2e/landing-34-test-round.spec.ts and tests/e2e/landing-34-arabic.alone.spec.ts.
const ROUND = 'e2e:tests/e2e/landing-34-test-round.spec.ts';
const ARABIC = 'e2e:tests/e2e/landing-34-arabic.alone.spec.ts';
const MY_DAY = 'src/modules/my-day/screens/MyDay.tsx';
const LIST = 'src/modules/partners/screens/PartnersList.tsx';
const RECORD = 'src/modules/partners/screens/PartnerRecord.tsx';
const OVERVIEW = 'src/modules/finance/screens/FinanceOverview.tsx';

export const sabotages = [
  // ---- a · Today's three
  {
    // My day goes back to having no Today's three at all
    name: 'e2e-l34-my-day-has-no-todays-three',
    breaks: [ROUND],
    expect: "Today's three is on My day",
    edits: [
      {
        file: MY_DAY,
        find: "{scope === 'me' ? <TodaysThree three={three} statuses={data.statuses} /> : null}",
        replace: '{null}',
      },
    ],
  },
  {
    // the Today block draws every task again, the picked ones too
    name: 'e2e-l34-a-picked-task-is-drawn-twice',
    breaks: [ROUND],
    expect: "a task picked into Today's three is not drawn again in the Today block",
    edits: [
      {
        file: MY_DAY,
        find: 'const belowThree = [...three.rest, ...helpingTasks(answer.tasks ?? [])];',
        replace: 'const belowThree = answer.tasks ?? [];',
      },
    ],
  },
  {
    // the streak line says no streak, whatever the database answered
    name: 'e2e-l34-the-streak-line-forgets-the-days',
    breaks: [ROUND],
    expect: 'the streak line reads the seeded streak',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodaysThree.tsx',
        find: '<p data-streak={streak.days}>',
        replace: '<p data-streak={0}>',
      },
    ],
  },
  // ---- b · Partners
  {
    // the search box moves the list without its words: nothing is filtered
    name: 'e2e-l34-the-search-box-writes-no-q',
    breaks: [ROUND],
    expect: 'the search is written to the address',
    edits: [{ file: LIST, find: 'go(withSearch(filters, q));', replace: 'go(filters);' }],
  },
  {
    // the name in the table links to the list itself, so a click opens no record
    name: 'e2e-l34-the-name-opens-no-record',
    breaks: [ROUND],
    expect: 'one click on the name opens the record',
    edits: [{ file: LIST, find: 'href={`${base}/${row.original.id}`}', replace: 'href={base}' }],
  },
  {
    // the Status filter loses its Archived choice
    name: 'e2e-l34-status-offers-no-archived',
    breaks: [ROUND],
    expect: 'the Status filter offers Archived',
    edits: [{ file: LIST, find: "[...STATUSES, 'none', ARCHIVED_PICK].map(", replace: "[...STATUSES, 'none'].map(" }],
  },
  {
    // a row's Actions offers Archive on an archived row
    name: 'e2e-l34-an-archived-row-offers-archive',
    breaks: [ROUND],
    expect: "an archived row's Actions offers Unarchive",
    edits: [{ file: LIST, find: '            row.archived ? (', replace: '            !row.archived ? (' }],
  },
  {
    // the name in the table is one line, cut with "…", as before
    name: 'e2e-l34-a-long-name-is-cut',
    breaks: [ROUND],
    expect: 'a long name is not cut with an ellipsis',
    edits: [
      {
        file: LIST,
        find: 'className="min-w-0 break-words font-medium leading-5 text-link hover:underline"',
        replace: 'className="min-w-0 truncate font-medium leading-5 text-link hover:underline"',
      },
    ],
  },
  // ---- c · search
  {
    // a search result closes the search and goes nowhere
    name: 'e2e-l34-a-search-result-opens-nothing',
    breaks: [ROUND],
    expect: 'Enter on a search result opens the record',
    edits: [
      {
        file: 'src/ui/shell/CommandPalette.tsx',
        find: 'onSelect={() => go(`/partners/${p.id}`)}',
        replace: 'onSelect={() => close(false)}',
      },
    ],
  },
  // ---- d · access
  {
    // the menu lists Finance for everyone, whatever their level on it
    name: 'e2e-l34-the-menu-shows-finance-to-everyone',
    breaks: [ROUND],
    expect: 'no Finance link in the menu',
    edits: [
      {
        file: 'src/ui/shell/nav.ts',
        find: 'return canSee(me, e.page) && !(e.tabOf && canSee(me, e.tabOf));',
        replace: "return (e.page === 'finance' || canSee(me, e.page)) && !(e.tabOf && canSee(me, e.tabOf));",
      },
    ],
  },
  // ---- e · Finance
  {
    // the months' total reads the provisional PROFIT again, which leaves the imported rows out
    name: 'e2e-l34-the-months-total-reads-the-provisional-profit',
    breaks: [ROUND],
    expect: 'the Months total says the same Provisional amount',
    edits: [
      { file: OVERVIEW, find: '{money(period.provisional.revenue)}', replace: '{money(period.provisional.profit)}' },
    ],
  },
  {
    // Income by company loses its address
    name: 'e2e-l34-income-by-company-has-no-address',
    breaks: [ROUND],
    expect: 'Income by company has its address (#finance-company)',
    edits: [
      {
        file: 'src/modules/finance/screens/FinanceReport.tsx',
        find: 'anchor="finance-company"',
        replace: 'anchor="finance-companies"',
      },
    ],
  },
  {
    // a Payments date of any age reads as current
    name: 'e2e-l34-an-old-payments-date-reads-as-current',
    breaks: [ROUND],
    expect: 'an old Payments date is marked stale',
    edits: [
      {
        file: 'src/modules/finance/figures.ts',
        find: 'stale: Number.isFinite(age) && age > STAMP_STALE_AFTER_DAYS,',
        replace: 'stale: false,',
      },
    ],
  },
  // ---- f · brand and shell
  {
    // the tab title's suffix is "Commercial" again
    name: 'e2e-l34-the-tab-title-says-commercial',
    breaks: [ROUND],
    expect: 'the tab title of My day',
    edits: [
      {
        file: 'src/app/layout.tsx',
        find: "const name = (await getTranslations())('app.short');",
        replace: "const name = 'Commercial';",
      },
    ],
  },
  {
    // the phone's top bar has no brand
    name: 'e2e-l34-the-phone-top-bar-has-no-brand',
    breaks: [ROUND],
    expect: 'the phone top bar shows the brand',
    edits: [
      {
        file: 'src/ui/shell/TopBar.tsx',
        find: 'className="flex h-11 shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-focus sm:hidden"',
        replace: 'className="hidden"',
      },
    ],
  },
  {
    // the partner record's sections wrap to a second row on a phone again
    name: 'e2e-l34-the-partner-sections-wrap-on-a-phone',
    breaks: [ROUND],
    expect: 'its sections bar is the one-row kind',
    edits: [{ file: RECORD, find: '        tabsOneRow', replace: '        tabsOneRow={false}' }],
  },
  {
    // a Today group's name and its count are glued again
    name: 'e2e-l34-a-group-name-and-its-count-are-glued',
    breaks: [ROUND],
    expect: 'the group heading keeps the space before its count',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: "{t(`pages.myDay.today.${x.key}`)}{' '}",
        replace: '{t(`pages.myDay.today.${x.key}`)}',
      },
    ],
  },
  // ---- g · Add task
  {
    // a failed Add task says nothing in the form
    name: 'e2e-l34-a-failed-add-task-says-nothing-in-the-form',
    breaks: [ROUND],
    expect: 'a failed Add task says so in the form',
    edits: [{ file: 'src/modules/tasks/screens/QuickAdd.tsx', find: '{failed ? (', replace: '{failed && !failed ? (' }],
  },
  // ---- h · test users
  {
    // the bar has only Back to my account
    name: 'e2e-l34-the-bar-offers-no-other-test-user',
    breaks: [ROUND],
    expect: 'the bar offers Switch test user',
    edits: [
      {
        file: 'src/ui/shell/TestSwitchBar.tsx',
        find: 'others={<SwitchOverMenu me={me} busy={sw.busy} onPick={(id) => void sw.over(id)} />}',
        replace: 'others={null}',
      },
    ],
  },
  // ---- Arabic
  {
    // the profile menu shows the language group while Arabic is off
    name: 'e2e-l34-the-language-menu-shows-while-arabic-is-off',
    breaks: [ARABIC],
    expect: 'no language group in the profile menu while Arabic is off',
    edits: [{ file: 'src/ui/shell/ProfileMenu.tsx', find: '        {arabic ? (', replace: '        {!arabic ? (' }],
  },
  {
    // Arabic On offers no choice on its own card
    name: 'e2e-l34-arabic-on-offers-no-choice-on-the-card',
    breaks: [ARABIC],
    expect: 'the card shows the language choice at once',
    edits: [
      {
        file: 'src/modules/settings/screens/SettingCard.tsx',
        find: '{def.key === ARABIC_KEY && def.value === true ? <LanguageChoice /> : null}',
        replace: '{null}',
      },
    ],
  },
  {
    // picking a language does nothing (the reload alone is not what the screen depends on: the app's own
    // preferences sync reloads too, so a plant on the reload stays green)
    name: 'e2e-l34-a-language-choice-does-nothing',
    breaks: [ARABIC],
    expect: 'choosing العربية reloads into Arabic',
    edits: [
      {
        file: 'src/core/prefs/use-language-choice.ts',
        find: 'if (next === locale) return;',
        replace: 'if (next !== locale) return;',
      },
    ],
  },
];
