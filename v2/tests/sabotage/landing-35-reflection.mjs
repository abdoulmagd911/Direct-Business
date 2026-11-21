// Landing 35 (the owner's check of 21 Nov) · the reflection between a client's page and Finance, and of an achievement
// logged for a client. tests/e2e/landing-35-reflection.spec.ts holds what the app does:
//   1. a Client ID added on the client page ties the Payments rows to the organisation — they show on the client's
//      Finance tab and on the Finance page, and an invoice typed on Finance under that ID shows on the client; the
//      tab reads the organisation's own rows and nobody else's;
//   2. an achievement logged naming a client is saved with that client, its record links to the client's page, and
//      the client's record lists it on its Related tab.
// Each sabotage takes one of those back, and the test named must go red for it.
const INVOICE_FORM = 'src/modules/finance/invoice-form.ts';
const COMPANY_TABS = 'src/modules/partners/screens/record/CompanyTabs.tsx';
const LOG = 'src/modules/perf/screens/LogAchievement.tsx';
const ACHIEVEMENTS = 'src/modules/partners/screens/record/PartnerAchievements.tsx';
const BROWSER = 'e2e:tests/e2e/landing-35-reflection.spec.ts';

export const sabotages = [
  {
    // Finance → New invoice drops the Client ID typed in it: the row is counted, but under no organisation
    name: 'e2e-l35-a-typed-invoice-forgets-its-client-id',
    breaks: [BROWSER],
    expect: 'this year’s row is on the client now',
    edits: [{ file: INVOICE_FORM, find: '    client_id: d.clientId.trim(),', replace: "    client_id: ''," }],
  },
  {
    // the client's Finance tab asks for the ledger without naming the client: it lists everyone's rows
    name: 'e2e-l35-the-client-finance-tab-reads-every-organisation',
    breaks: [BROWSER],
    expect: 'no money row',
    edits: [
      {
        file: COMPANY_TABS,
        find: '    { p_from: from, p_to: to, p_partner: partnerId },',
        replace: '    { p_from: from, p_to: to },',
      },
    ],
  },
  {
    // Log achievement saves without the organisation chosen in its picker
    name: 'e2e-l35-an-achievement-is-saved-without-its-client',
    breaks: [BROWSER],
    expect: 'the achievement is saved with the client',
    edits: [
      { file: LOG, find: '            partner_id: partner?.id ?? null,', replace: '            partner_id: null,' },
    ],
  },
  {
    // the Related tab's Achievements section draws nothing: the achievement is saved with the client and shows nowhere
    // on the client's record, as it was before 21 Nov
    name: 'e2e-l35-the-client-record-lists-no-achievement',
    breaks: [BROWSER],
    expect: 'the client’s Related tab has its Achievements section',
    edits: [
      { file: ACHIEVEMENTS, find: '  if (!wanted) return null;', replace: '  if (wanted || !wanted) return null;' },
    ],
  },
];
