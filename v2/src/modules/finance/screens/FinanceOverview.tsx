'use client';
import { ChevronDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { refetchAll } from '@/core/commands/refetch';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { formatDate, formatMoney } from '@/core/i18n/format';
import { Button, buttonVariants } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { Confirm } from '@/ui/Confirm';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { toast } from '@/ui/Toast';
import { attention, lateCount, lateParts, monthRows, monthsGap, shortForm, type MonthRow } from '../figures';
import type { PeriodAsk, PeriodKey } from '../period';
import { monthStart } from '../period';
import type { IncomeByService, LateChange, OverviewData, Period } from '../types';

type Locale = 'en' | 'ar';

/** A month start as "September 2026" (Riyadh calendar, Latin digits) — never "1 Sep 2026". */
const monthName = (m: string, locale: Locale) =>
  formatDate(`${m}T12:00:00Z`, locale, { day: undefined, month: 'long', year: 'numeric' });

/**
 * The Finance Overview, as drawn (GC-5): the period's three tiles each with the Provisional part directly under the
 * figure (V611), one line of what is not yet invoiced (V424), the commissions sentence (V612), Needs attention, the
 * months newest first with their close and what changed after it (V620), and income by service. A part that failed to
 * read says which one, with Try again — never a 0 (M27, M53).
 */
export function FinanceOverview({
  ask,
  today,
  full,
  data,
  loading,
  retry: retryBlock,
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
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  /** A block that has no data: still loading, or failed in words with a Try again that repeats only its own read. */
  const missing = (block: keyof OverviewData, what: string, className?: string) =>
    loading?.[block] ? (
      <DataState kind="loading" message={t('state.loading', { what })} className={className} />
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
  const asOf = data.asOf ? data.asOf.as_of : undefined;
  // Nothing imported from Payments yet and nothing in the period (V622): the page is one clear note under the period and
  // the stamp — no tiles of zeros, no months of dashes. A read that failed is never this — it says which read failed.
  const notImported =
    !!data.asOf &&
    !data.asOf.as_of &&
    !!data.period &&
    data.period.units === 0 &&
    data.period.revenue === 0 &&
    data.period.cost === 0;
  return (
    <div className="flex flex-col gap-5" data-finance-overview>
      <PageHeader
        title={t('nav.finance')}
        actions={
          // Full on Finance types an invoice here; on a phone the floating + already offers it, one main action (V630)
          full ? (
            <Link
              href="/finance/new"
              className={cn(buttonVariants({ variant: 'primary' }), 'max-sm:hidden')}
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
        {data.asOf === null ? (
          missing('asOf', t('finance.failed.stamp'), 'items-end')
        ) : (
          <span className="font-data text-sm text-muted tabular" data-finance-stamp>
            {asOf ? t('finance.stamp', { date: formatDate(`${asOf}T12:00:00Z`, locale) }) : t('finance.stampNone')}
          </span>
        )}
      </div>

      {notImported ? (
        <div data-finance-not-imported>
          <DataState kind="empty" message={t('finance.notImported')} />
        </div>
      ) : (
        <>
          {data.period ? <Tiles period={data.period} /> : missing('period', t('finance.failed.figures'))}

          <div className="flex flex-col gap-1 text-sm" data-finance-lines>
            {data.notInvoiced ? (
              <p data-finance-not-invoiced>
                <span className="font-medium">{t('finance.notInvoiced')}</span>{' '}
                <span className="text-muted">{t('finance.ready')}</span>{' '}
                <b className="font-data tabular">{data.notInvoiced.ready.units}</b>
                <span className="text-muted"> · {t('finance.pending')} </span>
                <b className="font-data tabular">{data.notInvoiced.pending.units}</b>
              </p>
            ) : (
              missing('notInvoiced', t('finance.failed.invoiced'))
            )}
            <p className="text-xs text-muted" data-finance-commissions>
              {t('finance.commissions')}
            </p>
          </div>

          {flags ? (
            <section
              aria-label={t('finance.attention.title')}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-raised px-4 py-3 max-sm:mb-16 max-sm:pe-20"
              data-finance-attention
            >
              <h2 className="font-ui text-xs font-semibold uppercase tracking-wide text-muted">
                {t('finance.attention.title')}
              </h2>
              <AttentionChip kind="checks" count={flags.checks} label={t('finance.attention.checks')} />
              <AttentionChip kind="no-client" count={flags.noClient} label={t('finance.attention.noClient')} />
              <AttentionChip kind="late" count={flags.late} label={t('finance.attention.late')} />
            </section>
          ) : data.health ? null : (
            missing('health', t('finance.failed.health'))
          )}

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            {rows && data.period ? (
              <Months rows={rows} period={data.period} ask={ask} full={full} />
            ) : (
              missing(data.period ? 'closed' : 'period', t('finance.failed.months'))
            )}
            {data.service ? <ByService service={data.service} /> : missing('service', t('finance.failed.service'))}
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
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2" data-finance-period>
      <nav
        aria-label={t('finance.period.label')}
        className="inline-flex overflow-hidden rounded-md border border-border-strong bg-raised"
      >
        {keys.map((k) => (
          <Link
            key={k}
            prefetch={false}
            href={k === 'custom' ? `/finance?period=custom&from=${ask.from}&to=${ask.to}` : `/finance?period=${k}`}
            aria-current={ask.key === k ? 'page' : undefined}
            data-finance-period-key={k}
            className={cn(
              'inline-flex h-[var(--control-h)] items-center px-3.5 text-base font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
              ask.key === k ? 'bg-text text-raised' : 'text-text hover:bg-surface',
            )}
          >
            {t(`finance.period.${k}`)}
          </Link>
        ))}
      </nav>
      {ask.key === 'custom' ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/finance?period=custom&from=${from}&to=${to}`);
          }}
        >
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label={t('finance.period.from')}
            className="w-[10.5rem]"
            data-finance-from
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label={t('finance.period.to')}
            className="w-[10.5rem]"
            data-finance-to
          />
          <Button type="submit" variant="secondary" data-finance-apply>
            {t('finance.period.apply')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function Tiles({ period }: { period: Period }) {
  const t = useTranslations();
  const p = period.provisional;
  return (
    <div className="grid gap-3 lg:grid-cols-3" data-finance-tiles>
      <FigureTile
        kind="revenue"
        label={t('finance.tile.revenue')}
        value={period.revenue}
        provisional={p.revenue}
        units={p.units}
      />
      <FigureTile kind="cost" label={t('finance.tile.cost')} value={period.cost} provisional={p.cost} units={p.units} />
      <FigureTile
        kind="profit"
        label={t('finance.tile.profit')}
        value={period.profit}
        provisional={p.profit}
        units={p.units}
      />
    </div>
  );
}

/** One tile: the figure (short where it has a short form, then its exact riyals), and the Provisional part directly under it. */
function FigureTile({
  kind,
  label,
  value,
  provisional,
  units,
}: {
  kind: string;
  label: string;
  value: number;
  provisional: number;
  units: number;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const exact = formatMoney(value, locale);
  const short = shortForm(value);
  return (
    <div
      className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-raised px-4 py-3.5 shadow-1"
      data-finance-tile={kind}
    >
      <span className="text-sm text-muted">{label}</span>
      <div className="font-display text-3xl font-semibold leading-[1.1] tracking-[-.01em] tabular" data-finance-figure>
        {short ?? exact}
        <small className="ms-1.5 text-sm font-medium text-muted">{t('finance.sar')}</small>
      </div>
      {short ? (
        <span className="font-data text-sm text-muted tabular" data-finance-exact>
          {exact} {t('finance.sar')}
        </span>
      ) : null}
      <span className="text-sm" data-finance-provisional>
        <span className="font-medium text-warning">{t('finance.provisional')}</span>{' '}
        <b className="font-data tabular">{formatMoney(provisional, locale)}</b>
        <span className="text-muted"> · {t('finance.provisionalUnits', { count: units })}</span>
      </span>
    </div>
  );
}

/** One count of the strip; a count that could not be read is a dash, never a 0 (M27, M53). */
function AttentionChip({ kind, count, label }: { kind: string; count: number | null; label: string }) {
  const quiet = count === null || count === 0;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm"
      data-finance-flag={kind}
      data-count={count === null ? 'unknown' : count}
    >
      <b className={cn('font-data tabular', quiet && 'text-muted')}>{count === null ? '—' : count}</b>
      <span className={cn(quiet && 'text-muted')}>{label}</span>
    </span>
  );
}

function Months({ rows, period, ask, full }: { rows: MonthRow[]; period: Period; ask: PeriodAsk; full: boolean }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [closing, setClosing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const gap = monthsGap(period);
  const money = (n: number) => formatMoney(n, locale);
  const close = async (month: string) => {
    setBusy(true);
    try {
      await rpc('finance_month_close', { p_month: month } as never);
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
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="finance-months" data-finance-months>
      <h2 id="finance-months" className="font-display text-lg font-semibold">
        {t('finance.months.title')}
      </h2>
      <div className="overflow-hidden rounded-lg border border-border bg-raised">
        <div
          className="hidden grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1.5fr] gap-3 border-b border-border bg-surface px-4 py-2 text-xs font-semibold text-muted sm:grid"
          aria-hidden="true"
        >
          <span>{t('finance.months.month')}</span>
          <span className="text-end">{t('finance.months.revenue')}</span>
          <span className="text-end">{t('finance.months.cost')}</span>
          <span className="text-end">{t('finance.months.profit')}</span>
          <span className="text-end">{t('finance.months.provisional')}</span>
          <span />
        </div>
        <ul className="flex flex-col">
          {rows.map((r) => (
            <MonthItem key={r.month} row={r} full={full} onClose={() => setClosing(r.month)} />
          ))}
        </ul>
        <div
          className="flex flex-col gap-1 border-t border-border bg-surface px-4 py-2.5 text-sm font-semibold"
          data-finance-total
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1.5fr]">
            <span>{t(`finance.period.total.${ask.key}`)}</span>
            <span className="text-end font-data tabular max-sm:hidden">{money(period.revenue)}</span>
            <span className="text-end font-data tabular max-sm:hidden">{money(period.cost)}</span>
            <span className="text-end font-data tabular max-sm:hidden">{money(period.profit)}</span>
            <span className="text-end font-data tabular max-sm:hidden">{money(period.provisional.profit)}</span>
            <span className="sm:hidden text-end font-data tabular">
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
      <Confirm
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={t('finance.close.title', { month: closing ? monthName(closing, locale) : '' })}
        body={t('finance.close.body')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('finance.months.close')}
        destructive={false}
        busy={busy}
        onConfirm={() => (closing ? close(closing) : undefined)}
      />
    </section>
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
      className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 max-sm:pe-20"
      data-finance-month={row.month}
      data-state={row.state}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:grid sm:grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1.5fr] sm:gap-3">
        <span className="font-medium max-sm:order-1">{monthName(row.month, locale)}</span>
        <Figure className="max-sm:hidden" label={t('finance.months.revenue')} value={money(f?.revenue)} />
        <Figure className="max-sm:hidden" label={t('finance.months.cost')} value={money(f?.cost)} />
        <Figure className="max-sm:hidden" label={t('finance.months.profit')} value={money(f?.profit)} />
        <Figure
          className="max-sm:hidden"
          label={t('finance.months.provisional')}
          value={money(f?.provisional_profit)}
        />
        <div className="flex flex-wrap items-center gap-2 max-sm:order-2 max-sm:ms-auto">
          <MonthChips row={row} full={full} onClose={onClose} />
        </div>
        <div className="grid basis-full grid-cols-3 gap-3 max-sm:order-3 sm:hidden" data-finance-month-card>
          <Figure label={t('finance.months.revenue')} value={money(f?.revenue)} stacked />
          <Figure label={t('finance.months.profit')} value={money(f?.profit)} stacked />
          <Figure label={t('finance.provisional')} value={money(f?.provisional_profit)} stacked />
        </div>
      </div>
      {late > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            data-finance-late-toggle={row.month}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-pill bg-warning-soft px-3 text-xs font-medium text-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:min-h-6 sm:h-6"
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
    <span className={cn(stacked ? 'flex flex-col gap-0.5' : 'text-end', className)}>
      {stacked ? <span className="text-xs text-muted">{label}</span> : null}
      <span className="font-data text-sm tabular">{value}</span>
    </span>
  );
}

function MonthChips({ row, full, onClose }: { row: MonthRow; full: boolean; onClose: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  if (row.state === 'closed' && row.closed)
    return (
      <StatusChip tone="neutral">
        {t('finance.months.closed', {
          date: formatDate(`${row.closed.closed_on}T12:00:00Z`, locale, { day: 'numeric', month: 'short' }),
        })}
      </StatusChip>
    );
  if (row.state === 'open') return <StatusChip tone="warning">{t('finance.months.open')}</StatusChip>;
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
    <div className="flex flex-col gap-1.5 ps-1" data-finance-after-close>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('finance.months.afterClose')}</h3>
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

function ByService({ service }: { service: IncomeByService }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const top = Math.max(1, ...service.rows.map((r) => Math.abs(r.revenue)));
  const gap = Math.round(service.gap * 100) / 100;
  return (
    <section
      className="flex flex-col gap-2 rounded-lg border border-border bg-raised px-4 py-3.5 shadow-1"
      aria-labelledby="finance-service"
      data-finance-service
    >
      <h2 id="finance-service" className="font-display text-lg font-semibold">
        {t('finance.service.title')}
      </h2>
      {service.rows.length === 0 && Math.abs(gap) < 1 ? (
        <p className="text-sm text-muted" data-finance-service-empty>
          {t('finance.service.empty')}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {service.rows.map((r, i) => (
          <li key={`${r.part}-${r.service_id ?? i}`} className="flex flex-col gap-1" data-finance-service-row={r.part}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                {r.part === 'service'
                  ? locale === 'ar' && r.name_ar
                    ? r.name_ar
                    : r.name_en
                  : t(`finance.service.${r.part}`)}
              </span>
              <span className="font-data tabular">{formatMoney(r.revenue, locale)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-[3px] bg-border" aria-hidden="true">
              <i
                className="block h-full rounded-[3px] bg-muted"
                style={{ width: `${Math.max(0, (Math.abs(r.revenue) / top) * 100)}%` }}
              />
            </div>
          </li>
        ))}
        {Math.abs(gap) >= 1 ? (
          <li className="flex items-baseline justify-between gap-3 text-sm text-warning" data-finance-service-gap>
            <span>{t('finance.service.gap')}</span>
            <span className="font-data tabular">{formatMoney(gap, locale)}</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
