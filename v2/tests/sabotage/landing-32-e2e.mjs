// Landing 32 (Finance F-B) in the browser: who counts and who does not. Each sabotage takes one rule of the landing
// back on the screen, and the browser test named must go red for it, with the words given.
// The specs: tests/e2e/landing-32-finance-fb.spec.ts and tests/e2e/landing-32-sweep.alone.spec.ts.
const FB = 'e2e:tests/e2e/landing-32-finance-fb.spec.ts';
const SWEEP = 'e2e:tests/e2e/landing-32-sweep.alone.spec.ts';
const REPORT = 'src/modules/finance/screens/FinanceReport.tsx';

export const sabotages = [
  {
    // Exclude, Include and Remove save with no reason typed
    name: 'e2e-exclude-needs-no-reason',
    breaks: [FB],
    expect: 'the button waits for a reason',
    edits: [
      {
        file: 'src/ui/ReasonDialog.tsx',
        find: 'const ok = reason.trim().length > 0 && !saveDisabled;',
        replace: 'const ok = !saveDisabled;',
      },
    ],
  },
  {
    // the organisation's tab adds the rows that do not count into its revenue
    name: 'e2e-tab-revenue-sums-not-counted-rows',
    breaks: [FB],
    expect: 'revenue: the tab minus the Finance page line',
    edits: [
      {
        file: 'src/modules/partners/screens/record/CompanyTabs.tsx',
        find: 'const revenue = visibleRows.reduce((s, r) => s + r.revenue, 0);',
        replace: 'const revenue = shownRows.reduce((s, r) => s + r.revenue, 0);',
      },
    ],
  },
  {
    // a period with no known cost draws Cost as 0
    name: 'e2e-empty-cost-reads-zero',
    breaks: [FB],
    expect: 'the strip Cost is marked empty',
    edits: [{ file: REPORT, find: 'value={total.cost} />', replace: 'value={total.cost ?? 0} />' }],
  },
  {
    // a row a list rule excludes offers Include, as if it had been excluded by hand
    name: 'e2e-list-rule-row-offers-include',
    breaks: [FB],
    expect: 'it says a list rule excludes it',
    edits: [{ file: REPORT, find: '{r.excluded_row_level ? (', replace: '{r.excluded_by ? (' }],
  },
  {
    // Exclude and Include are drawn for everyone who reads the Ledger, not the admin alone
    name: 'e2e-everyone-is-offered-exclude',
    breaks: [SWEEP],
    expect: 'no issue on any page',
    edits: [
      {
        file: REPORT,
        find: 'report.canToggle === true && !!onToggle && ',
        replace: '!!onToggle && ',
      },
    ],
  },
  {
    // a row with no cost shows 0 for its cost and its profit
    name: 'e2e-a-row-with-no-cost-reads-zero',
    breaks: [SWEEP],
    expect: 'no issue on any page',
    edits: [
      {
        file: REPORT,
        find: '    n === null || n === undefined ? (\n      <span className="font-ui text-muted" data-not-known>',
        replace: '    n === -1 ? (\n      <span className="font-ui text-muted" data-not-known>',
      },
      {
        file: REPORT,
        find: '      formatMoney(n, locale)\n    );\n  const nameOf',
        replace: '      formatMoney(n ?? 0, locale)\n    );\n  const nameOf',
      },
    ],
  },
];
