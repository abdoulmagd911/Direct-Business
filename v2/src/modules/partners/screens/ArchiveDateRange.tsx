'use client';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DatePicker } from '@/ui/DatePicker';

/**
 * The /files From/To dates (FIX-02): the shared DatePicker instead of the native date inputs. The page is a server
 * component whose filters submit as a GET form, so each date also carries a hidden input with the form's name — the
 * GET submission still carries `from`/`to` as `YYYY-MM-DD`. One instance per form (the page renders the filters
 * twice: desk and phone), so the ids come from `useId`, never a fixed string.
 */
export function ArchiveDateRange({ from, to }: { from: string; to: string }) {
  const t = useTranslations();
  const base = useId();
  const [fromV, setFromV] = useState<string | undefined>(from || undefined);
  const [toV, setToV] = useState<string | undefined>(to || undefined);
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.dateFrom')}</span>
        <DatePicker id={`${base}-from`} value={fromV} onChange={setFromV} chips="none" />
        <input type="hidden" name="from" value={fromV ?? ''} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{t('partners.archive.dateTo')}</span>
        <DatePicker id={`${base}-to`} value={toV} onChange={setToV} chips="none" />
        <input type="hidden" name="to" value={toV ?? ''} />
      </label>
    </>
  );
}
