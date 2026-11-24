'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { formatMoney, formatNumber, formatStoredDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { EntityLink } from '@/ui/EntityLink';
import {
  AGE_BUCKETS,
  HELD_REASONS,
  ageingOf,
  heldOf,
  reconciliationOf,
  type Ageing,
  type Gap,
  type Held,
  type Reconciliation,
} from '../checks';
import { useFinanceRead } from '../use-reads';
import { FinanceCard, NUM, TD, TH } from './parts';

type Locale = 'en' | 'ar';
type Named = {
  partner_id: string | null;
  partner_number: string | null;
  trade_name_en: string | null;
  trade_name_ar: string | null;
};

/** A card's own loading / failed state, like the page's other cards: each asks again on its own. */
function CardState({ loading, what, onRetry }: { loading: boolean; what: string; onRetry: () => void }) {
  const t = useTranslations();
  return (
    <div className="px-4 pb-4 sm:px-5">
      <DataState
        kind={loading ? 'loading' : 'failed'}
        message={t(loading ? 'state.loading' : 'state.failed', { what })}
        onRetry={loading ? undefined : onRetry}
        retryLabel={loading ? undefined : t('common.tryAgain')}
      />
    </div>
  );
}

/** An organisation's name as a link to its record; no organisation is said in words, never a link to nowhere. */
function PartnerName({ row, none }: { row: Named; none: string }) {
  const locale = useLocale() as Locale;
  if (!row.partner_id) return <span className="text-muted">{none}</span>;
  return (
    <EntityLink kind="partner" href={`/partners/${row.partner_id}`} className="[overflow-wrap:anywhere]">
      {(locale === 'ar' && row.trade_name_ar ? row.trade_name_ar : row.trade_name_en) ?? row.partner_number ?? none}
    </EntityLink>
  );
}

// ================================================================== A10 — Finance agrees with itself
/**
 * "Does Finance agree with itself?" (Landing 47, A10): the Finance page's figures beside the Ledger's totals for the
 * period on screen, and every gap between and inside them. An empty list is agreement, said in words. A gap of 1 SAR
 * or more is marked as a failure; a smaller one is listed all the same.
 */
export function FinanceReconciliation({ from, to, ready }: { from: string; to: string; ready: boolean }) {
  const read = useFinanceRead<unknown, 'finance_reconciliation'>(
    'finance_reconciliation',
    { p_from: from, p_to: to },
    `reconciliation|${from}|${to}`,
    ready,
  );
  const data = read.block.status === 'ready' ? reconciliationOf(read.block.data) : null;
  return (
    <FinanceReconciliationView
      data={data}
      loading={read.block.status === 'loading'}
      failed={read.block.status === 'failed' || (read.block.status === 'ready' && data === null)}
      onRetry={read.retry}
    />
  );
}

