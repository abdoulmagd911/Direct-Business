// Landing 47 (24 Nov) — Finance Part B in the browser (tests/e2e/landing-47-finance-part-b.spec.ts). Each sabotage
// takes one promise back on the real page, and the spec must go red for it with the words named.
const REPORT = 'src/modules/finance/screens/FinanceReport.tsx';
const SECTION = 'src/modules/finance/screens/FinanceLedgerSection.tsx';
const TABS = 'src/modules/partners/screens/record/CompanyTabs.tsx';
const NEW = 'src/modules/finance/screens/NewInvoice.tsx';
const IMPORT = 'src/modules/finance/screens/FinanceImportSection.tsx';
const CONTRACT = 'src/modules/finance/screens/ContractPayments.tsx';
const E2E = 'e2e:tests/e2e/landing-47-finance-part-b.spec.ts';

export const sabotages = [
  {
    name: 'e2e-l47-the-ledger-draws-no-deal-type',
    breaks: [E2E],
    expect: 'a row of a postpaid organisation',
    edits: [
      {
        file: REPORT,
        find: '                        <DealPills row={r} onSet={maySetDeal(r) ? () => askDeal(r) : undefined} />\n',
        replace: '',
      },
    ],
  },
  {
    name: 'e2e-l47-the-deal-filter-filters-nothing',
    breaks: [E2E],
    expect: 'the filter keeps the row that is not set',
    edits: [
      {
        file: REPORT,
        find: '  const filteredRows = filterByDeal(countedRows, dealFilter);',
        replace: '  const filteredRows = filterByDeal(countedRows, dealFilter && "all");',
      },
    ],
  },
  {
    name: 'e2e-l47-finance-draws-no-agreement-card',
    breaks: [E2E],
    expect: 'Finance agrees with itself for the month',
    edits: [
      {
        file: SECTION,
        find: '      <FinanceReconciliation from={ask.from} to={ask.to} ready={ready} />\n',
        replace: '',
      },
    ],
  },
  {
    name: 'e2e-l47-the-organisation-tab-draws-no-ageing',
    breaks: [E2E],
    expect: 'on its own tab too',
    edits: [{ file: TABS, find: '          <FinanceAgeing partner={card.id} />\n', replace: '' }],
  },
  {
    name: 'e2e-l47-a-postpaid-organisation-shows-its-top-up',
    breaks: [E2E],
    expect: 'a postpaid organisation says so',
    edits: [
      {
        file: TABS,
        find: '  const postpaid = isPostpaidOnly(card.identifiers);',
        replace: '  const postpaid = isPostpaidOnly([]);',
      },
    ],
  },
  {
    name: 'e2e-l47-the-contract-ignores-the-quarter',
    breaks: [E2E],
    expect: 'the first quarter is named',
    edits: [
      {
        file: CONTRACT,
        find: '    { p_contract: contractId, p_grain: grain },',
        replace: "    { p_contract: contractId, p_grain: grain && 'month' },",
      },
    ],
  },
  {
    name: 'e2e-l47-the-commission-is-not-sent',
    breaks: [E2E],
    expect: 'the invoice keeps the commission and its proof',
    edits: [{ file: NEW, find: '      if (commission)\n', replace: '      if (commission && !id)\n' }],
  },
  {
    name: 'e2e-l47-the-preview-keeps-the-files-own-sum',
    breaks: [E2E],
    expect: 'the cost shown counts the repeated line once',
    edits: [
      {
        file: IMPORT,
        find: '        settledRows = applySettled(norm.records, norm.held, settled);',
        replace: '        settledRows = applySettled(norm.records, norm.held, settled && []);',
      },
    ],
  },
];
