/**
 * Formatting rules that never change by theme or person (spec §1 Dates, V40):
 * Riyadh time, Gregorian calendar, Latin digits — in Arabic too (`ar-SA` would default to Hijri).
 */
export const TIME_ZONE = 'Asia/Riyadh';

export function intlLocale(locale: 'en' | 'ar'): string {
  return locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB-u-ca-gregory-nu-latn';
}

export function formatDate(
  d: Date | string,
  locale: 'en' | 'ar' = 'en',
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TIME_ZONE,
    calendar: 'gregory',
    numberingSystem: 'latn',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(date);
}

/** Money is a figure in mono with the currency muted beside it; VAT never appears (M1). */
export function formatMoney(amount: number, locale: 'en' | 'ar' = 'en', fraction = 0): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    numberingSystem: 'latn',
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(amount);
}

export function formatNumber(n: number, locale: 'en' | 'ar' = 'en', opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(intlLocale(locale), { numberingSystem: 'latn', ...opts }).format(n);
}
