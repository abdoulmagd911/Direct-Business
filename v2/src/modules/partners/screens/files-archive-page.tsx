import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { Input, inputClass } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { FileDownloadButton } from './files-download-button';
import type { AllFilesAnswer, AllFilesRow, ListEntry } from '../types';

/** The record types the archive filters on: the entity tables api.all_files takes. */
const RECORD_TYPES = [
  'work.task',
  'perf.achievement',
  'my.note',
  'partner.partner',
  'work.import_batch',
  'partner.campaign_code',
] as const;
/** The message key for a record type (the tables carry dots, which the catalogue reads as nesting). */
const RECORD_TYPE_KEY: Record<string, string> = {
  'work.task': 'task',
  'perf.achievement': 'achievement',
  'my.note': 'note',
  'partner.partner': 'partner',
  'work.import_batch': 'importBatch',
  'partner.campaign_code': 'campaignCode',
};
const PAGE_SIZE = 25;

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

function sizeOf(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * All files, in one place (Phase 3, rebuilt on api.all_files): every file linked to any record the reader may
 * see, flat and newest first by default, with search over the file name and the record it belongs to. The kind
 * filter reads the live file_kind list; side, purpose, status and added-by options read live from the files the
 * reader may see. One grouping toggle (by partner, by record type, none); paging applies to the flat list, not
 * to the grouped sections. Each row downloads in place and links to its own record. A read the database refuses
 * shows as failed, never as an empty list. On a phone the filters collapse to search plus a filter sheet.
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
      page: page === 0 ? undefined : String(page),
      ...patch,
    };
    for (const [k, v] of Object.entries(all)) if (v !== undefined) params.set(k, v);
    const s = params.toString();
    return s ? `/files?${s}` : '/files';
  };

  let answer: AllFilesAnswer | null = null;
  let kinds: ListEntry[] = [];
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
      p_limit?: number;
      p_offset?: number;
    } = { p_sort: sort, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE };
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
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromRow = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const toRow = Math.min(total, (page + 1) * PAGE_SIZE);
  const kindName = (f: AllFilesRow) => (locale === 'ar' && f.kind_ar ? f.kind_ar : f.kind_en);
  const displayName = (f: AllFilesRow) =>
    locale === 'ar' && f.display_name_ar ? f.display_name_ar : (f.display_name ?? f.original_name);

  const row = (f: AllFilesRow) => (
    <li key={f.link_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5" data-archive-file={f.id}>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{displayName(f)}</span>
        <span className="text-xs text-muted">
          {kindName(f)} · {sizeOf(f.size)} ·{' '}
          {f.added_by_name ? `${t('record.files.uploader')} ${f.added_by_name} · ` : ''}
          {formatDate(f.added_at, locale as 'en' | 'ar', { dateStyle: 'medium' })}
          {f.status !== 'stored' ? ` · ${t('record.files.notStored')}` : ''}
        </span>
        {f.record_link && f.record_label ? (
          <Link href={f.record_link} className="w-fit truncate text-sm text-link hover:underline">
            {f.record_label}
          </Link>
        ) : null}
      </span>
      {f.status === 'stored' ? (
        <FileDownloadButton
          fileId={f.id}
          label={t('record.files.download')}
          failedLabel={t('record.files.downloadFailed')}
        />
      ) : null}
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
              g.label = t(`partners.archive.recordTypes.${RECORD_TYPE_KEY[f.entity_table]}`);
              g.link = '';
            }
            g.rows.push(f);
            m.set(key, g);
            return m;
          }, new Map<string, { label: string; link: string; rows: AllFilesRow[] }>()),
        ];

  const fields = (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.recordType')}</span>
        <select name="entity" defaultValue={entity} className={inputClass}>
          <option value="">{t('partners.archive.all')}</option>
          {RECORD_TYPES.map((e) => (
            <option key={e} value={e}>
              {t(`partners.archive.recordTypes.${RECORD_TYPE_KEY[e]}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.kind')}</span>
        <select name="kind" defaultValue={kind} className={inputClass}>
          <option value="">{t('partners.archive.allKinds')}</option>
          {kinds.map((k) => (
            <option key={k.key} value={k.key}>
              {locale === 'ar' && k.name_ar ? k.name_ar : k.name_en}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.addedBy')}</span>
        <select name="uploader" defaultValue={uploader} className={inputClass}>
          <option value="">{t('partners.archive.all')}</option>
          {(answer?.uploaders ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.id}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.dateFrom')}</span>
        <Input type="date" name="from" defaultValue={from} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.dateTo')}</span>
        <Input type="date" name="to" defaultValue={to} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.purpose')}</span>
        <select name="purpose" defaultValue={purpose} className={inputClass}>
          <option value="">{t('partners.archive.all')}</option>
          {(answer?.facets.purposes ?? []).map((p) => (
            <option key={p} value={p}>
              {t(`partners.archive.purposes.${p}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.side')}</span>
        <select name="side" defaultValue={side} className={inputClass}>
          <option value="">{t('partners.archive.all')}</option>
          {(answer?.facets.sides ?? []).map((s) => (
            <option key={s} value={s}>
              {t(`partners.side.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.status')}</span>
        <select name="status" defaultValue={status} className={inputClass}>
          <option value="">{t('partners.archive.all')}</option>
          {(answer?.facets.statuses ?? []).map((s) => (
            <option key={s} value={s}>
              {t(`partners.archive.statuses.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.sort')}</span>
        <select name="sort" defaultValue={sort} className={inputClass}>
          <option value="added">{t('partners.archive.sortAdded')}</option>
          <option value="name">{t('partners.archive.sortName')}</option>
          <option value="size">{t('partners.archive.sortSize')}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.groupBy')}</span>
        <select name="group" defaultValue={group} className={inputClass}>
          <option value="none">{t('partners.archive.groupNone')}</option>
          <option value="company">{t('partners.archive.groupCompany')}</option>
          <option value="type">{t('partners.archive.groupType')}</option>
        </select>
      </label>
      {company ? <input type="hidden" name="company" value={company} /> : null}
    </>
  );

  return (
    <Page title={t('nav.files')}>
      <PageHeader title={t('partners.archive.title')} />
      {company ? (
        <p className="mb-4 text-sm text-muted">
          {t('partners.archive.partner')}: {rows[0]?.record_label ?? company} ·{' '}
          <Link href="/files" className="text-link hover:underline">
            {t('partners.archive.allCompanies')}
          </Link>
        </p>
      ) : null}
      {/* Wide screens: search and filters in one row. */}
      <form action="/files" method="get" className="mb-4 hidden flex-col gap-3 sm:flex">
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
      {/* Phones: search plus a filter sheet. */}
      <form action="/files" method="get" className="mb-4 flex flex-col gap-3 sm:hidden">
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
