// Sabotages for W47 / V635: a list page asks for its data in one round after me, and the app says Loading at once
// (tests/unit/pages/a-list-page-asks-for-its-data-in-one-round.test.ts, and tests/unit/shell/a-click-on-a-link-shows-loading-at-once.test.tsx).
const T = 'unit:tests/unit/pages/a-list-page-asks-for-its-data-in-one-round.test.ts';

export const sabotages = [
  {
    name: 'my-day-reads-the-organisation-first',
    breaks: [T],
    expect: '> a list page asks for all its data in one round after me > My day',
    edits: [
      {
        file: 'src/app/(app)/my-day/page.tsx',
        // Landing 3 added escalatedByMeRead, so the destructure now wraps over two lines.
        find: 'const [answerRead, orgRead, statusesRead, dueRead, asksRead, escalatedRead, escalatedByMeRead, unloggedRead] =\n    await Promise.allSettled([',
        replace:
          "await serverRpc('org', {} as never);\n  const [answerRead, orgRead, statusesRead, dueRead, asksRead, escalatedRead, escalatedByMeRead, unloggedRead] =\n    await Promise.allSettled([",
      },
    ],
  },
  {
    // FIX-45: the other side's count is gone — the tab shows no count until it is opened, when its own list read
    // carries its total, so the old plant (a late second partners call for the count) has nothing to delay. The
    // sabotage now proves the same Partners case catches a second partners read in the round: the list read twice.
    name: 'partners-reads-its-list-twice',
    breaks: [T],
    expect: '> a list page asks for all its data in one round after me > Partners: the list and the lookups together',
    edits: [
      {
        file: 'src/modules/partners/screens/list-page.tsx',
        find: "    serverRpc('list', { p_list: 'priority' }) as unknown as Promise<ListEntry[]>,\n    read(),",
        replace:
          "    serverRpc('list', { p_list: 'priority' }) as unknown as Promise<ListEntry[]>,\n    read(),\n    read(),",
      },
    ],
  },
  {
    name: 'a-click-on-a-link-shows-no-bar',
    breaks: ['unit:tests/unit/shell/a-click-on-a-link-shows-loading-at-once.test.tsx'],
    expect:
      '> a click on a link shows Loading at once > a tab switch, a Settings group or a query change leaves the page',
    edits: [
      {
        file: 'src/ui/shell/NavProgress.tsx',
        find: '  return to.pathname !== here.pathname || to.search !== here.search;',
        replace: '  return false;',
      },
    ],
  },
];
