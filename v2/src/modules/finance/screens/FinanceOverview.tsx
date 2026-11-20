'use client';
import { Banknote, ChevronDown, Hourglass, Plus, Receipt, TrendingUp, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode, Fragment } from 'react';
import { refetchAll } from '@/core/commands/refetch';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { formatDate, formatMoney } from '@/core/i18n/format';
import { Button, buttonVariants } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { Confirm } from '@/ui/Confirm';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { DatePicker } from '@/ui/DatePicker';
import { KpiTile } from '@/ui/KpiTile';
import { PageHeader } from '@/ui/PageHeader';
import { Tabs } from '@/ui/Tabs';
import { toast } from '@/ui/Toast';
import { attention, lateCount, lateParts, monthRows, monthsGap, shortForm, stampOf, type MonthRow } from '../figures';
import type { PeriodAsk, PeriodKey } from '../period';
import { monthStart } from '../period';
import type { IncomeByService, LateChange, OverviewData, Period } from '../types';
import { CloseReceipt, type Closed } from './CloseReceipt';
import { FinanceCard, TilesSkeleton } from './parts';

type Locale = 'en' | 'ar';

/** What a phone shows under the figures, one at a time (13 Nov phone board); a wider screen shows all three. */
export type PhoneView = 'months' | 'services' | 'ledger';

/** A real day as `YYYY-MM-DD` (not 30 Feb, not a half-typed day). */
const isDay = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** A month start as "September 2026" (Riyadh calendar, Latin digits) — never "1 Sep 2026". */
const monthName = (m: string, locale: Locale) =>
  formatDate(`${m}T12:00:00Z`, locale, { day: undefined, month: 'long', year: 'numeric' });

/**
 * The Finance Overview (GC-5), in the V21 look: the period's figure cards — Revenue, Cost and Profit as recorded here,
 * each with the Provisional part directly under the figure (V611), and the Provisional card beside them — one line of
 * what is not yet invoiced (V424), the commissions sentence (V612), Needs attention, the months newest first with
 * their close and what changed after it (V620), and income by service. A part that failed to read says which one,
 * with Try again — never a 0 (M27, M53). A month with cost-provisional units carries a Provisional row under it, their
 * revenue and profit apart and their cost empty, never 0 (rulebook §16). On a phone the months, the services and the
 * ledger are one view at a time (`phoneView`); a wider screen shows them all.
 */
