'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ArrowDownWideNarrow, Banknote, ExternalLink, Receipt, Search, Tag, Ticket, TrendingUp } from 'lucide-react';
import { command, type CommandWords } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { formatDate, formatMoney } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { buttonVariants } from '@/ui/button-variants';
import { StatusChip, type Tone } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { KpiTile } from '@/ui/KpiTile';
import { Money } from '@/ui/Money';
import { PageHeader } from '@/ui/PageHeader';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { Select } from '@/ui/Select';
import { filterCodes, searchCodes, sortCodes } from '../state';
import { toggleOf, type RowToggle } from '../toggle';
import type { CodeDetail, CodeRow, CompanyCodeRow, CodeState, PartnerOption } from '../types';
import { FilesSection, type RecordFile } from '@/ui/record/FilesSection';

type Locale = 'en' | 'ar';

const toneOf = (state: CodeState): Tone =>
  state === 'active' ? 'success' : state === 'expired' ? 'danger' : 'neutral';

/** A figure with its currency in the reader's language (ر.س in Arabic, never a hard "SAR"); empty is a dash, never 0. */
const moneyOrDash = (value: number | null, locale: Locale, currency: string, className?: string) =>
  value === null ? (
    <span className="text-sm text-muted">—</span>
  ) : (
    <Money value={formatMoney(value, locale)} currency={currency} className={className} />
  );

/** The white card every block of the page sits on (V21): 16 px corners, a hairline and the soft shadow. */
const CARD = 'rounded-lg border border-border bg-raised shadow-1';
const CARD_TITLE = 'text-lg font-semibold leading-6 text-strong';
const CARD_HEAD = 'flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3';
const COUNT = 'ms-2 font-data text-sm font-normal text-muted tabular';
const TH = 'px-4 py-2.5 text-xs font-semibold text-muted';
/** A cell's column name, shown only while its table is stacked (the header row is then for screen readers only). */
const LABEL_3 = 'block text-xs leading-4 text-muted @3xl:hidden';
const LABEL_4 = 'block text-xs leading-4 text-muted @4xl:hidden';
/** A table where the page is wide enough for its columns and a stack of labelled rows where it is not (a phone, a
 *  narrow window) — the same rows either way, so nothing scrolls sideways. `3` turns at 768 px of page, `4` at 896. */
const TABLE_3 = 'w-full text-base @max-3xl:block';
const TR_3 =
  'border-b border-border last:border-b-0 @max-3xl:grid @max-3xl:grid-cols-2 @max-3xl:gap-x-4 @max-3xl:gap-y-2 @max-3xl:px-4 @max-3xl:py-3';
const TD_3 = 'px-4 py-3 align-middle @max-3xl:block @max-3xl:min-w-0 @max-3xl:p-0';
const TABLE_4 = 'w-full text-base @max-4xl:block';
const TR_4 =
  'border-b border-border last:border-b-0 @max-4xl:grid @max-4xl:grid-cols-2 @max-4xl:gap-x-4 @max-4xl:gap-y-2 @max-4xl:px-4 @max-4xl:py-3';
const TD_4 = 'px-4 py-3 align-top @max-4xl:block @max-4xl:min-w-0 @max-4xl:p-0';

/** An organisation's name in the reader's language (the English trade name when it has no Arabic one). */
const nameIn = (o: { partner_name?: string | null; partner_name_ar?: string | null }, locale: Locale) =>
  (locale === 'ar' && o.partner_name_ar ? o.partner_name_ar : o.partner_name) ?? null;

