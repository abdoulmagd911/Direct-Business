// Landing 37 (Finance F-C) in the browser: a Pending or Draft invoice is seen and found before it counts, the form
// shows the invoice saved last, and the Custom period opens on the first press. Each sabotage takes one rule of the
// landing back on the screen, and the browser test named must go red for it, with the words given.
// The specs: tests/e2e/landing-37-finance-fc.spec.ts and tests/e2e/landing-37-arabic.alone.spec.ts.
const FC = 'e2e:tests/e2e/landing-37-finance-fc.spec.ts';
const ARABIC = 'e2e:tests/e2e/landing-37-arabic.alone.spec.ts';
const REPORT = 'src/modules/finance/screens/FinanceReport.tsx';
const OVERVIEW = 'src/modules/finance/screens/FinanceOverview.tsx';
const NEW = 'src/modules/finance/screens/NewInvoice.tsx';
const PALETTE = 'src/ui/shell/CommandPalette.tsx';
const TABS = 'src/modules/partners/screens/record/CompanyTabs.tsx';

export const sabotages = [
  {
    // CR-1594-23 as it was: the tab and its panel wait for the server's answer, so the first press shows nothing
    name: 'e2e-custom-period-waits-for-the-server',
    breaks: [FC, ARABIC],
    expect: 'the first press opens the From / To panel, before the server answers',
    edits: [{ file: OVERVIEW, find: 'onClick={() => setPressed(k)}', replace: 'onClick={() => setPressed(null)}' }],
  },
  {
    // the amount of what waits is added into the strip's Revenue
    name: 'e2e-pending-invoice-is-added-to-revenue',
    breaks: [FC],
    expect: 'Revenue: after minus before',
    edits: [
      {
        file: REPORT,
        find: 'label={t(\'finance.ledger.revenueUnified\')} value={total.revenue} tone="success" />',
        replace:
          'label={t(\'finance.ledger.revenueUnified\')} value={total.revenue + (total.notYetCountedAmount ?? 0)} tone="success" />',
      },
    ],
  },
  {
    // the Ledger lists no document that waits, as before the landing
    name: 'e2e-pending-invoice-is-not-listed',
    breaks: [FC],
    expect: 'the Pending invoice is a row under Not yet counted',
    edits: [
      {
        file: REPORT,
        find: 'const waitingRows = report.notYetCounted ?? [];',
        replace: 'const waitingRows: NonNullable<typeof report.notYetCounted> = [];',
      },
    ],
  },
  {
    // the form shows the saved record only after a save in this visit: opened again, it is blank
    name: 'e2e-form-opens-blank-again',
    breaks: [FC],
    expect: 'reopening the form shows the saved record',
    edits: [
      {
        file: NEW,
        find: '<SavedRecord turn={savedTurn} />',
        replace: '{savedTurn > 0 ? <SavedRecord turn={savedTurn} /> : null}',
      },
    ],
  },
  {
    // the search box draws no invoice, so a number typed there says "Nothing matches"
    name: 'e2e-search-box-draws-no-invoice',
    breaks: [FC],
    expect: 'the search finds the invoice by its number',
    edits: [{ file: PALETTE, find: 'invoices: invoiceHitsOf(a),', replace: 'invoices: [],' }],
  },
  {
    // the organisation's tab does not name the documents that wait
    name: 'e2e-tab-does-not-name-what-waits',
    breaks: [FC],
    expect: 'the Pending invoice is named on the tab',
    edits: [{ file: TABS, find: '{waitingRows.length ? (', replace: '{waitingRows.length < 0 ? (' }],
  },
  {
    // a phone lists every waiting row at once, however many
    name: 'e2e-waiting-list-is-never-cut-on-a-phone',
    breaks: [FC],
    expect: 'a phone lists the first five',
    edits: [
      {
        file: REPORT,
        find: "!allWaiting && i >= NARROW_ROWS && '@max-[599px]:hidden',",
        replace: "!allWaiting && i >= 1000 && '@max-[599px]:hidden',",
      },
    ],
  },
  {
    // the Direct link of a waiting row is a small tap on a phone
    name: 'e2e-direct-link-is-a-small-tap',
    breaks: [FC],
    expect: 'the Direct link is a full-size tap on a phone',
    edits: [
      {
        file: REPORT,
        find: 'underline-offset-[3px] hover:decoration-current max-sm:min-h-11"\n                      data-ledger-direct-link',
        replace: 'underline-offset-[3px] hover:decoration-current"\n                      data-ledger-direct-link',
      },
    ],
  },
  {
    // the not-yet-counted list keeps its English title in Arabic
    name: 'e2e-waiting-list-title-stays-english',
    breaks: [ARABIC],
    expect: 'the list is titled in Arabic',
    edits: [
      {
        file: 'messages/ar.json',
        find: '"notYetCountedTitle": "لم تُحتسب بعد ({count})"',
        replace: '"notYetCountedTitle": "Not yet counted ({count})"',
      },
    ],
  },
];
