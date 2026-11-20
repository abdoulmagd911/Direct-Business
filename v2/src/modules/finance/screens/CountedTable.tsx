'use client';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate, formatMoney, formatNumber } from '@/core/i18n/format';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import type { CountedByMonth, CountedFigures, CountedMonth } from '../types';
import { useFinanceRead } from '../use-reads';
import { FinanceCard, NUM, TD, TH } from './parts';

type Locale = 'en' | 'ar';

/** The split of what is not counted only has room in a wide card; narrower, it sits under the row's first cell. */
const FROM_860 = 'hidden @min-[860px]:table-cell';

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const FIGURES = [
  'counted_units',
  'counted_revenue',
  'not_counted_units',
  'not_counted_revenue',
  'excluded_units',
  'excluded_revenue',
  'not_paid_units',
  'not_paid_revenue',
  'promo_pool_units',
  'promo_pool_revenue',
] as const satisfies readonly (keyof CountedFigures)[];
const figuresOf = (r: Record<string, unknown>): CountedFigures =>
  Object.fromEntries(FIGURES.map((k) => [k, num(r[k])])) as CountedFigures;

/**
 * api.finance_counted_by_month as the table draws it: months and years as the database answered them — the year
 * rows are the database's own totals, never summed here. Anything that is not such an answer is null (a failed read).
 */
export function countedByMonthOf(answer: unknown): CountedByMonth | null {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null;
  const a = answer as Record<string, unknown>;
  if (!Array.isArray(a.months) || !Array.isArray(a.years)) return null;
  return {
    from: typeof a.from === 'string' ? a.from : '',
    to: typeof a.to === 'string' ? a.to : '',
    months: (a.months as Record<string, unknown>[])
      .filter((m) => typeof m?.month_on === 'string')
      .map((m) => ({ month_on: m.month_on as string, ...figuresOf(m) })),
    years: (a.years as Record<string, unknown>[])
      .filter((y) => Number.isFinite(Number(y?.year)))
      .map((y) => ({ year: Number(y.year), ...figuresOf(y) })),
  };
}

/**
 * "Is it counted?" (Landing 32, A2) for the ledger's own period: one read, in the page's read queue, as a card of
 * its own under the ledger.
 */
export function CountedTable({ from, to, ready }: { from: string; to: string; ready: boolean }) {
  const read = useFinanceRead<unknown, 'finance_counted_by_month'>(
    'finance_counted_by_month',
    { p_from: from, p_to: to },
    `counted|${from}|${to}`,
    ready,
  );
  const data = read.block.status === 'ready' ? countedByMonthOf(read.block.data) : null;
  return (
    <CountedTableView
      data={data}
      loading={read.block.status === 'loading'}
      // an answer that is not the table's shape is a failed read, said so — never an empty table
      failed={read.block.status === 'failed' || (read.block.status === 'ready' && data === null)}
      onRetry={read.retry}
    />
  );
}

/**
 * The table itself: by month, with a total row per year — Counted (rows, revenue), Not counted (rows, revenue), and
 * what is not counted split three ways: Excluded · Not fully paid · Promo pool. Revenue only: there is no cost, no
 * profit and no VAT here. Loading, failed and empty each have their own state, like the page's other cards.
 */
