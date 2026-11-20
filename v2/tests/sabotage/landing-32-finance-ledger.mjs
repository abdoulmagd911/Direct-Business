// Landing 32 (Finance F-B, 19 Nov): the Finance page's unified Ledger says what is counted, and the import preview
// counts the exclusion list. Each sabotage takes back one promise — a cost that is not known read as 0, a row that
// does not count left in the table or the file, Exclude / Include offered where they must not be, a reason no longer
// required, a code that was not found left unsaid, the "Is it counted?" table mixing its columns or summing a year
// on the screen, a preview that does not count what the list leaves out — and the test named must go red for it.
const REPORT = 'src/modules/finance/screens/FinanceReport.tsx';
const MAPPER = 'src/modules/finance/screens/ledger-report.ts';
const LEDGER = 'src/modules/finance/ledger.ts';
const UNIFIED = 'src/modules/finance/unified.ts';
const COUNTED = 'src/modules/finance/screens/CountedTable.tsx';
const NOTES = 'src/modules/finance/screens/ImportRuleNotes.tsx';
const RULES = 'src/modules/imports/rule-check.ts';
const REASON_BOX = 'src/ui/ReasonDialog.tsx';
const SAYS = 'unit:tests/unit/finance/landing-32-the-ledger-says-what-is-counted.test.tsx';
const TOGGLE = 'unit:tests/unit/finance/landing-32-exclude-and-include-need-a-reason.test.tsx';
const TABLE = 'unit:tests/unit/finance/landing-32-is-it-counted-table.test.tsx';
const PREVIEW = 'unit:tests/unit/finance/landing-32-the-import-preview-says-what-will-not-count.test.tsx';
const COUNTS = 'unit:tests/unit/imports/landing-32-the-preview-counts-the-exclusion-list.test.ts';

