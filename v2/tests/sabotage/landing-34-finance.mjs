// Landing 34 (the 19 Nov test round) — Finance. Each sabotage takes back one fix of the round — a ledger that waits
// for the figures to succeed, a request with no answer that never fails in words or is asked twice, a window coming
// back that throws the reads away, a Provisional amount read from the wrong field, a provisional row with a profit, a
// stale Payments stamp said as current, Income by company without its name or its address, words run together, the
// screen-words allowance widened — and the test named must go red for it.
const READS = 'src/modules/finance/use-reads.ts';
const LEDGER = 'src/modules/finance/ledger.ts';
const FIGURES = 'src/modules/finance/figures.ts';
const OVERVIEW = 'src/modules/finance/screens/FinanceOverview.tsx';
const REPORT = 'src/modules/finance/screens/FinanceReport.tsx';
const WORDS_CHECK = 'scripts/checks/screen-words.mjs';
const SETTLES = 'unit:tests/unit/finance/landing-34-every-finance-read-settles.test.ts';
const PAGE = 'unit:tests/unit/finance/landing-34-one-provisional-amount-and-an-honest-stamp.test.tsx';

export const sabotages = [
  // ---- item 4: every read settles
  {
    name: 'ledger-waits-for-the-figures-to-succeed',
    breaks: [SETTLES],
    expect: 'is not held by a figures read that failed',
    edits: [{ file: LEDGER, find: "figures !== 'loading';", replace: "figures === 'ready';" }],
  },
  {
    name: 'a-read-with-no-answer-fails-without-its-words',
    breaks: [SETTLES],
    expect: 'fails as "could not be reached" at the deadline',
    edits: [{ file: READS, find: '      reject(late);\n', replace: "      reject(new Error('late'));\n" }],
  },
  {
    name: 'a-read-with-no-answer-is-asked-twice',
    breaks: [SETTLES],
    expect: 'is not asked a second time on its own',
    edits: [{ file: READS, find: '    if (noAnswer.has(e)) throw e;\n', replace: '' }],
  },
  {
    name: 'window-back-restarts-a-read-in-flight',
    breaks: [SETTLES],
    expect: 'a window that only came back leaves a read still on its way alone',
    edits: [{ file: READS, find: "block.status === 'ready' && now", replace: "block.status !== 'failed' && now" }],
  },
  {
    name: 'window-back-reasks-a-fresh-answer',
    breaks: [SETTLES],
    expect: 'a window that came back leaves a fresh answer',
    edits: [{ file: READS, find: 'now - block.answeredAt > BACK_STALE_MS', replace: 'now - block.answeredAt > 0' }],
  },
  // ---- items 16/35: one Provisional amount
  {
    name: 'months-total-reads-the-provisional-profit',
    breaks: [PAGE],
    expect: 'the months’ total says the same amount, never the provisional profit',
    edits: [
      { file: OVERVIEW, find: '{money(period.provisional.revenue)}', replace: '{money(period.provisional.profit)}' },
    ],
  },
  {
    name: 'month-row-reads-the-provisional-profit',
    breaks: [PAGE],
    expect: 'the provisional profit, which leaves the imported rows out, is printed nowhere',
    edits: [
      {
        file: OVERVIEW,
        find: "          label={t('finance.months.provisional')}\n          value={money(f?.provisional_revenue)}",
        replace: "          label={t('finance.months.provisional')}\n          value={money(f?.provisional_profit)}",
      },
    ],
  },
  {
    name: 'cost-card-reads-the-empty-provisional-cost',
    breaks: [PAGE],
    expect: 'the Revenue card holds it, and the Cost and Profit cards name the same amount as left out',
    edits: [
      {
        file: OVERVIEW,
        find: '        value={period.cost}\n        provisional={p.revenue}',
        replace: '        value={period.cost}\n        provisional={p.cost}',
      },
    ],
  },
  {
    name: 'provisional-row-prints-a-profit',
    breaks: [PAGE],
    expect: 'the provisional profit, which leaves the imported rows out, is printed nowhere',
    edits: [
      {
        file: OVERVIEW,
        find: '<Figure className="hidden @min-[600px]:block" label={t(\'finance.months.profit\')} value={none} />',
        replace:
          '<Figure className="hidden @min-[600px]:block" label={t(\'finance.months.profit\')} value={formatMoney(f.provisional_profit, locale)} />',
      },
    ],
  },
  // ---- item 19: the stamp
  {
    name: 'stale-stamp-reads-as-current',
    breaks: [PAGE],
    expect: 'is "not refreshed since", in the warning tone, once it is more than two days old',
    edits: [{ file: FIGURES, find: 'Number.isFinite(age) && age > STAMP_STALE_AFTER_DAYS', replace: 'false' }],
  },
  {
    name: 'stamp-hides-the-newest-file',
    breaks: [PAGE],
    expect: 'says the newest file’s day too',
    edits: [{ file: FIGURES, find: 'newest: last > day ? last : null', replace: 'newest: null' }],
  },
  // ---- item 18: Income by company
  {
    name: 'income-by-company-loses-its-name',
    breaks: [PAGE],
    expect: 'the ledger’s table by partner is named Income by company',
    edits: [
      { file: REPORT, find: "title={t('finance.ledger.byCompany')}", replace: "title={t('finance.ledger.byPartner')}" },
    ],
  },
  {
    name: 'income-by-company-loses-its-address',
    breaks: [PAGE],
    expect: 'has an address of its own, like Income by service',
    edits: [{ file: REPORT, find: '        anchor="finance-company"\n', replace: '' }],
  },
  {
    name: 'screen-words-lets-any-company-through',
    breaks: [PAGE],
    expect: 'the screen-words check lets that one label through, and still refuses the word anywhere else',
    edits: [
      {
        file: WORDS_CHECK,
        find: 'const OWNER_LABELS = [\'"byCompany": "Income by company"\'];',
        replace: "const OWNER_LABELS = ['Income by company'];",
      },
    ],
  },
  // ---- item 15: the spaces
  {
    name: 'provisional-words-run-together',
    breaks: [PAGE],
    expect: 'of which Provisional: the words, the amount and the rows apart',
    edits: [
      {
        file: OVERVIEW,
        find: 'className="flex flex-wrap items-baseline gap-x-1 text-sm" data-finance-provisional',
        replace: 'className="text-sm" data-finance-provisional',
      },
    ],
  },
  {
    name: 'not-invoiced-words-run-together',
    breaks: [PAGE],
    expect: 'Not yet invoiced: each word and figure apart',
    edits: [
      {
        file: OVERVIEW,
        find: '<p className="flex flex-wrap items-baseline gap-x-1.5" data-finance-not-invoiced>',
        replace: '<p data-finance-not-invoiced>',
      },
    ],
  },
];
