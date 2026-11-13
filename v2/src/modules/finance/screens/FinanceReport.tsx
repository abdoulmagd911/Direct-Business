'use client';
import { useLocale, useTranslations } from 'next-intl';
import { formatMoney, formatStoredDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { EntityLink } from '@/ui/EntityLink';
import { ledgerRowsToCsv } from '../ledger';
import type { LedgerReport } from '../types';

type Locale = 'en' | 'ar';

/**
 * The Finance report itself (workstream B): totals, then received and remaining by partner, then the invoices,
 * then the unit rows with their transaction number and invoice number apart, then the discount-code rows kept apart
 * from those totals. A view with nothing in it is one line, not five tiles of 0 and three empty tables.
 * A cost with no approved expense is empty, never 0; settlement is never shown; there is no VAT anywhere here.
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
  if (loading || failed || !report) {
    return (
      <DataState
        kind={loading ? 'loading' : 'failed'}
        message={t(loading ? 'state.loading' : 'state.failed', { what: t('finance.ledger.failed') })}
        onRetry={loading ? undefined : onRetry}
        retryLabel={loading ? undefined : t('common.tryAgain')}
      />
    );
  }
  const money = (n: number | null | undefined) =>
    n === null || n === undefined ? t('finance.ledger.noCost') : formatMoney(n, locale);
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
      <EntityLink kind="partner" href={`/partners/${partnerId}`}>
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
      <div className="flex flex-col gap-2" data-finance-report data-empty>
        <p className="text-sm text-muted">{t('finance.ledger.empty')}</p>
        {unconfirmed}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5" data-finance-report>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">{t('finance.ledger.totals')}</h3>
        <Button variant="secondary" onClick={download} data-finance-export>
          {t('finance.ledger.export')}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-finance-ledger-totals>
        <TotalTile label={t('finance.ledger.revenue')} value={formatMoney(total.revenue, locale)} />
        <TotalTile label={t('finance.ledger.cost')} value={formatMoney(total.cost, locale)} />
        <TotalTile label={t('finance.ledger.profit')} value={formatMoney(total.profit, locale)} />
        <TotalTile label={t('finance.ledger.received')} value={formatMoney(total.received, locale)} />
        <TotalTile label={t('finance.ledger.remaining')} value={formatMoney(total.remaining, locale)} />
      </div>
      <p className="text-sm text-muted" data-finance-ledger-counts>
        {t('finance.ledger.units')}: <b className="font-data tabular">{total.units}</b>
        {' · '}
        {t('finance.ledger.withoutCost', { count: total.without_cost })}
        {total.manualUnits !== undefined && total.importUnits !== undefined ? (
          <>
            {' · '}
            {t('finance.ledger.sourceManual')}: <b className="font-data tabular">{total.manualUnits}</b>
            {' · '}
            {t('finance.ledger.sourceImport')}: <b className="font-data tabular">{total.importUnits}</b>
          </>
        ) : null}
        {total.unconfirmedImportUnits ? (
          <>
            {' · '}
            {t('finance.ledger.unconfirmed', { count: total.unconfirmedImportUnits })}
          </>
        ) : null}
      </p>
      {report.code && report.codeDiscount !== null && report.codeDiscount !== undefined ? (
        <p className="text-sm text-muted" data-finance-ledger-code-discount>
          {t('finance.ledger.codeDiscount')}:{' '}
          <b className="font-data tabular">{formatMoney(report.codeDiscount, locale)}</b>
        </p>
      ) : null}
      <section aria-labelledby="finance-ledger-companies" data-finance-ledger-companies>
        <h3 id="finance-ledger-companies" className="font-display text-lg font-semibold">
          {t('finance.ledger.byPartner')}
        </h3>
        {report.by_company.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('finance.ledger.empty')}</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-raised">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs text-muted">
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.partnerName')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.revenue')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.cost')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.profit')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.received')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.remaining')}</th>
                </tr>
              </thead>
              <tbody>
                {report.by_company.map((c) => (
                  <tr key={c.partner_id ?? 'none'} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-medium">{partnerCell(c.partner_id)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{formatMoney(c.revenue, locale)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{formatMoney(c.cost, locale)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{formatMoney(c.profit, locale)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{formatMoney(c.received, locale)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{formatMoney(c.remaining, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="finance-ledger-invoices" data-finance-ledger-invoices>
        <h3 id="finance-ledger-invoices" className="font-display text-lg font-semibold">
          {t('finance.ledger.invoices')}
        </h3>
        {report.invoices.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('finance.ledger.empty')}</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-raised">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs text-muted">
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.invoiceNumber')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.partnerName')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.transactions')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.received')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.remaining')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.dpin')}</th>
                </tr>
              </thead>
              <tbody>
                {report.invoices.map((v) => (
                  <tr key={v.invoice_id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-data tabular">{v.invoice_number ?? '—'}</td>
                    <td className="px-4 py-2.5">{partnerCell(v.partner_id)}</td>
                    <td className="px-4 py-2.5 font-data tabular">{v.transactions.join(', ') || '—'}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{formatMoney(v.received_sar, locale)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{money(v.remaining_sar)}</td>
                    <td className="px-4 py-2.5 font-data tabular">{v.dpin ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="finance-ledger-rows" data-finance-ledger-rows>
        <h3 id="finance-ledger-rows" className="font-display text-lg font-semibold">
          {t('finance.ledger.rows')}
        </h3>
        {report.truncated ? <p className="mt-2 text-sm text-warning">{t('finance.ledger.truncated')}</p> : null}
        {report.rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('finance.ledger.empty')}</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-raised">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs text-muted">
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.created')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.partnerName')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.transactionNumber')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.invoiceNumber')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.source')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.revenue')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.cost')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.profit')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.flags')}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={`${r.invoice_id}-${r.unit_kind}`} className="border-b border-border last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-2.5 font-data tabular">{day(r.created_on)}</td>
                    <td className="px-4 py-2.5">{partnerCell(r.partner_id)}</td>
                    <td className="px-4 py-2.5 font-data tabular">{r.transaction_number ?? '—'}</td>
                    <td className="px-4 py-2.5 font-data tabular">{r.invoice_number ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {r.isPromo
                        ? `${t(r.source === 'import' ? 'finance.ledger.sourceImport' : 'finance.ledger.sourceManual')} · ${t('finance.ledger.promoTitle')}`
                        : t(r.source === 'import' ? 'finance.ledger.sourceImport' : 'finance.ledger.sourceManual')}
                    </td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{formatMoney(r.revenue, locale)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{money(r.cost)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{money(r.profit)}</td>
                    <td className="px-4 py-2.5 text-muted">{r.flags.map(flagLabel).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {promoRows.length > 0 ? (
        <section aria-labelledby="finance-ledger-promo" data-finance-ledger-promo>
          <h3 id="finance-ledger-promo" className="font-display text-lg font-semibold">
            {t('finance.ledger.promoTitle')}
          </h3>
          <p className="mt-2 text-sm text-muted">{t('finance.ledger.promoNote')}</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-raised">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-xs text-muted">
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.created')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.partnerName')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.code')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.transactionNumber')}</th>
                  <th className="px-4 py-2 text-start font-semibold">{t('finance.ledger.invoiceNumber')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.discount')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.revenue')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.cost')}</th>
                  <th className="px-4 py-2 text-end font-semibold">{t('finance.ledger.profit')}</th>
                </tr>
              </thead>
              <tbody>
                {promoRows.map((pr) => (
                  <tr key={pr.id} className="border-b border-border last:border-b-0" data-finance-ledger-promo-row>
                    <td className="whitespace-nowrap px-4 py-2.5 font-data tabular">{day(pr.created_on)}</td>
                    <td className="px-4 py-2.5">{partnerCell(pr.partner_id)}</td>
                    <td className="px-4 py-2.5 font-data">{pr.code ?? '—'}</td>
                    <td className="px-4 py-2.5 font-data tabular">{pr.transaction_number ?? '—'}</td>
                    <td className="px-4 py-2.5 font-data tabular">{pr.invoice_number ?? '—'}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{money(pr.discount_sar)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{money(pr.revenue)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{money(pr.cost)}</td>
                    <td className="px-4 py-2.5 text-end font-data tabular">{money(pr.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TotalTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-raised px-4 py-3 shadow-1">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-data text-xl font-semibold tabular">{value}</span>
    </div>
  );
}