export const sabotages = [
  // ---- A5: no counted cost is a dash, never 0
  {
    name: 'ledger-empty-cost-reads-zero',
    breaks: [SAYS],
    expect: 'the strip’s Cost is a dash with Not known yet — never 0',
    edits: [
      {
        file: REPORT,
        find: "label={t('finance.ledger.costUnified')} value={total.cost} />",
        replace: "label={t('finance.ledger.costUnified')} value={total.cost ?? 0} />",
      },
    ],
  },
  {
    name: 'ledger-empty-profit-reads-zero',
    breaks: [SAYS],
    expect: 'the strip’s Profit is empty with it — never 0, and never red',
    edits: [
      {
        file: REPORT,
        find: '          value={total.profit}\n',
        replace: '          value={total.profit ?? 0}\n',
      },
    ],
  },
  {
    name: 'partner-empty-cost-reads-zero',
    breaks: [SAYS],
    expect: 'an organisation with no cost shows no cost and no profit',
    edits: [
      {
        file: REPORT,
        find: '                    {known(c.cost)}\n',
        replace: '                    {formatMoney(c.cost ?? 0, locale)}\n',
      },
    ],
  },
  {
    name: 'an-empty-cost-is-read-as-zero',
    breaks: [SAYS],
    expect: 'an empty cost stays empty — never read as 0',
    edits: [{ file: MAPPER, find: '      cost: num(totals.cost),', replace: '      cost: num(totals.cost) ?? 0,' }],
  },
  // ---- A2: the Counted? column and the rows listed apart
  {
    name: 'not-counted-rows-stay-in-the-main-table',
    breaks: [SAYS],
    expect: 'a row that does not count is listed apart, never in the main table',
    edits: [
      {
        file: REPORT,
        find: '  const countedRows = report.rows.filter(isCounted);',
        replace: '  const countedRows = report.rows;',
      },
    ],
  },
  {
    name: 'the-apart-list-drops-its-reason',
    breaks: [SAYS],
    expect: 'a row listed apart shows its revenue and the reason typed',
    edits: [
      {
        file: REPORT,
        find: "{r.not_counted_reason ?? t('finance.ledger.noReason')}",
        replace: "{t('finance.ledger.noReason')}",
      },
    ],
  },
  {
    name: 'the-file-lists-rows-left-out',
    breaks: [SAYS],
    expect: 'the file holds counted rows only, above the totals they are in',
    edits: [
      {
        file: LEDGER,
        find: 'for (const r of (report.rows as LedgerRow[]).filter(isCounted)) {',
        replace: 'for (const r of report.rows as LedgerRow[]) {',
      },
    ],
  },
  {
    name: 'the-rules-copy-totals-an-excluded-row',
    breaks: [SAYS],
    expect: 'an excluded row is listed apart with its revenue, out of every total',
    edits: [{ file: UNIFIED, find: '    if (row.excluded) {', replace: '    if (row.excluded && row.revenue < 0) {' }],
  },
  // ---- A2: Exclude / Include, admins only and only where allowed
  {
    name: 'everyone-gets-the-buttons',
    breaks: [SAYS],
    expect: 'anyone else reads the column and the reasons, with no button',
    edits: [
      {
        file: REPORT,
        find: 'report.canToggle === true && !!onToggle && !!r.number',
        replace: '!!onToggle && !!r.number',
      },
    ],
  },
  {
    name: 'a-row-with-no-number-offers-exclude',
    breaks: [SAYS],
    expect: 'an admin gets Exclude on a counted row that names itself',
    edits: [
      {
        file: REPORT,
        find: '!!onToggle && !!r.number && !!r.source_partner_id',
        replace: '!!onToggle && !!r.source_partner_id',
      },
    ],
  },
  {
    name: 'list-rule-rows-offer-include',
    breaks: [SAYS],
    expect: 'an admin gets Include only on a row excluded by hand',
    edits: [
      {
        file: REPORT,
        find: '                  {r.excluded_row_level ? (\n',
        replace: '                  {r.excluded_row_level || r.excluded_by ? (\n',
      },
    ],
  },
  {
    name: 'exclude-runs-as-include',
    breaks: [TOGGLE],
    expect: 'Exclude runs once, as an exclusion, with the row and the reason typed',
    edits: [{ file: REPORT, find: "onClick={() => ask('exclude', r)}", replace: "onClick={() => ask('include', r)}" }],
  },
  {
    name: 'a-change-runs-without-a-reason',
    breaks: [TOGGLE],
    expect: 'Exclude opens the reason box, naming the row, and its button waits for a reason',
    edits: [
      {
        file: REASON_BOX,
        find: '  const ok = reason.trim().length > 0 && !saveDisabled;',
        replace: '  const ok = !saveDisabled;',
      },
    ],
  },
  // ---- A3: a code that has not been found
  {
    name: 'code-not-found-is-silent',
    breaks: [SAYS],
    expect: 'a row flagged code_not_found carries the warning',
    edits: [
      {
        file: REPORT,
        find: ": r.code_state === 'not_found' || r.flags?.includes('code_not_found')",
        replace: ": r.code_state === 'not_found'",
      },
    ],
  },
  {
    name: 'promo-rows-say-nothing-of-their-code',
    breaks: [SAYS],
    expect: 'a discount-code row says the same from what its code matched',
    edits: [{ file: REPORT, find: '                    {codePill(pr)}\n', replace: '' }],
  },
  // ---- A4: one discount figure
  {
    name: 'a-second-discount-figure',
    breaks: [SAYS],
    expect: 'the filtered discount is drawn once, and no second figure beside it',
    edits: [
      {
        file: REPORT,
        find: '          <b className="font-data text-text tabular">{formatMoney(report.codeDiscount, locale)}</b>\n',
        replace:
          '          <b className="font-data text-text tabular">{formatMoney(report.codeDiscount, locale)}</b>\n          <b className="font-data text-text tabular">{formatMoney(report.codeDiscount, locale)}</b>\n',
      },
    ],
  },
  // ---- A2: the "Is it counted?" table
  {
    name: 'counted-table-swaps-its-columns',
    breaks: [TABLE],
    expect: 'what is not counted is split: Excluded · Not fully paid · Promo pool',
    edits: [
      {
        file: COUNTED,
        find: '        {pair(f.excluded_units, f.excluded_revenue)}\n',
        replace: '        {pair(f.not_paid_units, f.not_paid_revenue)}\n',
      },
    ],
  },
  {
    name: 'year-total-is-summed-on-screen',
    breaks: [TABLE],
    expect: 'a year’s total is the database’s own, never the months summed here',
    edits: [
      {
        file: COUNTED,
        find: '            {cells(y)}\n',
        replace:
          '            {cells(data.months.filter((m) => m.month_on.slice(0, 4) === String(y.year)).reduce((a, m) => ({ ...a, counted_units: a.counted_units + m.counted_units, counted_revenue: a.counted_revenue + m.counted_revenue }), { ...y, counted_units: 0, counted_revenue: 0 }))}\n',
      },
    ],
  },
  {
    name: 'failed-counted-table-reads-empty',
    breaks: [TABLE],
    expect: 'an answer that is not the table’s shape is no table — never read as an empty one',
    edits: [
      {
        file: COUNTED,
        find: '  if (!Array.isArray(a.months) || !Array.isArray(a.years)) return null;\n',
        replace:
          '  if (!Array.isArray(a.months) || !Array.isArray(a.years)) return { from: "", to: "", months: [], years: [] };\n',
      },
    ],
  },
  // ---- A2: the import preview counts the exclusion list
  {
    name: 'rule-excluded-rows-are-not-counted',
    breaks: [COUNTS],
    expect: 'a rule on the organisation adds every row the import stores to Left out by rule',
    edits: [
      { file: RULES, find: '    if (check.excluded) return true;', replace: '    if (check.excluded) return false;' },
    ],
  },
  {
    name: 'named-rows-are-not-counted',
    breaks: [COUNTS],
    expect: 'rows the list names one by one are counted the same way, by transaction or invoice number',
    edits: [
      {
        file: RULES,
        find: '    if (named.size === 0) return false;',
        replace: '    if (named.size >= 0) return false;',
      },
    ],
  },
  {
    name: 'held-rows-are-counted-twice',
    breaks: [COUNTS],
    expect: 'a held row is not counted a second time, and a skipped duplicate is not counted at all',
    edits: [
      {
        file: RULES,
        find: "const isStored = (r: PreviewRow) => r.outcome !== 'excluded' && r.values !== null;",
        replace: 'const isStored = (r: PreviewRow) => r.row_no > 0;',
      },
    ],
  },
  {
    name: 'numbers-are-compared-unfolded',
    breaks: [COUNTS],
    expect: 'a number is compared the way the database folds it',
    edits: [{ file: RULES, find: '    .toLowerCase()\n', replace: '' }],
  },
  {
    name: 'the-rule-is-not-named',
    breaks: [PREVIEW],
    expect: 'names the rule that keeps the whole import out: its kind, its value and its reason',
    edits: [{ file: NOTES, find: "            value: check.value ?? '—',", replace: "            value: '—'," }],
  },
  {
    name: 'a-code-not-found-is-silent-in-the-preview',
    breaks: [PREVIEW],
    expect: 'a code that has not been found is a warning',
    edits: [{ file: NOTES, find: '      {codeState ? (', replace: "      {codeState === 'found' ? (" }],
  },
  {
    name: 'a-failed-rule-check-is-silent',
    breaks: [PREVIEW],
    expect: 'a check that did not answer says so — the preview is never silent about it',
    edits: [
      { file: NOTES, find: '      {checkFailed ? (', replace: '      {checkFailed && !check ? null : checkFailed ? (' },
    ],
  },
];
