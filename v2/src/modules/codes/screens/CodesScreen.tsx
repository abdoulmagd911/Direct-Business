'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { formatDate, formatMoney } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { StatusChip, type Tone } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { Money } from '@/ui/Money';
import { PageHeader } from '@/ui/PageHeader';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { Select } from '@/ui/Select';
import { toast } from '@/ui/Toast';
import { filterCodes, searchCodes, sortCodes } from '../state';
import type { CodeDetail, CodeRow, CompanyCodeRow, CodeState, PartnerOption } from '../types';
import { FilesSection, type RecordFile } from '@/ui/record/FilesSection';

type Locale = 'en' | 'ar';

const toneOf = (state: CodeState): Tone =>
  state === 'active' ? 'success' : state === 'expired' ? 'danger' : 'neutral';

const moneyOrDash = (value: number | null, locale: Locale) =>
  value === null ? <span className="text-sm text-muted">—</span> : <Money value={formatMoney(value, locale)} />;

const dateOrDash = (value: string | null, locale: Locale) =>
  value === null ? <span className="text-sm text-muted">—</span> : formatDate(`${value}T12:00:00Z`, locale);

const percentOrDash = (value: number | null) =>
  value === null ? (
    <span className="text-sm text-muted">—</span>
  ) : (
    <span className="font-data text-sm tabular">{`${Number(value).toString()}%`}</span>
  );

/**
 * The Discount Codes page: every code on its own row, keyed by its id (the same text can repeat under
 * different ids, so the text is never the key), sorted by total discount first. The state filter is
 * active / inactive / expired, and the search box narrows the list by the code's text, in the same order
 * (F-B3-04). A code's detail is its own ledger — recorded uses, each with the invoice's
 * created date, its counted revenue, cost and profit from the Finance report's own units, and its stored
 * Direct link — with uses that are not counted listed apart, never in the totals. The per-company view is
 * promo attribution only, apart from a company's own totals. Only Full records a use or an attribution.
 * The detail also holds the code's own files (Phase 4): the approval file belongs to the code itself, not
 * to a use — a use is a transaction.
 */
