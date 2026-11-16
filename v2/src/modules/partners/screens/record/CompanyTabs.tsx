'use client';
import { Banknote, Download, Hash, Receipt, Ticket, TrendingUp, Wallet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { formatDate, formatMoney, formatStoredDate } from '@/core/i18n/format';
import { ledgerRowsToCsv } from '@/modules/finance/ledger';
import { riyadhDay } from '@/modules/finance/period';
import { ledgerReportOf } from '@/modules/finance/screens/ledger-report';
import type { LedgerReport, PaymentsAsOf } from '@/modules/finance/types';
import { useFinanceRead } from '@/modules/finance/use-reads';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { KpiTile } from '@/ui/KpiTile';
import { Money } from '@/ui/Money';
import { SavedViewsBar } from '@/ui/SavedViewsBar';
import { Switch } from '@/ui/Switch';
import { FilesSection as SharedFilesSection } from '@/ui/record/FilesSection';
import type { CompanyFile, CompanySummary, Identifier, ListEntry, PartnerCard, Side } from '../../types';

/** The file kinds the company Files section offers, and the purpose each is stored under. */
const FILE_KINDS = [
  { kind: 'agreement', purpose: 'agreement' },
  { kind: 'cr_certificate', purpose: 'attachment' },
  { kind: 'vat_certificate', purpose: 'attachment' },
  { kind: 'national_address', purpose: 'attachment' },
  { kind: 'tender_document', purpose: 'tender' },
] as const;

/** A company's files, through the shared Files section (Phase 3): the same five kinds, the same words, the
 *  same rendering — the section itself now lives in src/ui/record/FilesSection.tsx. Whether a kind needs a
 *  review date comes from the live file_kind list (FIX-15), never hard-coded, so an admin's change in
 *  Settings applies; a kind missing from the live list simply asks for no review date. */
export function FilesSection({
  partnerId,
  files,
  mayWrite,
  onDone,
  fileKinds,
  hiddenFiles,
}: {
  partnerId: string;
  files: CompanyFile[] | null;
  mayWrite: boolean;
  onDone: () => void;
  fileKinds: ListEntry[];
  /** Files on the partner the reader cannot see (F-B6-02): passed through to the shared section's empty state. */
  hiddenFiles?: number | null;
}) {
  const t = useTranslations();
  return (
    <SharedFilesSection
      entity="partner"
      recordId={partnerId}
      kinds={FILE_KINDS.map((k) => ({
        kind: k.kind,
        purpose: k.purpose,
        reviewRequired: fileKinds.find((x) => x.key === k.kind)?.review_required === true,
        label: t(`partners.companyFiles.kinds.${k.kind}`),
      }))}
      files={files}
      mayWrite={mayWrite}
      onDone={onDone}
      title={t('partners.companyFiles.title')}
      // the link opens this organisation's files in All files; no line under the title (it read "Every partner's
      // files, in one place" above this one organisation's files, which it is not — V11, no hint text)
      allFilesHref={`/files?company=${partnerId}`}
      allFilesLabel={t('partners.companyFiles.allFiles')}
      hiddenFiles={hiddenFiles}
    />
  );
}

/** The white card every block of these tabs sits on (V21): 16 px corners, a hairline and the soft shadow. */
const CARD = 'rounded-lg border border-border bg-raised shadow-1';
/** A card's heading. */
const CARD_TITLE = 'text-lg font-semibold leading-6 text-strong';
/** A table that is a table where its card is wide enough and a stack of labelled rows where it is not (a phone, a
 *  narrow window): the same rows either way, so nothing ever scrolls sideways. The card carries `@container`. */
const TABLE = 'w-full text-base @max-3xl:block';
const THEAD = '@max-3xl:sr-only';
const TH = 'px-4 py-2.5 text-xs font-semibold text-muted';
const TR =
  'border-b border-border last:border-b-0 @max-3xl:grid @max-3xl:grid-cols-2 @max-3xl:gap-x-4 @max-3xl:gap-y-2 @max-3xl:px-4 @max-3xl:py-3';
const TD = 'px-4 py-3 align-top @max-3xl:block @max-3xl:min-w-0 @max-3xl:p-0';
/** A cell's column name, shown only while the table is stacked (the header row is then for screen readers only). */
const CELL_LABEL = 'block text-xs leading-4 text-muted @3xl:hidden';

/** A company's discount codes, with each code's counted totals beside it. */
export function CodesTab({ card, summary }: { card: PartnerCard; summary: CompanySummary | null }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const codes = card.identifiers.filter((i) => i.kind === 'discount_code');
  const totals = new Map<string, { units: number; revenue: number; profit: number }>();
  for (const row of summary?.codes ?? []) {
    const key = row.code.trim().toLowerCase();
    totals.set(key, { units: row.units, revenue: row.revenue, profit: row.profit });
  }
  return (
    <section className={cn(CARD, 'p-5 max-sm:p-4')} data-partner-codes>
      <h2 className={cn(CARD_TITLE, 'mb-3')}>{t('partners.companyCodes.title')}</h2>
      {codes.length ? (
        <ul className="divide-y divide-border">
          {codes.map((c) => {
            const total = totals.get(c.value.trim().toLowerCase());
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                data-company-code={c.id}
              >
                <span className="flex min-w-0 flex-col">
                  <bdi className="font-data text-base font-medium text-strong">{c.value}</bdi>
                  <span className="text-xs text-muted">
                    {c.valid_from
                      ? `${t('partners.companyCodes.valid')}: ${formatDate(c.valid_from, locale, { dateStyle: 'medium' })}`
                      : ''}
                    {c.valid_from && c.valid_to ? ' – ' : ''}
                    {c.valid_to ? formatDate(c.valid_to, locale, { dateStyle: 'medium' }) : ''}
                  </span>
                </span>
                {total ? (
                  <span className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <span className="flex flex-col items-end">
                      <span className="text-xs text-muted">{t('partners.companyCodes.units')}</span>
                      <span className="font-data">{total.units}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-xs text-muted">{t('partners.companyCodes.revenue')}</span>
                      <Money
                        value={formatMoney(total.revenue, locale)}
                        currency={t('common.sar')}
                        className="text-success"
                      />
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-xs text-muted">{t('partners.companyCodes.profit')}</span>
                      <Money value={formatMoney(total.profit, locale)} currency={t('common.sar')} />
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-muted">{t('partners.companyCodes.noTotals')}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <DataState kind="empty" compact message={t('partners.companyCodes.none')} />
      )}
    </section>
  );
}

/** One money line of the Finance tab; a missing figure reads as words, never as 0. */
function moneyRow(
  label: string,
  value: number | null,
  locale: 'en' | 'ar',
  notKnown: string,
  currency: string,
  strong = false,
) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-b border-border py-1.5 text-base last:border-b-0">
      <span className={strong ? 'font-medium text-strong' : 'text-muted'}>{label}</span>
      {value === null ? (
        <span className="text-muted">{notKnown}</span>
      ) : (
        <Money
          value={formatMoney(value, locale)}
          currency={currency}
          className={strong ? 'text-lg font-semibold text-strong' : 'text-base'}
        />
      )}
    </div>
  );
}

/** The not-yet-counted read's answer: the rows an exclusion rule keeps out, and the rows recorded but not paid yet. */
type CompanyNotCounted = {
  excluded_units: number;
  excluded_revenue: number;
  held_units: number;
  held_revenue: number;
};

/**
 * A company's money from the unified ledger (Landing 25, F-A/A1): the list and the totals both come from
 * finance.unified_ledger filtered to this company, for the year to date — the same read the Finance page uses,
 * so the two agree by construction. Hiding the imported rows hides them from the list AND the total together.
 * Profit is calculated only from the rows that have a cost: a company whose rows lack a cost shows profit empty
 * and says how many rows lack one — never 0. Anything the count leaves out is named under "Not yet counted"
 * (not fully paid imports, held rows, excluded rows), never a silent gap. The stamp is the same "as of last
 * import" date the Finance page shows.
 */
function CompanyFinanceLedger({
  partnerId,
  partnerName,
  hideImported,
  view,
}: {
  partnerId: string;
  partnerName: string;
  hideImported: boolean;
  view: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const full = useMe().levels['finance'] === 'full';
  const today = riyadhDay();
  const from = `${today.slice(0, 4)}-01-01`;
  const to = today;
  // The open view and the filter, lit the moment they are pressed (F172) and kept in the address, so Back and
  // refresh keep them — the same render-phase sync as the Finance ledger's boxes (FIX-34 R2a).
  const [currentView, setCurrentView] = useState(view || 'partner-result');
  const [seenView, setSeenView] = useState(view || 'partner-result');
  if ((view || 'partner-result') !== seenView) {
    setSeenView(view || 'partner-result');
    setCurrentView(view || 'partner-result');
  }
  const [hide, setHide] = useState(hideImported);
  const [seenHide, setSeenHide] = useState(hideImported);
  if (hideImported !== seenHide) {
    setSeenHide(hideImported);
    setHide(hideImported);
  }
  const go = (h: boolean, v = '') => {
    const q = new URLSearchParams({ tab: 'finance', ...(h ? { hideImported: '1' } : {}) });
    if (v) q.set('view', v);
    router.push(`/partners/${partnerId}?${q.toString()}`);
  };
  const openView = (v: { key: string; query?: Record<string, unknown> }) => {
    setCurrentView(v.key);
    if (!v.query) return go(hide, v.key === 'partner-result' ? '' : v.key);
    const h = v.query.hideImported === true;
    setHide(h);
    go(h, v.key);
  };
  // The tab's three reads, each failing and retrying on its own: the ledger (the list and the totals), the
  // as-of stamp, and the not-yet-counted rows. The ledger read is the Finance page's read with this company
  // set, so the two agree by construction.
  const ledger = useFinanceRead<unknown, 'finance_unified_ledger'>(
    'finance_unified_ledger',
    { p_from: from, p_to: to, p_partner: partnerId },
    `company-ledger|${partnerId}|${from}|${to}`,
  );
  const asOf = useFinanceRead<PaymentsAsOf, 'finance_payments_as_of'>('finance_payments_as_of', {}, 'company-asof');
  const notCounted = useFinanceRead<unknown, 'finance_company_not_counted'>(
    'finance_company_not_counted',
    { p_partner: partnerId, p_from: from, p_to: to },
    `company-not-counted|${partnerId}|${from}|${to}`,
  );
  const report = useMemo(
    () => (ledger.block.status === 'ready' ? ledgerReportOf(ledger.block.data) : null),
    [ledger.block],
  );
  const visibleRows = useMemo(
    () => (report ? (hide ? report.rows.filter((r) => r.source === 'manual') : report.rows) : []),
    [report, hide],
  );
  // The totals are the visible rows': hiding the imported rows hides them from the total too, and profit is
  // only the rows that have one — a row with no cost carries no profit, so a company with no costed row shows
  // profit empty, never 0.
  const units = visibleRows.length;
  const revenue = visibleRows.reduce((s, r) => s + r.revenue, 0);
  const costRows = visibleRows.filter((r) => r.cost !== null);
  const cost = costRows.length ? costRows.reduce((s, r) => s + (r.cost ?? 0), 0) : null;
  const profitRows = visibleRows.filter((r) => r.profit !== null);
  const profit = profitRows.length ? profitRows.reduce((s, r) => s + (r.profit ?? 0), 0) : null;
  const withoutCost = visibleRows.filter((r) => r.cost === null).length;
  const waiting = visibleRows.filter((r) => r.flags.includes('waiting_for_issuing')).length;
  const unconfirmed = report?.totals.unconfirmedImportUnits ?? 0;
  const nc = notCounted.block.status === 'ready' ? (notCounted.block.data as CompanyNotCounted | null) : null;
  const held = typeof nc?.held_units === 'number' ? nc.held_units : 0;
  const excluded = typeof nc?.excluded_units === 'number' ? nc.excluded_units : 0;
  const allCounted = unconfirmed === 0 && held === 0 && excluded === 0;
  const asOfDate = asOf.block.status === 'ready' ? ((asOf.block.data as PaymentsAsOf | null)?.as_of ?? null) : null;
  const flagLabel = (f: string) => (t.has(`finance.ledger.flag.${f}`) ? t(`finance.ledger.flag.${f}`) : f);
  const day = (d: string | null | undefined) => (d ? (formatStoredDate(d, locale) ?? d) : '—');
  const download = () => {
    if (!report) return;
    // The file is the view on screen: the visible rows, and their totals — a cost with no approved expense
    // stays empty in the file, never 0, the same rule as on screen (the CSV writer writes a null as empty).
    const visible: LedgerReport = {
      ...report,
      rows: visibleRows,
      totals: { ...report.totals, units, revenue, cost, profit, without_cost: withoutCost },
    } as LedgerReport;
    const csv = ledgerRowsToCsv(
      visible,
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
      () => partnerName,
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `partner-result-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const sar = t('common.sar');
  const notKnown = t('partners.companyFinance.notKnown');
  return (
    <section className="flex flex-col gap-4" data-partner-finance-ledger data-state={ledger.block.status}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-xl font-semibold leading-7 text-strong">{t('partners.companyFinance.totals')}</h2>
          <StatusChip tone="neutral">{t('finance.period.total.ytd')}</StatusChip>
        </div>
        {asOf.block.status === 'ready' ? (
          <span className="font-data text-sm text-muted tabular" data-finance-stamp>
            {asOfDate
              ? t('finance.stamp', { date: formatDate(`${asOfDate}T12:00:00Z`, locale) })
              : t('finance.stampNone')}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SavedViewsBar
          page="partner_finance"
          fixed={[{ key: 'partner-result', label: t('partners.companyFinance.partnerResult') }]}
          current={currentView}
          query={{ hideImported: hide }}
          onOpen={openView}
          canShare={full}
          onDefault={(v) => openView(v)}
          saveHint={t('finance.ledger.saveHint')}
        />
        {/* One word (13 Nov board): on shows the imported rows, off hides them from the list and the totals together.
            The address and a saved view still carry the same hideImported filter as before. */}
        <label
          className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-base font-medium text-strong sm:min-h-9"
          data-partner-finance-imported
        >
          <Switch
            checked={!hide}
            onCheckedChange={(v) => {
              setHide(!v);
              go(!v, currentView === 'partner-result' ? '' : currentView);
            }}
            label={t('partners.companyFinance.imported')}
          />
          {t('partners.companyFinance.imported')}
        </label>
      </div>
      {ledger.block.status === 'loading' || ledger.block.status === 'failed' || !report ? (
        <DataState
          kind={ledger.block.status === 'loading' ? 'loading' : 'failed'}
          message={t(
            ledger.block.status === 'loading' ? 'state.loading' : 'state.failed',
            ledger.block.status === 'loading'
              ? { what: t('partners.companyFinance.totals') }
              : { what: t('finance.ledger.failed') },
          )}
          onRetry={ledger.block.status === 'failed' ? ledger.retry : undefined}
          retryLabel={ledger.block.status === 'failed' ? t('common.tryAgain') : undefined}
        >
          {ledger.block.status === 'loading' ? (
            <>
              <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4" data-partner-finance-skeleton>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="shimmer h-[116px] rounded-lg bg-pressed max-sm:h-[96px]" />
                ))}
              </div>
              <div className="shimmer h-40 rounded-lg bg-pressed" />
            </>
          ) : null}
        </DataState>
      ) : (
        <>
          <div className="flex flex-col gap-3" data-partner-finance-totals>
            <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
              <KpiTile
                label={t('partners.companyFinance.revenue')}
                value={formatMoney(revenue, locale)}
                unit={sar}
                tone="success"
                icon={<Banknote />}
              />
              <KpiTile
                label={t('partners.companyFinance.cost')}
                value={cost === null ? null : formatMoney(cost, locale)}
                unit={sar}
                icon={<Receipt />}
                footnote={
                  cost === null ? (withoutCost > 0 ? t('partners.companyFinance.costMissing') : notKnown) : undefined
                }
              />
              <KpiTile
                label={t('partners.companyFinance.profit')}
                value={profit === null ? null : formatMoney(profit, locale)}
                unit={sar}
                icon={<TrendingUp />}
                footnote={profit === null ? notKnown : undefined}
              />
              <KpiTile label={t('partners.companyFinance.units')} value={String(units)} icon={<Ticket />} />
            </div>
            {withoutCost > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <StatusChip tone="warning">{t('partners.companyFinance.costPending')}</StatusChip>
                  {t('finance.ledger.withoutCost', { count: withoutCost })}
                </p>
                <p className="text-sm text-muted">{t('partners.companyFinance.costPendingNote')}</p>
              </div>
            ) : null}
            {waiting > 0 ? (
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <StatusChip tone="warning">{t('partners.companyFinance.waitingForIssuing')}</StatusChip>
                {t('partners.companyFinance.waitingCount', { count: waiting })}
              </p>
            ) : null}
          </div>
          <div className={cn(CARD, 'overflow-hidden')}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className={CARD_TITLE}>
                {t('finance.ledger.rows')}
                <span className="ms-2 font-data text-sm font-normal text-muted tabular">{visibleRows.length}</span>
              </h3>
              <Button variant="secondary" size="sm" icon={<Download />} onClick={download} data-finance-export>
                {t('finance.ledger.export')}
              </Button>
            </div>
            {report.truncated ? (
              <p className="border-b border-border px-4 py-2.5 text-sm text-warning">{t('finance.ledger.truncated')}</p>
            ) : null}
            {visibleRows.length === 0 ? (
              <p className="px-4 py-6 text-base text-muted" data-partner-finance-empty>
                {t('finance.ledger.empty')}
              </p>
            ) : (
              <table className={TABLE}>
                <thead className={THEAD}>
                  <tr className="border-b border-border">
                    <th className={cn(TH, 'text-start')}>{t('partners.companyFinance.reference')}</th>
                    <th className={cn(TH, 'text-start')}>{t('finance.ledger.source')}</th>
                    <th className={cn(TH, 'text-start')}>{t('finance.ledger.created')}</th>
                    <th className={cn(TH, 'text-end')}>{t('finance.ledger.revenue')}</th>
                    <th className={cn(TH, 'text-end')}>{t('finance.ledger.cost')}</th>
                    <th className={cn(TH, 'text-end')}>{t('finance.ledger.profit')}</th>
                    <th className={cn(TH, 'text-start')}>{t('finance.ledger.flags')}</th>
                  </tr>
                </thead>
                <tbody className="@max-3xl:block">
                  {visibleRows.map((r) => (
                    <tr key={`${r.invoice_id}-${r.unit_kind}`} className={TR} data-partner-finance-row>
                      {/* the reference: the transaction number, with the invoice number named under it */}
                      <td className={cn(TD, '@max-3xl:col-span-2')}>
                        <bdi className="block font-data font-medium text-strong tabular">
                          {r.transaction_number ?? '—'}
                        </bdi>
                        <span className="block text-xs leading-4 text-muted">
                          {t('finance.ledger.invoiceNumber')}{' '}
                          <bdi className="font-data tabular">{r.invoice_number ?? '—'}</bdi>
                        </span>
                      </td>
                      <td className={TD}>
                        <span className={CELL_LABEL}>{t('finance.ledger.source')}</span>
                        <StatusChip tone={r.source === 'import' ? 'info' : 'neutral'}>
                          {t(r.source === 'import' ? 'finance.ledger.sourceImport' : 'finance.ledger.sourceManual')}
                        </StatusChip>
                      </td>
                      <td className={cn(TD, 'whitespace-nowrap font-data tabular')}>
                        <span className={cn(CELL_LABEL, 'font-ui')}>{t('finance.ledger.created')}</span>
                        {day(r.created_on)}
                      </td>
                      <td className={cn(TD, 'font-data text-success tabular @3xl:text-end')}>
                        <span className={cn(CELL_LABEL, 'font-ui')}>{t('finance.ledger.revenue')}</span>
                        {formatMoney(r.revenue, locale)}
                      </td>
                      <td className={cn(TD, 'font-data tabular @3xl:text-end')}>
                        <span className={cn(CELL_LABEL, 'font-ui')}>{t('finance.ledger.cost')}</span>
                        {r.cost === null ? t('finance.ledger.noCost') : formatMoney(r.cost, locale)}
                      </td>
                      <td className={cn(TD, 'font-data tabular @3xl:text-end')}>
                        <span className={cn(CELL_LABEL, 'font-ui')}>{t('finance.ledger.profit')}</span>
                        {r.profit === null ? t('finance.ledger.noCost') : formatMoney(r.profit, locale)}
                      </td>
                      <td className={cn(TD, 'text-sm text-muted', !r.flags.length && '@max-3xl:hidden')}>
                        <span className={CELL_LABEL}>{t('finance.ledger.flags')}</span>
                        {r.flags.map(flagLabel).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className={cn(CARD, 'flex flex-col gap-2 p-5 max-sm:p-4')} data-partner-finance-not-counted>
            <h3 className={CARD_TITLE}>{t('partners.companyFinance.notYetCounted')}</h3>
            {unconfirmed > 0 ? (
              <p className="text-base text-muted" data-partner-finance-unconfirmed>
                {t('finance.ledger.unconfirmed', { count: unconfirmed })}
              </p>
            ) : null}
            {notCounted.block.status === 'loading' ? (
              <DataState
                kind="loading"
                message={t('state.loading', { what: t('partners.companyFinance.notYetCounted') })}
              />
            ) : null}
            {notCounted.block.status === 'failed' ? (
              <DataState
                kind="failed"
                message={t('state.failed', { what: t('partners.companyFinance.notYetCounted') })}
                onRetry={notCounted.retry}
                retryLabel={t('common.tryAgain')}
              />
            ) : null}
            {notCounted.block.status === 'ready' && held > 0 ? (
              <p className="text-base text-muted" data-partner-finance-held>
                {t('partners.companyFinance.heldRows', { count: held })}
              </p>
            ) : null}
            {notCounted.block.status === 'ready' && excluded > 0 ? (
              <p className="text-base text-muted" data-partner-finance-excluded>
                {t('partners.companyFinance.excludedRows', { count: excluded })}
              </p>
            ) : null}
            {notCounted.block.status === 'ready' && allCounted ? (
              <p className="flex items-center gap-2 text-base text-muted">
                <StatusChip tone="success">{t('partners.companyFinance.allCounted')}</StatusChip>
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * A company's money: its counted totals as the Finance page's cards (Revenue in the Revenue green) with the two
 * Provisional flags and the ledger rows under them, then its client IDs grouped by kind, its wallet roll-up, and its
 * tenders with invoiced, remaining and actual profit beside expected profit.
 * No VAT is shown anywhere; a figure with no source is empty, never 0.
 */
export function FinanceTab({
  card,
  summary,
  onRetry,
  side,
  hideImported,
  view,
}: {
  card: PartnerCard;
  summary: CompanySummary | null;
  onRetry: () => void;
  /** The record's side: its identifiers are client IDs on a client, supplier IDs on a supplier (F140). */
  side: Side;
  /** The Finance tab's imported-rows filter, from the address (?hideImported=1). */
  hideImported: boolean;
  /** The open saved view's id, from the address — '' for the plain view. */
  view: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  if (summary === null) {
    return (
      <DataState
        kind="failed"
        what={t('partners.companyFinance.title')}
        onRetry={onRetry}
        retryLabel={t('common.tryAgain')}
      />
    );
  }
  if (!summary.finance_visible || summary.wallet === null || summary.finance === null) {
    return (
      <DataState
        kind="no-access"
        what={t('partners.companyFinance.title')}
        message={t('partners.companyFinance.noAccess')}
      />
    );
  }
  const wallet = summary.wallet;
  const groups = (['prepaid', 'postpaid', 'tender'] as const).map((sub) => ({
    sub,
    rows: card.identifiers.filter((i) => i.kind === 'payments_client_id' && i.subkind === sub),
  }));
  const otherIds = card.identifiers.filter((i) => i.kind === 'payments_client_id' && !i.subkind);
  const hasTender = groups.find((g) => g.sub === 'tender')!.rows.length > 0 || (summary.tenders ?? []).length > 0;
  const partnerName = locale === 'ar' && card.trade_name_ar ? card.trade_name_ar : card.trade_name_en;
  const notKnown = t('partners.companyFinance.notKnown');
  const sar = t('common.sar');
  /** One client (or supplier) ID as the boards draw it: a mono tag. */
  const idTag = (i: Identifier) => (
    <li
      key={i.id}
      className="inline-flex h-7 items-center rounded-pill bg-surface px-3 font-data text-sm text-strong tabular"
      data-client-id={i.id}
    >
      <bdi>{i.value}</bdi>
    </li>
  );

  return (
    <div className="@container flex flex-col gap-5" data-partner-finance>
      <CompanyFinanceLedger partnerId={card.id} partnerName={partnerName} hideImported={hideImported} view={view} />

      <div className="grid gap-5 @3xl:grid-cols-2">
        <section className={cn(CARD, 'p-5 max-sm:p-4')} data-partner-finance-ids>
          <h2 className={cn(CARD_TITLE, 'mb-3 flex items-center gap-2.5')}>
            <span
              aria-hidden="true"
              className="inline-grid size-8 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent-ink"
            >
              <Hash className="size-4" />
            </span>
            {side === 'client' ? t('partners.companyFinance.clientIds') : t('partners.companyFinance.supplierIds')}
          </h2>
          {groups.some((g) => g.rows.length) || otherIds.length ? (
            <div className="flex flex-col gap-3">
              {groups.map((g) =>
                g.rows.length ? (
                  <div key={g.sub}>
                    <h3 className="mb-1.5 text-sm font-medium text-muted">
                      {t(`partners.identifier.subkinds.${g.sub}`)}
                    </h3>
                    <ul className="flex flex-wrap gap-2">{g.rows.map(idTag)}</ul>
                  </div>
                ) : null,
              )}
              {otherIds.length ? (
                <div>
                  <h3 className="mb-1.5 text-sm font-medium text-muted">
                    {side === 'client'
                      ? t('partners.identifier.kinds.payments_client_id')
                      : t('partners.identifier.kinds.supplier_id')}
                  </h3>
                  <ul className="flex flex-wrap gap-2">{otherIds.map(idTag)}</ul>
                </div>
              ) : null}
              {hasTender ? (
                <StatusChip tone="info" className="w-fit">
                  {t('partners.identifier.subkinds.tender')}
                </StatusChip>
              ) : null}
            </div>
          ) : (
            <DataState
              kind="empty"
              compact
              message={
                side === 'client'
                  ? t('partners.companyFinance.clientIdsNone')
                  : t('partners.companyFinance.supplierIdsNone')
              }
            />
          )}
        </section>

        <section className={cn(CARD, 'p-5 max-sm:p-4')} data-partner-finance-wallet>
          <h2 className={cn(CARD_TITLE, 'mb-3 flex items-center gap-2.5')}>
            <span
              aria-hidden="true"
              className="inline-grid size-8 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent-ink"
            >
              <Wallet className="size-4" />
            </span>
            {t('partners.companyFinance.wallet')}
          </h2>
          {moneyRow(t('partners.companyFinance.toppedUp'), wallet.topped_up, locale, notKnown, sar)}
          {moneyRow(t('partners.companyFinance.walletSpent'), wallet.wallet_spent, locale, notKnown, sar)}
          {moneyRow(t('partners.companyFinance.invoicedTotal'), wallet.invoiced_total, locale, notKnown, sar)}
          {moneyRow(t('partners.companyFinance.balance'), wallet.balance, locale, notKnown, sar, true)}
          {moneyRow(t('partners.companyFinance.held'), wallet.held, locale, notKnown, sar)}
          {moneyRow(t('partners.companyFinance.available'), wallet.available, locale, notKnown, sar, true)}
          <p className="mt-2 text-sm text-muted">{t('partners.companyFinance.heldNotRecorded')}</p>
        </section>
      </div>

      <section className={cn(CARD, 'p-5 max-sm:p-4')} data-partner-finance-tenders>
        <h2 className={cn(CARD_TITLE, 'mb-3')}>{t('partners.companyFinance.tenders')}</h2>
        {summary.tenders?.length ? (
          <ul className="divide-y divide-border">
            {summary.tenders.map((u) => (
              <li key={u.id} className="py-3 first:pt-0 last:pb-0" data-company-tender={u.id}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-base font-medium text-strong">{u.title}</span>
                  <bdi className="font-data text-xs text-muted">{u.number}</bdi>
                  <StatusChip tone={u.state === 'signed' ? 'success' : 'neutral'}>
                    {t(`partners.companyFinance.state.${u.state}`)}
                  </StatusChip>
                  {u.cost_pending ? (
                    <StatusChip tone="warning">{t('partners.companyFinance.costPending')}</StatusChip>
                  ) : null}
                </div>
                {u.state === 'applied' ? (
                  <p className="text-sm text-muted">{t('partners.companyFinance.appliedNote')}</p>
                ) : null}
                {!u.client_id_named ? (
                  <p className="text-sm text-muted">{t('partners.companyFinance.noClientId')}</p>
                ) : null}
                <div className="grid gap-x-8 @3xl:grid-cols-2">
                  {moneyRow(t('partners.companyFinance.tenderAmount'), u.tender_amount, locale, notKnown, sar)}
                  {moneyRow(t('partners.companyFinance.invoiced'), u.invoiced, locale, notKnown, sar)}
                  {moneyRow(t('partners.companyFinance.remaining'), u.remaining, locale, notKnown, sar)}
                  {moneyRow(t('partners.companyFinance.expectedProfit'), u.expected_profit, locale, notKnown, sar)}
                  {moneyRow(t('partners.companyFinance.actualProfit'), u.actual_profit, locale, notKnown, sar)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <DataState kind="empty" compact message={t('partners.companyFinance.tendersNone')} />
        )}
      </section>
    </div>
  );
}
