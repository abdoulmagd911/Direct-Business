'use client';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate, formatMoney } from '@/core/i18n/format';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Money } from '@/ui/Money';
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
      allFilesHref={`/files?company=${partnerId}`}
      allFilesLabel={t('partners.companyFiles.allFiles')}
      intro={t('partners.companyFiles.allFilesHint')}
      hiddenFiles={hiddenFiles}
    />
  );
}

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
    <section className="rounded-lg border border-border bg-raised p-5" data-partner-codes>
      <h2 className="mb-3 text-base font-semibold">{t('partners.companyCodes.title')}</h2>
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
                  <span className="font-data text-sm font-medium">{c.value}</span>
                  <span className="text-xs text-muted">
                    {c.valid_from
                      ? `${t('partners.companyCodes.valid')}: ${formatDate(c.valid_from, locale, { dateStyle: 'medium' })}`
                      : ''}
                    {c.valid_from && c.valid_to ? ' – ' : ''}
                    {c.valid_to ? formatDate(c.valid_to, locale, { dateStyle: 'medium' }) : ''}
                  </span>
                </span>
                {total ? (
                  <span className="flex gap-5 text-sm">
                    <span className="flex flex-col items-end">
                      <span className="text-xs text-muted">{t('partners.companyCodes.units')}</span>
                      <span className="font-data">{total.units}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-xs text-muted">{t('partners.companyCodes.revenue')}</span>
                      <Money value={formatMoney(total.revenue, locale)} currency={t('common.sar')} />
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
        <DataState kind="empty" message={t('partners.companyCodes.none')} />
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
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {value === null ? (
        <span className="text-muted">{notKnown}</span>
      ) : (
        <Money
          value={formatMoney(value, locale)}
          currency={currency}
          className={strong ? 'text-base font-semibold' : undefined}
        />
      )}
    </div>
  );
}

/**
 * A company's money: its client IDs grouped by kind, its wallet roll-up, its counted totals with the two
 * Provisional flags, and its tenders with invoiced, remaining and actual profit beside expected profit.
 * No VAT is shown anywhere; a figure with no source is empty, never 0.
 */