/**
 * The Discount Codes page: every code on its own row, keyed by its id (the same text can repeat under
 * different ids, so the text is never the key), sorted by total discount first, each naming the organisation
 * it belongs to. The state filter is active / inactive / expired, and the search box narrows the list by the
 * code's text, in the same order (F-B3-04). A code's detail (`?code=<id>`, Landing 31: drawn as its own page, with
 * the way back in its trail) is its totals as the Finance page's cards and its own ledger — recorded uses, each with
 * the invoice's created date, its counted revenue, cost and profit from the Finance report's own units, and its stored
 * Direct link — where a use that is not counted says so on its row and carries no figure, never in the totals. The
 * per-partner table is promo attribution only, apart from a partner's own totals. Only Full records a use or an
 * attribution; each one, and each removal, is one request with one Undo, as everywhere else.
 * The detail also holds the code's own files (Phase 4): the approval file belongs to the code itself, not
 * to a use — a use is a transaction.
 * Landing 32: an admin (the read's `can_toggle`) excludes a counted row from the count, or includes again a row that
 * was excluded by hand — each with a required reason; a row a list rule catches says so and is changed in Settings.
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
  detailError,
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
  /** What ended the detail's read — the error's kind and code (Landing 28); null when it did not fail. */
  detailError?: string | null;
  companiesFailed: boolean;
  /** The selected code's files; null when the read failed (a failed read says so, never an empty section). */
  files: RecordFile[] | null;
  filesFailed: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const sar = t('common.sar');
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
  const [busy, setBusy] = useState<'use' | 'attribution' | null>(null);
  const [toggle, setToggle] = useState<RowToggle | null>(null);
  // the dialog keeps its words while it closes (the row asked for is gone the moment Save is pressed)
  const [toggleKind, setToggleKind] = useState<RowToggle['kind']>('exclude');
  const canToggle = detail?.can_toggle === true;
  const askToggle = (next: RowToggle) => {
    setToggleKind(next.kind);
    setToggle(next);
  };

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
  // one ledger, the counted uses first: a use that is not counted says so on its row and carries no figure
  const ledgerRows = [...counted, ...notCounted];
  /** A total for a card: the figure as it reads everywhere on the page, or nothing (the card then shows a dash). */
  const figure = (value: number | null) => (value === null ? null : formatMoney(value, locale));

  const words = (done: string): CommandWords => ({
    done,
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k) => t.has(k),
    failed: (k, d) => t(k, { detail: d }),
  });

  /** The dates a code runs between, in words — nothing at all for a code with neither date (it showed "— — —"). */
  const validity = (from: string | null, to: string | null) => {
    const day = (d: string) => formatDate(`${d}T12:00:00Z`, locale, { dateStyle: 'medium' });
    if (from && to) return `${day(from)} – ${day(to)}`;
    if (from) return t('pages.codes.detail.validFrom', { date: day(from) });
    if (to) return t('pages.codes.detail.validUntil', { date: day(to) });
    return null;
  };

  const addUse = async () => {
    if (!detail) return;
    setBusy('use');
    await command(
      words(t('pages.codes.addUse.done')),
      () =>
        rpc('code_use_add', {
          p_code: detail.id,
          p_invoice_ref: invoiceRef.trim(),
          p_discount: Number(discount),
          p_direct_url: directUrl.trim() || undefined,
          p_reason: useReason.trim() || undefined,
        }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          setInvoiceRef('');
          setDiscount('');
          setDirectUrl('');
          setUseReason('');
          router.refresh();
        },
      },
    );
    setBusy(null);
  };

  const addAttribution = async () => {
    if (!detail || !partnerId) return;
    setBusy('attribution');
    await command(
      words(t('pages.codes.attribution.done')),
      () =>
        rpc('codes_attribution_add', {
          p_code: detail.id,
          p_partner: partnerId,
          p_reason: attributionReason.trim(),
        }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          setPartnerId('');
          setAttributionReason('');
          router.refresh();
        },
      },
    );
    setBusy(null);
  };

  // the words of a removal's reason box: its button says Remove, in the danger colour — not Save
  const removeWords = {
    reason: t('common.reason'),
    save: t('common.remove'),
    cancel: t('common.cancel'),
    reasonRequired: t('settings.form.reasonRequired'),
  };

  const owner = (o: { partner_id?: string | null; partner_name?: string | null; partner_name_ar?: string | null }) => {
    const name = nameIn(o, locale);
    return o.partner_id && name ? (
      <Link
        href={`/partners/${o.partner_id}`}
        className="inline-flex min-h-11 min-w-0 max-w-full items-center text-sm text-link hover:underline sm:min-h-0"
        data-code-partner
      >
        <bdi className="truncate">{name}</bdi>
      </Link>
    ) : null;
  };

  /** The page of one code (`/codes?code=<id>`): its own heading and trail, its totals as cards, its one ledger. */
  const detailView = () =>
    detailFailed || !detail ? (
      <>
        <PageHeader
          crumbs={[{ label: t('nav.codes'), href: '/codes' }, { label: t('pages.codes.detail.title') }]}
          title={t('pages.codes.detail.title')}
        />
        <DataState
          kind="failed"
          message={t('state.failed', { what: t('pages.codes.detail.title') })}
          onRetry={() => router.refresh()}
          retryLabel={t('common.tryAgain')}
          // Landing 28: the failure's kind and code ride beside the message, so a flaky read can be diagnosed
          action={
            detailError ? (
              <span dir="ltr" className="basis-full font-data text-xs text-muted" data-codes-detail-error>
                {detailError}
              </span>
            ) : null
          }
        />
      </>
    ) : (
      <section className="flex flex-col gap-5" data-codes-detail>
        <PageHeader
          crumbs={[
            { label: t('nav.codes'), href: '/codes' },
            { label: <bdi className="font-data">{detail.code}</bdi> },
          ]}
          title={<bdi className="font-data">{detail.code}</bdi>}
          meta={
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {owner(detail)}
              <StatusChip tone={toneOf(detail.state)}>{t(`pages.codes.filter.${detail.state}`)}</StatusChip>
              {validity(detail.valid_from, detail.valid_to) ? (
                <span className="text-sm text-muted" data-code-validity>
                  {validity(detail.valid_from, detail.valid_to)}
                </span>
              ) : null}
            </span>
          }
          actions={
            <Link
              href={`/finance?code=${encodeURIComponent(detail.code)}`}
              className={buttonVariants({ variant: 'secondary' })}
              data-code-finance-link
            >
              {t('pages.codes.detail.viewInFinance')}
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @5xl:grid-cols-5" data-code-totals>
          <KpiTile
            label={t('pages.codes.columns.totalCollected')}
            value={figure(detail.totals.total_collected)}
            unit={sar}
            tone="success"
            icon={<Banknote />}
          />
          <KpiTile
            label={t('pages.codes.columns.totalDiscount')}
            value={figure(detail.totals.total_discount)}
            unit={sar}
            icon={<Tag />}
            footnote={
              <span data-code-fee>
                {t('pages.codes.detail.configuredFee')}{' '}
                <bdi className="font-data tabular">
                  {detail.fee_percent === null ? '—' : `${Number(detail.fee_percent).toString()}%`}
                </bdi>
              </span>
            }
          />
          <KpiTile
            label={t('pages.codes.detail.cost')}
            value={figure(detail.totals.total_cost)}
            unit={sar}
            icon={<Receipt />}
          />
          <KpiTile
            label={t('pages.codes.detail.profit')}
            value={figure(detail.totals.total_profit)}
            unit={sar}
            icon={<TrendingUp />}
          />
          <KpiTile
            label={t('pages.codes.detail.invoices')}
            value={String(detail.totals.units)}
            icon={<Ticket />}
            className="max-sm:col-span-2"
          />
        </div>

        <section className={cn(CARD, 'overflow-hidden')} data-code-ledger>
          <div className={CARD_HEAD}>
            <h2 className={CARD_TITLE}>
              {t('pages.codes.detail.ledger')}
              <span className={COUNT}>{ledgerRows.length}</span>
            </h2>
          </div>
          {counted.length === 0 ? (
            <p className="px-4 py-5 text-base text-muted" data-code-ledger-empty>
              {t('pages.codes.detail.noCounted')}
            </p>
          ) : null}
          {ledgerRows.length ? (
            <table className={cn(TABLE_4, counted.length === 0 && 'border-t border-border')}>
              <thead className="@max-4xl:sr-only">
                <tr className="border-b border-border">
                  <th className={cn(TH, 'text-start')}>{t('pages.codes.detail.invoice')}</th>
                  <th className={cn(TH, 'text-start')}>{t('pages.codes.detail.date')}</th>
                  <th className={cn(TH, 'text-start')}>{t('pages.codes.columns.state')}</th>
                  <th className={cn(TH, 'text-end')}>{t('pages.codes.detail.discount')}</th>
                  <th className={cn(TH, 'text-end')}>{t('pages.codes.detail.revenue')}</th>
                  <th className={cn(TH, 'text-end')}>{t('pages.codes.detail.cost')}</th>
                  <th className={cn(TH, 'text-end')}>{t('pages.codes.detail.profit')}</th>
                  {canToggle ? (
                    <th className={TH}>
                      <span className="sr-only">{t('pages.codes.detail.countedAction')}</span>
                    </th>
                  ) : null}
                  {full ? (
                    <th className={TH}>
                      <span className="sr-only">{t('pages.codes.detail.remove')}</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="@max-4xl:block">
                {ledgerRows.map((l) => {
                  // why a use is not counted, in the words the read gives (its status, its exclusion) — never a guess
                  const why = [l.status_word, l.excluded_reason].filter(Boolean).join(' · ');
                  // a list rule (Settings → Finance) keeps the row out: it says so, and offers no button here
                  const byListRule = !l.counted && Boolean(l.excluded_by) && l.excluded_row_level !== true;
                  const rowToggle = canToggle ? toggleOf(l) : null;
                  return (
                    <tr key={l.use_id} className={TR_4} data-code-use={l.use_id} data-counted={l.counted}>
                      <td className={TD_4}>
                        <bdi className="block font-data font-medium text-strong tabular">{l.ref}</bdi>
                        {l.direct_url ? (
                          <a
                            href={l.direct_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-6 items-center gap-1 text-sm font-medium text-link underline decoration-border-strong underline-offset-[3px] hover:decoration-current max-sm:min-h-11"
                          >
                            {t('pages.codes.detail.directLink')}
                            <ExternalLink className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                          </a>
                        ) : null}
                      </td>
                      <td className={cn(TD_4, 'whitespace-nowrap text-muted')}>
                        <span className={LABEL_4}>{t('pages.codes.detail.date')}</span>
                        {formatDate(`${l.created_on}T12:00:00Z`, locale, { dateStyle: 'medium' })}
                      </td>
                      <td className={cn(TD_4, '@max-4xl:col-span-2')}>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <StatusChip tone={l.counted ? 'success' : 'neutral'}>
                            {t(l.counted ? 'pages.codes.detail.countedPill' : 'pages.codes.detail.notCountedPill')}
                          </StatusChip>
                          {!l.counted && why ? <span className="text-sm text-muted">{why}</span> : null}
                          {byListRule ? (
                            <span className="basis-full text-sm text-muted" data-code-list-rule>
                              {t('pages.codes.detail.listRule')}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className={cn(TD_4, '@4xl:text-end')}>
                        <span className={LABEL_4}>{t('pages.codes.detail.discount')}</span>
                        {l.counted ? (
                          <Money value={formatMoney(l.discount_sar, locale)} currency={sar} />
                        ) : (
                          <span className="text-sm text-muted">—</span>
                        )}
                      </td>
                      <td className={cn(TD_4, '@4xl:text-end')}>
                        <span className={LABEL_4}>{t('pages.codes.detail.revenue')}</span>
                        {l.counted
                          ? moneyOrDash(l.revenue, locale, sar, 'text-success')
                          : moneyOrDash(null, locale, sar)}
                      </td>
                      <td className={cn(TD_4, '@4xl:text-end')}>
                        <span className={LABEL_4}>{t('pages.codes.detail.cost')}</span>
                        {moneyOrDash(l.counted ? l.cost : null, locale, sar)}
                      </td>
                      <td className={cn(TD_4, '@4xl:text-end')}>
                        <span className={LABEL_4}>{t('pages.codes.detail.profit')}</span>
                        {moneyOrDash(l.counted ? l.profit : null, locale, sar)}
                      </td>
                      {canToggle ? (
                        <td className={cn(TD_4, '@4xl:text-end', !rowToggle && '@max-4xl:hidden')}>
                          {rowToggle ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => askToggle(rowToggle)}
                              {...(rowToggle.kind === 'exclude'
                                ? { 'data-code-exclude': l.use_id }
                                : { 'data-code-include': l.use_id })}
                            >
                              {t(
                                rowToggle.kind === 'exclude'
                                  ? 'pages.codes.detail.exclude'
                                  : 'pages.codes.detail.include',
                              )}
                            </Button>
                          ) : null}
                        </td>
                      ) : null}
                      {full ? (
                        <td className={cn(TD_4, '@4xl:text-end')}>
                          <Button size="sm" variant="ghost" onClick={() => setRemoveUseId(l.use_id)}>
                            {t('pages.codes.detail.remove')}
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </section>

        <div className={cn('grid items-start gap-5', full && '@3xl:grid-cols-2')}>
          {/* Record a use: its own box with its own heading, beside the ledger it adds to */}
          {full ? (
            <form
              className={cn(CARD, 'flex min-w-0 flex-col gap-3 p-5 max-sm:p-4')}
              onSubmit={(e) => {
                e.preventDefault();
                if (invoiceRef.trim() && discount && useReason.trim()) void addUse();
              }}
              data-code-use-form
            >
              <h2 className={CARD_TITLE}>{t('pages.codes.addUse.title')}</h2>
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
                type="submit"
                variant="primary"
                className="self-start"
                loading={busy === 'use'}
                disabled={!invoiceRef.trim() || !discount || !useReason.trim()}
              >
                {t('pages.codes.addUse.save')}
              </Button>
            </form>
          ) : null}

          <section className={cn(CARD, 'flex min-w-0 flex-col')} data-code-attributions>
            <div className={CARD_HEAD}>
              <h2 className={CARD_TITLE}>
                {t('pages.codes.attribution.title')}
                <span className={COUNT}>{detail.attributions.length}</span>
              </h2>
            </div>
            {detail.attributions.length === 0 ? (
              <p className="px-4 py-5 text-base text-muted">{t('pages.codes.attribution.none')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {detail.attributions.map((a) => (
                  <li key={a.id} className="flex min-h-12 flex-wrap items-center gap-3 px-4 py-2">
                    <bdi className="min-w-0 truncate text-base text-strong">{nameIn(a, locale) ?? '—'}</bdi>
                    {a.is_promo ? <StatusChip tone="info">{t('pages.codes.partners.promo')}</StatusChip> : null}
                    {full ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ms-auto"
                        onClick={() => setRemoveAttributionId(a.id)}
                      >
                        {t('pages.codes.detail.remove')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {/* Show under a partner: under the partners it adds to — one Reason per box, never two in one */}
            {full ? (
              <form
                className="flex flex-col gap-3 border-t border-border p-5 max-sm:p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (partnerId && attributionReason.trim()) void addAttribution();
                }}
                data-code-attribution-form
              >
                <h3 className="text-base font-semibold text-strong">{t('pages.codes.attribution.add')}</h3>
                <Field label={t('pages.codes.attribution.partner')} required={t('common.required')}>
                  {(p) => (
                    <Select
                      {...p}
                      // always controlled: '' shows the placeholder again after a save (undefined left the old
                      // partner showing in the box while the form held none)
                      value={partnerId}
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
                <Button
                  type="submit"
                  variant="primary"
                  className="self-start"
                  loading={busy === 'attribution'}
                  disabled={!partnerId || !attributionReason.trim()}
                >
                  {t('pages.codes.attribution.save')}
                </Button>
              </form>
            ) : null}
          </section>
        </div>

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
    );

  /** The list (`/codes`): the state pills and the search, every code on its row, then the promo totals by partner. */
  const listView = () => (
    <>
      <PageHeader
        title={t('nav.codes')}
        meta={listFailed ? undefined : <span data-codes-count>{t('pages.codes.count', { count: rows.length })}</span>}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('pages.codes.filter.label')}>
          {(['all', 'active', 'inactive', 'expired'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setState(s)}
              aria-pressed={state === s}
              data-codes-filter={s}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-pill border px-3.5 text-base font-medium leading-5 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:h-11',
                state === s
                  ? 'border-sel bg-sel font-semibold text-on-sel'
                  : 'border-border-strong bg-raised text-text hover:bg-surface active:bg-pressed',
              )}
            >
              {t(`pages.codes.filterPill.${s}`)}
              <span className="font-data text-xs tabular">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 max-sm:w-full">
          {/* the list's one order, said in words (the board's sort control has nothing else to offer here) */}
          <span className="inline-flex items-center gap-1.5 text-sm text-muted" data-codes-order>
            <ArrowDownWideNarrow className="size-4 shrink-0" aria-hidden="true" />
            {t('pages.codes.sortedBy')}
          </span>
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
        </div>
      </div>

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
          icon={<Tag />}
          message={t(
            rows.length === 0
              ? 'pages.codes.empty'
              : query.trim()
                ? 'pages.codes.search.noMatch'
                : 'pages.codes.emptyFiltered',
          )}
        />
      ) : (
        <section className={cn(CARD, 'overflow-hidden')} data-codes-list>
          <table className={TABLE_3}>
            <thead className="@max-3xl:sr-only">
              <tr className="border-b border-border">
                <th className={cn(TH, 'text-start')}>{t('pages.codes.columns.code')}</th>
                <th className={cn(TH, 'text-start')}>{t('pages.codes.columns.partner')}</th>
                <th className={cn(TH, 'text-end')}>{t('pages.codes.columns.totalDiscount')}</th>
                <th className={cn(TH, 'text-end')}>{t('pages.codes.columns.totalCollected')}</th>
                <th className={cn(TH, 'text-end')}>{t('pages.codes.detail.invoices')}</th>
                <th className={cn(TH, 'text-start')}>{t('pages.codes.columns.state')}</th>
              </tr>
            </thead>
            <tbody className="@max-3xl:block">
              {visible.map((row) => (
                <tr key={row.id} className={TR_3} data-code-row={row.id}>
                  <td className={cn(TD_3, '@max-3xl:order-1')}>
                    {/* the code is the way into its page (the board's link; it was a separate "View" before) */}
                    <Link
                      href={`/codes?code=${row.id}`}
                      aria-label={`${t('pages.codes.columns.view')} ${row.code}`}
                      className="inline-flex min-h-6 items-center font-data font-medium text-link underline decoration-border-strong underline-offset-[3px] hover:decoration-current max-sm:min-h-11"
                      data-code-open
                    >
                      <bdi>{row.code}</bdi>
                    </Link>
                  </td>
                  <td className={cn(TD_3, '@max-3xl:order-3 @max-3xl:col-span-2')}>
                    {/* whose code it is */}
                    <span className="block min-w-0 @3xl:max-w-[18rem]">
                      {owner(row) ?? <span className="text-sm text-muted">—</span>}
                    </span>
                  </td>
                  <td className={cn(TD_3, '@max-3xl:order-4 @3xl:text-end')}>
                    <span className={LABEL_3}>{t('pages.codes.columns.totalDiscount')}</span>
                    {moneyOrDash(row.total_discount, locale, sar)}
                  </td>
                  <td className={cn(TD_3, '@max-3xl:order-4 @3xl:text-end')}>
                    <span className={LABEL_3}>{t('pages.codes.columns.totalCollected')}</span>
                    {moneyOrDash(row.total_collected, locale, sar, 'text-success')}
                  </td>
                  <td className={cn(TD_3, 'font-data tabular @max-3xl:order-4 @3xl:text-end')}>
                    <span className={cn(LABEL_3, 'font-ui')}>{t('pages.codes.detail.invoices')}</span>
                    {row.units}
                  </td>
                  <td className={cn(TD_3, '@max-3xl:order-2 @max-3xl:justify-self-end @max-3xl:self-center')}>
                    <StatusChip tone={toneOf(row.state)}>{t(`pages.codes.filter.${row.state}`)}</StatusChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className={cn(CARD, 'overflow-hidden')} data-codes-partners>
        <div className={CARD_HEAD}>
          <h2 className={CARD_TITLE}>{t('pages.codes.partners.promoTitle')}</h2>
        </div>
        {companiesFailed ? (
          <div className="p-4">
            <DataState
              kind="failed"
              message={t('state.failed', { what: t('pages.codes.partners.promoTitle') })}
              onRetry={() => router.refresh()}
              retryLabel={t('common.tryAgain')}
            />
          </div>
        ) : companyRows.length === 0 ? (
          <p className="px-4 py-5 text-base text-muted">{t('pages.codes.partners.none')}</p>
        ) : (
          <table className={TABLE_3}>
            <thead className="@max-3xl:sr-only">
              <tr className="border-b border-border">
                <th className={cn(TH, 'text-start')}>{t('pages.codes.columns.partner')}</th>
                <th className={cn(TH, 'text-end')}>{t('pages.codes.partners.codes')}</th>
                <th className={cn(TH, 'text-end')}>{t('pages.codes.columns.totalDiscount')}</th>
                <th className={cn(TH, 'text-end')}>{t('pages.codes.columns.totalCollected')}</th>
                <th className={cn(TH, 'text-end')}>{t('pages.codes.detail.profit')}</th>
              </tr>
            </thead>
            <tbody className="@max-3xl:block">
              {companyRows.map((c) => (
                <tr key={c.partner_id} className={TR_3} data-codes-partner-row={c.partner_id}>
                  <td className={cn(TD_3, '@max-3xl:col-span-2')}>
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <bdi className="min-w-0 truncate text-strong">{nameIn(c, locale) ?? '—'}</bdi>
                      <StatusChip tone="info">{t('pages.codes.partners.promo')}</StatusChip>
                    </span>
                  </td>
                  <td className={cn(TD_3, 'font-data tabular @3xl:text-end')}>
                    <span className={cn(LABEL_3, 'font-ui')}>{t('pages.codes.partners.codes')}</span>
                    {c.codes}
                  </td>
                  <td className={cn(TD_3, '@3xl:text-end')}>
                    <span className={LABEL_3}>{t('pages.codes.columns.totalDiscount')}</span>
                    {moneyOrDash(c.total_discount, locale, sar)}
                  </td>
                  <td className={cn(TD_3, '@3xl:text-end')}>
                    <span className={LABEL_3}>{t('pages.codes.columns.totalCollected')}</span>
                    {moneyOrDash(c.total_collected, locale, sar, 'text-success')}
                  </td>
                  <td className={cn(TD_3, '@3xl:text-end')}>
                    <span className={LABEL_3}>{t('pages.codes.detail.profit')}</span>
                    {moneyOrDash(c.total_profit, locale, sar)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );

  return (
    <div className="@container flex flex-col gap-5" data-codes-page data-codes-view={selectedId ? 'detail' : 'list'}>
      {selectedId ? detailView() : listView()}

      <ReasonDialog
        open={removeUseId !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveUseId(null);
        }}
        title={t('pages.codes.detail.removeTitle')}
        destructive
        words={removeWords}
        onSave={async (reason) => {
          const id = removeUseId;
          if (!id) return;
          setRemoveUseId(null);
          await command(
            words(t('pages.codes.detail.removed')),
            () =>
              rpc('code_use_remove', { p_id: id, p_reason: reason }) as Promise<{ request_id?: string | null } | null>,
            { after: () => router.refresh() },
          );
        }}
      />
      <ReasonDialog
        open={toggle !== null}
        onOpenChange={(o) => {
          if (!o) setToggle(null);
        }}
        title={t(toggleKind === 'exclude' ? 'pages.codes.detail.excludeTitle' : 'pages.codes.detail.includeTitle')}
        words={{
          reason: t('pages.codes.detail.toggleReason'),
          save: t(toggleKind === 'exclude' ? 'pages.codes.detail.exclude' : 'pages.codes.detail.include'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
        onSave={async (reason) => {
          const asked = toggle;
          if (!asked) return;
          setToggle(null);
          // one request, one Undo, then the detail is read again — the same way a recorded use refreshes it
          await command(
            words(t(asked.kind === 'exclude' ? 'pages.codes.detail.excluded' : 'pages.codes.detail.included')),
            () =>
              rpc(asked.kind === 'exclude' ? 'finance_row_exclude' : 'finance_row_include', {
                p_partner: asked.partnerId,
                p_number: asked.number,
                p_reason: reason,
              }) as Promise<{ request_id?: string | null } | null>,
            { after: () => router.refresh() },
          );
        }}
      />
      <ReasonDialog
        open={removeAttributionId !== null}
        onOpenChange={(o) => {
          if (!o) setRemoveAttributionId(null);
        }}
        title={t('pages.codes.attribution.removeTitle')}
        destructive
        words={removeWords}
        onSave={async (reason) => {
          const id = removeAttributionId;
          if (!id) return;
          setRemoveAttributionId(null);
          await command(
            words(t('pages.codes.attribution.removed')),
            () =>
              rpc('codes_attribution_remove', { p_id: id, p_reason: reason }) as Promise<{
                request_id?: string | null;
              } | null>,
            { after: () => router.refresh() },
          );
        }}
      />
    </div>
  );
}
