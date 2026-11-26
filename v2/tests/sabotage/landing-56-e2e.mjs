// Landing 56 (26 Nov) — "Own clients only" on Finance, on the real stack. Each sabotage offers a team member a
// change on a colleague's client's entry, or takes from them what is theirs, and the browser test must go red for
// it. The rule itself: tests/sabotage/landing-56.mjs; the database: OWN-02.
const REPORT = 'src/modules/finance/screens/FinanceReport.tsx';
const PAGE = 'src/modules/finance/screens/overview-page.tsx';
const NEW_PAGE = 'src/modules/finance/screens/new-page.tsx';
const E2E = 'e2e:tests/e2e/landing-56-finance-own-clients-only.spec.ts';

export const sabotages = [
  {
    name: 'e2e-l56-the-deal-type-control-is-on-a-colleagues-clients-row',
    breaks: [E2E],
    expect: 'and not on a colleague’s client’s row',
    edits: [
      {
        file: REPORT,
        find: '    (report.canSetDealType === true || (!!mine && mayChangeEntryOf(mine, r.source_partner_id))) &&',
        replace: '    (report.canSetDealType === true || !!mine) &&',
      },
    ],
  },
  {
    name: 'e2e-l56-a-team-member-is-not-offered-new-invoice',
    breaks: [E2E],
    expect: 'a team member is offered New invoice',
    edits: [
      { file: PAGE, find: '        mayType={mayTypeInvoice(me.levels.finance)}', replace: '        mayType={false}' },
    ],
  },
  {
    name: 'e2e-l56-the-new-invoice-form-asks-for-full',
    breaks: [E2E],
    expect: 'the New invoice form opens for a team member',
    edits: [
      {
        file: NEW_PAGE,
        find: '  const full = mayTypeInvoice(me.levels.finance);',
        replace: "  const full = (me.levels.finance ?? 'none') === 'full';",
      },
    ],
  },
];
