// The owner's decision of 21 Nov 2026 (it overrules item 5 of Landing 34): everyone sees Finance and everyone adds and
// edits it — a Team member starts at Full, as a manager does; only the view-only role (Viewer) reads without the write
// controls; a person set to None in Settings › People & access › Access has no Finance. Each sabotage takes one side
// of that rule back on the screen, in one line, and the browser test named must go red for it, with the words given.
// (Finance shown to a person at None is tests/sabotage/landing-34-e2e.mjs "e2e-l34-the-menu-shows-finance-to-everyone".)
const ROUND = 'e2e:tests/e2e/landing-34-test-round.spec.ts';
const EMPLOYEE = 'e2e:tests/e2e/employee-view.spec.ts';
const NEW_INVOICE = 'e2e:tests/e2e/finance-new-invoice.spec.ts';
const NAV = 'src/ui/shell/nav.ts';
const OVERVIEW_PAGE = 'src/modules/finance/screens/overview-page.tsx';
const OVERVIEW = 'src/modules/finance/screens/FinanceOverview.tsx';
const NEW_PAGE = 'src/modules/finance/screens/new-page.tsx';
const TABS = 'src/modules/partners/screens/record/CompanyTabs.tsx';

export const sabotages = [
  {
    // the menu leaves Finance out again, whatever the person's level on it: a member no longer finds it
    name: 'e2e-l34c-the-menu-hides-finance-from-a-member',
    breaks: [ROUND],
    expect: 'a member: Finance is in the menu',
    edits: [
      {
        file: NAV,
        find: 'return canSee(me, e.page) && !(e.tabOf && canSee(me, e.tabOf));',
        replace: "return e.page !== 'finance' && canSee(me, e.page) && !(e.tabOf && canSee(me, e.tabOf));",
      },
    ],
  },
  {
    // the same, read by the employee view: Finance is in a member's menu
    name: 'e2e-l34c-the-menu-hides-finance-in-the-employee-view',
    breaks: [EMPLOYEE],
    expect: 'Finance is in a member menu',
    edits: [
      {
        file: NAV,
        find: 'return canSee(me, e.page) && !(e.tabOf && canSee(me, e.tabOf));',
        replace: "return e.page !== 'finance' && canSee(me, e.page) && !(e.tabOf && canSee(me, e.tabOf));",
      },
    ],
  },
  {
    // the write controls of the Finance page are given to anyone who can read it: a viewer gets New invoice
    name: 'e2e-l34c-a-viewer-gets-the-write-controls',
    breaks: [ROUND],
    expect: 'a viewer: no New invoice',
    edits: [
      {
        file: OVERVIEW_PAGE,
        find: "full={(me.levels.finance ?? 'none') === 'full'}",
        replace: "full={(me.levels.finance ?? 'none') !== 'none'}",
      },
    ],
  },
  {
    // the same, read by the employee view: a viewer reads Finance with no New invoice
    name: 'e2e-l34c-a-viewer-gets-new-invoice-in-the-employee-view',
    breaks: [EMPLOYEE],
    expect: 'no New invoice for a viewer',
    edits: [
      {
        file: OVERVIEW_PAGE,
        find: "full={(me.levels.finance ?? 'none') === 'full'}",
        replace: "full={(me.levels.finance ?? 'none') !== 'none'}",
      },
    ],
  },
  {
    // New invoice is offered to nobody: a member, at Full on Finance, has no way to add from the page
    name: 'e2e-l34c-new-invoice-is-offered-to-nobody',
    breaks: [ROUND],
    expect: 'a member: New invoice is offered',
    edits: [
      {
        file: OVERVIEW,
        find: '          mayType ? (\n            <Link',
        replace: '          mayType && !mayType ? (\n            <Link',
      },
    ],
  },
  {
    // the New invoice form opens for anyone who can read Finance: a viewer is shown the form
    name: 'e2e-l34c-a-viewer-opens-the-new-invoice-form',
    breaks: [NEW_INVOICE],
    expect: 'a viewer never sees the form',
    edits: [
      {
        file: NEW_PAGE,
        find: 'const full = mayTypeInvoice(me.levels.finance);',
        replace: "const full = (me.levels.finance ?? 'none') !== 'none';",
      },
    ],
  },
  {
    // a partner's Finance tab says "not open to you" to everyone, whatever the database answered
    name: 'e2e-l34c-a-partners-finance-tab-is-closed-to-a-member',
    breaks: [ROUND],
    expect: 'a member: the money of the partner is drawn on its Finance tab',
    edits: [
      {
        file: TABS,
        find: '  if (!summary.finance_visible || summary.wallet === null || summary.finance === null) {',
        replace: '  if (summary.finance_visible || summary.wallet === null || summary.finance === null) {',
      },
    ],
  },
];
