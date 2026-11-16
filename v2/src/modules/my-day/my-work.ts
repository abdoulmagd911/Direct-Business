import { formatDate } from '@/core/i18n/format';
import { listFilter, parseFilters } from '@/modules/tasks/rules';

/**
 * The My day banner counts "My work" — the same thing, read the same way, as the Tasks screen's My work tab (the 15 Nov
 * board: "The banner counts My work, the same name and the same number as the Tasks tab, and says so"). This is the
 * filter the Tasks page sends `api.tasks` when it opens with nothing chosen (`listFilter(parseFilters(params))` in
 * `app/(app)/tasks/page.tsx`): built by the Tasks screen's own two functions, so the two can never drift apart.
 */
export const myWorkFilter = (): Record<string, unknown> => listFilter(parseFilters({}));

/** The banner's heading: Riyadh's day as the boards write it — "Sun 15 Nov 2026", «الأحد، 15 نوفمبر 2026». */
export function dayHeading(d: Date | string, locale: 'en' | 'ar'): string {
  const day = formatDate(d, locale, { weekday: 'short' });
  return locale === 'en' ? day.replace(/,/g, '') : day;
}