export function FinanceOverview({
  ask,
  today,
  full,
  data,
  loading,
  retry: retryBlock,
  closer,
  phoneView,
  onPhoneView,
}: {
  ask: PeriodAsk;
  today: string;
  /** Full on Finance: the person who closes a month (V620). */
  full: boolean;
  data: OverviewData;
  /** A block still being read: drawn as loading, not as failed. */
  loading?: Partial<Record<keyof OverviewData, boolean>>;
  /** Repeats one block's own read; the page's refresh is only the fallback. */
  retry?: Partial<Record<keyof OverviewData, () => void>>;
  /** The signed-in person's name, for the receipt of a month they close. */
  closer?: string;
  /** The view a phone shows; without `onPhoneView` there is no switch and nothing is put away. */
  phoneView?: PhoneView;
  onPhoneView?: (v: PhoneView) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  /** A block that has no data: still loading, or failed in words with a Try again that repeats only its own read. */
  const missing = (block: keyof OverviewData, what: string, className?: string, skeleton?: ReactNode) =>
    loading?.[block] ? (
      <DataState kind="loading" message={t('state.loading', { what })} className={className}>
        {skeleton}
      </DataState>
    ) : (
      <DataState
        kind="failed"
        message={t('state.failed', { what })}
        onRetry={retryBlock?.[block] ?? (() => router.refresh())}
        retryLabel={t('common.tryAgain')}
        className={className}
      />
    );
  const rows = data.period && data.closed ? monthRows(data.period, data.closed, monthStart(today)) : null;
  const flags = data.health ? attention(data.health, lateCount(data.closed, ask.from, ask.to)) : null;
  // the Payments stamp: the day behind the figures, said as "not refreshed since" once it is more than two days old
  const stamp = data.asOf ? stampOf(data.asOf, today) : null;
  /** Income by company is a part of the ledger: a phone opens that view first, then the browser is taken to it. */
  const toCompany = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    onPhoneView?.('ledger');
    requestAnimationFrame(() =>
      (document.getElementById('finance-company') ?? document.getElementById('finance-ledger'))?.scrollIntoView({
        block: 'start',
      }),
    );
  };
  // Nothing imported from Payments yet and nothing in the period (V622): the page is one clear note under the period and
  // the stamp — no tiles of zeros, no months of dashes. A read that failed is never this — it says which read failed.
  // An empty period after imports exist is a different thing (F173): the Overview shows its zero tiles and says the
  // period has nothing — never the import prompt.
  const neverImported =
    !!data.asOf &&
    !data.asOf.as_of &&
    !!data.period &&
    data.period.units === 0 &&
    data.period.revenue === 0 &&
    data.period.cost === 0;
  const periodEmpty =
    !!data.asOf &&
    !!data.asOf.as_of &&
    !!data.period &&
    data.period.units === 0 &&
    data.period.revenue === 0 &&
    data.period.cost === 0;
  const view: PhoneView = phoneView ?? 'months';
  /** On a phone, a block that is not the open view is put away; the DOM keeps it, so nothing is read twice. */
  const away = (v: PhoneView) => (onPhoneView && view !== v ? 'max-sm:hidden' : undefined);
  // the phone's view switch: under the figures, and under the not-imported note too (the ledger view holds Import)
  const viewSwitch = onPhoneView ? (
    <Tabs
      className="sm:hidden"
      label={t('finance.view.label')}
      fill
      value={view}
      onValueChange={(v) => onPhoneView(v as PhoneView)}
      tabs={[
        { value: 'months', label: t('finance.view.months') },
        { value: 'services', label: t('finance.view.services') },
        { value: 'ledger', label: t('finance.view.ledger') },
      ]}
    />
  ) : null;
  return (
    <div className="@container flex flex-col gap-5" data-finance-overview>
      <PageHeader
        title={t('nav.finance')}
        actions={
          // Full on Finance types an invoice here; on a phone the bar's Create already offers it, one main action (V630)
          full ? (
            <Link
              href="/finance/new"
              className={cn(buttonVariants({ variant: 'secondary' }), 'max-sm:hidden')}
              data-new-invoice-link
            >
              <Plus aria-hidden="true" />
              {t('createNew.invoice')}
            </Link>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSwitch ask={ask} />
        {/* Landing 31: the credit limit lives in Settings → Finance; managers and heads change it there, everyone
            else reads it, and Settings is not in their menu — so Finance offers the way in */}
        <Link
          href="/settings/finance"
          className="inline-flex min-h-8 items-center text-sm font-medium text-link underline-offset-2 hover:underline max-sm:min-h-11"
          data-finance-credit-limit-link
        >
          {t('settings.credit.title')}
        </Link>
        {data.asOf === null ? (
          missing('asOf', t('finance.failed.stamp'), 'items-end')
        ) : (
          <span className="flex flex-col items-end gap-0.5">
            {/* a stamp more than two days old is a warning, in words — never shown as if it were current (Landing 34) */}
            <span
              className={cn('font-data text-sm tabular', stamp?.stale ? 'font-medium text-warning' : 'text-muted')}
              data-finance-stamp
              data-stale={stamp?.stale ? '' : undefined}
            >
              {stamp?.day
                ? t(stamp.stale ? 'finance.stampStale' : 'finance.stamp', {
                    date: formatDate(`${stamp.day}T12:00:00Z`, locale),
                  })
                : t('finance.stampNone')}
            </span>
            {/* the stamp is the OLDEST file's day; when another file was read later, that day is said too */}
            {stamp?.newest ? (
              <span className="font-data text-xs text-muted tabular" data-finance-stamp-newest>
                {t('finance.stampNewest', { date: formatDate(`${stamp.newest}T12:00:00Z`, locale) })}
              </span>
            ) : null}
          </span>
        )}
      </div>

      {neverImported ? (
        <div data-finance-not-imported>
          <DataState kind="empty" message={t('finance.notImported')} />
          {viewSwitch ? <div className="mt-5 sm:hidden">{viewSwitch}</div> : null}
        </div>
      ) : (
        <>
          {periodEmpty ? (
            <p className="text-base text-muted" data-finance-period-empty>
              {t('finance.periodEmpty', {
                from: formatDate(`${ask.from}T12:00:00Z`, locale),
                to: formatDate(`${ask.to}T12:00:00Z`, locale),
              })}
            </p>
          ) : null}
          {data.period ? (
            <Tiles period={data.period} />
          ) : (
            missing('period', t('finance.failed.figures'), undefined, <TilesSkeleton />)
          )}

          <div className="flex flex-col gap-1 text-base" data-finance-lines>
            {data.notInvoiced ? (
              // each word and each figure is a part of its own with a gap between them: on a phone the words and
              // the figures ran together ("Ready1·Pending1") — the space no longer depends on how the line breaks
              <p className="flex flex-wrap items-baseline gap-x-1.5" data-finance-not-invoiced>
                <span className="font-medium text-strong">{t('finance.notInvoiced')}</span>{' '}
                <span className="text-muted">{t('finance.ready')}</span>{' '}
                <b className="font-data tabular">{data.notInvoiced.ready.units}</b>{' '}
                <span className="text-muted" aria-hidden="true">
                  ·
                </span>{' '}
                <span className="text-muted">{t('finance.pending')}</span>{' '}
                <b className="font-data tabular">{data.notInvoiced.pending.units}</b>
              </p>
            ) : (
              missing('notInvoiced', t('finance.failed.invoiced'))
            )}
            <p className="text-sm text-muted" data-finance-commissions>
              {t('finance.commissions')}
            </p>
          </div>

          {flags ? (
            <section
              aria-label={t('finance.attention.title')}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-raised px-4 py-3 max-sm:pe-20 shadow-1 sm:px-5"
              data-finance-attention
            >
              <h2 className="font-ui text-sm font-semibold text-strong">{t('finance.attention.title')}</h2>
              <AttentionChip kind="checks" count={flags.checks} label={t('finance.attention.checks')} />
              <AttentionChip kind="no-client" count={flags.noClient} label={t('finance.attention.noClient')} />
              <AttentionChip kind="late" count={flags.late} label={t('finance.attention.late')} />
            </section>
          ) : data.health ? null : (
            missing('health', t('finance.failed.health'))
          )}

          {viewSwitch}

          <div className="grid items-start gap-5 @min-[1040px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className={cn('min-w-0', away('months'))}>
              {rows && data.period ? (
                <Months rows={rows} period={data.period} ask={ask} full={full} today={today} closer={closer} />
              ) : (
                missing(data.period ? 'closed' : 'period', t('finance.failed.months'))
              )}
            </div>
            <div className={cn('min-w-0', away('services'))}>
              {data.service ? (
                <ByService service={data.service} onCompany={toCompany} />
              ) : (
                missing('service', t('finance.failed.service'))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PeriodSwitch({ ask }: { ask: PeriodAsk }) {
  const t = useTranslations();
  const keys: PeriodKey[] = ['mtd', 'qtd', 'ytd', 'custom'];
  const [from, setFrom] = useState(ask.from);
  const [to, setTo] = useState(ask.to);
  // The boxes follow the address (F171): opening a saved view changes `ask`, and the boxes must show the view's
  // dates, not the ones typed before it. Same render-phase sync as the task list (FIX-34 R2a).
  const [seenFrom, setSeenFrom] = useState(ask.from);
  if (ask.from !== seenFrom) {
    setSeenFrom(ask.from);
    setFrom(ask.from);
  }
  const [seenTo, setSeenTo] = useState(ask.to);
  if (ask.to !== seenTo) {
    setSeenTo(ask.to);
    setTo(ask.to);
  }
  const router = useRouter();
  const [wrong, setWrong] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2" data-finance-period>
      {/* the period as pill tabs on a soft track (V21); a tab never breaks inside its word (the Arabic "Custom" read
          مخص/ص on a phone); a track wider than the screen scrolls inside itself instead of wrapping */}
      <nav
        aria-label={t('finance.period.label')}
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-pill bg-surface p-1 [scrollbar-width:none]"
      >
        {keys.map((k) => (
          <Link
            key={k}
            prefetch={false}
            href={k === 'custom' ? `/finance?period=custom&from=${ask.from}&to=${ask.to}` : `/finance?period=${k}`}
            aria-current={ask.key === k ? 'page' : undefined}
            data-finance-period-key={k}
            className={cn(
              'inline-flex h-9 max-sm:h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-pill px-4 text-base font-medium leading-5 transition-[background-color,color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
              ask.key === k ? 'bg-raised font-semibold text-strong shadow-tab' : 'text-muted hover:text-strong',
            )}
          >
            {t(`finance.period.${k}`)}
          </Link>
        ))}
      </nav>
      {ask.key === 'custom' ? (
        // From and To are named on screen (two bare boxes said nothing on a phone); two days that are not a period —
        // half typed, or the first after the second — are said so in place, instead of silently becoming the year
        <form
          className="flex flex-wrap items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isDay(from) || !isDay(to) || from > to) {
              setWrong(true);
              return;
            }
            router.push(`/finance?period=custom&from=${from}&to=${to}`);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="finance-from" className="text-sm font-medium text-strong">
              {t('finance.period.from')}
            </label>
            <DatePicker
              id="finance-from"
              value={from || undefined}
              onChange={(v) => {
                setFrom(v ?? '');
                setWrong(false);
              }}
              onClear={() => router.push('/finance?period=ytd')}
              chips="none"
              invalid={wrong || undefined}
              describedBy={wrong ? 'finance-period-wrong' : undefined}
              className="w-[10.5rem]"
              inputProps={{ 'data-finance-from': '' }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="finance-to" className="text-sm font-medium text-strong">
              {t('finance.period.to')}
            </label>
            <DatePicker
              id="finance-to"
              value={to || undefined}
              onChange={(v) => {
                setTo(v ?? '');
                setWrong(false);
              }}
              onClear={() => router.push('/finance?period=ytd')}
              chips="none"
              invalid={wrong || undefined}
              describedBy={wrong ? 'finance-period-wrong' : undefined}
              className="w-[10.5rem]"
              inputProps={{ 'data-finance-to': '' }}
            />
          </div>
          <Button type="submit" variant="secondary" className="mt-[1.5rem]" data-finance-apply>
            {t('finance.period.apply')}
          </Button>
          {wrong ? (
            <p id="finance-period-wrong" role="alert" className="basis-full text-sm text-danger">
              {t('finance.period.invalid')}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

/**
 * The figure cards (V21, the finalisation board): Revenue, Cost and Profit as recorded here, then Provisional — the
 * revenue of the rows whose cost is not known yet, which Profit leaves out. Two to a row on a phone and in a narrow
 * place, four across where the page is wide enough.
 *
 * Landing 34: there is ONE Provisional amount on the page — `provisional.revenue`, the revenue of the rows whose cost
 * is not known yet — and every card names that same amount: Revenue holds it ("of which Provisional"), Cost and
 * Profit leave it out ("not counting Provisional"). Before, Cost read `provisional.cost` (always empty, so a dash) and
 * Profit read `provisional.profit`, which leaves the imported rows out (their profit is empty with their cost) — so the
 * same page said 4,200, a dash and 3,500 for one thing. A provisional row has no cost and so no profit: neither is
 * printed as a figure.
 */
function Tiles({ period }: { period: Period }) {
  const t = useTranslations();
  const p = period.provisional;
  return (
    <div className="grid grid-cols-2 gap-3 @min-[880px]:grid-cols-4 sm:gap-4" data-finance-tiles>
      <FigureTile
        kind="revenue"
        label={t('finance.tile.revenueHere')}
        icon={<Banknote />}
        tone="success"
        value={period.revenue}
        provisional={p.revenue}
        units={p.units}
      />
      <FigureTile
        kind="cost"
        label={t('finance.tile.costHere')}
        icon={<Receipt />}
        value={period.cost}
        provisional={p.revenue}
        units={p.units}
        left
      />
      <FigureTile
        kind="profit"
        label={t('finance.tile.profitHere')}
        icon={<TrendingUp />}
        tone={period.profit < 0 ? 'danger' : undefined}
        value={period.profit}
        provisional={p.revenue}
        units={p.units}
        left
      />
      <FigureTile
        kind="provisional"
        label={t('finance.tile.provisional')}
        icon={<Hourglass />}
        value={p.revenue}
        note={t('finance.tile.provisionalNote', { count: p.units })}
      />
    </div>
  );
}

/**
 * One card: the kit's KPI card, the figure (short where it has a short form, then its exact riyals under it), and the
 * Provisional part directly under the figure. Revenue is the one green figure; a loss is red; the rest stay neutral.
 * The figure is handed to the card inside its own marked span — the walk reads the figure and where it sits by that
 * mark — so the card's `value` (typed as words) is given an element here.
 */
function FigureTile({
  kind,
  label,
  icon,
  tone,
  value,
  provisional,
  units,
  left,
  note,
}: {
  kind: string;
  label: string;
  icon: ReactNode;
  tone?: 'success' | 'danger';
  value: number;
  /** The Provisional amount: the revenue of the rows whose cost is not known yet. Empty (null) is shown empty, never 0. */
  provisional?: number | null;
  units?: number;
  /** True on Cost and Profit: the figure leaves the Provisional amount out, where Revenue holds it. */
  left?: boolean;
  /** The Provisional card's one line, in place of a Provisional part. */
  note?: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const exact = formatMoney(value, locale);
  // the short form's K and M are words of the screen's language (1.5K; in Arabic 1.5 ألف), never Latin letters there
  const parts = /^(-?[\d.]+)([KM])$/.exec(shortForm(value) ?? '');
  const short = parts
    ? t(parts[2] === 'K' ? 'finance.short.thousands' : 'finance.short.millions', { n: parts[1] ?? '' })
    : null;
  const figure = <span data-finance-figure>{short ?? exact}</span>;
  return (
    <div className="grid min-w-0" data-finance-tile={kind}>
      <KpiTile
        // two lines where the card is narrow (a phone holds two cards to a row), never cut off
        label={<span className="block whitespace-normal break-words">{label}</span>}
        icon={icon}
        tone={tone}
        value={figure}
        unit={t('finance.sar')}
        footnote={
          <span className="flex flex-col gap-0.5">
            {short ? (
              <span className="font-data tabular" data-finance-exact>
                {exact} {t('finance.sar')}
              </span>
            ) : null}
            {note ? (
              <span className="text-warning" data-finance-note>
                {note}
              </span>
            ) : (
              // words, amount, dot and rows are parts of their own with a gap between them (Landing 34): on a phone
              // they ran together ("Provisional4,200·3 units") where the line broke inside the card
              <span className="flex flex-wrap items-baseline gap-x-1 text-sm" data-finance-provisional>
                <span className="font-medium text-warning">
                  {t(left ? 'finance.provisionalLeft' : 'finance.provisional')}
                </span>{' '}
                <b className="font-data text-text tabular" data-finance-provisional-amount>
                  {provisional === null || provisional === undefined
                    ? t('finance.months.none')
                    : formatMoney(provisional, locale)}
                </b>{' '}
                <span className="text-muted" aria-hidden="true">
                  ·
                </span>{' '}
                <span className="text-muted">{t('finance.provisionalUnits', { count: units ?? 0 })}</span>
              </span>
            )}
          </span>
        }
      />
    </div>
  );
}

/** One count of the strip; a count that could not be read is a dash, never a 0 (M27, M53). */
function AttentionChip({ kind, count, label }: { kind: string; count: number | null; label: string }) {
  const quiet = count === null || count === 0;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-base"
      data-finance-flag={kind}
      data-count={count === null ? 'unknown' : count}
    >
      <b className={cn('font-data tabular', quiet ? 'text-muted' : 'text-strong')}>{count === null ? '—' : count}</b>
      <span className={cn(quiet && 'text-muted')}>{label}</span>
    </span>
  );
}

/** The months' columns where the card is wide enough for a table; narrower, each month is a card of its own. */
const MONTH_COLS = '@min-[600px]:grid @min-[600px]:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1.4fr] @min-[600px]:gap-3';

function Months({
  rows,
  period,
  ask,
  full,
  today,
  closer,
}: {
  rows: MonthRow[];
  period: Period;
  ask: PeriodAsk;
  full: boolean;
  today: string;
  closer?: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [closing, setClosing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // the month just closed, for its receipt: what the page knew when the close was confirmed
  const [receipt, setReceipt] = useState<Closed | null>(null);
  const gap = monthsGap(period);
  const money = (n: number) => formatMoney(n, locale);
  const closingRow = closing ? rows.find((r) => r.month === closing) : undefined;
  const close = async (month: string) => {
    setBusy(true);
    try {
      const answer = (await rpc('finance_month_close', { p_month: month } as never)) as { units?: unknown } | null;
      const f = rows.find((r) => r.month === month)?.figures ?? null;
      setReceipt({
        month,
        monthLabel: monthName(month, locale),
        by: closer,
        on: today,
        units: typeof answer?.units === 'number' ? answer.units : null,
        figures: f ? { revenue: f.revenue, cost: f.cost, profit: f.profit } : null,
      });
      setClosing(null);
      // the one action here with no Undo (V620): a closed month is never reopened
      toast.done(t('finance.close.done', { month: monthName(month, locale) }));
      refetchAll();
    } catch (e) {
      setClosing(null);
      const { key, detail } = errorKey(e, (k) => t.has(k));
      toast.failed(t(key, { detail }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FinanceCard id="finance-months" title={t('finance.months.title')} source={t('finance.here')} data-finance-months>
      {receipt ? <CloseReceipt closed={receipt} onDone={() => setReceipt(null)} /> : null}
      <div>
        <div
          className={cn(
            'hidden border-y border-border bg-surface px-4 py-2.5 text-xs font-semibold leading-4 text-muted sm:px-5',
            MONTH_COLS,
          )}
          aria-hidden="true"
        >
          <span>{t('finance.months.month')}</span>
          <span className="text-end">{t('finance.months.revenue')}</span>
          <span className="text-end">{t('finance.months.cost')}</span>
          <span className="text-end">{t('finance.months.profit')}</span>
          <span className="text-end">{t('finance.months.provisional')}</span>
          <span className="text-end">{t('finance.months.state')}</span>
        </div>
        <ul className="flex flex-col border-t border-border @min-[600px]:border-t-0">
          {rows.map((r) => (
            <Fragment key={r.month}>
              <MonthItem row={r} full={full} onClose={() => setClosing(r.month)} />
              {r.figures && r.figures.provisional_units > 0 ? <ProvisionalMonthItem row={r} /> : null}
            </Fragment>
          ))}
        </ul>
        <div
          className="flex flex-col gap-1 border-t border-border bg-surface px-4 py-3 text-sm font-semibold text-strong sm:px-5"
          data-finance-total
        >
          <div className={cn('grid grid-cols-2 gap-3', MONTH_COLS)}>
            <span>{t(`finance.period.total.${ask.key}`)}</span>
            <span className="hidden text-end font-data tabular @min-[600px]:block">{money(period.revenue)}</span>
            <span className="hidden text-end font-data tabular @min-[600px]:block">{money(period.cost)}</span>
            <span className="hidden text-end font-data tabular @min-[600px]:block">{money(period.profit)}</span>
            {/* the same Provisional amount as the card above: the revenue of the rows whose cost is not known yet */}
            <span className="hidden text-end font-data tabular @min-[600px]:block" data-finance-total-provisional>
              {money(period.provisional.revenue)}
            </span>
            <span className="text-end font-data tabular @min-[600px]:hidden">
              {money(period.revenue)} · {money(period.profit)}
            </span>
          </div>
          {Math.abs(gap) >= 1 ? (
            <span className="text-xs font-normal text-warning" data-finance-gap>
              {t('finance.months.gap', { amount: money(gap) })}
            </span>
          ) : null}
        </div>
      </div>
      {/* Close month asks first (the 12 Nov board): one confirming button and Cancel; no second approver today */}
      <Confirm
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={t('finance.close.title', { month: closing ? monthName(closing, locale) : '' })}
        body={t('finance.close.body')}
        extra={
          closingRow?.figures && closingRow.figures.provisional_units > 0 ? (
            <p
              className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-base text-warning"
              data-finance-close-warning
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t('finance.close.warn', { count: closingRow.figures.provisional_units })}
            </p>
          ) : undefined
        }
        cancelLabel={t('common.cancel')}
        confirmLabel={t('finance.months.close')}
        destructive={false}
        busy={busy}
        onConfirm={() => (closing ? close(closing) : undefined)}
      />
    </FinanceCard>
  );
}

function MonthItem({ row, full, onClose }: { row: MonthRow; full: boolean; onClose: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const f = row.figures;
  const money = (n: number | undefined) => (f && n !== undefined ? formatMoney(n, locale) : t('finance.months.none'));
  const late = row.late.length;
  return (
    <li
      className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 max-sm:pe-20 sm:px-5"
      data-finance-month={row.month}
      data-state={row.state}
    >
      <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-2', MONTH_COLS)}>
        <span className="order-1 font-medium text-strong @min-[600px]:order-none">{monthName(row.month, locale)}</span>
        <Figure className="hidden @min-[600px]:block" label={t('finance.months.revenue')} value={money(f?.revenue)} />
        <Figure className="hidden @min-[600px]:block" label={t('finance.months.cost')} value={money(f?.cost)} />
        <Figure className="hidden @min-[600px]:block" label={t('finance.months.profit')} value={money(f?.profit)} />
        <Figure
          className="hidden @min-[600px]:block"
          label={t('finance.months.provisional')}
          value={money(f?.provisional_revenue)}
        />
        <div className="order-2 ms-auto flex flex-wrap items-center justify-end gap-2 @min-[600px]:order-none @min-[600px]:ms-0">
          <MonthChips row={row} full={full} onClose={onClose} />
        </div>
        <div className="order-3 grid basis-full grid-cols-3 gap-3 @min-[600px]:hidden" data-finance-month-card>
          <Figure label={t('finance.months.revenue')} value={money(f?.revenue)} stacked />
          <Figure label={t('finance.months.profit')} value={money(f?.profit)} stacked />
          <Figure label={t('finance.months.provisional')} value={money(f?.provisional_revenue)} stacked />
        </div>
      </div>
      {late > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            data-finance-late-toggle={row.month}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-pill bg-warning-soft px-3 text-xs font-semibold text-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:min-h-6 sm:h-6"
          >
            {t('finance.months.lateChanges', { count: late })}
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </button>
          {open ? <AfterClose lines={row.late} /> : null}
        </>
      ) : null}
    </li>
  );
}

function Figure({
  label,
  value,
  className,
  stacked,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  stacked?: boolean;
}) {
  return (
    <span className={cn(stacked ? 'flex min-w-0 flex-col gap-0.5' : 'text-end', className)}>
      {stacked ? <span className="text-xs text-muted">{label}</span> : null}
      <span className="font-data text-sm tabular">{value}</span>
    </span>
  );
}

/**
 * The Provisional row under a month with cost-provisional units: their revenue apart, the cost empty, never 0
 * (rulebook §16) — and the profit empty with it (Landing 34: a row with no cost has no profit; the read's
 * `provisional_profit` also leaves the imported rows out, so it never agreed with the revenue beside it). The month's
 * own row keeps the clean totals, so the two rows never double-count.
 */
function ProvisionalMonthItem({ row }: { row: MonthRow }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const f = row.figures;
  if (!f) return null;
  const none = t('finance.months.none');
  return (
    <li
      className="flex flex-col gap-2 border-b border-border bg-surface px-4 py-3 last:border-b-0 max-sm:pe-20 sm:px-5"
      data-finance-month-provisional={row.month}
    >
      <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-2', MONTH_COLS)}>
        <span className="order-1 font-medium text-warning @min-[600px]:order-none">
          {t('finance.months.provisionalRow')}
        </span>
        <Figure
          className="hidden @min-[600px]:block"
          label={t('finance.months.revenue')}
          value={formatMoney(f.provisional_revenue, locale)}
        />
        <Figure className="hidden @min-[600px]:block" label={t('finance.months.cost')} value={none} />
        <Figure className="hidden @min-[600px]:block" label={t('finance.months.profit')} value={none} />
        <Figure className="hidden @min-[600px]:block" label={t('finance.months.provisional')} value={none} />
        <span aria-hidden="true" className="hidden @min-[600px]:block" />
        <div className="order-3 grid basis-full grid-cols-3 gap-3 @min-[600px]:hidden" data-finance-month-card>
          <Figure label={t('finance.months.revenue')} value={formatMoney(f.provisional_revenue, locale)} stacked />
          <Figure label={t('finance.months.profit')} value={none} stacked />
          <Figure label={t('finance.months.provisional')} value={none} stacked />
        </div>
      </div>
    </li>
  );
}

function MonthChips({ row, full, onClose }: { row: MonthRow; full: boolean; onClose: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  if (row.state === 'closed' && row.closed)
    return (
      <StatusChip tone="success">
        {t('finance.months.closed', {
          date: formatDate(`${row.closed.closed_on}T12:00:00Z`, locale, { day: 'numeric', month: 'short' }),
        })}
      </StatusChip>
    );
  if (row.state === 'open') return <StatusChip tone="info">{t('finance.months.open')}</StatusChip>;
  return full ? (
    <Button size="sm" variant="secondary" onClick={onClose} data-close-month={row.month}>
      {t('finance.months.close')}
    </Button>
  ) : (
    <StatusChip tone="neutral">{t('finance.months.notClosed')}</StatusChip>
  );
}

/** A signed riyal amount: + for what a late change added, − for what it took away. */
const signed = (n: number, locale: Locale) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatMoney(Math.abs(n), locale)}`;

/** After close: what happened to a closed month later, one dated line each; the month's own figures never move (V620). */
function AfterClose({ lines }: { lines: LateChange[] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface px-3 py-2.5" data-finance-after-close>
      <h3 className="text-xs font-semibold text-muted">{t('finance.months.afterClose')}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {lines.map((l) => {
          const { main, other } = lateParts(l);
          return (
            <li
              key={`${l.invoice_id}-${l.change}`}
              className="flex flex-wrap items-baseline justify-between gap-x-3"
              data-finance-late-line={l.change}
            >
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span>{t(`finance.late.${l.change}`)}</span>
                <span className="font-data tabular">{l.ref}</span>
                <span className="text-muted">
                  {l.changed_on
                    ? formatDate(`${l.changed_on}T12:00:00Z`, locale, { day: 'numeric', month: 'short' })
                    : ''}
                </span>
              </span>
              <span className="flex flex-wrap items-baseline gap-x-3 font-data tabular">
                <span data-finance-late-main>{signed(main, locale)}</span>
                {other ? (
                  <span data-finance-late-other={other.of}>
                    <span className="font-ui text-xs text-muted">{t(`finance.months.${other.of}`)}</span>{' '}
                    {signed(other.amount, locale)}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ByService({
  service,
  onCompany,
}: {
  service: IncomeByService;
  /** Takes the person to Income by company, in the ledger below. */
  onCompany?: (e: { preventDefault: () => void }) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const top = Math.max(1, ...service.rows.map((r) => Math.abs(r.revenue)));
  const gap = Math.round(service.gap * 100) / 100;
  return (
    <FinanceCard
      id="finance-service"
      title={t('finance.service.title')}
      source={t('finance.here')}
      action={
        onCompany ? (
          <a
            href="#finance-company"
            onClick={onCompany}
            className="inline-flex min-h-8 items-center text-sm font-medium text-link underline-offset-2 hover:underline max-sm:min-h-11"
            data-finance-company-link
          >
            {t('finance.ledger.byCompany')}
          </a>
        ) : undefined
      }
      data-finance-service
    >
      <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
        {service.rows.length === 0 && Math.abs(gap) < 1 ? (
          <p className="text-base text-muted" data-finance-service-empty>
            {t('finance.service.empty')}
          </p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {service.rows.map((r, i) => (
            <li
              key={`${r.part}-${r.service_id ?? i}`}
              className="flex flex-col gap-1.5"
              data-finance-service-row={r.part}
            >
              <div className="flex items-baseline justify-between gap-3 text-base">
                <span className="min-w-0 break-words">
                  {r.part === 'service'
                    ? locale === 'ar' && r.name_ar
                      ? r.name_ar
                      : r.name_en
                    : t(`finance.service.${r.part}`)}
                </span>
                <span className="font-data text-sm tabular">{formatMoney(r.revenue, locale)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-pill bg-pressed" aria-hidden="true">
                <i
                  className="block h-full rounded-pill bg-muted"
                  style={{ width: `${Math.max(0, (Math.abs(r.revenue) / top) * 100)}%` }}
                />
              </div>
            </li>
          ))}
          {Math.abs(gap) >= 1 ? (
            <li className="flex items-baseline justify-between gap-3 text-base text-warning" data-finance-service-gap>
              <span>{t('finance.service.gap')}</span>
              <span className="font-data text-sm tabular">{formatMoney(gap, locale)}</span>
            </li>
          ) : null}
        </ul>
      </div>
    </FinanceCard>
  );
}
