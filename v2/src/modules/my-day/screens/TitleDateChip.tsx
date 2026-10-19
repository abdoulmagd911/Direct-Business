'use client';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/core/i18n/format';
import type { TitleDate } from '../title-date';

/** "Fri 23 Oct" or "Fri 23 Oct · 18:00": the day a title's date was read as, in the one date form of the app. */
export function titleDateLine(r: TitleDate, locale: 'en' | 'ar'): string {
  const day = formatDate(`${r.day}T12:00:00+03:00`, locale, { weekday: 'short' }).replace(/[,،]/g, '');
  return r.time ? `${day} · ${r.time}` : day;
}

/**
 * A date typed in a title, read (V639 (1)): the day it was read as, with a button to take it away before saving. The
 * words stay in the title either way; removing the chip only stops them setting the day.
 */
export function TitleDateChip({
  read,
  what,
  onRemove,
}: {
  read: TitleDate;
  /** "reminder" or "due": which of the two the chip sets */
  what: 'reminder' | 'due';
  onRemove: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  return (
    <div
      className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-accent bg-accent-soft px-3 text-sm"
      data-title-date
      data-title-date-day={read.day}
    >
      <span className="min-w-0 break-words">
        {t(`pages.myDay.titleDate.${what}`, { found: read.found, when: titleDateLine(read, locale) })}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('pages.myDay.titleDate.remove')}
        className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
        data-title-date-remove
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