export function FinanceTab({
  card,
  summary,
  onRetry,
  side,
}: {
  card: PartnerCard;
  summary: CompanySummary | null;
  onRetry: () => void;
  /** The record's side: its identifiers are client IDs on a client, supplier IDs on a supplier (F140). */
  side: Side;
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
  const fin = summary.finance;
  const groups = (['prepaid', 'postpaid', 'tender'] as const).map((sub) => ({
    sub,
    rows: card.identifiers.filter((i) => i.kind === 'payments_client_id' && i.subkind === sub),
  }));
  const otherIds = card.identifiers.filter((i) => i.kind === 'payments_client_id' && !i.subkind);
  const hasTender = groups.find((g) => g.sub === 'tender')!.rows.length > 0 || (summary.tenders ?? []).length > 0;

  return (
    <div className="flex flex-col gap-6" data-partner-finance>
      <section className="rounded-lg border border-border bg-raised p-5">
        <h2 className="mb-3 text-base font-semibold">
          {side === 'client' ? t('partners.companyFinance.clientIds') : t('partners.companyFinance.supplierIds')}
        </h2>
        {groups.some((g) => g.rows.length) || otherIds.length ? (
          <div className="flex flex-col gap-3">
            {groups.map((g) =>
              g.rows.length ? (
                <div key={g.sub}>
                  <h3 className="mb-1 text-sm font-medium">{t(`partners.identifier.subkinds.${g.sub}`)}</h3>
                  <ul className="flex flex-col gap-1">
                    {g.rows.map((i: Identifier) => (
                      <li key={i.id} className="font-data text-sm" data-client-id={i.id}>
                        {i.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
            {otherIds.length ? (
              <div>
                <h3 className="mb-1 text-sm font-medium">
                  {side === 'client'
                    ? t('partners.identifier.kinds.payments_client_id')
                    : t('partners.identifier.kinds.supplier_id')}
                </h3>
                <ul className="flex flex-col gap-1">
                  {otherIds.map((i) => (
                    <li key={i.id} className="font-data text-sm" data-client-id={i.id}>
                      {i.value}
                    </li>
                  ))}
                </ul>
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
            message={
              side === 'client'
                ? t('partners.companyFinance.clientIdsNone')
                : t('partners.companyFinance.supplierIdsNone')
            }
          />
        )}
      </section>

      <section className="rounded-lg border border-border bg-raised p-5">
        <h2 className="mb-3 text-base font-semibold">{t('partners.companyFinance.wallet')}</h2>
        {moneyRow(
          t('partners.companyFinance.toppedUp'),
          wallet.topped_up,
          locale,
          t('partners.companyFinance.notKnown'),
          t('common.sar'),
        )}
        {moneyRow(
          t('partners.companyFinance.walletSpent'),
          wallet.wallet_spent,
          locale,
          t('partners.companyFinance.notKnown'),
          t('common.sar'),
        )}
        {moneyRow(
          t('partners.companyFinance.invoicedTotal'),
          wallet.invoiced_total,
          locale,
          t('partners.companyFinance.notKnown'),
          t('common.sar'),
        )}
        {moneyRow(
          t('partners.companyFinance.balance'),
          wallet.balance,
          locale,
          t('partners.companyFinance.notKnown'),
          t('common.sar'),
          true,
        )}
        {moneyRow(
          t('partners.companyFinance.held'),
          wallet.held,
          locale,
          t('partners.companyFinance.notKnown'),
          t('common.sar'),
        )}
        {moneyRow(
          t('partners.companyFinance.available'),
          wallet.available,
          locale,
          t('partners.companyFinance.notKnown'),
          t('common.sar'),
          true,
        )}
        <p className="mt-2 text-sm text-muted">{t('partners.companyFinance.heldNotRecorded')}</p>
      </section>

      <section className="rounded-lg border border-border bg-raised p-5">
        <h2 className="mb-3 text-base font-semibold">{t('partners.companyFinance.totals')}</h2>
        <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
          <span className="text-muted">{t('partners.companyFinance.units')}</span>
          <span className="font-data">{fin.units}</span>
        </div>
        {moneyRow(
          t('partners.companyFinance.revenue'),
          fin.revenue,
          locale,
          t('partners.companyFinance.notKnown'),
          t('common.sar'),
        )}
        {moneyRow(
          t('partners.companyFinance.cost'),
          fin.cost,
          locale,
          fin.cost_pending ? t('partners.companyFinance.costMissing') : t('partners.companyFinance.notKnown'),
          t('common.sar'),
        )}
        {moneyRow(
          t('partners.companyFinance.profit'),
          fin.profit,
          locale,
          t('partners.companyFinance.notKnown'),
          t('common.sar'),
          true,
        )}
        {fin.cost_pending ? (
          <p className="mt-2 text-sm text-muted">
            <StatusChip tone="warning" className="me-2">
              {t('partners.companyFinance.costPending')}
            </StatusChip>
            {t('partners.companyFinance.costPendingNote')}
          </p>
        ) : null}
        {fin.waiting_for_issuing ? (
          <p className="mt-2 text-sm text-muted">
            <StatusChip tone="warning" className="me-2">
              {t('partners.companyFinance.waitingForIssuing')}
            </StatusChip>
            {t('partners.companyFinance.waitingCount', { count: fin.waiting_count })}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-raised p-5">
        <h2 className="mb-3 text-base font-semibold">{t('partners.companyFinance.tenders')}</h2>
        {summary.tenders?.length ? (
          <ul className="divide-y divide-border">
            {summary.tenders.map((u) => (
              <li key={u.id} className="py-3" data-company-tender={u.id}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{u.title}</span>
                  <span className="font-data text-xs text-muted">{u.number}</span>
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
                {moneyRow(
                  t('partners.companyFinance.tenderAmount'),
                  u.tender_amount,
                  locale,
                  t('partners.companyFinance.notKnown'),
                  t('common.sar'),
                )}
                {moneyRow(
                  t('partners.companyFinance.invoiced'),
                  u.invoiced,
                  locale,
                  t('partners.companyFinance.notKnown'),
                  t('common.sar'),
                )}
                {moneyRow(
                  t('partners.companyFinance.remaining'),
                  u.remaining,
                  locale,
                  t('partners.companyFinance.notKnown'),
                  t('common.sar'),
                )}
                {moneyRow(
                  t('partners.companyFinance.expectedProfit'),
                  u.expected_profit,
                  locale,
                  t('partners.companyFinance.notKnown'),
                  t('common.sar'),
                )}
                {moneyRow(
                  t('partners.companyFinance.actualProfit'),
                  u.actual_profit,
                  locale,
                  t('partners.companyFinance.notKnown'),
                  t('common.sar'),
                )}
              </li>
            ))}
          </ul>
        ) : (
          <DataState kind="empty" message={t('partners.companyFinance.tendersNone')} />
        )}
      </section>
    </div>
  );
}
