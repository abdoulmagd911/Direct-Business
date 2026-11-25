import { formatDate } from '@/core/i18n/format';
import { listFilter, parseFilters } from '@/modules/tasks/rules';

/**
 * The My day banner counts "My work" — the same thing, read the same way, as the Tasks screen's My work tab (the 15 Nov
 * board: "The banner counts My work, the same name and the same number as the Tasks tab, and says so"). This is the
 * filter the Tasks page sends `api.tasks` when it opens with nothing chosen (`listFilter(parseFilters(params))` in
 * `app/(app)/tasks/page.tsx`): built by the Tasks screen's own two functions, so the two can never drift apart.
 */
export const myWorkFilter = (): Record<string, unknown> => listFilter(parseFilters({}));

/**
 * The banner's heading: Riyadh's day as the boards of Landing 53 write it — "Friday, 13 November 2026",
 * «الجمعة، 13 نوفمبر 2026». A heading, not a date in a row: the weekday and the month are written in full (each asked
 * for on its own, so the one date format's short month does not apply), Latin digits, Gregorian in Arabic too.
 */
export function dayHeading(d: Date | string, locale: 'en' | 'ar'): string {
  if (locale === 'ar') return formatDate(d, 'ar', { weekday: 'long' });
  const alone = { day: undefined, month: undefined, year: undefined } as const;
  const weekday = formatDate(d, 'en', { ...alone, weekday: 'long' });
  const day = formatDate(d, 'en', { ...alone, day: 'numeric' });
  const month = formatDate(d, 'en', { ...alone, month: 'long' });
  const year = formatDate(d, 'en', { ...alone, year: 'numeric' });
  return `${weekday}, ${day} ${month} ${year}`;
}
