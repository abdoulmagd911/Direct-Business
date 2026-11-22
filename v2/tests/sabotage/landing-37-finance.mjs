// Landing 37 (Finance F-C, 23 Nov): a Pending or Draft invoice is seen and found before it counts; the form shows the
// invoice saved last; the Custom period opens on the first press. Each sabotage takes back one promise — what waits
// added into Revenue or not listed at all, a Direct link dropped or any text taken for one, the Custom panel waiting
// for the server again, the form opening blank, a missing total read as 0, an imported number refusing a save, the
// search box drawing no invoice or opening the wrong list, the organisation's tab saying "Everything is counted" while
// a document waits — and the test named must go red for it.
const REPORT = 'src/modules/finance/screens/FinanceReport.tsx';
const MAPPER = 'src/modules/finance/screens/ledger-report.ts';
const OVERVIEW = 'src/modules/finance/screens/FinanceOverview.tsx';
const NEW = 'src/modules/finance/screens/NewInvoice.tsx';
const FORM = 'src/modules/finance/invoice-form.ts';
const PALETTE = 'src/ui/shell/CommandPalette.tsx';
const HIT = 'src/ui/shell/invoice-hit.ts';
const TABS = 'src/modules/partners/screens/record/CompanyTabs.tsx';
const LISTS = 'unit:tests/unit/finance/landing-37-the-ledger-lists-what-is-not-yet-counted.test.tsx';
const PERIOD = 'unit:tests/unit/finance/landing-37-the-custom-period-opens-on-the-first-press.test.tsx';
const SAVED = 'unit:tests/unit/finance/landing-37-the-new-invoice-form-shows-the-invoice-saved-last.test.tsx';
const SEARCH = 'unit:tests/unit/shell/landing-37-the-search-finds-an-invoice-by-its-number.test.tsx';
const TAB = 'unit:tests/unit/partners/landing-37-a-pending-invoice-on-the-finance-tab.test.tsx';

export const sabotages = [
  // ---- A6: the Ledger lists what is not yet counted, and counts none of it
  {
    name: 'ledger-waiting-amount-is-added-to-revenue',
    breaks: [LISTS],
    expect: 'Revenue and every figure of the strip are the same with the list as without it',
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
    name: 'ledger-waiting-rows-are-not-listed',
    breaks: [LISTS],
    expect: 'a Pending and a Draft invoice are rows of their own under Not yet counted (N)',
    edits: [
      {
        file: REPORT,
        find: 'const waitingRows = report.notYetCounted ?? [];',
        replace: 'const waitingRows: NonNullable<typeof report.notYetCounted> = [];',
      },
    ],
  },
  {
    name: 'ledger-waiting-row-drops-its-direct-link',
    breaks: [LISTS],
    expect: 'an imported row says where it came from and carries its Direct link',
    edits: [{ file: REPORT, find: '{r.direct_url ? (', replace: '{r.direct_url && r.source === "manual" ? (' }],
  },
  {
    name: 'ledger-mapper-reads-the-waiting-list-under-the-wrong-name',
    breaks: [LISTS],
    expect: 'the list and its two totals arrive under the report’s names',
    edits: [
      {
        file: MAPPER,
        find: "list(either(a, 'not_yet_counted', 'notYetCounted'))",
        replace: "list(either(a, 'notYetCounted', 'notYetCounted'))",
      },
    ],
  },
  {
    name: 'ledger-mapper-takes-any-text-for-a-link',
    breaks: [LISTS],
    expect: 'a row with no amount is no row, and a link that is not a web address is no link',
    edits: [
      {
        file: MAPPER,
        find: 'direct_url: link && /^https?:\\/\\//i.test(link) ? link : null,',
        replace: 'direct_url: link,',
      },
    ],
  },
  // ---- A7 (CR-1594-23): the Custom period opens on the first press
  {
    name: 'custom-period-waits-for-the-server',
    breaks: [PERIOD],
    expect: 'one press opens the From / To panel and lights Custom',
    edits: [{ file: OVERVIEW, find: 'onClick={() => setPressed(k)}', replace: '' }],
  },
  // ---- F185: the form shows the invoice saved last
  {
    name: 'new-invoice-opens-blank',
    breaks: [SAVED],
    expect: 'opened again, it shows the saved record',
    edits: [{ file: NEW, find: '<SavedRecord turn={savedTurn} />', replace: '' }],
  },
  {
    name: 'saved-record-reads-no-total-as-zero',
    breaks: [SAVED],
    expect: 'a missing total is a dash, never 0',
    edits: [
      {
        file: NEW,
        find: "r.total === null ? '—' : fmt(r.total, locale)",
        replace: 'fmt(r.total ?? 0, locale)',
      },
    ],
  },
  {
    name: 'new-invoice-refuses-an-imported-number',
    breaks: [SAVED],
    expect: 'an imported row with that number refuses nothing',
    edits: [{ file: FORM, find: "h.source !== 'import' && ", replace: '' }],
  },
  // ---- A6: the top search finds an invoice by its number
  {
    name: 'search-box-draws-no-invoice',
    breaks: [SEARCH],
    expect: 'a Draft invoice is found by its number',
    edits: [{ file: PALETTE, find: 'invoices: invoiceHitsOf(a),', replace: 'invoices: [],' }],
  },
  {
    name: 'invoice-hit-opens-the-counted-rows-for-a-waiting-invoice',
    breaks: [SEARCH],
    expect: 'one that is not fully paid opens the Not yet counted list of its own day',
    edits: [
      {
        file: HIT,
        find: "const anchor = invoiceHitCounts(h) ? '#finance-ledger' : '#finance-ledger-waiting';",
        replace: "const anchor = '#finance-ledger';",
      },
    ],
  },
  // ---- A6: what a Pending invoice does to the organisation's tab
  {
    name: 'tab-says-everything-is-counted-while-one-waits',
    breaks: [TAB],
    expect: 'with a document waiting the card never says Everything is counted',
    edits: [
      {
        file: TABS,
        find: 'excluded === 0 && waitingRows.length === 0;',
        replace: 'excluded === 0;',
      },
    ],
  },
  {
    name: 'tab-does-not-name-what-waits',
    breaks: [TAB],
    expect: 'is named in the Not yet counted card: number, status, amount',
    edits: [{ file: TABS, find: '{waitingRows.length ? (', replace: '{waitingRows.length < 0 ? (' }],
  },
];
