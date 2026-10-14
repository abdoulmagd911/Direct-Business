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
  {
    name: 'menu-ignores-the-access-list',
    breaks: ['unit:tests/unit/shell/the-menu-shows-a-page-where-the-person-can-open-it.test.ts'],
    expect: 'shows a member every page their access opens',
    edits: [
      {
        file: 'src/ui/shell/nav.ts',
        find: 'return canSee(me, e.page) && !(e.tabOf && canSee(me, e.tabOf));',
        replace:
          "return canSee(me, e.page) && !(e.tabOf && canSee(me, e.tabOf)) && ['my_day', 'tasks', 'clients', 'pipeline'].includes(e.page);",
      },
    ],
  },
  {
    name: 'menu-shows-work-pages-only-on-screen',
    breaks: ['e2e:tests/e2e/employee-view.spec.ts'],
    expect: '1 · a member: the drawer is every built page their access opens',
    edits: [
      {
        file: 'src/ui/shell/nav.ts',
        find: 'return canSee(me, e.page) && !(e.tabOf && canSee(me, e.tabOf));',
        replace:
          "return canSee(me, e.page) && !(e.tabOf && canSee(me, e.tabOf)) && ['my_day', 'tasks', 'clients', 'pipeline'].includes(e.page);",
      },
    ],
  },
  {
    name: 'phone-more-drops-the-last-page',
    breaks: [E2E],
    expect: 'the desktop menu, the phone bar and More are one list',
    edits: [
      {
        file: 'src/ui/shell/nav.ts',
        find: 'const rest = menu.slice(4);',
        replace: 'const rest = menu.slice(4, -1);',
      },
    ],
  },
  {
    name: 'settings-shown-to-everyone',
    breaks: [E2E],
    expect: 'the desktop menu, the phone bar and More are one list',
    edits: [
      {
        file: 'src/ui/shell/nav.ts',
        find: 'return [...navFor(me), ...(isAdmin(me) ? [SETTINGS_ENTRY] : [])];',
        replace: 'return [...navFor(me), SETTINGS_ENTRY];',
      },
    ],
  },
  {
    name: 'menu-shows-unbuilt-pages',
    breaks: ['unit:tests/unit/shell/the-menu-shows-a-page-where-the-person-can-open-it.test.ts'],
    expect: 'never shows a page whose screen is not built',
    edits: [
      {
        file: 'src/ui/shell/nav.ts',
        find: "if (p.nav?.group !== 'main' || !p.built) continue;",
        replace: "if (p.nav?.group !== 'main') continue;",
      },
    ],
  },
  {
    name: 'menu-shows-unbuilt-pages-on-screen',
    breaks: ['e2e:tests/e2e/employee-view.spec.ts'],
    expect: '1 · a member: the drawer is every built page their access opens',
    edits: [
      {
        file: 'src/ui/shell/nav.ts',
        find: "if (p.nav?.group !== 'main' || !p.built) continue;",
        replace: "if (p.nav?.group !== 'main') continue;",
      },
    ],
  },
];
