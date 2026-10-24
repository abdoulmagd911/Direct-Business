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
  // a time is always 24-hour (09:00, 21:30), in Arabic too: ar-SA would default to 12-hour with ص/م (V643 (4))
  if (given.hour) given.hourCycle = 'h23';
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

/**
 * A stored value that is a date (`2026-10-19`) or a moment (`2026-10-19T06:30:00+00:00`) written the one way — `19 Oct 2026`,
 * `19 Oct 2026, 09:30` — for a screen that prints whatever a column held (a history line, a conflict, a custom field).
 * Anything else is not a date: null, so the caller prints it as it was.
 */
export function formatStoredDate(v: unknown, locale: 'en' | 'ar' = 'en'): string | null {
  if (typeof v !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(`${v}T12:00:00+03:00`, locale);
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) {
    const moment = /(Z|[+-]\d{2}(:?\d{2})?)$/.test(v) ? v.replace(' ', 'T') : `${v.replace(' ', 'T')}+03:00`;
    const out = formatDate(moment, locale, { dateStyle: 'medium', timeStyle: 'short' });
    return out === '—' ? null : out;
  }
  return null;
}

/** A time of day, always 24-hour (`09:30`, `21:05`), written by the same formatter as a date; `HH:MM` in, text out. */
export function formatClock(hhmm: string, locale: 'en' | 'ar' = 'en'): string {
  return formatDate(`2026-01-15T${hhmm}:00+03:00`, locale, { timeStyle: 'short' });
}

/**
 * Reads a typed time of day as `HH:MM`, 24-hour: "9", "9:30", "0930", "21.05", "٢١:٠٥", and "9:30 pm" for a person who
 * types it that way. Anything else is no time (null).
 */
export function parseClock(typed: string): string | null {
  const s = typed
    .trim()
    .toLowerCase()
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
  const m = /^(\d{1,2})(?:[:.]?(\d{2}))?\s*(am|pm)?$/.exec(s);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  if (m[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (m[3] === 'pm' ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

let monthWords: Map<string, number> | undefined;
/** The month (1–12) a typed word names — `Oct` or `October`, or Arabic's own word — read from the formatter's own names. */
export function monthNumber(word: string): number | null {
  if (!monthWords) {
    monthWords = new Map();
    for (const loc of ['en', 'ar'] as const)
      for (let m = 1; m <= 12; m++) {
        const name = formatDate(`2026-${String(m).padStart(2, '0')}-15T12:00:00+03:00`, loc, {
          month: 'short',
          day: undefined,
          year: undefined,
        });
        const key = name.toLowerCase().replace(/\.$/, '');
        monthWords.set(/^[a-z]/.test(key) ? key.slice(0, 3) : key, m);
      }
  }
  const w = word.trim().toLowerCase().replace(/\.$/, '');
  return monthWords.get(/^[a-z]/.test(w) ? w.slice(0, 3) : w) ?? null;
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
