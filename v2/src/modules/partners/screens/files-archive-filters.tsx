'use client';
import { useLocale, useTranslations } from 'next-intl';
import { inputClass } from '@/ui/Input';
import type { ListEntry } from '../types';

/** The page sizes the archive offers: 10 / 25 / 50 / 100, default 25 (FIX-08 F151). */
export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

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

/**
 * The archive's filter selects (FIX-08): record type, kind, added by, purpose, status, sort, group by, page size.
 * A select applies the moment it changes — it submits the enclosing GET form at once (F147), so the list the
 * person sees is never behind the control they just set. The search box and the From/To dates are not selects:
 * they still apply with the Search button. The Side filter is gone (F148): no upload path ever records a side,
 * so it could only ever offer "All". The date inputs stay on the server page, beside this component.
 */
export function ArchiveFilters({
  values,
  kinds,
  uploaders,
  purposes,
  statuses,
}: {
  values: {
    entity: string;
    kind: string;
    uploader: string;
    purpose: string;
    status: string;
    sort: string;
    group: string;
    size: number;
    company?: string;
  };
  kinds: ListEntry[];
  uploaders: { id: string; name: string | null }[];
  purposes: string[];
  statuses: string[];
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const apply = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // A form submit carries every field as it stands (search text, dates, the other selects), so changing one
    // select never drops the rest of the filter.
    e.currentTarget.form?.requestSubmit();
  };
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.recordType')}</span>
        <select name="entity" defaultValue={values.entity} onChange={apply} className={inputClass}>
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
        <select name="kind" defaultValue={values.kind} onChange={apply} className={inputClass}>
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
        <select name="uploader" defaultValue={values.uploader} onChange={apply} className={inputClass}>
          <option value="">{t('partners.archive.all')}</option>
          {uploaders.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.id}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.purpose')}</span>
        <select name="purpose" defaultValue={values.purpose} onChange={apply} className={inputClass}>
          <option value="">{t('partners.archive.all')}</option>
          {purposes.map((p) => (
            <option key={p} value={p}>
              {t(`partners.archive.purposes.${p}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.status')}</span>
        <select name="status" defaultValue={values.status} onChange={apply} className={inputClass}>
          <option value="">{t('partners.archive.all')}</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {t(`partners.archive.statuses.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.sort')}</span>
        <select name="sort" defaultValue={values.sort} onChange={apply} className={inputClass}>
          <option value="added">{t('partners.archive.sortAdded')}</option>
          <option value="name">{t('partners.archive.sortName')}</option>
          <option value="size">{t('partners.archive.sortSize')}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.groupBy')}</span>
        <select name="group" defaultValue={values.group} onChange={apply} className={inputClass}>
          <option value="none">{t('partners.archive.groupNone')}</option>
          <option value="company">{t('partners.archive.groupCompany')}</option>
          <option value="type">{t('partners.archive.groupType')}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.pageSize')}</span>
        <select name="size" defaultValue={String(values.size)} onChange={apply} className={inputClass}>
          {PAGE_SIZES.map((s) => (
            <option key={s} value={String(s)}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {values.company ? <input type="hidden" name="company" value={values.company} /> : null}
    </>
  );
}
