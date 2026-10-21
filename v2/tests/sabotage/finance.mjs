// Sabotages for the Finance Overview (builder B, GC-5, P4-5): each breaks one promise of the brief's section F, and the
// named test must go red for that reason. The New invoice entries (P4-4) follow the Overview's.
const E2E = 'e2e:tests/e2e/finance-overview.spec.ts';
const UNIT =
  'unit:tests/unit/finance/the-overview-prints-exact-figures-and-names-a-gap-and-lists-months-newest-first.test.ts';
const FAILED = 'unit:tests/unit/finance/a-failed-read-fails-only-its-own-block-on-the-overview.test.tsx';
const OVERVIEW = 'src/modules/finance/screens/FinanceOverview.tsx';
const NEW_E2E = 'e2e:tests/e2e/finance-new-invoice.spec.ts';
const FORM = 'src/modules/finance/invoice-form.ts';
const NEW_SCREEN = 'src/modules/finance/screens/NewInvoice.tsx';
const READS_E2E = 'e2e:tests/e2e/finance-overview-reads.spec.ts';
const LIVE = 'src/modules/finance/screens/FinanceOverviewLive.tsx';
const READS = 'src/modules/finance/use-reads.ts';

export const sabotages = [
  {
    name: 'tile-profit-leaves-provisional-out',
    breaks: [E2E],
    expect: 'profit keeps its Provisional part',
    edits: [
      {
        file: OVERVIEW,
        find: '        value={period.profit}\n        provisional={p.profit}',
        replace: '        value={period.profit}\n        provisional={0}',
      },
    ],
  },
  {
    name: 'short-form-hides-its-exact-figure',
    breaks: [E2E],
    expect: 'a short form prints its exact figure',
    edits: [{ file: OVERVIEW, find: '      {short ? (', replace: '      {false ? (' }],
  },
  {
    name: 'close-month-offers-an-undo',
    breaks: [E2E],
    expect: 'closing has no Undo',
    edits: [
      {
        file: OVERVIEW,
        find: "      toast.done(t('finance.close.done', { month: monthName(month, locale) }));",
        replace:
          "      toast.done(t('finance.close.done', { month: monthName(month, locale) }), { undo: { label: 'Undo', onUndo: () => undefined } });",
      },
    ],
  },
  {
    name: 'closed-month-row-takes-late-changes',
    breaks: [E2E],
    expect: 'the closed month keeps its figures',
    edits: [
      {
        file: 'src/modules/finance/figures.ts',
        find: '        figures: byMonth.get(month) ?? null,',
        replace:
          '        figures: ((f) => (f && close ? { ...f, revenue: f.revenue + close.late_changes.reduce((s, l) => s + (l.revenue_change ?? 0), 0) } : (f ?? null)))(byMonth.get(month)),',
      },
    ],
  },
  {
    name: 'member-can-close-a-month',
    breaks: [E2E],
    expect: 'a member sees the month is not closed',
    edits: [{ file: OVERVIEW, find: '  return full ? (', replace: '  return true ? (' }],
  },
  {
    name: 'commissions-sentence-missing',
    breaks: [E2E],
    expect: 'the commissions sentence is on the Overview',
    edits: [{ file: OVERVIEW, find: "          {t('finance.commissions')}", replace: "          {''}" }],
  },
  {
    name: 'two-payments-stamps',
    breaks: [E2E],
    expect: 'one Payments stamp',
    edits: [
      {
        file: OVERVIEW,
        find: '    <div className="flex flex-wrap items-center gap-2" data-finance-period>',
        replace: '    <div className="flex flex-wrap items-center gap-2" data-finance-period data-finance-stamp>',
      },
    ],
  },
  {
    name: 'provisional-far-from-its-figure',
    breaks: [E2E],
    expect: 'the Provisional part is right under its figure',
    edits: [
      {
        file: OVERVIEW,
        find: '      <span className="text-sm" data-finance-provisional>',
        replace: '      <span className="mt-24 text-sm" data-finance-provisional>',
      },
    ],
  },
  {
    name: 'period-links-short-on-a-phone',
    breaks: [E2E],
    expect: 'every target is 44 px or more',
    edits: [
      {
        file: OVERVIEW,
        find: "'inline-flex h-[var(--control-h)] items-center px-3.5 text-base",
        replace: "'inline-flex h-6 min-h-0 items-center px-3.5 text-base",
      },
    ],
  },
  {
    name: 'month-stays-a-table-on-a-phone',
    breaks: [E2E],
    expect: 'the month is a card on a phone',
    edits: [
      {
        file: OVERVIEW,
        find: 'className="grid basis-full grid-cols-3 gap-3 max-sm:order-3 sm:hidden" data-finance-month-card',
        replace: 'className="hidden" data-finance-month-card',
      },
    ],
  },
  {
    name: 'short-form-loses-a-riyal',
    breaks: [UNIT],
    expect: "'1.5K'",
    edits: [
      {
        file: 'src/modules/finance/figures.ts',
        find: '(Math.round(n / 100) / 10).toString()',
        replace: 'Math.round(n / 1_000).toString()',
      },
    ],
  },
  {
    name: 'months-gap-is-never-named',
    breaks: [UNIT],
    expect: 'to be 1.5',
    edits: [
      {
        file: 'src/modules/finance/figures.ts',
        find: 'return Math.round((period.revenue - sum) * 100) / 100;',
        replace: 'return 0 * (period.revenue - sum);',
      },
    ],
  },
  {
    name: 'months-run-oldest-first',
    breaks: [UNIT],
    expect: 'run newest first',
    edits: [{ file: 'src/modules/finance/figures.ts', find: '    .reverse();', replace: ';' }],
  },
  {
    name: 'failed-payments-date-reads-as-no-file',
    breaks: [FAILED],
    expect: 'Payments · not imported yet',
    edits: [{ file: OVERVIEW, find: '        {data.asOf === null ? (', replace: '        {false ? (' }],
  },
  {
    // V622: before any import the Overview is one empty state, never "as of —" over three zeros
    name: 'finance-before-import-shows-zeros',
    breaks: [FAILED],
    expect: 'never a dash and zeros',
    edits: [{ file: OVERVIEW, find: '  const notImported =\n', replace: '  const notImported = false &&\n' }],
  },
  {
    name: 'attention-strip-hides-when-closed-months-fail',
    breaks: [FAILED],
    expect: 'when the closed months failed',
    edits: [
      {
        file: OVERVIEW,
        find: '  const flags = data.health ? attention(',
        replace: '  const flags = data.health && data.closed ? attention(',
      },
    ],
  },
  {
    name: 'late-line-drops-its-cost-part',
    breaks: [UNIT],
    expect: 'both parts of a unit',
    edits: [
      {
        file: 'src/modules/finance/figures.ts',
        find: "  return { main: revenue, other: cost !== 0 ? { of: 'cost', amount: cost } : null };",
        replace: '  return { main: revenue, other: null };',
      },
    ],
  },
  {
    name: 'short-form-rounds-up-to-1000k',
    breaks: [UNIT],
    expect: '1.00M',
    edits: [
      {
        file: 'src/modules/finance/figures.ts',
        find: '  if (a >= 1_000_000 || thousands >= 1_000)',
        replace: '  if (a >= 1_000_000)',
      },
    ],
  },

  {
    name: 'new-invoice-skips-the-required-check',
    breaks: [NEW_E2E],
    expect: 'an empty form says what is missing',
    edits: [{ file: FORM, find: "if (d.ref.trim() === '')", replace: 'if (false)' }],
  },
  {
    name: 'new-invoice-saves-a-duplicate-number',
    breaks: [NEW_E2E],
    expect: 'the same number twice is refused in its field',
    edits: [{ file: NEW_SCREEN, find: 'if ((hits ?? []).some(', replace: 'if (false && (hits ?? []).some(' }],
  },
  {
    name: 'new-invoice-undo-leaves-the-lines',
    breaks: [NEW_E2E],
    expect: 'Undo takes the line and the invoice back',
    edits: [
      {
        file: NEW_SCREEN,
        find: 'for (const rid of [...made].reverse()) await undoRequest(rid);',
        replace: 'if (made[0]) await undoRequest(made[0]);',
      },
    ],
  },
  {
    name: 'new-invoice-offers-a-fifth-kind',
    breaks: [NEW_E2E],
    expect: 'four kinds, no Credit note',
    edits: [
      {
        file: FORM,
        find: "['transaction', 'standalone', 'billing', 'wallet_topup'];",
        replace: "['transaction', 'standalone', 'billing', 'wallet_topup', 'wallet_topup'];",
      },
    ],
  },
  {
    name: 'new-invoice-panel-ignores-the-count',
    breaks: [NEW_E2E],
    expect: 'counted as the database says',
    edits: [{ file: NEW_SCREEN, find: 'data-counted={u.counted}', replace: 'data-counted={true}' }],
  },
  {
    name: 'new-invoice-panel-says-final-for-all',
    breaks: [NEW_E2E],
    expect: 'the state is the database',
    edits: [{ file: NEW_SCREEN, find: "? t('finance.state.provisional')", replace: "? t('finance.state.final')" }],
  },
  {
    name: 'new-invoice-panel-works-out-its-own-cost',
    breaks: [NEW_E2E],
    expect: 'cost is the database',
    edits: [{ file: NEW_SCREEN, find: "['cost', u.cost],", replace: "['cost', u.revenue * 0.5]," }],
  },
  {
    name: 'new-invoice-undo-keeps-the-last-saved-panel',
    breaks: [NEW_E2E],
    expect: 'an undone invoice is no longer shown as last saved',
    edits: [
      {
        file: NEW_SCREEN,
        find: 'setSaved((now) => (now?.ref === d.ref.trim() ? null : now));',
        replace: '',
      },
    ],
  },
  {
    name: 'month-helper-creates-its-sequence-unlocked',
    breaks: ['e2e:tests/e2e/finance-month-helper.spec.ts'],
    expect: 'pg_class_relname_nsp_index',
    edits: [
      {
        file: 'tests/e2e/support/finance-month.ts',
        find: 'perform pg_advisory_xact_lock(7231001); ',
        replace: '',
      },
    ],
  },
  {
    name: 'attention-row-sits-under-the-add-button',
    breaks: [E2E],
    expect: 'the Needs attention row stays clear of the + button',
    edits: [{ file: OVERVIEW, find: ' max-sm:mb-16 max-sm:pe-20', replace: '' }],
  },
  {
    name: 'month-row-sits-under-the-add-button',
    breaks: [E2E],
    expect: 'the month rows stay clear of the + button',
    edits: [{ file: OVERVIEW, find: 'last:border-b-0 max-sm:pe-20', replace: 'last:border-b-0' }],
  },
  {
    name: 'finance-reads-all-at-once',
    breaks: [READS_E2E],
    expect: 'at most two Finance reads are in flight at once',
    edits: [{ file: READS, find: 'export const LIMIT = 2;', replace: 'export const LIMIT = 99;' }],
  },
  {
    name: 'finance-read-is-never-asked-again',
    breaks: [READS_E2E],
    expect: 'a timeout is retried, not shown',
    edits: [
      {
        file: READS,
        find: "if (!(e instanceof DbError) || e.kind !== 'Unavailable') throw e;",
        replace: 'throw e;',
      },
    ],
  },
  {
    name: 'finance-aborted-read-overwrites-the-answer',
    breaks: [READS_E2E],
    expect: 'no block is left on loading or failed after going back to a period',
    edits: [
      {
        file: READS,
        find: "if (!controller.signal.aborted) setState({ key, block: { status: 'ready', data } });",
        replace: "setState({ key, block: { status: 'ready', data } });",
      },
      {
        file: READS,
        find: "signal.addEventListener('abort', cancelled, { once: true });\n    request.then(",
        replace: 'request.then(',
      },
    ],
  },
  {
    name: 'finance-cancelled-read-frees-its-slot',
    breaks: [READS_E2E],
    expect: 'at most two Finance reads are in flight at once',
    edits: [
      {
        file: READS,
        find: 'const request: Promise<T> = Promise.resolve(browserDb().rpc(fn as never, args as never))',
        replace:
          'const request: Promise<T> = Promise.resolve(browserDb().rpc(fn as never, args as never).abortSignal(signal))',
      },
    ],
  },
  {
    name: 'try-again-reloads-the-whole-page',
    breaks: [READS_E2E],
    expect: 'Try again brings the months back',
    edits: [
      {
        file: OVERVIEW,
        find: 'onRetry={retryBlock?.[block] ?? (() => router.refresh())}',
        replace: 'onRetry={() => router.refresh()}',
      },
    ],
  },
  {
    name: 'month-label-says-the-day',
    breaks: [READS_E2E],
    expect: 'the month is its name and year',
    edits: [{ file: OVERVIEW, find: 'day: undefined, month:', replace: 'month:' }],
  },
  {
    name: 'by-service-empty-says-nothing',
    breaks: [READS_E2E],
    expect: 'nothing to split says so',
    edits: [{ file: OVERVIEW, find: 'service.rows.length === 0 && Math.abs(gap) < 1', replace: 'false' }],
  },
  {
    name: 'finance-heavy-reads-asked-first',
    breaks: [READS_E2E],
    expect: 'the reads are asked in the order a person looks',
    edits: [
      {
        file: LIVE,
        find: "  const closed = useFinanceRead<ClosedMonth[], 'finance_closed_months'>('finance_closed_months', {}, 'closed');\n  const health = useFinanceRead<HealthEntry[], 'finance_health'>('finance_health', range, `health|${at}`);\n",
        replace: '',
      },
      {
        file: LIVE,
        find: '  const notInvoiced = useFinanceRead',
        replace:
          "  const closed = useFinanceRead<ClosedMonth[], 'finance_closed_months'>('finance_closed_months', {}, 'closed');\n  const health = useFinanceRead<HealthEntry[], 'finance_health'>('finance_health', range, `health|${at}`);\n  const notInvoiced = useFinanceRead",
      },
    ],
  },
];
