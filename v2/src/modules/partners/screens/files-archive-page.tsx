import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { inputClass } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { formatFileSize } from '@/ui/record/file-size';
import { Page } from '@/ui/shell/Page';
import { FileDownloadButton } from './files-download-button';
import { ArchiveDateRange } from './ArchiveDateRange';
import { ArchiveFilters } from './files-archive-filters';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from './files-archive-constants';
import { tradeName, type AllFilesAnswer, type AllFilesRow, type HoverPartner, type ListEntry } from '../types';

/** The message key for a record type (the tables carry dots, which the catalogue reads as nesting). A discount
 *  code's own files sit on its identifier row (F157) and read as a discount code too; a type with no words here
 *  reads as "Other", never as a missing key. */
const RECORD_TYPE_KEY: Record<string, string> = {
  'work.task': 'task',
  'perf.achievement': 'achievement',
  'my.note': 'note',
  'partner.partner': 'partner',
  'work.import_batch': 'importBatch',
  'partner.campaign_code': 'campaignCode',
  'partner.identifier': 'campaignCode',
};

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

/**
 * All files, in one place (Phase 3, rebuilt on api.all_files): every file linked to any record the reader may
 * see, flat and newest first by default, with search over the file name and the record it belongs to. The kind
 * filter reads the live file_kind list; purpose, status and added-by options read live from the files the
 * reader may see. One grouping toggle (by record, by record type, none); paging applies to the flat list, not
 * to the grouped sections. Each row downloads in place and links to its own record. A read the database refuses
 * shows as failed, never as an empty list. On a phone the filters collapse to search plus a filter sheet.
 * The selects apply the moment they change (ArchiveFilters); the page size is a URL param, 10 / 25 / 50 / 100.
 */
