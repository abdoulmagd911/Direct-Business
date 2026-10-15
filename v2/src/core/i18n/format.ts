/**
 * Formatting rules that never change by theme or person (spec §1 Dates, V40):
 * Riyadh time, Gregorian calendar, Latin digits — in Arabic too (`ar-SA` would default to Hijri).
 */
export const TIME_ZONE = 'Asia/Riyadh';

export function intlLocale(locale: 'en' | 'ar'): string {
  return locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB-u-ca-gregory-nu-latn';
}

/**
 * The one way a date is written (W-daily 13): `14 Oct 2026` — day, a three-letter month, the year — in English
 * (`Sept` is `Sep`), the same date in Arabic's own month name, Latin digits, Riyadh time. Whatever is asked for, a
 * date that has a day and a month always has its year and a short month; a long date style is the short one. A month on
 * its own ("October 2026", a period's name) and a weekday on its own are not dates and stay as asked. Every screen
 * writes dates here — the `one-date-format` check refuses another way.
 */
export function formatDate(
  d: Date | string,
  locale: 'en' | 'ar' = 'en',
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  // A value that is not a date costs one figure, never the screen (the old app's "NaN days ago").
  if (Number.isNaN(date.getTime())) return '—';
  // The ready-made styles are written as parts, so every date comes out the same way in both languages.
  const { dateStyle, timeStyle, ...rest } = opts;
  const given: Intl.DateTimeFormatOptions = dateStyle
    ? { day: 'numeric', month: 'short', year: 'numeric', ...rest }
    : timeStyle
      ? rest
      : { day: 'numeric', month: 'short', year: 'numeric', ...rest };
  if (timeStyle) Object.assign(given, { hour: '2-digit', minute: '2-digit' });
  // a date has its day, a short month and its year; a month or a weekday alone is a label and stays as asked
  const dated = !!given.day && !!given.month;
  if (dated) {
    given.month = 'short';
    given.year = 'numeric';
  }
  const parts = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TIME_ZONE,
    calendar: 'gregory',
    numberingSystem: 'latn',
    ...given,
  }).formatToParts(date);
  return parts
    .map((p) =>
      p.type === 'month' && locale === 'en' && dated && /^[A-Za-z]{4,}$/.test(p.value) ? p.value.slice(0, 3) : p.value,
    )
    .join('');
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

/**
 * A title as a toast or a short line names it: whole when it fits, otherwise cut at `max` characters with an ellipsis
 * (the supervisor's sweep of 15 Oct: a toast names the thing by its title, then its number).
 */
export function clip(text: string, max = 60): string {
  const s = text.trim().replace(/\s+/g, ' ');
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
