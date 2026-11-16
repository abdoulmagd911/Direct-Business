'use client';
import { Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { formatMoney, formatStoredDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { EntityLink } from '@/ui/EntityLink';
import { ledgerRowsToCsv } from '../ledger';
import type { LedgerReport } from '../types';
import { NUM, TD, TH } from './parts';

type Locale = 'en' | 'ar';

/** How many rows a narrow place (a phone) lists before "See all" (the 13 Nov phone board). */
const NARROW_ROWS = 5;
/** A column that only a wide enough card has room for; narrower, its value sits under the row's first cell. */
const FROM_600 = 'hidden @min-[600px]:table-cell';
const FROM_860 = 'hidden @min-[860px]:table-cell';
const FROM_1000 = 'hidden @min-[1000px]:table-cell';

/**
 * The Finance report itself (workstream B), in the V21 look: the unified ledger's five figures in one strip (Revenue
 * the one green figure), then received and remaining by partner, then the invoices, then the unit rows with their
 * transaction number and invoice number apart, then the discount-code rows kept apart from those totals. A view with
 * nothing in it is one line, not five figures of 0 and three empty tables. A cost with no approved expense is "Not
 * known yet", never 0, and its profit with it; settlement is never shown; there is no VAT anywhere here.
 * No table scrolls sideways: each one fits the card it is in — a column the card has no room for moves under the
 * row's first cell (the report is its own container, so this follows the card's width, not the window's).
 */
export function FinanceReport({
  report,
  loading,
  failed,
  onRetry,
}: {
  report: LedgerReport | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  // a narrow place lists the first rows and offers the rest; a table wide enough always lists them all
  const [allRows, setAllRows] = useState(false);
  if (loading || failed || !report) {
    return (
      <div className="border-t border-border px-4 py-4 sm:px-5">
        <DataState
          kind={loading ? 'loading' : 'failed'}
          message={t(loading ? 'state.loading' : 'state.failed', { what: t('finance.ledger.failed') })}
          onRetry={loading ? undefined : onRetry}
          retryLabel={loading ? undefined : t('common.tryAgain')}
        >
          {loading ? <ReportSkeleton /> : null}
        </DataState>
      </div>
    );
  }
  const money = (n: number | null | undefined) =>
    n === null || n === undefined ? t('finance.ledger.noCost') : formatMoney(n, locale);
  /** A cost or a profit in a row: its figure, or — while no approved expense exists — the words, muted, never 0. */
  const known = (n: number | null | undefined): ReactNode =>
    n === null || n === undefined ? (
      <span className="font-ui text-muted" data-not-known>
        {t('finance.ledger.notKnown')}
      </span>
    ) : (
      formatMoney(n, locale)
    );
  const nameOf = (partnerId: string | null) => {
    if (!partnerId) return t('finance.ledger.noPartner');
    const c = report.companies.find((x) => x.partner_id === partnerId);
    if (!c) return t('finance.ledger.noPartner');
    return locale === 'ar' && c.trade_name_ar ? c.trade_name_ar : (c.trade_name_en ?? c.partner_number ?? '');
  };
  // A partner's name as a link to its record (F170): /partners/{id} lands on the side the reader may see.
  // No partner on the row, or no company in the report, stays plain text — never a link to nowhere.
  // The transaction and invoice numbers stay plain text: no invoice record page exists to link them to.
  const partnerCell = (partnerId: string | null) => {
    if (!partnerId || !report.companies.some((x) => x.partner_id === partnerId)) return nameOf(partnerId);
    return (
      <EntityLink kind="partner" href={`/partners/${partnerId}`} className="[overflow-wrap:anywhere]">
        {nameOf(partnerId)}
      </EntityLink>
    );
  };
  const download = () => {
    const csv = ledgerRowsToCsv(
      report,
      {
        created: t('finance.ledger.created'),
        company: t('finance.ledger.partnerName'),
        transaction: t('finance.ledger.transactionNumber'),
        invoice: t('finance.ledger.invoiceNumber'),
        kind: t('finance.ledger.kind'),
        source: t('finance.ledger.source'),
        revenue: t('finance.ledger.revenue'),
        cost: t('finance.ledger.cost'),
        profit: t('finance.ledger.profit'),
        dpin: t('finance.ledger.dpin'),
        flags: t('finance.ledger.flags'),
        total: t('finance.ledger.totals'),
      },
      nameOf,
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-ledger-${report.from}-${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const flagLabel = (f: string) => (t.has(`finance.ledger.flag.${f}`) ? t(`finance.ledger.flag.${f}`) : f);
  // a stored day (2026-11-08) is written the one way, 8 Nov 2026 (W-daily 13)
  const day = (d: string | null | undefined) => (d ? (formatStoredDate(d, locale) ?? d) : '—');
  const total = report.totals;
  const promoRows = report.promoRows ?? [];
  const unconfirmed = total.unconfirmedImportUnits ? (
    <p className="text-sm text-muted" data-finance-ledger-unconfirmed>
      {t('finance.ledger.unconfirmed', { count: total.unconfirmedImportUnits })}
    </p>
  ) : null;
  if (
    report.rows.length === 0 &&
    report.invoices.length === 0 &&
    report.by_company.length === 0 &&
    promoRows.length === 0
  ) {
    return (
      <div className="flex flex-col gap-2 border-t border-border px-4 py-4 sm:px-5" data-finance-report data-empty>
        <p className="text-base text-muted">{t('finance.ledger.empty')}</p>
        {unconfirmed}
      </div>
    );
  }
  /** Where a row came from, as a pill: Imported only on imported rows (13 Nov), and the discount-code mark beside it. */
  const sourcePills = (r: { source: 'manual' | 'import'; isPromo: boolean }): ReactNode =>
    r.source === 'import' || r.isPromo ? (
      <span className="flex flex-wrap gap-1">
        {r.source === 'import' ? <StatusChip tone="info">{t('finance.ledger.sourceImport')}</StatusChip> : null}
        {r.isPromo ? <StatusChip tone="neutral">{t('finance.ledger.promoTitle')}</StatusChip> : null}
      </span>
    ) : null;
  const empty = <p className="px-4 pb-4 text-base text-muted sm:px-5">{t('finance.ledger.empty')}</p>;
  return (
    <div className="@container flex min-w-0 flex-col" data-finance-report>
      <div
        className="flex flex-wrap items-start gap-x-8 gap-y-3 border-y border-border px-4 py-3.5 sm:px-5"
        aria-label={t('finance.ledger.totals')}
        role="group"
        data-finance-ledger-totals
      >
        <StripFigure kind="revenue" label={t('finance.ledger.revenueUnified')} value={total.revenue} tone="success" />
        <StripFigure kind="cost" label={t('finance.ledger.costUnified')} value={total.cost} />
        <StripFigure
          kind="profit"
          label={t('finance.ledger.profitUnified')}
          value={total.profit}
          tone={total.profit < 0 ? 'danger' : undefined}
        />
        <StripFigure kind="received" label={t('finance.ledger.received')} value={total.received} />
        <StripFigure kind="remaining" label={t('finance.ledger.remaining')} value={total.remaining} />
        <Button
          variant="secondary"
          size="sm"
          icon={<Download aria-hidden="true" />}
          onClick={download}
          className="ms-auto self-center"
          data-finance-export
        >
          {t('finance.ledger.export')}
        </Button>
      </div>
      <p
        className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-3 text-sm text-muted sm:px-5"
        data-finance-ledger-counts
      >
        <span>
          {t('finance.ledger.units')}: <b className="font-data text-text tabular">{total.units}</b>
        </span>
        <span aria-hidden="true">·</span>
        <span>{t('finance.ledger.withoutCost', { count: total.without_cost })}</span>
        {total.manualUnits !== undefined && total.importUnits !== undefined ? (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {t('finance.ledger.sourceManual')}: <b className="font-data text-text tabular">{total.manualUnits}</b>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <StatusChip tone="info">{t('finance.ledger.sourceImport')}</StatusChip>
              <b className="font-data text-text tabular">{total.importUnits}</b>
            </span>
          </>
        ) : null}
        {total.unconfirmedImportUnits ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{t('finance.ledger.unconfirmed', { count: total.unconfirmedImportUnits })}</span>
          </>
        ) : null}
      </p>
      {report.code && report.codeDiscount !== null && report.codeDiscount !== undefined ? (
        <p className="px-4 pb-3 text-sm text-muted sm:px-5" data-finance-ledger-code-discount>
          {t('finance.ledger.codeDiscount')}:{' '}
          <b className="font-data text-text tabular">{formatMoney(report.codeDiscount, locale)}</b>
        </p>
      ) : null}

      <Block id="finance-ledger-companies" title={t('finance.ledger.byPartner')} data-finance-ledger-companies>
        {report.by_company.length === 0 ? (
          empty
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-border bg-surface">
                <th className={TH}>{t('finance.ledger.partnerName')}</th>
                <th className={cn(TH, 'text-end')}>{t('finance.ledger.revenue')}</th>
                <th className={cn(TH, 'text-end', FROM_600)}>{t('finance.ledger.cost')}</th>
                <th className={cn(TH, 'text-end', FROM_600)}>{t('finance.ledger.profit')}</th>
                <th className={cn(TH, 'text-end', FROM_600)}>{t('finance.ledger.received')}</th>
                <th className={cn(TH, 'text-end')}>{t('finance.ledger.remaining')}</th>
              </tr>
            </thead>
            <tbody>
              {report.by_company.map((c) => (
                <tr key={c.partner_id ?? 'none'} className="border-b border-border last:border-b-0">
                  <td className={TD}>
                    <span className="font-medium">{partnerCell(c.partner_id)}</span>
                    <Under until="600">
                      <Pair label={t('finance.ledger.cost')} value={formatMoney(c.cost, locale)} />
                      <Pair label={t('finance.ledger.profit')} value={formatMoney(c.profit, locale)} />
                      <Pair label={t('finance.ledger.received')} value={formatMoney(c.received, locale)} />
                    </Under>
                  </td>
                  <td className={cn(TD, NUM)}>{formatMoney(c.revenue, locale)}</td>
                  <td className={cn(TD, NUM, FROM_600)}>{formatMoney(c.cost, locale)}</td>
                  <td className={cn(TD, NUM, FROM_600)}>{formatMoney(c.profit, locale)}</td>
                  <td className={cn(TD, NUM, FROM_600)}>{formatMoney(c.received, locale)}</td>
                  <td className={cn(TD, NUM)}>{formatMoney(c.remaining, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Block>

      <Block id="finance-ledger-invoices" title={t('finance.ledger.invoices')} data-finance-ledger-invoices>
        {report.invoices.length === 0 ? (
          empty
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-border bg-surface">
                <th className={TH}>{t('finance.ledger.invoiceNumber')}</th>
                <th className={cn(TH, FROM_600)}>{t('finance.ledger.partnerName')}</th>
                <th className={cn(TH, FROM_860)}>{t('finance.ledger.transactions')}</th>
                <th className={cn(TH, 'text-end')}>{t('finance.ledger.received')}</th>
                <th className={cn(TH, 'text-end')}>{t('finance.ledger.remaining')}</th>
                <th className={cn(TH, FROM_860)}>{t('finance.ledger.dpin')}</th>
              </tr>
            </thead>
            <tbody>
              {report.invoices.map((v) => (
                <tr key={v.invoice_id} className="border-b border-border last:border-b-0">
                  <td className={TD}>
                    <bdi className="font-data font-medium text-strong tabular [overflow-wrap:anywhere]">
                      {v.invoice_number ?? '—'}
                    </bdi>
                    <Under until="600">{partnerCell(v.partner_id)}</Under>
                    <Under until="860">
                      {v.transactions.length ? (
                        <Pair label={t('finance.ledger.transactions')} value={v.transactions.join(', ')} />
                      ) : null}
                      {v.dpin ? <Pair label={t('finance.ledger.dpin')} value={v.dpin} /> : null}
                    </Under>
                  </td>
                  <td className={cn(TD, FROM_600)}>{partnerCell(v.partner_id)}</td>
                  <td className={cn(TD, FROM_860, 'font-data tabular [overflow-wrap:anywhere]')}>
                    {v.transactions.join(', ') || '—'}
                  </td>
                  <td className={cn(TD, NUM)}>{formatMoney(v.received_sar, locale)}</td>
                  <td className={cn(TD, NUM)}>{money(v.remaining_sar)}</td>
                  <td className={cn(TD, FROM_860, 'font-data tabular [overflow-wrap:anywhere]')}>{v.dpin ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Block>

      <Block id="finance-ledger-rows" title={t('finance.ledger.rows')} data-finance-ledger-rows>
        {report.truncated ? (
          <p className="px-4 pb-3 text-sm text-warning sm:px-5">{t('finance.ledger.truncated')}</p>
        ) : null}
        {report.rows.length === 0 ? (
          empty
        ) : (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-border bg-surface">
                  <th className={TH}>{t('finance.ledger.transactionNumber')}</th>
                  <th className={cn(TH, FROM_600)}>{t('finance.ledger.partnerName')}</th>
                  <th className={cn(TH, FROM_860)}>{t('finance.ledger.source')}</th>
                  <th className={cn(TH, FROM_600)}>{t('finance.ledger.created')}</th>
                  <th className={cn(TH, 'text-end')}>{t('finance.ledger.revenue')}</th>
                  <th className={cn(TH, 'text-end', FROM_600)}>{t('finance.ledger.cost')}</th>
                  <th className={cn(TH, 'text-end', FROM_600)}>{t('finance.ledger.profit')}</th>
                  <th className={cn(TH, FROM_1000)}>{t('finance.ledger.flags')}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => {
                  const pills = sourcePills(r);
                  const flags = r.flags.map(flagLabel).join(' · ');
                  return (
                    <tr
                      key={`${r.invoice_id}-${r.unit_kind}`}
                      className={cn(
                        'border-b border-border last:border-b-0',
                        !allRows && i >= NARROW_ROWS && '@max-[599px]:hidden',
                      )}
                      data-finance-ledger-row={r.source}
                    >
                      <td className={TD}>
                        <bdi className="block font-data font-medium text-strong tabular [overflow-wrap:anywhere]">
                          {r.transaction_number ?? '—'}
                        </bdi>
                        <Pair label={t('finance.ledger.invoiceNumber')} value={r.invoice_number ?? '—'} block />
                        <Under until="600">
                          {partnerCell(r.partner_id)}
                          <span className="whitespace-nowrap">{day(r.created_on)}</span>
                        </Under>
                        {pills ? <Under until="860">{pills}</Under> : null}
                        {flags ? <Under until="1000">{flags}</Under> : null}
                      </td>
                      <td className={cn(TD, FROM_600)}>{partnerCell(r.partner_id)}</td>
                      <td className={cn(TD, FROM_860)}>{pills}</td>
                      <td className={cn(TD, FROM_600, 'whitespace-nowrap')}>{day(r.created_on)}</td>
                      <td className={cn(TD, NUM)}>
                        {formatMoney(r.revenue, locale)}
                        <Under until="600" end>
                          <Pair label={t('finance.ledger.profit')} value={known(r.profit)} />
                        </Under>
                      </td>
                      <td className={cn(TD, NUM, FROM_600)}>{known(r.cost)}</td>
                      <td className={cn(TD, NUM, FROM_600)}>{known(r.profit)}</td>
                      <td className={cn(TD, FROM_1000, 'text-muted')}>{flags || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!allRows && report.rows.length > NARROW_ROWS ? (
              <div className="border-t border-border px-2 py-2 @min-[600px]:hidden">
                <Button variant="ghost" size="sm" onClick={() => setAllRows(true)} data-finance-ledger-see-all>
                  {t('finance.ledger.seeAll', { count: report.rows.length })}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Block>

      {promoRows.length > 0 ? (
        <Block id="finance-ledger-promo" title={t('finance.ledger.promoTitle')} data-finance-ledger-promo>
          <p className="px-4 pb-3 text-sm text-muted sm:px-5">{t('finance.ledger.promoNote')}</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-border bg-surface">
                <th className={TH}>{t('finance.ledger.transactionNumber')}</th>
                <th className={cn(TH, FROM_600)}>{t('finance.ledger.partnerName')}</th>
                <th className={cn(TH, FROM_860)}>{t('finance.ledger.code')}</th>
                <th className={cn(TH, FROM_860)}>{t('finance.ledger.created')}</th>
                <th className={cn(TH, 'text-end')}>{t('finance.ledger.discount')}</th>
                <th className={cn(TH, 'text-end')}>{t('finance.ledger.revenue')}</th>
                <th className={cn(TH, 'text-end', FROM_600)}>{t('finance.ledger.cost')}</th>
                <th className={cn(TH, 'text-end', FROM_600)}>{t('finance.ledger.profit')}</th>
              </tr>
            </thead>
            <tbody>
              {promoRows.map((pr) => (
                <tr key={pr.id} className="border-b border-border last:border-b-0" data-finance-ledger-promo-row>
                  <td className={TD}>
                    <bdi className="block font-data font-medium text-strong tabular [overflow-wrap:anywhere]">
                      {pr.transaction_number ?? '—'}
                    </bdi>
                    <Pair label={t('finance.ledger.invoiceNumber')} value={pr.invoice_number ?? '—'} block />
                    <Under until="600">{partnerCell(pr.partner_id)}</Under>
                    <Under until="860">
                      <Pair label={t('finance.ledger.code')} value={pr.code ?? '—'} />
                      <span className="whitespace-nowrap">{day(pr.created_on)}</span>
                    </Under>
                  </td>
                  <td className={cn(TD, FROM_600)}>{partnerCell(pr.partner_id)}</td>
                  <td className={cn(TD, FROM_860, 'font-data [overflow-wrap:anywhere]')}>{pr.code ?? '—'}</td>
                  <td className={cn(TD, FROM_860, 'whitespace-nowrap')}>{day(pr.created_on)}</td>
                  <td className={cn(TD, NUM)}>{money(pr.discount_sar)}</td>
                  <td className={cn(TD, NUM)}>
                    {money(pr.revenue)}
                    <Under until="600" end>
                      <Pair label={t('finance.ledger.profit')} value={known(pr.profit)} />
                    </Under>
                  </td>
                  <td className={cn(TD, NUM, FROM_600)}>{known(pr.cost)}</td>
                  <td className={cn(TD, NUM, FROM_600)}>{known(pr.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      ) : null}
    </div>
  );
}

/** One part of the report: its heading, then its table edge to edge inside the card. */
function Block({
  id,
  title,
  children,
  ...rest
}: { id: string; title: string; children: ReactNode } & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col border-t border-border" {...rest}>
      <h3 id={id} className="px-4 pb-2.5 pt-4 font-display text-base font-semibold leading-5 text-strong sm:px-5">
        {title}
      </h3>
      {children}
    </section>
  );
}

const UNTIL = {
  '600': '@min-[600px]:hidden',
  '860': '@min-[860px]:hidden',
  '1000': '@min-[1000px]:hidden',
} as const;

/** What a narrow card shows under a row's first cell, in place of the columns it has no room for. */
function Under({ until, end, children }: { until: keyof typeof UNTIL; end?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-ui text-xs leading-4 text-muted',
        end && 'justify-end',
        UNTIL[until],
      )}
    >
      {children}
    </span>
  );
}

/** A small named value: the name muted, the value in mono. */
function Pair({ label, value, block }: { label: string; value: ReactNode; block?: boolean }) {
  return (
    <span className={cn('font-ui text-xs leading-4 text-muted', block ? 'mt-0.5 block' : 'inline-block')}>
      {label} <bdi className="font-data tabular [overflow-wrap:anywhere]">{value}</bdi>
    </span>
  );
}

/**
 * One figure of the ledger's strip (13 Nov board): its name small and muted, the figure in the heading face at
 * 20/28. Revenue is the one green figure and a loss is red; every other figure stays neutral.
 */
function StripFigure({
  kind,
  label,
  value,
  tone,
}: {
  kind: string;
  label: string;
  value: number;
  tone?: 'success' | 'danger';
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <span className="flex min-w-0 flex-col" data-finance-ledger-total={kind} data-tone={tone}>
      <span className="text-sm leading-[18px] text-muted">{label}</span>
      <span
        className={cn(
          'font-display text-xl font-semibold leading-7 tabular',
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-strong',
        )}
      >
        {formatMoney(value, locale)}
        <small className="ms-1 font-ui text-sm font-medium text-muted">{t('finance.sar')}</small>
      </span>
    </span>
  );
}

/** The ledger while it is read: the strip's figures and a few rows, as soft bars with the shimmer. */
function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="shimmer h-3 w-28 rounded-pill bg-pressed" />
            <div className="shimmer h-6 w-24 rounded-pill bg-pressed" />
          </div>
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="shimmer h-4 w-full rounded-pill bg-pressed" />
      ))}
    </div>
  );
}
