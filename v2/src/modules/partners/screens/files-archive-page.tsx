import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { formatDate } from '@/core/i18n/format';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import type { ArchiveFile } from '../types';

/** The kinds the archive filter offers — the company Files section's kinds. Other kinds still list. */
const KIND_FILTERS = ['agreement', 'cr_certificate', 'vat_certificate', 'national_address', 'tender_document'] as const;

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

/**
 * All company files, in one place: every file linked to a company, grouped by company, filtered by
 * company (?company=) and by kind (?kind=). Downloading lives on the company itself, so each row links
 * there. A read the database refuses shows as no access, never as an empty list.
 */
export async function FilesArchivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [q, t, locale] = await Promise.all([searchParams, getTranslations(), getLocale()]);
  await requireMe();
  const company = one(q.company);
  const kind = one(q.kind);
  const href = (c: string | undefined, k: string | undefined) => {
    const params = new URLSearchParams();
    if (c) params.set('company', c);
    if (k) params.set('kind', k);
    const s = params.toString();
    return s ? `/files?${s}` : '/files';
  };
  let rows: ArchiveFile[] | null = null;
  try {
    const args: { p_partner?: string; p_kind?: string } = {};
    if (company) args.p_partner = company;
    if (kind) args.p_kind = kind;
    rows = (await serverRpc('company_files', args)) as unknown as ArchiveFile[];
  } catch {
    rows = null;
  }
  const groups = new Map<string, { name: string; nameAr: string | null; rows: ArchiveFile[] }>();
  for (const r of rows ?? []) {
    const g = groups.get(r.partner_id) ?? { name: r.partner_name, nameAr: r.partner_name_ar, rows: [] };
    g.rows.push(r);
    groups.set(r.partner_id, g);
  }
  return (
    <Page title={t('nav.files')}>
      <PageHeader title={t('partners.archive.title')} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{t('partners.companyFiles.kind')}:</span>
        <Link
          href={href(company, undefined)}
          className={`rounded-pill border px-3 py-1 text-sm ${!kind ? 'border-border-strong bg-raised font-medium' : 'border-border'}`}
        >
          {t('partners.archive.allKinds')}
        </Link>
        {KIND_FILTERS.map((k) => (
          <Link
            key={k}
            href={href(company, k)}
            className={`rounded-pill border px-3 py-1 text-sm ${kind === k ? 'border-border-strong bg-raised font-medium' : 'border-border'}`}
          >
            {t(`partners.companyFiles.kinds.${k}`)}
          </Link>
        ))}
        {company ? (
          <Link href={href(undefined, kind)} className="ms-2 text-sm text-link hover:underline">
            {t('partners.archive.showAll')}
          </Link>
        ) : null}
      </div>
      {rows === null ? (
        <DataState kind="failed" what={t('partners.archive.title')} />
      ) : rows.length ? (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([partnerId, g]) => (
            <section
              key={partnerId}
              className="rounded-lg border border-border bg-raised p-5"
              data-archive-company={partnerId}
            >
              <h2 className="mb-3 text-base font-semibold">
                <Link href={`/partners/${partnerId}`} className="hover:underline">
                  {locale === 'ar' && g.nameAr ? g.nameAr : g.name}
                </Link>
              </h2>
              <ul className="divide-y divide-border">
                {g.rows.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    data-archive-file={f.id}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {locale === 'ar' && f.display_name_ar
                          ? f.display_name_ar
                          : (f.display_name_en ?? f.original_name)}
                      </span>
                      <span className="text-xs text-muted">
                        {locale === 'ar' && f.kind_ar ? f.kind_ar : f.kind_en} ·{' '}
                        {formatDate(f.added_at, locale as 'en' | 'ar', { dateStyle: 'medium' })}
                        {f.status !== 'stored' ? ` · ${t('partners.companyFiles.notStored')}` : ''}
                      </span>
                    </span>
                    <Link href={`/partners/${partnerId}`} className="text-sm text-link hover:underline">
                      {t('partners.archive.partner')}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <DataState kind="empty" message={t('partners.archive.none')} />
      )}
    </Page>
  );
}