export function FinanceReconciliationView({
  data,
  loading,
  failed,
  onRetry,
}: {
  data: Reconciliation | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const card = (children: ReactNode) => (
    <FinanceCard
      id="finance-reconciliation"
      title={t('finance.reconcile.title')}
      source={t('finance.reconcile.source')}
      data-finance-reconciliation
    >
      {children}
    </FinanceCard>
  );
  if (loading || failed || !data)
    return card(<CardState loading={loading} what={t('finance.reconcile.failed')} onRetry={onRetry} />);
  // a figure with nothing behind it is a dash, never 0 (a period with no cost has no cost to compare)
  const fig = (n: number | null, whole = false) =>
    n === null ? t('finance.ledger.noCost') : whole ? formatNumber(n, locale) : formatMoney(n, locale, 2);
  const gapWhat = (g: Gap) =>
    g.kind === 'sides' || g.kind === 'organisations'
      ? t(`finance.reconcile.gap.${g.kind}`, { figure: t(`finance.reconcile.figure.${g.figure ?? 'revenue'}`) })
      : t(`finance.reconcile.gap.${g.kind}`, { number: g.number ?? '—' });
  return card(
    <div className="flex flex-col gap-3 pb-4">
      <p
        className="flex flex-wrap items-center gap-2 px-4 text-base sm:px-5"
        data-reconcile-verdict={data.agrees ? 'agrees' : 'gaps'}
      >
        {data.agrees ? (
          <>
            <StatusChip tone="success">{t('finance.reconcile.agrees')}</StatusChip>
            <span className="text-text">{t('finance.reconcile.agreesLine')}</span>
          </>
        ) : (
          <>
            <StatusChip tone={data.failing > 0 ? 'danger' : 'warning'}>
              {t('finance.reconcile.gaps', { count: data.gaps.length })}
            </StatusChip>
            <span className="text-text">{t('finance.reconcile.gapsLine', { failing: data.failing })}</span>
          </>
        )}
      </p>
      <table className="w-full border-collapse" data-reconcile-sides>
        <thead>
          <tr className="border-y border-border bg-surface">
            <th className={TH}>{t('finance.reconcile.figureHead')}</th>
            <th className={cn(TH, 'text-end')}>{t('finance.reconcile.sideOverview')}</th>
            <th className={cn(TH, 'text-end')}>{t('finance.reconcile.sideLedger')}</th>
          </tr>
        </thead>
        <tbody>
          {(['revenue', 'cost', 'profit', 'units'] as const).map((f) => (
            <tr key={f} className="border-b border-border last:border-b-0" data-reconcile-figure={f}>
              <td className={cn(TD, 'font-medium')}>{t(`finance.reconcile.figure.${f}`)}</td>
              <td className={cn(TD, NUM)} data-reconcile-overview>
                {fig(data.overview[f], f === 'units')}
              </td>
              <td className={cn(TD, NUM)} data-reconcile-ledger>
                {fig(data.ledger[f], f === 'units')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.gaps.length > 0 ? (
        <ul className="flex flex-col border-t border-border" data-reconcile-gaps>
          {data.gaps.map((g, i) => (
            <li
              key={`${g.kind}-${g.figure ?? g.number ?? i}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3 text-sm leading-5 last:border-b-0 sm:px-5"
              data-reconcile-gap={g.kind}
            >
              <span className="min-w-0 font-medium text-strong [overflow-wrap:anywhere]">{gapWhat(g)}</span>
              <span className="whitespace-nowrap text-muted">
                <bdi className="font-data tabular">{fig(g.left, g.figure === 'units')}</bdi>
                {' / '}
                <bdi className="font-data tabular">{fig(g.right, g.figure === 'units')}</bdi>
              </span>
              <span className="ms-auto whitespace-nowrap" data-reconcile-difference>
                <span className="text-muted">{t('finance.reconcile.difference')} </span>
                <bdi className="font-data tabular">{fig(g.difference, g.figure === 'units')}</bdi>
              </span>
              <StatusChip tone={g.failing ? 'danger' : 'neutral'}>
                {t(g.failing ? 'finance.reconcile.failing' : 'finance.reconcile.small')}
              </StatusChip>
            </li>
          ))}
        </ul>
      ) : null}
      {data.rowsTruncated ? (
        <p className="px-4 text-sm text-warning sm:px-5" data-reconcile-truncated>
          {t('finance.reconcile.truncated')}
        </p>
      ) : null}
    </div>,
  );
}

// ================================================================== A6 — outstanding and how old
/**
 * "Outstanding and how old" (Landing 47, A6): what is still owed, by organisation and by invoice, each with its age.
 * It opens as the pursue list for postpaid — postpaid rows and the rows whose deal type is not set — and one press
 * lists every deal type. `partner` keeps it to one organisation (its Finance tab).
 */
export function FinanceAgeing({ partner, ready = true }: { partner?: string; ready?: boolean }) {
  const [all, setAll] = useState(false);
  const read = useFinanceRead<unknown, 'finance_ageing'>(
    'finance_ageing',
    { ...(partner ? { p_partner: partner } : {}), p_all: all },
    `ageing|${partner ?? ''}|${all}`,
    ready,
  );
  const data = read.block.status === 'ready' ? ageingOf(read.block.data) : null;
  return (
    <FinanceAgeingView
      data={data}
      all={all}
      onAll={setAll}
      onePartner={!!partner}
      loading={read.block.status === 'loading'}
      failed={read.block.status === 'failed' || (read.block.status === 'ready' && data === null)}
      onRetry={read.retry}
    />
  );
}

export function FinanceAgeingView({
  data,
  all,
  onAll,
  onePartner,
  loading,
  failed,
  onRetry,
}: {
  data: Ageing | null;
  all: boolean;
  onAll: (all: boolean) => void;
  /** One organisation's own list: the by-organisation table is left out. */
  onePartner: boolean;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const day = (d: string | null) => (d ? (formatStoredDate(d, locale) ?? d) : '—');
  const card = (children: ReactNode) => (
    <FinanceCard
      id="finance-ageing"
      title={t('finance.ageing.title')}
      source={data?.as_of ? t('finance.ageing.asOf', { date: day(data.as_of) }) : undefined}
      action={
        <Button variant="secondary" size="sm" aria-pressed={all} onClick={() => onAll(!all)} data-ageing-all>
          {t(all ? 'finance.ageing.showPostpaid' : 'finance.ageing.showAll')}
        </Button>
      }
      data-finance-ageing
      data-ageing-scope={all ? 'all' : 'postpaid'}
    >
      {children}
    </FinanceCard>
  );
  if (loading || failed || !data)
    return card(<CardState loading={loading} what={t('finance.ageing.failed')} onRetry={onRetry} />);
  if (data.rows.length === 0)
    return card(
      <p className="px-4 pb-4 text-base text-muted sm:px-5" data-ageing-empty>
        {t(all ? 'finance.ageing.emptyAll' : 'finance.ageing.empty')}
      </p>,
    );
  return card(
    <div className="flex flex-col pb-1">
      <p className="px-4 pb-3 text-sm text-muted sm:px-5">
        {t(all ? 'finance.ageing.scopeAll' : 'finance.ageing.scopePostpaid')}
      </p>
      <div
        className="flex flex-wrap items-start gap-x-8 gap-y-3 border-y border-border px-4 py-3.5 sm:px-5"
        role="group"
        aria-label={t('finance.ageing.title')}
        data-ageing-totals
      >
        <span className="flex min-w-0 flex-col" data-ageing-total="outstanding">
          <span className="text-sm leading-[18px] text-muted">{t('finance.ageing.outstanding')}</span>
          <span className="font-display text-xl font-semibold leading-7 text-strong tabular">
            {formatMoney(data.outstanding, locale)}
            <small className="ms-1 font-ui text-sm font-medium text-muted">{t('finance.sar')}</small>
          </span>
        </span>
        {AGE_BUCKETS.map((b) => (
          <span key={b} className="flex min-w-0 flex-col" data-ageing-total={b}>
            <span className="text-sm leading-[18px] text-muted">{t(`finance.ageing.bucket.${b}`)}</span>
            <span
              className={cn(
                'font-display text-xl font-semibold leading-7 tabular',
                b === 'days_over_90' && data.buckets[b] > 0 ? 'text-danger' : 'text-strong',
              )}
            >
              {formatMoney(data.buckets[b], locale)}
            </span>
          </span>
        ))}
      </div>
      {onePartner ? null : (
        <table className="w-full border-collapse" data-ageing-companies>
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className={TH}>{t('finance.ledger.partnerName')}</th>
              <th className={cn(TH, 'text-end')}>{t('finance.ageing.outstanding')}</th>
              <th className={cn(TH, 'text-end')}>{t('finance.ageing.oldest')}</th>
              {AGE_BUCKETS.map((b) => (
                <th key={b} className={cn(TH, 'hidden text-end @min-[860px]:table-cell')}>
                  {t(`finance.ageing.bucket.${b}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.companies.map((c) => (
              <tr key={c.partner_id ?? 'none'} className="border-b border-border last:border-b-0" data-ageing-company>
                <td className={cn(TD, 'font-medium')}>
                  <PartnerName row={c} none={t('finance.ledger.noPartner')} />
                  <span className="mt-0.5 block font-ui text-xs leading-4 text-muted">
                    {t('finance.ageing.invoices', { count: c.units })}
                  </span>
                </td>
                <td className={cn(TD, NUM)} data-ageing-company-outstanding>
                  {formatMoney(c.outstanding, locale)}
                </td>
                <td className={cn(TD, NUM)} data-ageing-company-oldest>
                  {c.oldest_days === null ? '—' : t('finance.ageing.days', { count: c.oldest_days })}
                </td>
                {AGE_BUCKETS.map((b) => (
                  <td key={b} className={cn(TD, NUM, 'hidden @min-[860px]:table-cell')}>
                    {formatMoney(c[b], locale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul className="flex flex-col border-t border-border" data-ageing-rows>
        {data.rows.map((r, i) => (
          <li
            key={`${r.source}-${r.partner_id ?? ''}-${r.number ?? i}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3 text-sm leading-5 last:border-b-0 sm:px-5"
            data-ageing-row={r.bucket}
            data-number={r.number ?? undefined}
          >
            <bdi className="font-data font-medium text-strong tabular [overflow-wrap:anywhere]">{r.number ?? '—'}</bdi>
            {onePartner ? null : (
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <PartnerName row={r} none={t('finance.ledger.noPartner')} />
              </span>
            )}
            <span className="whitespace-nowrap text-muted">{day(r.issued_on)}</span>
            <StatusChip
              tone={r.bucket === 'days_over_90' ? 'danger' : r.bucket === 'days_61_90' ? 'warning' : 'neutral'}
            >
              {r.age_days === null ? t('finance.ageing.noDate') : t('finance.ageing.days', { count: r.age_days })}
            </StatusChip>
            {r.deal_type ? (
              <StatusChip tone="neutral">{t(`finance.ledger.deal.type.${r.deal_type}`)}</StatusChip>
            ) : (
              <StatusChip tone="warning">{t('finance.ledger.deal.notSet')}</StatusChip>
            )}
            {r.source === 'import' ? <StatusChip tone="info">{t('finance.ledger.sourceImport')}</StatusChip> : null}
            <span className="ms-auto whitespace-nowrap" data-ageing-row-outstanding>
              <span className="text-muted">{t('finance.ageing.outstanding')} </span>
              <bdi className="font-data tabular">{formatMoney(r.outstanding, locale)}</bdi>
            </span>
          </li>
        ))}
      </ul>
      {data.truncated ? (
        <p className="px-4 py-3 text-sm text-warning sm:px-5">{t('finance.ageing.truncated')}</p>
      ) : null}
    </div>,
  );
}

// ================================================================== A11 — held, never dropped
/**
 * "Held — to tie" (Landing 47, A11): the rows of the period Finance cannot tie firmly — no organisation, no client
 * ID, or a number found under more than one organisation — each with its amount and whether it counts. They are
 * held in view here; none is dropped from the Ledger, and no figure is changed by this list.
 */
export function FinanceHeld({ from, to, ready }: { from: string; to: string; ready: boolean }) {
  const read = useFinanceRead<unknown, 'finance_held_rows'>(
    'finance_held_rows',
    { p_from: from, p_to: to },
    `held|${from}|${to}`,
    ready,
  );
  const data = read.block.status === 'ready' ? heldOf(read.block.data) : null;
  return (
    <FinanceHeldView
      data={data}
      loading={read.block.status === 'loading'}
      failed={read.block.status === 'failed' || (read.block.status === 'ready' && data === null)}
      onRetry={read.retry}
    />
  );
}

export function FinanceHeldView({
  data,
  loading,
  failed,
  onRetry,
}: {
  data: Held | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const day = (d: string | null) => (d ? (formatStoredDate(d, locale) ?? d) : '—');
  const card = (children: ReactNode) => (
    <FinanceCard id="finance-held" title={t('finance.held.title')} source={t('finance.held.source')} data-finance-held>
      {children}
    </FinanceCard>
  );
  if (loading || failed || !data)
    return card(<CardState loading={loading} what={t('finance.held.failed')} onRetry={onRetry} />);
  if (data.rows.length === 0)
    return card(
      <p className="px-4 pb-4 text-base text-muted sm:px-5" data-held-empty>
        {t('finance.held.empty')}
      </p>,
    );
  return card(
    <div className="flex flex-col pb-1">
      {HELD_REASONS.map((reason) => {
        const rows = data.rows.filter((r) => r.reason === reason);
        if (rows.length === 0) return null;
        const total = data.totals[reason];
        return (
          <section key={reason} className="flex flex-col border-t border-border" data-held-reason={reason}>
            <h3 className="flex flex-wrap items-baseline gap-x-3 px-4 pb-2.5 pt-4 font-display text-base font-semibold leading-5 text-strong sm:px-5">
              {t(`finance.held.reason.${reason}`)}
              <span className="font-ui text-sm font-normal text-muted" data-held-reason-total>
                {t('finance.held.total', {
                  count: total?.units ?? rows.length,
                  amount: formatMoney(total?.amount ?? 0, locale),
                })}
              </span>
            </h3>
            <ul className="flex flex-col border-t border-border">
              {rows.map((r, i) => (
                <li
                  key={`${r.source}-${r.partner_id ?? ''}-${r.number ?? i}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3 text-sm leading-5 last:border-b-0 sm:px-5"
                  data-held-row={r.source}
                  data-number={r.number ?? undefined}
                >
                  <bdi className="font-data font-medium text-strong tabular [overflow-wrap:anywhere]">
                    {r.number ?? '—'}
                  </bdi>
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <PartnerName row={r} none={t('finance.ledger.noPartner')} />
                  </span>
                  <span className="whitespace-nowrap text-muted">{day(r.created_on)}</span>
                  <StatusChip tone={r.counted ? 'success' : 'warning'}>
                    {t(r.counted ? 'finance.ledger.countedYes' : 'finance.ledger.notYetCountedPill')}
                  </StatusChip>
                  {r.source === 'import' ? (
                    <StatusChip tone="info">{t('finance.ledger.sourceImport')}</StatusChip>
                  ) : null}
                  <span className="ms-auto whitespace-nowrap" data-held-amount>
                    <bdi className="font-data tabular">{r.amount === null ? '—' : formatMoney(r.amount, locale)}</bdi>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {data.truncated ? <p className="px-4 py-3 text-sm text-warning sm:px-5">{t('finance.held.truncated')}</p> : null}
    </div>,
  );
}