export function CodesScreen({
  rows,
  detail,
  companyRows,
  partners,
  full,
  selectedId,
  listFailed,
  detailFailed,
  companiesFailed,
  files,
  filesFailed,
}: {
  rows: CodeRow[];
  detail: CodeDetail | null;
  companyRows: CompanyCodeRow[];
  partners: PartnerOption[];
  full: boolean;
  selectedId: string | null;
  listFailed: boolean;
  detailFailed: boolean;
  companiesFailed: boolean;
  /** The selected code's files; null when the read failed (a failed read says so, never an empty section). */
  files: RecordFile[] | null;
  filesFailed: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [state, setState] = useState<CodeState | 'all'>('all');
  const [query, setQuery] = useState('');
  const [removeUseId, setRemoveUseId] = useState<string | null>(null);
  const [removeAttributionId, setRemoveAttributionId] = useState<string | null>(null);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [discount, setDiscount] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [useReason, setUseReason] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [attributionReason, setAttributionReason] = useState('');

  const sorted = sortCodes(rows);
  const visible = searchCodes(filterCodes(sorted, state), query);
  const counts = {
    all: sorted.length,
    active: sorted.filter((r) => r.state === 'active').length,
    inactive: sorted.filter((r) => r.state === 'inactive').length,
    expired: sorted.filter((r) => r.state === 'expired').length,
  };
  const counted = detail?.ledger.filter((l) => l.counted) ?? [];
  const notCounted = detail?.ledger.filter((l) => !l.counted) ?? [];

  const failed = (e: unknown) => {
    const { key, detail: d } = errorKey(e, (k) => t.has(k));
    toast.failed(t(key, { detail: d }));
  };

  const addUse = async () => {
    if (!detail) return;
    try {
      await rpc('code_use_add', {
        p_code: detail.id,
        p_invoice_ref: invoiceRef.trim(),
        p_discount: Number(discount),
        p_direct_url: directUrl.trim() || undefined,
        p_reason: useReason.trim() || undefined,
      });
      setInvoiceRef('');
      setDiscount('');
      setDirectUrl('');
      setUseReason('');
      toast.done(t('pages.codes.addUse.done'));
      router.refresh();
    } catch (e) {
      failed(e);
    }
  };

  const addAttribution = async () => {
    if (!detail || !partnerId) return;
    try {
      await rpc('codes_attribution_add', {
        p_code: detail.id,
        p_partner: partnerId,
        p_reason: attributionReason.trim(),
      });
      setPartnerId('');
      setAttributionReason('');
      toast.done(t('pages.codes.attribution.done'));
      router.refresh();
    } catch (e) {
      failed(e);
    }
  };

  return (
    <div className="flex flex-col gap-5" data-codes-page>
      <PageHeader title={t('nav.codes')} />
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('pages.codes.filter.label')}>
        {(['all', 'active', 'inactive', 'expired'] as const).map((s) => (
          <Button
            key={s}
            variant={state === s ? 'primary' : 'secondary'}
            onClick={() => setState(s)}
            aria-pressed={state === s}
          >
            {t(`pages.codes.filter.${s}`)} ({counts[s]})
          </Button>
        ))}
      </div>
      <form
        role="search"
        className="relative w-full sm:w-64"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('pages.codes.search.label')}
          placeholder={t('pages.codes.search.placeholder')}
          className="ps-9"
          data-codes-search
        />
      </form>

      {listFailed ? (
        <DataState
          kind="failed"
          message={t('state.failed', { what: t('pages.codes.list') })}
          onRetry={() => router.refresh()}
          retryLabel={t('common.tryAgain')}
        />
      ) : visible.length === 0 ? (
        // A filter or a search with no matches says so; only a list with no codes at all says none exist yet (F166).
        <DataState
          kind="empty"
          message={t(
            rows.length === 0
              ? 'pages.codes.empty'
              : query.trim()
                ? 'pages.codes.search.noMatch'
                : 'pages.codes.emptyFiltered',
          )}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
          {visible.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="font-data text-sm">{row.code}</span>
              <StatusChip tone={toneOf(row.state)}>{t(`pages.codes.filter.${row.state}`)}</StatusChip>
              <span className="ms-auto flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">{t('pages.codes.columns.totalDiscount')}</span>
                  {moneyOrDash(row.total_discount, locale)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">{t('pages.codes.columns.totalCollected')}</span>
                  {moneyOrDash(row.total_collected, locale)}
                </span>
                <Link href={`/codes?code=${row.id}`} className="text-sm font-medium text-primary">
                  {t('pages.codes.columns.view')}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}

      {selectedId ? (
        detailFailed || !detail ? (
          <DataState
            kind="failed"
            message={t('state.failed', { what: t('pages.codes.detail.title') })}
            onRetry={() => router.refresh()}
            retryLabel={t('common.tryAgain')}
          />
        ) : (
          <section className="flex flex-col gap-5" data-codes-detail>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-data text-xl">{detail.code}</h2>
              <Link
                href={`/finance?code=${encodeURIComponent(detail.code)}`}
                className="text-sm font-medium text-primary"
              >
                {t('pages.codes.detail.viewInFinance')}
              </Link>
              <StatusChip tone={toneOf(detail.state)}>{t(`pages.codes.filter.${detail.state}`)}</StatusChip>
              <span className="text-sm text-muted">
                {dateOrDash(detail.valid_from, locale)} — {dateOrDash(detail.valid_to, locale)}
              </span>
            </div>
            <div className="flex flex-wrap gap-6">
              <span className="flex flex-col gap-1">
                <span className="text-xs text-muted">{t('pages.codes.detail.configuredFee')}</span>
                {percentOrDash(detail.fee_percent)}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-xs text-muted">{t('pages.codes.columns.totalDiscount')}</span>
                {moneyOrDash(detail.totals.total_discount, locale)}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-xs text-muted">{t('pages.codes.columns.totalCollected')}</span>
                {moneyOrDash(detail.totals.total_collected, locale)}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-xs text-muted">{t('pages.codes.detail.cost')}</span>
                {moneyOrDash(detail.totals.total_cost, locale)}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-xs text-muted">{t('pages.codes.detail.profit')}</span>
                {moneyOrDash(detail.totals.total_profit, locale)}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-xs text-muted">{t('pages.codes.detail.invoices')}</span>
                <span className="font-data text-sm tabular">{detail.totals.units}</span>
              </span>
            </div>

            <h3 className="text-base font-semibold">{t('pages.codes.detail.ledger')}</h3>
            {counted.length === 0 ? (
              <DataState kind="empty" message={t('pages.codes.detail.noCounted')} />
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
                {counted.map((l) => (
                  <li key={l.use_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="font-data text-sm">{l.ref}</span>
                    <span className="text-sm text-muted">{formatDate(`${l.created_on}T12:00:00Z`, locale)}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs text-muted">{t('pages.codes.detail.discount')}</span>
                      <Money value={formatMoney(l.discount_sar, locale)} />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs text-muted">{t('pages.codes.detail.revenue')}</span>
                      {moneyOrDash(l.revenue, locale)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs text-muted">{t('pages.codes.detail.cost')}</span>
                      {moneyOrDash(l.cost, locale)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs text-muted">{t('pages.codes.detail.profit')}</span>
                      {moneyOrDash(l.profit, locale)}
                    </span>
                    {l.direct_url ? (
                      <a
                        href={l.direct_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary"
                      >
                        {t('pages.codes.detail.directLink')}
                      </a>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                    {full ? (
                      <Button variant="danger" onClick={() => setRemoveUseId(l.use_id)}>
                        {t('pages.codes.detail.remove')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {notCounted.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-semibold">{t('pages.codes.detail.notCounted')}</h3>
                <p className="text-sm text-muted">{t('pages.codes.detail.notCountedNote')}</p>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
                  {notCounted.map((l) => (
                    <li key={l.use_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="font-data text-sm">{l.ref}</span>
                      <span className="text-sm text-muted">{l.status_word ?? '—'}</span>
                      <span className="text-sm text-muted">{l.excluded_reason ?? '—'}</span>
                      {full ? (
                        <Button variant="danger" onClick={() => setRemoveUseId(l.use_id)}>
                          {t('pages.codes.detail.remove')}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <h3 className="text-base font-semibold">{t('pages.codes.attribution.title')}</h3>
            {detail.attributions.length === 0 ? (
              <DataState kind="empty" message={t('pages.codes.attribution.none')} />
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
                {detail.attributions.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="text-sm">{a.partner_name ?? '—'}</span>
                    {a.is_promo ? <StatusChip tone="info">{t('pages.codes.partners.promo')}</StatusChip> : null}
                    {full ? (
                      <Button variant="danger" onClick={() => setRemoveAttributionId(a.id)}>
                        {t('pages.codes.detail.remove')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {full ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-4">
                <Field label={t('pages.codes.addUse.invoiceNumber')} required={t('common.required')}>
                  {(p) => (
                    <Input
                      {...p}
                      value={invoiceRef}
                      onChange={(e) => setInvoiceRef(e.target.value)}
                      inputMode="numeric"
                    />
                  )}
                </Field>
                <Field label={t('pages.codes.addUse.discount')} required={t('common.required')}>
                  {(p) => (
                    <Input {...p} value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" />
                  )}
                </Field>
                <Field label={t('pages.codes.addUse.directLink')}>
                  {(p) => <Input {...p} value={directUrl} onChange={(e) => setDirectUrl(e.target.value)} />}
                </Field>
                <Field label={t('pages.codes.addUse.reason')} required={t('common.required')}>
                  {(p) => <Input {...p} value={useReason} onChange={(e) => setUseReason(e.target.value)} />}
                </Field>
                <Button
                  variant="primary"
                  onClick={addUse}
                  disabled={!invoiceRef.trim() || !discount || !useReason.trim()}
                >
                  {t('pages.codes.addUse.save')}
                </Button>
                <Field label={t('pages.codes.attribution.partner')} required={t('common.required')}>
                  {(p) => (
                    <Select
                      {...p}
                      value={partnerId || undefined}
                      onValueChange={setPartnerId}
                      options={partners.map((o) => ({ value: o.id, label: o.name }))}
                      placeholder={t('pages.codes.attribution.partnerPlaceholder')}
                    />
                  )}
                </Field>
                <Field label={t('pages.codes.attribution.reason')} required={t('common.required')}>
                  {(p) => (
                    <Input {...p} value={attributionReason} onChange={(e) => setAttributionReason(e.target.value)} />
                  )}
                </Field>
                <Button variant="primary" onClick={addAttribution} disabled={!partnerId || !attributionReason.trim()}>
                  {t('pages.codes.attribution.save')}
                </Button>
              </div>
            ) : null}
            <FilesSection
              entity="identifier"
              recordId={detail.id}
              kinds={[{ kind: 'evidence', purpose: 'evidence', label: t('record.files.kinds.evidence') }]}
              files={filesFailed ? null : files}
              mayWrite={full}
              onDone={() => router.refresh()}
              title={t('record.files.title')}
            />
          </section>
        )
      ) : null}

      <h2 className="text-xl font-semibold">{t('pages.codes.partners.title')}</h2>
      <p className="text-sm text-muted">{t('pages.codes.partners.note')}</p>
      {companiesFailed ? (
        <DataState
          kind="failed"
          message={t('state.failed', { what: t('pages.codes.partners.title') })}
          onRetry={() => router.refresh()}
          retryLabel={t('common.tryAgain')}
        />
      ) : companyRows.length === 0 ? (
        <DataState kind="empty" message={t('pages.codes.partners.none')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
          {companyRows.map((c) => (
            <li key={c.partner_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="text-sm">{c.partner_name ?? '—'}</span>
              <StatusChip tone="info">{t('pages.codes.partners.promo')}</StatusChip>
              <span className="ms-auto flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">{t('pages.codes.partners.codes')}</span>
                  <span className="font-data text-sm tabular">{c.codes}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">{t('pages.codes.columns.totalDiscount')}</span>
                  {moneyOrDash(c.total_discount, locale)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">{t('pages.codes.columns.totalCollected')}</span>
                  {moneyOrDash(c.total_collected, locale)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">{t('pages.codes.detail.profit')}</span>
                  {moneyOrDash(c.total_profit, locale)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ReasonDialog
        open={removeUseId !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveUseId(null);
        }}
        title={t('pages.codes.detail.removeTitle')}
        words={{
          reason: t('common.reason'),
          save: t('common.save'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
        onSave={async (reason) => {
          if (!removeUseId) return;
          try {
            await rpc('code_use_remove', { p_id: removeUseId, p_reason: reason });
            toast.done(t('pages.codes.detail.removed'));
            setRemoveUseId(null);
            router.refresh();
          } catch (e) {
            failed(e);
          }
        }}
      />
      <ReasonDialog
        open={removeAttributionId !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveAttributionId(null);
        }}
        title={t('pages.codes.attribution.removeTitle')}
        words={{
          reason: t('common.reason'),
          save: t('common.save'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
        onSave={async (reason) => {
          if (!removeAttributionId) return;
          try {
            await rpc('codes_attribution_remove', { p_id: removeAttributionId, p_reason: reason });
            toast.done(t('pages.codes.attribution.removed'));
            setRemoveAttributionId(null);
            router.refresh();
          } catch (e) {
            failed(e);
          }
        }}
      />
    </div>
  );
}