export function CountedTableView({
  data,
  loading,
  failed,
  onRetry,
}: {
  data: CountedByMonth | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const card = (children: React.ReactNode) => (
    <FinanceCard
      id="finance-counted"
      title={t('finance.counted.title')}
      source={t('finance.unified')}
      data-counted-table
    >
      {children}
    </FinanceCard>
  );
  if (loading || failed || !data)
    return card(
      <div className="px-4 pb-4 sm:px-5">
        <DataState
          kind={loading ? 'loading' : 'failed'}
          message={t(loading ? 'state.loading' : 'state.failed', { what: t('finance.counted.failed') })}
          onRetry={loading ? undefined : onRetry}
          retryLabel={loading ? undefined : t('common.tryAgain')}
        />
      </div>,
    );
  if (data.months.length === 0)
    return card(
      <p className="px-4 pb-4 text-base text-muted sm:px-5" data-counted-empty>
        {t('finance.counted.empty')}
      </p>,
    );
  /** One figure pair: the revenue, and the number of rows under it. */
  const pair = (units: number, revenue: number) => (
    <>
      {formatMoney(revenue, locale)}
      <span className="block font-ui text-xs leading-4 text-muted">
        {t('finance.counted.units')} {formatNumber(units, locale)}
      </span>
    </>
  );
  /** The three-way split under the first cell, where the card has no room for its columns. */
  const under = (f: CountedFigures) => (
    <span className="mt-1 flex flex-col gap-0.5 font-ui text-xs leading-4 text-muted @min-[860px]:hidden">
      {(
        [
          ['excluded', f.excluded_units, f.excluded_revenue],
          ['notPaid', f.not_paid_units, f.not_paid_revenue],
          ['promoPool', f.promo_pool_units, f.promo_pool_revenue],
        ] as const
      ).map(([key, units, revenue]) => (
        <span key={key}>
          {t(`finance.counted.${key}`)}{' '}
          <bdi className="font-data tabular">
            {formatMoney(revenue, locale)} ({formatNumber(units, locale)})
          </bdi>
        </span>
      ))}
    </span>
  );
  const cells = (f: CountedFigures) => (
    <>
      <td className={cn(TD, NUM)} data-counted-cell="counted">
        {pair(f.counted_units, f.counted_revenue)}
      </td>
      <td className={cn(TD, NUM)} data-counted-cell="not-counted">
        {pair(f.not_counted_units, f.not_counted_revenue)}
      </td>
      <td className={cn(TD, NUM, FROM_860)} data-counted-cell="excluded">
        {pair(f.excluded_units, f.excluded_revenue)}
      </td>
      <td className={cn(TD, NUM, FROM_860)} data-counted-cell="not-paid">
        {pair(f.not_paid_units, f.not_paid_revenue)}
      </td>
      <td className={cn(TD, NUM, FROM_860)} data-counted-cell="promo-pool">
        {pair(f.promo_pool_units, f.promo_pool_revenue)}
      </td>
    </>
  );
  // "October 2026" — a month on its own is a label, in Latin digits in both languages
  const monthName = (m: string) =>
    formatDate(`${m.slice(0, 7)}-01T12:00:00Z`, locale, { day: undefined, month: 'long', year: 'numeric' });
  const monthRow = (m: CountedMonth) => (
    <tr key={m.month_on} className="border-b border-border" data-counted-month={m.month_on.slice(0, 7)}>
      <td className={TD}>
        <span className="font-medium text-strong">{monthName(m.month_on)}</span>
        {under(m)}
      </td>
      {cells(m)}
    </tr>
  );
  // each year's months, then that year's own total row; a month of a year the answer gave no total for is still listed
  const yearsListed = new Set(data.years.map((y) => String(y.year)));
  const stray = data.months.filter((m) => !yearsListed.has(m.month_on.slice(0, 4)));
  return card(
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-y border-border bg-surface">
          <th className={TH}>{t('finance.counted.month')}</th>
          <th className={cn(TH, 'text-end')}>{t('finance.counted.counted')}</th>
          <th className={cn(TH, 'text-end')}>{t('finance.counted.notCounted')}</th>
          <th className={cn(TH, 'text-end', FROM_860)}>{t('finance.counted.excluded')}</th>
          <th className={cn(TH, 'text-end', FROM_860)}>{t('finance.counted.notPaid')}</th>
          <th className={cn(TH, 'text-end', FROM_860)}>{t('finance.counted.promoPool')}</th>
        </tr>
      </thead>
      <tbody>
        {stray.map(monthRow)}
        {data.years.flatMap((y) => [
          ...data.months.filter((m) => m.month_on.slice(0, 4) === String(y.year)).map(monthRow),
          <tr
            key={`year-${y.year}`}
            className="border-b border-border bg-surface font-semibold last:border-b-0"
            data-counted-year={y.year}
          >
            <td className={TD}>
              <span className="text-strong">{t('finance.counted.yearTotal', { year: String(y.year) })}</span>
              {under(y)}
            </td>
            {cells(y)}
          </tr>,
        ])}
      </tbody>
    </table>,
  );
}
