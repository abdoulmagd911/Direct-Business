'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { formatMoney, formatStoredDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { contractPaymentsOf, periodLabel, type ContractPayments as Payments } from '../checks';
import { useFinanceRead } from '../use-reads';

type Locale = 'en' | 'ar';
type Grain = 'month' | 'quarter';

/**
 * One contract's payments (Landing 47, A13): the Ledger's own rows of the organisation dated inside the contract's
 * term, by month or by quarter — each period's total and, under it, each invoice. A document not yet counted is
 * listed under its period and is in no total. The read is asked only once the person opens it.
 */
export function ContractPayments({
  contractId,
  title,
  startOn,
  endOn,
}: {
  contractId: string;
  title: string;
  startOn: string;
  endOn: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [grain, setGrain] = useState<Grain>('month');
  const read = useFinanceRead<unknown, 'finance_contract_payments'>(
    'finance_contract_payments',
    { p_contract: contractId, p_grain: grain },
    `contract-payments|${contractId}|${grain}`,
    open,
  );
  const data = read.block.status === 'ready' ? contractPaymentsOf(read.block.data) : null;
  const day = (d: string | null) =>
    d ? (formatStoredDate(d, locale) ?? d) : t('partners.companyFinance.contractOpenEnded');
  return (
    <li className="py-3 first:pt-0 last:pb-0" data-contract-payments={contractId}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 text-base font-medium text-strong [overflow-wrap:anywhere]">{title}</span>
        <span className="whitespace-nowrap text-sm text-muted">
          {day(startOn)} – {day(endOn)}
        </span>
        <span className="ms-auto flex flex-wrap gap-2">
          {open ? (
            (['month', 'quarter'] as const).map((g) => (
              <Button
                key={g}
                variant={grain === g ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={grain === g}
                onClick={() => setGrain(g)}
                data-contract-grain={g}
              >
                {t(`partners.companyFinance.contractGrain.${g}`)}
              </Button>
            ))
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)} data-contract-payments-open>
              {t('partners.companyFinance.contractShow')}
            </Button>
          )}
        </span>
      </div>
      {open ? (
        <ContractPaymentsView
          data={data}
          grain={grain}
          loading={read.block.status === 'loading'}
          failed={read.block.status === 'failed' || (read.block.status === 'ready' && data === null)}
          onRetry={read.retry}
        />
      ) : null}
    </li>
  );
}

export function ContractPaymentsView({
  data,
  grain,
  loading,
  failed,
  onRetry,
}: {
  data: Payments | null;
  grain: Grain;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  if (loading || failed || !data)
    return (
      <div className="mt-3">
        <DataState
          kind={loading ? 'loading' : 'failed'}
          message={t(loading ? 'state.loading' : 'state.failed', {
            what: t('partners.companyFinance.contractPayments'),
          })}
          onRetry={loading ? undefined : onRetry}
          retryLabel={loading ? undefined : t('common.tryAgain')}
        />
      </div>
    );
  if (data.periods.length === 0)
    return (
      <p className="mt-3 text-base text-muted" data-contract-payments-empty>
        {t('partners.companyFinance.contractNoPayments')}
      </p>
    );
  const quarterWord = (quarter: number, year: number) =>
    t('partners.companyFinance.contractQuarter', { quarter, year: String(year) });
  return (
    <div className="mt-3 flex flex-col gap-3" data-contract-payments-list={grain}>
      <p className="text-sm text-muted" data-contract-total>
        {t('partners.companyFinance.contractTotal')}{' '}
        <bdi className="font-data text-text tabular">{formatMoney(data.total, locale)}</bdi>
        {data.not_yet_counted > 0 ? (
          <span data-contract-not-yet-counted>
            {' · '}
            {t('finance.ledger.notYetCountedPill')}{' '}
            <bdi className="font-data text-text tabular">{formatMoney(data.not_yet_counted, locale)}</bdi>
          </span>
        ) : null}
      </p>
      <ul className="flex flex-col gap-3">
        {data.periods.map((p) => (
          <li key={p.period_start} className="rounded-md border border-border" data-contract-period={p.period_start}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border bg-surface px-3 py-2">
              <span className="font-medium text-strong">{periodLabel(p.period_start, grain, locale, quarterWord)}</span>
              <span className="whitespace-nowrap" data-contract-period-total>
                <bdi className="font-data font-medium text-strong tabular">{formatMoney(p.total, locale)}</bdi>
                <small className="ms-1 text-sm text-muted">{t('common.sar')}</small>
              </span>
            </div>
            <ul className="flex flex-col">
              {p.invoices.map((v, i) => (
                <li
                  key={`${v.source}-${v.number ?? i}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2 text-sm leading-5 last:border-b-0"
                  data-contract-invoice={v.number ?? undefined}
                >
                  <bdi className="font-data font-medium text-strong tabular [overflow-wrap:anywhere]">
                    {v.number ?? '—'}
                  </bdi>
                  <span className="whitespace-nowrap text-muted">
                    {v.created_on ? (formatStoredDate(v.created_on, locale) ?? v.created_on) : '—'}
                  </span>
                  {v.counted ? null : <StatusChip tone="warning">{t('finance.ledger.notYetCountedPill')}</StatusChip>}
                  {v.source === 'import' ? (
                    <StatusChip tone="info">{t('finance.ledger.sourceImport')}</StatusChip>
                  ) : null}
                  <bdi className="ms-auto font-data tabular">
                    {v.amount === null ? '—' : formatMoney(v.amount, locale)}
                  </bdi>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {data.truncated ? <p className="text-sm text-warning">{t('finance.ledger.truncated')}</p> : null}
    </div>
  );
}
