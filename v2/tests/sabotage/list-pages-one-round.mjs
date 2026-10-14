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
        find: 'const [answerRead, orgRead, statusesRead] = await Promise.allSettled([',
        replace:
          "await serverRpc('org', {} as never);\n  const [answerRead, orgRead, statusesRead] = await Promise.allSettled([",
      },
    ],
  },
  {
    name: 'clients-counts-the-other-side-last',
    breaks: [T],
    expect:
      "> a list page asks for all its data in one round after me > Clients: the list, the lookups and the other side's count together",
    edits: [
      {
        file: 'src/modules/partners/screens/list-page.tsx',
        find: '    if (!both) return null;\n    try {',
        replace: '    if (!both) return null;\n    await new Promise((r) => setTimeout(r, 1000));\n    try {',
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