export async function FilesArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [q, t, locale] = await Promise.all([searchParams, getTranslations(), getLocale()]);
  await requireMe();
  const search = one(q.q) ?? '';
  const entity = one(q.entity) ?? '';
  const company = one(q.company);
  const kind = one(q.kind) ?? '';
  const uploader = one(q.uploader) ?? '';
  const from = one(q.from) ?? '';
  const to = one(q.to) ?? '';
  const purpose = one(q.purpose) ?? '';
  const side = one(q.side) ?? '';
  const status = one(q.status) ?? '';
  const sort = one(q.sort) === 'name' || one(q.sort) === 'size' ? (one(q.sort) as 'name' | 'size') : 'added';
  const group = one(q.group) === 'company' || one(q.group) === 'type' ? (one(q.group) as 'company' | 'type') : 'none';
  const page = Math.max(0, parseInt(one(q.page) ?? '0', 10) || 0);
  // The page size is a URL param (F151): 10 / 25 / 50 / 100, default 25; anything else is 25, never an error.
  const size = PAGE_SIZES.includes(Number(one(q.size)) as (typeof PAGE_SIZES)[number])
    ? Number(one(q.size))
    : DEFAULT_PAGE_SIZE;
  // The forms are keyed by the address (F146): the selects are uncontrolled, so a navigation that changes the
  // address must remount them — otherwise Clear filters would clear the list while the controls kept showing
  // the old values.
  const queryKey = JSON.stringify(q);
  const hasFilter = Boolean(search || entity || company || kind || uploader || from || to || purpose || side || status);

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const all: Record<string, string | undefined> = {
      q: search || undefined,
      entity: entity || undefined,
      company,
      kind: kind || undefined,
      uploader: uploader || undefined,
      from: from || undefined,
      to: to || undefined,
      purpose: purpose || undefined,
      side: side || undefined,
      status: status || undefined,
      sort: sort === 'added' ? undefined : sort,
      group: group === 'none' ? undefined : group,
      size: size === DEFAULT_PAGE_SIZE ? undefined : String(size),
      page: page === 0 ? undefined : String(page),
      ...patch,
    };
    for (const [k, v] of Object.entries(all)) if (v !== undefined) params.set(k, v);
    const s = params.toString();
    return s ? `/files?${s}` : '/files';
  };

  let answer: AllFilesAnswer | null = null;
  let kinds: ListEntry[] = [];
  // The organisation the list is narrowed to, by its name: read on its own, so a company with no files yet is still
  // named (the line printed the address's id when the list was empty).
  const narrowedTo: Promise<HoverPartner | null> = company
    ? (serverRpc('hover_partner', { p_id: company }) as unknown as Promise<HoverPartner | null>).catch(() => null)
    : Promise.resolve(null);
  try {
    const args: {
      p_entity?: string;
      p_record?: string;
      p_kind?: string;
      p_uploader?: string;
      p_from?: string;
      p_to?: string;
      p_purpose?: string;
      p_side?: string;
      p_status?: string;
      p_search?: string;
      p_sort?: string;
      p_locale?: string;
      p_limit?: number;
      p_offset?: number;
    } = { p_sort: sort, p_locale: locale, p_limit: size, p_offset: page * size };
    if (company) {
      args.p_entity = 'partner.partner';
      args.p_record = company;
    } else if (entity) args.p_entity = entity;
    if (kind) args.p_kind = kind;
    if (uploader) args.p_uploader = uploader;
    if (from) args.p_from = from;
    if (to) args.p_to = to;
    if (purpose) args.p_purpose = purpose;
    if (side) args.p_side = side;
    if (status) args.p_status = status;
    if (search) args.p_search = search;
    const [a, k] = await Promise.all([
      serverRpc('all_files', args) as unknown as Promise<AllFilesAnswer>,
      (serverRpc('list', { p_list: 'file_kind' }) as unknown as Promise<ListEntry[] | null>).catch(() => []),
    ]);
    answer = a;
    kinds = k ?? [];
  } catch {
    answer = null;
  }

  const rows = answer?.rows ?? [];
  const total = answer?.total ?? 0;
  const owner = await narrowedTo;
  const companyName = owner ? tradeName(owner, locale as 'en' | 'ar') : (rows[0]?.record_label ?? null);
  const pages = Math.max(1, Math.ceil(total / size));
  const fromRow = total === 0 ? 0 : page * size + 1;
  const toRow = Math.min(total, (page + 1) * size);
  const kindName = (f: AllFilesRow) => (locale === 'ar' && f.kind_ar ? f.kind_ar : f.kind_en);
  // The row's name is the stored uploaded filename, in both languages (FIX-38): file names are data, never
  // translated — the generated display name (Agreement · … · to.csv) is never shown as the row's name.
  const displayName = (f: AllFilesRow) => f.original_name;

  const row = (f: AllFilesRow) => (
    <li key={f.link_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5" data-archive-file={f.id}>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{displayName(f)}</span>
        <span className="text-xs text-muted">
          {kindName(f)} · {formatFileSize(f.size, t, locale === 'ar' ? 'ar' : 'en')} ·{' '}
          {f.added_by_name ? `${t('record.files.uploader')} ${f.added_by_name} · ` : ''}
          {formatDate(f.added_at, locale as 'en' | 'ar', { dateStyle: 'medium' })}
          {f.review_on ? (
            <>
              {' · '}
              {t('record.files.reviewOnDate', {
                date: formatDate(f.review_on, locale as 'en' | 'ar', { dateStyle: 'medium' }),
              })}
            </>
          ) : null}
          {f.status !== 'stored' ? ` · ${t('record.files.notStored')}` : ''}
        </span>
        {f.record_link && f.record_label ? (
          <Link href={f.record_link} className="w-fit truncate text-sm text-link hover:underline">
            {f.record_label}
          </Link>
        ) : null}
      </span>
      {f.status === 'stored' ? <FileDownloadButton fileId={f.id} label={t('record.files.download')} /> : null}
    </li>
  );

  const sections =
    group === 'none'
      ? null
      : [
          ...rows.reduce((m, f) => {
            const key = group === 'company' ? f.entity_id : f.entity_table;
            const g = m.get(key) ?? { label: '', link: '', rows: [] as AllFilesRow[] };
            if (group === 'company') {
              g.label = f.record_label ?? '';
              g.link = f.record_link ?? '';
            } else {
              g.label = t(`partners.archive.recordTypes.${RECORD_TYPE_KEY[f.entity_table] ?? 'other'}`);
              g.link = '';
            }
            g.rows.push(f);
            m.set(key, g);
            return m;
          }, new Map<string, { label: string; link: string; rows: AllFilesRow[] }>()),
        ];

  // The filter controls, shared by the wide form and the phone sheet: the selects live in the client
  // component (they apply on change), the From/To dates stay here (they apply with the Search button).
  const fields = (
    <>
      <ArchiveFilters
        values={{
          entity,
          kind,
          uploader,
          purpose,
          status,
          sort,
          group,
          size,
          company,
        }}
        kinds={kinds}
        uploaders={answer?.uploaders ?? []}
        purposes={answer?.facets.purposes ?? []}
        statuses={answer?.facets.statuses ?? []}
      />
      <ArchiveDateRange from={from} to={to} />
    </>
  );

  return (
    <Page title={t('nav.files')}>
      <PageHeader title={t('partners.archive.title')} />
      {company ? (
        <p className="mb-4 text-sm text-muted" data-archive-company>
          {t('partners.archive.partner')}: <bdi>{companyName ?? '—'}</bdi> ·{' '}
          <Link href="/files" className="text-link hover:underline">
            {t('partners.archive.allCompanies')}
          </Link>
        </p>
      ) : null}
      {/* Wide screens: search and filters in one row. Keyed by the address, so Clear filters remounts the
          controls with fresh defaults (F146) instead of leaving the old values showing. The key carries the
          breakpoint too: the two forms are siblings, and the same key on both broke React reconciliation and
          piled up extra filter bars across soft navigations (F-B3-01). */}
      <form key={`${queryKey}:wide`} action="/files" method="get" className="mb-4 hidden flex-col gap-3 sm:flex">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={t('partners.archive.search')}
            aria-label={t('partners.archive.search')}
            className={inputClass}
          />
          <Button type="submit" variant="primary">
            {t('partners.archive.search')}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">{fields}</div>
        {hasFilter ? (
          <Link href="/files" className="w-fit text-sm text-link hover:underline">
            {t('partners.archive.clearFilters')}
          </Link>
        ) : null}
      </form>
      {/* Phones: search plus a filter sheet. Keyed by the address, as the wide form above — with its own
          breakpoint suffix, so the two sibling forms never share a key (F-B3-01). */}
      <form key={`${queryKey}:phone`} action="/files" method="get" className="mb-4 flex flex-col gap-3 sm:hidden">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={t('partners.archive.search')}
            aria-label={t('partners.archive.search')}
            className={inputClass}
          />
          <Button type="submit" variant="primary">
            {t('partners.archive.search')}
          </Button>
        </div>
        <details open={hasFilter} className="rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">{t('partners.archive.filters')}</summary>
          <div className="mt-3 flex flex-col gap-3">{fields}</div>
          <Button type="submit" variant="primary" className="mt-3">
            {t('partners.archive.filters')}
          </Button>
        </details>
        {hasFilter ? (
          <Link href="/files" className="w-fit text-sm text-link hover:underline">
            {t('partners.archive.clearFilters')}
          </Link>
        ) : null}
      </form>
      {answer === null ? (
        <DataState kind="failed" what={t('partners.archive.title')} />
      ) : rows.length ? (
        <>
          <p className="mb-3 text-sm text-muted">
            {t('partners.archive.showing', { from: fromRow, to: toRow, total })}
          </p>
          {sections === null ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-raised px-5">{rows.map(row)}</ul>
          ) : (
            <div className="flex flex-col gap-6">
              {sections.map(([key, g]) => (
                <section key={key} className="rounded-lg border border-border bg-raised p-5" data-archive-group={key}>
                  <h2 className="mb-3 text-base font-semibold">
                    {g.link ? (
                      <Link href={g.link} className="hover:underline">
                        {g.label}
                      </Link>
                    ) : (
                      g.label
                    )}
                  </h2>
                  <ul className="divide-y divide-border">{g.rows.map(row)}</ul>
                </section>
              ))}
            </div>
          )}
          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              {page > 0 ? (
                <Link href={href({ page: String(page - 1) })} className="text-sm text-link hover:underline">
                  {t('partners.archive.prevPage')}
                </Link>
              ) : (
                <span />
              )}
              {page + 1 < pages ? (
                <Link href={href({ page: String(page + 1) })} className="text-sm text-link hover:underline">
                  {t('partners.archive.nextPage')}
                </Link>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </>
      ) : (
        <DataState kind="empty" message={t('partners.archive.none')} />
      )}
    </Page>
  );
}
