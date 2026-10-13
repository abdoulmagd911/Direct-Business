// Sabotages for the 13 Oct sweep, nav and Finance (builder B): each breaks one promise of tests/e2e/nav-access.spec.ts.
const E2E = 'e2e:tests/e2e/nav-access.spec.ts';

export const sabotages = [
  {
    name: 'suppliers-page-says-clients',
    breaks: [E2E],
    expect: 'the Suppliers page is titled Suppliers',
    edits: [
      {
        file: 'src/modules/partners/screens/list-page.tsx',
        find: "const title = side === 'client' ? t('nav.clients') : t('nav.suppliers_partners');",
        replace: "const title = t('nav.clients');",
      },
    ],
  },
  {
    name: 'finance-lists-wait-for-the-heavy-reads',
    breaks: [E2E],
    expect: 'Finance fills the lists beside the figures',
    edits: [
      {
        file: 'src/modules/finance/screens/FinanceOverviewLive.tsx',
        find: "  const closed = useFinanceRead<ClosedMonth[], 'finance_closed_months'>('finance_closed_months', {}, 'closed');\n  const health = useFinanceRead<HealthEntry[], 'finance_health'>('finance_health', range, `health|${at}`);\n",
        replace: '',
      },
      {
        file: 'src/modules/finance/screens/FinanceOverviewLive.tsx',
        find: '  const notInvoiced = useFinanceRead',
        replace:
          "  const closed = useFinanceRead<ClosedMonth[], 'finance_closed_months'>('finance_closed_months', {}, 'closed');\n  const health = useFinanceRead<HealthEntry[], 'finance_health'>('finance_health', range, `health|${at}`);\n  const notInvoiced = useFinanceRead",
      },
    ],
  },
];
