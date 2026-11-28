// Landing 58 (28 Nov, the owner's review of 26 Nov: "Finance is too much on one page") · Finance in tabs on every
// screen: the address names the open tab, Overview is the bare address, Import is only for a person who imports, and an
// anchor opens the tab that holds its section. Each sabotage takes one of those back; the test named must go red for it.
const TABS = 'src/modules/finance/tabs.ts';
const OVERVIEW = 'src/modules/finance/screens/FinanceOverview.tsx';
const UNIT = 'unit:tests/unit/finance/landing-58-finance-in-tabs.test.ts';
const CARDS = 'unit:tests/unit/finance/landing-31-the-finance-cards-carry-their-tone-and-their-source.test.tsx';

export const sabotages = [
  {
    name: 'l58-the-address-opens-import-for-everyone',
    breaks: [UNIT],
    expect: '> opens Import only for a person who imports',
    edits: [
      {
        file: TABS,
        find: "  return tab === 'import' && !mayImport ? 'overview' : tab;",
        replace: '  return mayImport || true ? tab : tab;',
      },
    ],
  },
  {
    name: 'l58-overview-names-itself-in-the-address',
    breaks: [UNIT],
    expect: '> keeps the period and the ledger filters when the tab changes, and Overview is the bare address',
    edits: [
      {
        file: TABS,
        find: "  if (tab === 'overview') p.delete('tab');\n  else p.set('tab', tab);",
        replace: "  p.set('tab', tab);",
      },
    ],
  },
  {
    name: 'l58-a-tab-forgets-the-period',
    breaks: [UNIT],
    expect: '> keeps the period and the ledger filters when the tab changes, and Overview is the bare address',
    edits: [
      {
        file: TABS,
        find: '  const p = new URLSearchParams(search);',
        replace: "  const p = new URLSearchParams(search && '');",
      },
    ],
  },
  {
    name: 'l58-the-owed-anchor-opens-nothing',
    breaks: [UNIT],
    expect: '> what is owed opens Owed; the reconciliation and what is held open Checks',
    edits: [{ file: TABS, find: "  [/^#finance-ageing/, 'owed'],\n", replace: '' }],
  },
  {
    name: 'l58-the-import-tab-for-everyone',
    breaks: [CARDS],
    expect: 'no Import tab for a person who does not import',
    edits: [
      {
        file: OVERVIEW,
        find: "        ...(mayImport ? [{ value: 'import', label: t('finance.tab.import') }] : []),",
        replace: "        { value: 'import', label: t('finance.tab.import') },",
      },
    ],
  },
];
