// Landing 31 (16 Nov): the Finance page, New invoice and the Import card in the V21 look. No rule changed; each
// sabotage takes back one promise of the new look — the Revenue green, a loss in red, Profit without the rows that
// have no cost, tables that fit their card, the Close month receipt, the bar that keeps Save in reach — and the test
// named must go red for it.
const OVERVIEW = 'src/modules/finance/screens/FinanceOverview.tsx';
const RECEIPT = 'src/modules/finance/screens/CloseReceipt.tsx';
const REPORT = 'src/modules/finance/screens/FinanceReport.tsx';
const NEW_SCREEN = 'src/modules/finance/screens/NewInvoice.tsx';
const IMPORT = 'src/modules/finance/screens/FinanceImportSection.tsx';
const CARDS = 'unit:tests/unit/finance/landing-31-the-finance-cards-carry-their-tone-and-their-source.test.tsx';
const CLOSED = 'unit:tests/unit/finance/landing-31-a-closed-month-shows-its-receipt.test.tsx';
const LEDGER = 'unit:tests/unit/finance/landing-31-the-ledger-fits-its-card-and-names-what-is-not-known.test.tsx';
const FORMS = 'unit:tests/unit/finance/landing-31-the-new-invoice-form-and-the-import-card.test.tsx';

export const sabotages = [
  // ---- the figure cards
  {
    name: 'revenue-card-loses-its-green',
    breaks: [CARDS],
    expect: 'Revenue is the green card',
    edits: [
      {
        file: OVERVIEW,
        find: '        tone="success"\n        value={period.revenue}',
        replace: '        value={period.revenue}',
      },
    ],
  },
  {
    name: 'a-loss-is-not-red',
    breaks: [CARDS],
    expect: 'a loss is the danger tone',
    edits: [
      {
        file: OVERVIEW,
        find: "        tone={period.profit < 0 ? 'danger' : undefined}",
        replace: '        tone={undefined}',
      },
    ],
  },
  {
    // the rule that stays: Profit counts only rows that have a cost — the card never adds the Provisional rows to it
    name: 'profit-card-takes-the-provisional-rows',
    breaks: [CARDS],
    expect: 'Profit is the read’s own profit',
    edits: [
      {
        file: OVERVIEW,
        find: '        value={period.profit}\n        provisional={p.profit}',
        replace: '        value={period.profit + p.profit}\n        provisional={p.profit}',
      },
    ],
  },
  {
    name: 'provisional-card-loses-its-line',
    breaks: [CARDS],
    expect: 'the Provisional card has its one line',
    edits: [
      {
        file: OVERVIEW,
        find: "        note={t('finance.tile.provisionalNote', { count: p.units })}",
        replace: "        note={''}",
      },
    ],
  },
  {
    name: 'cards-lose-their-source',
    breaks: [CARDS],
    expect: 'Cost — Recorded here',
    edits: [
      {
        file: OVERVIEW,
        find: "        label={t('finance.tile.costHere')}",
        replace: "        label={t('finance.tile.cost')}",
      },
    ],
  },
  {
    name: 'by-service-stays-over-the-months-on-a-phone',
    breaks: [CARDS],
    expect: 'By service is put away on a phone while Months is open',
    edits: [
      {
        file: OVERVIEW,
        find: "            <div className={cn('min-w-0', away('services'))}>",
        replace: '            <div className="min-w-0">',
      },
    ],
  },
  // ---- the Close month receipt
  {
    name: 'receipt-forgets-who-closed',
    breaks: [CLOSED],
    expect: 'by whom',
    edits: [
      {
        file: RECEIPT,
        find: "    ...(closed.by ? [['by', t('finance.close.receipt.by'), closed.by] as [string, string, string]] : []),\n",
        replace: '',
      },
    ],
  },
  {
    name: 'receipt-has-two-buttons',
    breaks: [CLOSED],
    expect: 'one button',
    edits: [
      {
        file: RECEIPT,
        find: '        <Button variant="primary" onClick={onDone} data-receipt-done>',
        replace:
          '        <Button variant="secondary" onClick={onDone}>\n          {t(\'common.cancel\')}\n        </Button>\n        <Button variant="primary" onClick={onDone} data-receipt-done>',
      },
    ],
  },
  {
    name: 'receipt-draws-a-missing-month-as-zero',
    breaks: [CLOSED],
    expect: "expected '0 SAR' to be '—'",
    edits: [
      {
        file: RECEIPT,
        find: "    closed.figures && n !== undefined ? `${formatMoney(n, locale)} ${t('finance.sar')}` : none;",
        replace: "    `${formatMoney(n ?? 0, locale)} ${t('finance.sar')}`;",
      },
    ],
  },
  // ---- the unified ledger
  {
    name: 'ledger-revenue-loses-its-green',
    breaks: [LEDGER],
    expect: 'Revenue is green',
    edits: [
      {
        file: REPORT,
        find: 'value={total.revenue} tone="success" />',
        replace: 'value={total.revenue} />',
      },
    ],
  },
  {
    // the rule that stays: a cost with no approved expense is never 0
    name: 'no-cost-row-reads-zero',
    breaks: [LEDGER],
    expect: 'cost and profit both say so',
    edits: [
      {
        file: REPORT,
        find: '<td className={cn(TD, NUM, FROM_600)}>{known(r.cost)}</td>',
        replace: '<td className={cn(TD, NUM, FROM_600)}>{formatMoney(r.cost ?? 0, locale)}</td>',
      },
    ],
  },
  {
    name: 'recorded-rows-get-the-imported-pill',
    breaks: [LEDGER],
    expect: 'a recorded row carries none',
    edits: [
      { file: REPORT, find: "    r.source === 'import' || r.isPromo ? (", replace: '    true ? (' },
      {
        file: REPORT,
        find: "        {r.source === 'import' ? <StatusChip tone=\"info\">{t('finance.ledger.sourceImport')}</StatusChip> : null}",
        replace: '        <StatusChip tone="info">{t(\'finance.ledger.sourceImport\')}</StatusChip>',
      },
    ],
  },
  {
    name: 'ledger-table-scrolls-sideways',
    breaks: [LEDGER],
    expect: 'nothing scrolls sideways',
    edits: [
      {
        file: REPORT,
        find: '<section aria-labelledby={id} className="flex min-w-0 flex-col border-t border-border" {...rest}>',
        replace:
          '<section aria-labelledby={id} className="flex min-w-0 flex-col overflow-x-auto border-t border-border" {...rest}>',
      },
    ],
  },
  {
    name: 'narrow-ledger-lists-every-row',
    breaks: [LEDGER],
    expect: 'rows six to eight are put away where it is narrow',
    edits: [
      {
        file: REPORT,
        find: "                        !allRows && i >= NARROW_ROWS && '@max-[599px]:hidden',",
        replace: '                        false,',
      },
    ],
  },
  {
    name: 'failed-ledger-has-no-try-again',
    breaks: [LEDGER],
    expect: 'a failed read offers Try again',
    edits: [
      {
        file: REPORT,
        find: '          onRetry={loading ? undefined : onRetry}',
        replace: '          onRetry={undefined}',
      },
    ],
  },
  // ---- New invoice and the Import card
  {
    name: 'new-invoice-has-two-save-buttons',
    breaks: [FORMS],
    expect: 'one Save',
    edits: [
      {
        file: NEW_SCREEN,
        find: "          title={t('finance.new.title')}\n        />",
        replace:
          '          title={t(\'finance.new.title\')}\n          actions={\n            <Button variant="primary" type="submit" disabled={busy} data-save>\n              {t(\'common.save\')}\n            </Button>\n          }\n        />',
      },
    ],
  },
  {
    name: 'new-invoice-bar-does-not-stay-in-reach',
    breaks: [FORMS],
    expect: 'sticks where the page is narrow',
    edits: [
      {
        file: NEW_SCREEN,
        find: '@max-[639px]:sticky @max-[639px]:bottom-3',
        replace: '@max-[639px]:bottom-3',
      },
    ],
  },
  {
    name: 'import-steps-all-lit',
    breaks: [FORMS],
    expect: 'Review is not reached yet',
    edits: [
      {
        file: IMPORT,
        find: "            const at = stage === 'confirmed' ? 2 : stage === 'preview' ? 1 : 0;",
        replace: '            const at = 2;',
      },
    ],
  },
];
