// Landing 58 in the browser: each tab shows only its own sections, the address keeps the tab through a refresh, and an
// anchor opens the tab that holds its section. Each sabotage takes one back; the spec must go red with its own words.
const LIVE = 'src/modules/finance/screens/FinanceOverviewLive.tsx';
const PAGE = 'src/modules/finance/screens/overview-page.tsx';
const E2E = 'e2e:tests/e2e/landing-58-finance-in-tabs.spec.ts';

export const sabotages = [
  {
    name: 'e2e-l58-every-section-on-one-page',
    breaks: [E2E],
    expect: 'finance-ledger is under another tab',
    edits: [
      {
        file: LIVE,
        find: "  const away = (v: FinanceTab) => (tab !== v ? 'hidden' : undefined);",
        replace: '  const away = (v: FinanceTab) => (tab === v ? undefined : undefined);',
      },
    ],
  },
  {
    name: 'e2e-l58-the-tab-is-not-in-the-address',
    breaks: [E2E],
    expect: 'toHaveURL',
    edits: [
      {
        file: LIVE,
        find: "    window.history.replaceState(window.history.state, '', financeTabHref(window.location.search, v));",
        replace: '    void financeTabHref;',
      },
    ],
  },
  {
    name: 'e2e-l58-a-refresh-forgets-the-tab',
    breaks: [E2E],
    expect: 'a refresh keeps Ledger',
    edits: [{ file: PAGE, find: '        tab={one(q.tab)}\n', replace: '' }],
  },
  {
    name: 'e2e-l58-an-anchor-opens-overview',
    breaks: [E2E],
    expect: '#finance-ageing opens Owed',
    edits: [
      {
        file: LIVE,
        find: '    const named = tabOfAnchor(hash);',
        replace: '    const named = tabOfAnchor(hash) && null;',
      },
    ],
  },
];
