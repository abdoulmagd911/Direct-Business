'use client';
import { Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatMoney, formatStoredDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { EntityLink } from '@/ui/EntityLink';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { Select } from '@/ui/Select';
import { DEAL_TYPES, filterByDeal, sortByDeal, type DealFilter, type DealType } from '../deal-type';
import { isCounted, ledgerRowsToCsv } from '../ledger';
import type { LedgerReport, LedgerRow } from '../types';
import { DealPills, DealTypeTable } from './DealMarks';
import { NUM, TD, TH } from './parts';

type Locale = 'en' | 'ar';

/** How many rows a narrow place (a phone) lists before "See all" (the 13 Nov phone board). */
const NARROW_ROWS = 5;
/** A column that only a wide enough card has room for; narrower, its value sits under the row's first cell. */
const FROM_600 = 'hidden @min-[600px]:table-cell';
const FROM_860 = 'hidden @min-[860px]:table-cell';
const FROM_1000 = 'hidden @min-[1000px]:table-cell';
/** The two flags that are said as a warning pill on the row itself (Landing 32, A3), never in the flags text. */
const CODE_FLAGS = ['code_not_found', 'code_held'];

/** Exclude takes a counted row out of every figure; Include brings a row excluded by hand back. */
export type LedgerToggle = 'exclude' | 'include';

/**
 * The Finance report itself (workstream B), in the V21 look: the unified ledger's five figures in one strip (Revenue
 * the one green figure), then received and remaining by partner, then the invoices, then the unit rows with their
 * transaction number and invoice number apart, then the discount-code rows kept apart from those totals. A view with
 * nothing in it is one line, not five figures of 0 and three empty tables. A cost with no approved expense is "Not
 * known yet", never 0, and its profit with it; settlement is never shown; there is no VAT anywhere here.
 * No table scrolls sideways: each one fits the card it is in — a column the card has no room for moves under the
 * row's first cell (the report is its own container, so this follows the card's width, not the window's).
 * Landing 32: every row says whether it is counted; a row that is not is listed apart, under "Not counted (N)", with
 * its revenue and the reason typed, and is in no total (the totals are the database's own — nothing is added here).
 * An admin (`canToggle`) may Exclude a counted row or Include one excluded by hand, each with a reason; a row a list
 * rule catches points to Settings → Finance instead. A code text that matched no code, or more than one, is said on
 * the row. With no counted cost there is no Cost and no Profit to show: a dash and the words, never 0.
 * Landing 37 (A6): a document that is not fully paid yet — Pending, Draft, part paid, an imported row not confirmed
 * paid — is listed under "Not yet counted (N)" with its amount, what is left on it and its status. It is in no figure:
 * the strip and every table above are the database's own totals, and this list adds nothing to them.
 * Landing 47: every row says its deal type — prepaid, postpaid, tender or promo, or that it is not set (A5) — and,
 * where it applies, "Paid · receivable" (A12), "Tax invoice issued" (A14) and which commission it is (A7). "By deal
 * type" lists the database's own lines per deal type, and filters and sorts the row list under it; a person with Full
 * on Finance (`canSetDealType`) sets a row's deal type with a reason. None of it reads or changes a figure.
 */
export function FinanceReport({
  report,
  loading,
  failed,
  onRetry,
  onToggle,
  onSetDealType,
}: {
  report: LedgerReport | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** Runs Exclude / Include for one row with the reason typed; it throws in the database's words when refused. */
  onToggle?: (kind: LedgerToggle, row: LedgerRow, reason: string) => Promise<void>;
  /** Sets one row's deal type (null = let the rule decide again) with the reason typed; throws when refused. */
  onSetDealType?: (row: LedgerRow, type: DealType | null, reason: string) => Promise<void>;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  // a narrow place lists the first rows and offers the rest; a table wide enough always lists them all
  const [allRows, setAllRows] = useState(false);
  const [allWaiting, setAllWaiting] = useState(false);
  // the row Exclude / Include was pressed on; it stays while the box closes, so its title never blanks mid-way
  const [asked, setAsked] = useState<{ kind: LedgerToggle; row: LedgerRow } | null>(null);
  const [asking, setAsking] = useState(false);
  // Landing 47: the deal-type filter and sort over the row list, and the row whose deal type is being set
  const [dealFilter, setDealFilter] = useState<DealFilter>('all');
  const [dealSorted, setDealSorted] = useState(false);
  const [dealRow, setDealRow] = useState<LedgerRow | null>(null);
  const [dealChoice, setDealChoice] = useState<DealType | 'none'>('none');
  const [dealAsking, setDealAsking] = useState(false);
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
        dealType: t('finance.ledger.deal.filterLabel'),
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
  /** The flags said as text: the two code flags are a warning pill on the row instead (codePill). */
  const flagsText = (flags: string[]) =>
    flags
      .filter((f) => !CODE_FLAGS.includes(f))
      .map(flagLabel)
      .join(' · ');
  /**
   * "Code has not been found" / "Held: more than one code carries this text" (A3): a visible warning on the row, from
   * its flags or from what its code text matched — said once, whichever of the two carries it.
   */
  const codePill = (r: { flags?: string[]; code_state?: LedgerRow['code_state'] }): ReactNode => {
    const state =
      r.code_state === 'ambiguous' || r.flags?.includes('code_held')
        ? 'ambiguous'
        : r.code_state === 'not_found' || r.flags?.includes('code_not_found')
          ? 'not_found'
          : null;
    if (!state) return null;
    return (
      <span className="mt-1 block" data-ledger-code-state={state}>
        <StatusChip tone="warning" className="h-auto min-h-6 whitespace-normal py-0.5">
          {t(state === 'not_found' ? 'finance.ledger.codeNotFound' : 'finance.ledger.codeHeld')}
        </StatusChip>
      </span>
    );
  };
  // Exclude / Include: admins only, and only on a row that names itself (its number, and the organisation it is
  // recorded under). Everyone else reads the column and the reasons, with no button.
  const mayToggle = (r: LedgerRow) => report.canToggle === true && !!onToggle && !!r.number && !!r.source_partner_id;
  const ask = (kind: LedgerToggle, row: LedgerRow) => {
    setAsked({ kind, row });
    setAsking(true);
  };
  const countedRows = report.rows.filter(isCounted);
  // the counted rows as listed: the deal-type filter, then the sort — the figures above never follow them
  const filteredRows = filterByDeal(countedRows, dealFilter);
  const listedRows = dealSorted ? sortByDeal(filteredRows) : filteredRows;
  const maySetDeal = (r: LedgerRow) =>
    report.canSetDealType === true && !!onSetDealType && !!r.number && (r.source === 'manual' || !!r.source_partner_id);
  const askDeal = (row: LedgerRow) => {
    setDealRow(row);
    setDealChoice(row.deal_type_by === 'person' && row.deal_type ? row.deal_type : 'none');
    setDealAsking(true);
  };
  const notCountedRows = report.rows.filter((r) => !isCounted(r));
  // a stored day (2026-11-08) is written the one way, 8 Nov 2026 (W-daily 13)
  const day = (d: string | null | undefined) => (d ? (formatStoredDate(d, locale) ?? d) : '—');
  const total = report.totals;
  const promoRows = report.promoRows ?? [];
  // the documents not fully paid yet: listed apart, in no figure (Landing 37)
  const waitingRows = report.notYetCounted ?? [];
  const unconfirmed = total.unconfirmedImportUnits ? (
    <p className="text-sm text-muted" data-finance-ledger-unconfirmed>
      {t('finance.ledger.unconfirmed', { count: total.unconfirmedImportUnits })}
    </p>
  ) : null;
  if (
    report.rows.length === 0 &&
    report.invoices.length === 0 &&
    report.by_company.length === 0 &&
    promoRows.length === 0 &&
    waitingRows.length === 0
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
          tone={total.profit !== null && total.profit < 0 ? 'danger' : undefined}
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

      {/* "Income by company" — the owner's own words for this table (Landing 34, item 18), and a place with an address
          of its own (…/finance#finance-company), like Income by service */}
      <Block
        id="finance-ledger-companies"
        anchor="finance-company"
        title={t('finance.ledger.byCompany')}
        data-finance-ledger-companies
        data-finance-by-company
      >
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
                      <Pair label={t('finance.ledger.cost')} value={known(c.cost)} />
                      <Pair label={t('finance.ledger.profit')} value={known(c.profit)} />
                      <Pair label={t('finance.ledger.received')} value={formatMoney(c.received, locale)} />
                    </Under>
                  </td>
                  <td className={cn(TD, NUM)}>{formatMoney(c.revenue, locale)}</td>
                  <td className={cn(TD, NUM, FROM_600)} data-ledger-partner-cost>
                    {known(c.cost)}
                  </td>
                  <td className={cn(TD, NUM, FROM_600)} data-ledger-partner-profit>
                    {known(c.profit)}
                  </td>
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
        {countedRows.length === 0 ? null : (
          <DealTypeTable
            lines={report.byDealType ?? []}
            filter={dealFilter}
            onFilter={setDealFilter}
            sorted={dealSorted}
            onSort={setDealSorted}
            partial={report.truncated}
          />
        )}
        {countedRows.length === 0 ? (
          empty
        ) : listedRows.length === 0 ? (
          <p className="border-t border-border px-4 py-4 text-base text-muted sm:px-5" data-ledger-deal-none>
            {t('finance.ledger.deal.noneOfType')}
          </p>
        ) : (
          <>
            <table className="w-full border-collapse border-t border-border">
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
                  <th className={TH}>{t('finance.ledger.countedTitle')}</th>
                </tr>
              </thead>
              <tbody>
                {listedRows.map((r, i) => {
                  const pills = sourcePills(r);
                  const flags = flagsText(r.flags);
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
                        {codePill(r)}
                        <DealPills row={r} onSet={maySetDeal(r) ? () => askDeal(r) : undefined} />
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
                      <td className={TD} data-ledger-counted="yes">
                        <span className="flex flex-col items-start gap-1.5">
                          <StatusChip tone="success">{t('finance.ledger.countedYes')}</StatusChip>
                          {mayToggle(r) ? (
                            <Button
                              variant="secondary"
                              size="xs"
                              className="max-sm:min-h-11"
                              onClick={() => ask('exclude', r)}
                              data-ledger-exclude
                            >
                              {t('finance.ledger.exclude')}
                            </Button>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!allRows && listedRows.length > NARROW_ROWS ? (
              <div className="border-t border-border px-2 py-2 @min-[600px]:hidden">
                <Button variant="ghost" size="sm" onClick={() => setAllRows(true)} data-finance-ledger-see-all>
                  {t('finance.ledger.seeAll', { count: listedRows.length })}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Block>

      {waitingRows.length > 0 ? (
        <Block
          id="finance-ledger-not-yet-counted"
          anchor="finance-ledger-waiting"
          title={t('finance.ledger.notYetCountedTitle', { count: waitingRows.length })}
          data-ledger-not-yet-counted
        >
          <p className="px-4 pb-3 text-sm text-muted sm:px-5">
            {t('finance.ledger.notYetCountedNote')}{' '}
            <span className="whitespace-nowrap" data-ledger-not-yet-counted-total>
              {t('finance.ledger.notYetCountedTotal')}:{' '}
              <bdi className="font-data text-text tabular">
                {formatMoney(total.notYetCountedAmount ?? waitingRows.reduce((s, r) => s + r.amount, 0), locale)}
              </bdi>
            </span>
          </p>
          {/* each document as its own lines, at every width: its number and amount, then its status and what is left */}
          <ul className="flex flex-col border-t border-border">
            {waitingRows.map((r, i) => (
              <li
                key={`${r.source}-${r.invoice_id}-${r.unit_kind}`}
                className={cn(
                  'flex flex-col gap-1.5 border-b border-border px-4 py-3 text-sm leading-5 last:border-b-0 sm:px-5',
                  !allWaiting && i >= NARROW_ROWS && '@max-[599px]:hidden',
                )}
                data-ledger-not-yet-counted-row={r.source}
                data-number={r.number ?? undefined}
              >
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <bdi className="font-data font-medium text-strong tabular [overflow-wrap:anywhere]">
                    {r.number ?? '—'}
                  </bdi>
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {r.partner_id ? (
                      <EntityLink
                        kind="partner"
                        href={`/partners/${r.partner_id}`}
                        className="[overflow-wrap:anywhere]"
                      >
                        {(locale === 'ar' && r.trade_name_ar ? r.trade_name_ar : r.trade_name_en) ??
                          r.partner_number ??
                          t('finance.ledger.noPartner')}
                      </EntityLink>
                    ) : (
                      <span className="text-muted">{t('finance.ledger.noPartner')}</span>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-muted">{day(r.created_on)}</span>
                  <span className="ms-auto whitespace-nowrap" data-ledger-not-yet-counted-amount>
                    <span className="text-muted">{t('finance.ledger.notYetCountedAmount')} </span>
                    <bdi className="font-data tabular">{formatMoney(r.amount, locale)}</bdi>
                  </span>
                </span>
                {r.transaction_number && r.invoice_number ? (
                  <Pair label={t('finance.ledger.invoiceNumber')} value={r.invoice_number} block />
                ) : null}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5" data-ledger-counted="not-yet">
                  <StatusChip tone="warning">{t('finance.ledger.notYetCountedPill')}</StatusChip>
                  {r.source === 'import' ? (
                    <StatusChip tone="info">{t('finance.ledger.sourceImport')}</StatusChip>
                  ) : null}
                  {r.deal_type ? (
                    <span data-ledger-deal-type={r.deal_type}>
                      <StatusChip tone="neutral">{t(`finance.ledger.deal.type.${r.deal_type}`)}</StatusChip>
                    </span>
                  ) : null}
                  {r.status ? (
                    <span className="min-w-0 [overflow-wrap:anywhere]" data-ledger-not-yet-counted-status>
                      <span className="text-muted">{t('finance.ledger.status')}: </span>
                      <bdi>{r.status}</bdi>
                    </span>
                  ) : null}
                  {r.remaining !== null ? (
                    <span className="whitespace-nowrap" data-ledger-not-yet-counted-remaining>
                      <span className="text-muted">{t('finance.ledger.remaining')} </span>
                      <bdi className="font-data tabular">{formatMoney(r.remaining, locale)}</bdi>
                    </span>
                  ) : null}
                  {r.direct_url ? (
                    <a
                      href={r.direct_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-6 items-center gap-1 font-medium text-link underline decoration-border-strong underline-offset-[3px] hover:decoration-current max-sm:min-h-11"
                      data-ledger-direct-link
                    >
                      {t('finance.ledger.openInDirect')}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {!allWaiting && waitingRows.length > NARROW_ROWS ? (
            <div className="border-t border-border px-2 py-2 @min-[600px]:hidden">
              <Button variant="ghost" size="sm" onClick={() => setAllWaiting(true)} data-ledger-not-yet-counted-see-all>
                {t('finance.ledger.seeAll', { count: waitingRows.length })}
              </Button>
            </div>
          ) : null}
        </Block>
      ) : null}

      {notCountedRows.length > 0 ? (
        <Block
          id="finance-ledger-not-counted"
          title={t('finance.ledger.notCountedTitle', { count: notCountedRows.length })}
          data-ledger-not-counted
        >
          <p className="px-4 pb-3 text-sm text-muted sm:px-5">{t('finance.ledger.notCountedNote')}</p>
          {/* each row as its own lines, at every width: its number and revenue, then why it does not count */}
          <ul className="flex flex-col border-t border-border">
            {notCountedRows.map((r) => (
              <li
                key={`${r.invoice_id}-${r.unit_kind}`}
                className="flex flex-col gap-1.5 border-b border-border px-4 py-3 text-sm leading-5 last:border-b-0 sm:px-5"
                data-ledger-not-counted-row
              >
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <bdi className="font-data font-medium text-strong tabular [overflow-wrap:anywhere]">
                    {r.number ?? r.transaction_number ?? r.invoice_number ?? '—'}
                  </bdi>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{partnerCell(r.partner_id)}</span>
                  <span className="whitespace-nowrap text-muted">{day(r.created_on)}</span>
                  <span className="ms-auto whitespace-nowrap" data-ledger-not-counted-revenue>
                    <span className="text-muted">{t('finance.ledger.revenue')} </span>
                    <bdi className="font-data tabular">{formatMoney(r.revenue, locale)}</bdi>
                  </span>
                </span>
                {codePill(r)}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5" data-ledger-counted="no">
                  <StatusChip tone="neutral">{t('finance.ledger.countedNo')}</StatusChip>
                  <span className="min-w-0 [overflow-wrap:anywhere]" data-ledger-not-counted-reason>
                    <span className="text-muted">{t('finance.ledger.reason')}: </span>
                    {r.not_counted_reason ?? t('finance.ledger.noReason')}
                  </span>
                  {r.excluded_row_level ? (
                    mayToggle(r) ? (
                      <Button
                        variant="secondary"
                        size="xs"
                        className="max-sm:min-h-11"
                        onClick={() => ask('include', r)}
                        data-ledger-include
                      >
                        {t('finance.ledger.include')}
                      </Button>
                    ) : null
                  ) : (
                    // a list rule catches it: no Include here — the rule is changed where the lists are kept
                    <span className="basis-full text-muted" data-ledger-by-list-rule>
                      {t('finance.ledger.byListRule')}
                      {r.excluded_by && t.has(`finance.ledger.excludedBy.${r.excluded_by}`)
                        ? ` · ${t(`finance.ledger.excludedBy.${r.excluded_by}`)}`
                        : ''}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

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
                    {codePill(pr)}
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

      {onToggle && report.canToggle ? (
        <ReasonDialog
          open={asking}
          onOpenChange={setAsking}
          title={t(asked?.kind === 'include' ? 'finance.ledger.includeTitle' : 'finance.ledger.excludeTitle', {
            number: asked?.row.number ?? '',
          })}
          body={t(asked?.kind === 'include' ? 'finance.ledger.includeBody' : 'finance.ledger.excludeBody')}
          words={{
            reason: t('finance.ledger.reasonRequired'),
            save: t(asked?.kind === 'include' ? 'finance.ledger.include' : 'finance.ledger.exclude'),
            cancel: t('common.cancel'),
            reasonRequired: t('errors.common.reason_required'),
          }}
          onSave={async (reason) => {
            if (asked) await onToggle(asked.kind, asked.row, reason);
          }}
        />
      ) : null}
      {onSetDealType && report.canSetDealType ? (
        <ReasonDialog
          open={dealAsking}
          onOpenChange={setDealAsking}
          title={t('finance.ledger.deal.setTitle', { number: dealRow?.number ?? '' })}
          body={t('finance.ledger.deal.setBody')}
          words={{
            reason: t('finance.ledger.reasonRequired'),
            save: t('common.save'),
            cancel: t('common.cancel'),
            reasonRequired: t('errors.common.reason_required'),
          }}
          onSave={async (reason) => {
            if (dealRow) await onSetDealType(dealRow, dealChoice === 'none' ? null : dealChoice, reason);
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium text-strong">
            {t('finance.ledger.deal.filterLabel')}
            <Select
              value={dealChoice}
              onValueChange={(v) => setDealChoice(v as DealType | 'none')}
              options={[
                { value: 'none', label: t('finance.ledger.deal.letRuleDecide') },
                ...DEAL_TYPES.map((d) => ({ value: d, label: t(`finance.ledger.deal.type.${d}`) })),
              ]}
              aria-label={t('finance.ledger.deal.filterLabel')}
              data-ledger-deal-choice
            />
          </label>
        </ReasonDialog>
      ) : null}
    </div>
  );
}

/** One part of the report: its heading, then its table edge to edge inside the card. */
function Block({
  id,
  anchor,
  title,
  children,
  ...rest
}: {
  id: string;
  /** The part's own address on the page (…#anchor), when it has one. */
  anchor?: string;
  title: string;
  children: ReactNode;
} & Record<`data-${string}`, string | boolean | undefined>) {
  // The part is drawn only once the ledger has answered, long after the browser looked for the address's #anchor:
  // an address that names this part is taken to it now.
  const here = useRef<HTMLElement>(null);
  useEffect(() => {
    if (anchor && window.location.hash === `#${anchor}`) here.current?.scrollIntoView({ block: 'start' });
  }, [anchor]);
  return (
    <section
      ref={here}
      id={anchor}
      aria-labelledby={id}
      className="flex min-w-0 scroll-mt-20 flex-col border-t border-border"
      {...rest}
    >
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
 * 20/28. Revenue is the one green figure and a loss is red; every other figure stays neutral. A figure that is not
 * known (Cost and Profit while no counted row has a cost) is a dash with "Not known yet" — never 0, and no "SAR".
 */
function StripFigure({
  kind,
  label,
  value,
  tone,
}: {
  kind: string;
  label: string;
  /** Null: there is no such figure to show (no counted row has a cost) — a dash and the words, never 0. */
  value: number | null;
  tone?: 'success' | 'danger';
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  if (value === null)
    return (
      <span
        className="flex min-w-0 flex-col"
        data-finance-ledger-total={kind}
        data-ledger-cost-empty={kind === 'cost' ? '' : undefined}
        data-ledger-figure-empty=""
      >
        <span className="text-sm leading-[18px] text-muted">{label}</span>
        <span className="font-display text-xl font-semibold leading-7 text-muted">
          {t('finance.ledger.noCost')}
          <small className="ms-1 font-ui text-sm font-medium text-muted" data-not-known>
            {t('finance.ledger.notKnown')}
          </small>
        </span>
      </span>
    );
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
