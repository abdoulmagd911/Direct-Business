'use client';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { formatMoney } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import { DEAL_FILTERS, type DealFilter, type DealType, type DealTypeLine } from '../deal-type';
import type { LedgerRow } from '../types';
import { NUM, TD, TH } from './parts';

type Locale = 'en' | 'ar';

/**
 * The marks a Ledger row says beside its money (Landing 47): its deal type — prepaid, postpaid, tender or promo, or
 * a warning that it is not set (A5); "Paid · receivable" on a counted postpaid row (A12); "Tax invoice issued" when
 * it carries a DPIN (A14); and which commission a hand-typed commission is (A7). A person with Full on Finance gets
 * the control to set the deal type. Marks only: no figure is read or changed here.
 */
export function DealPills({
  row,
  onSet,
}: {
  row: Pick<LedgerRow, 'deal_type' | 'deal_type_by' | 'receivable' | 'tax_invoice_issued' | 'commission_type'>;
  /** Opens the box to set this row's deal type; absent for a reader who may not. */
  onSet?: () => void;
}) {
  const t = useTranslations();
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1" data-ledger-marks>
      {row.deal_type ? (
        <span
          title={row.deal_type_by ? t(`finance.ledger.deal.by.${row.deal_type_by}`) : undefined}
          data-ledger-deal-type={row.deal_type}
          data-ledger-deal-type-by={row.deal_type_by ?? undefined}
        >
          <StatusChip tone="neutral">{t(`finance.ledger.deal.type.${row.deal_type}`)}</StatusChip>
        </span>
      ) : (
        <span data-ledger-deal-type="none">
          <StatusChip tone="warning">{t('finance.ledger.deal.notSet')}</StatusChip>
        </span>
      )}
      {row.receivable ? (
        <span data-ledger-receivable>
          <StatusChip tone="info">{t('finance.ledger.deal.receivable')}</StatusChip>
        </span>
      ) : null}
      {row.tax_invoice_issued ? (
        <span data-ledger-tax-invoice-issued>
          <StatusChip tone="success">{t('finance.ledger.deal.taxIssued')}</StatusChip>
        </span>
      ) : null}
      {row.commission_type ? (
        <span data-ledger-commission-type={row.commission_type}>
          <StatusChip tone="neutral">
            {t('finance.ledger.deal.commission', { type: t(`finance.commissionType.${row.commission_type}`) })}
          </StatusChip>
        </span>
      ) : null}
      {onSet ? (
        <Button variant="ghost" size="xs" className="max-sm:min-h-11" onClick={onSet} data-ledger-set-deal-type>
          {t(row.deal_type ? 'finance.ledger.deal.change' : 'finance.ledger.deal.set')}
        </Button>
      ) : null}
    </span>
  );
}

/** A deal type's name, or "Not set" for the rows nothing settles. */
export function dealName(t: ReturnType<typeof useTranslations>, type: DealType | null): string {
  return type ? t(`finance.ledger.deal.type.${type}`) : t('finance.ledger.deal.type.none');
}

/**
 * "By deal type" (A5): the listed counted rows added up per deal type — the database's own lines, never added up
 * here — and, over them, the filter and the sort for the row list below. A cost that is not known is a dash, never 0.
 * The rows whose deal type is not set are a line and a filter of their own: a missing flag hides nothing.
 */
export function DealTypeTable({
  lines,
  filter,
  onFilter,
  sorted,
  onSort,
  partial,
}: {
  lines: DealTypeLine[];
  filter: DealFilter;
  onFilter: (f: DealFilter) => void;
  sorted: boolean;
  onSort: (on: boolean) => void;
  /** True when the row list was cut: the lines then add up the listed rows only, and say so. */
  partial: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const known = (n: number | null): ReactNode =>
    n === null ? (
      <span className="font-ui text-muted" data-not-known>
        {t('finance.ledger.notKnown')}
      </span>
    ) : (
      formatMoney(n, locale)
    );
  const label = (f: DealFilter) =>
    f === 'all'
      ? t('common.all')
      : f === 'none'
        ? t('finance.ledger.deal.type.none')
        : t(`finance.ledger.deal.type.${f}`);
  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-5"
        role="group"
        aria-label={t('finance.ledger.deal.filterLabel')}
        data-ledger-deal-filter
      >
        {DEAL_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => onFilter(f)}
            className={cn(
              'inline-flex h-[34px] items-center whitespace-nowrap rounded-pill border px-3.5 text-sm font-medium leading-[18px] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:h-11',
              filter === f
                ? 'border-sel bg-sel text-on-sel'
                : 'border-border-strong bg-raised text-text hover:bg-surface active:bg-pressed',
            )}
            data-ledger-deal-filter-option={f}
          >
            {label(f)}
          </button>
        ))}
        <Button
          variant={sorted ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={sorted}
          onClick={() => onSort(!sorted)}
          className="ms-auto"
          data-ledger-deal-sort
        >
          {t('finance.ledger.deal.sort')}
        </Button>
      </div>
      {lines.length === 0 ? null : (
        <table className="w-full border-collapse" data-ledger-by-deal-type>
          <thead>
            <tr className="border-y border-border bg-surface">
              <th className={TH}>{t('finance.ledger.deal.filterLabel')}</th>
              <th className={cn(TH, 'text-end')}>{t('finance.ledger.units')}</th>
              <th className={cn(TH, 'text-end')}>{t('finance.ledger.revenue')}</th>
              <th className={cn(TH, 'hidden text-end @min-[600px]:table-cell')}>{t('finance.ledger.cost')}</th>
              <th className={cn(TH, 'text-end')}>{t('finance.ledger.profit')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((g) => (
              <tr
                key={g.deal_type ?? 'none'}
                className="border-b border-border last:border-b-0"
                data-ledger-deal-line={g.deal_type ?? 'none'}
              >
                <td className={cn(TD, 'font-medium')}>{dealName(t, g.deal_type)}</td>
                <td className={cn(TD, NUM)}>{g.units}</td>
                <td className={cn(TD, NUM)} data-ledger-deal-revenue>
                  {formatMoney(g.revenue, locale)}
                </td>
                <td className={cn(TD, NUM, 'hidden @min-[600px]:table-cell')}>{known(g.cost)}</td>
                <td className={cn(TD, NUM)}>{known(g.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {partial ? (
        <p className="px-4 py-3 text-sm text-warning sm:px-5" data-ledger-deal-partial>
          {t('finance.ledger.deal.partial')}
        </p>
      ) : null}
    </>
  );
}
