/**
 * A pasted date as a calendar day (`YYYY-MM-DD`, Riyadh's calendar — D20). What a spreadsheet copies is the date as
 * the sheet displays it, so the reading order is the person's choice (day first is the Saudi habit), never a guess:
 * "03/04/2026" is refused as ambiguous unless an order is chosen. Also read: ISO dates, "29 Sep 2026" / "Sep 29, 2026",
 * Excel's serial day numbers (a date cell formatted as a number), and a date copied from an Arabic sheet — Arabic-Indic
 * digits, the unseen direction marks an Arabic sheet writes around them, and the Arabic month names ("30 سبتمبر 2026").
 * A two-digit year is refused. Nothing here depends on the computer's time zone (PRF-139).
 */
export type DateOrder = 'dmy' | 'mdy';

export type DayReading = { day: string } | { problem: 'date_missing' | 'date_unreadable' | 'date_ambiguous' };

/** Arabic-Indic and extended Arabic-Indic digits as 0–9 (a date typed in an Arabic sheet). */
function latinDigits(s: string): string {
  return s
    .replace(/[\u{0660}-\u{0669}]/gu, (d) => String(d.codePointAt(0)! - 0x0660))
    .replace(/[\u{06F0}-\u{06F9}]/gu, (d) => String(d.codePointAt(0)! - 0x06f0));
}

/**
 * Marks that set the direction of text without being seen: an Arabic sheet writes a right-to-left mark after the day
 * and after the month of "٣٠/٩/٢٠٢٦", and a copy keeps them.
 */
const DIRECTION_MARKS = /[\u{061C}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}]/gu;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** The Gregorian month names as an Arabic sheet shows them, from the browser's own calendar data (no word list here). */
const AR_MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('ar', { month: 'long', calendar: 'gregory', timeZone: 'UTC' }).format(Date.UTC(2026, i, 15)),
);

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function calendarDay(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

/** Excel's serial day (the 1900 system: day 1 is 1900-01-01, with its phantom 29 Feb 1900). */
function fromSerial(n: number): string | null {
  if (!Number.isInteger(n) || n < 367 || n > 401_768) return null; // 1901 … 2999
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000);
  return calendarDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function readDay(raw: string, order: DateOrder | null): DayReading {
  const text = latinDigits(raw)
    .replace(DIRECTION_MARKS, '')
    .replace(/\u{060C}/gu, ',') // the Arabic comma
    .trim()
    .replace(/\s+/g, ' ');
  if (!text) return { problem: 'date_missing' };
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(text);
  if (m) return found(calendarDay(+m[1]!, +m[2]!, +m[3]!));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?: .*)?$/.exec(text);
  if (m) {
    if (m[3]!.length !== 4) return { problem: 'date_unreadable' };
    const [a, b, y] = [+m[1]!, +m[2]!, +m[3]!];
    if (a === b) return found(calendarDay(y, a, b));
    const chosen = order ?? (a > 12 ? 'dmy' : b > 12 ? 'mdy' : null);
    if (!chosen) return { problem: 'date_ambiguous' };
    return found(chosen === 'dmy' ? calendarDay(y, b, a) : calendarDay(y, a, b));
  }
  m = /^(\d{1,2}) ([a-z]{3})[a-z]*\.?,? (\d{4})$/i.exec(text);
  if (m) return found(calendarDay(+m[3]!, MONTHS.indexOf(m[2]!.toLowerCase()) + 1, +m[1]!));
  m = /^([a-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/i.exec(text);
  if (m) return found(calendarDay(+m[3]!, MONTHS.indexOf(m[1]!.toLowerCase()) + 1, +m[2]!));
  m = /^(\d{1,2}) (\p{Script=Arabic}+),? (\d{4})$/u.exec(text);
  if (m) return found(calendarDay(+m[3]!, AR_MONTHS.indexOf(m[2]!) + 1, +m[1]!));
  m = /^(\p{Script=Arabic}+) (\d{1,2}),? (\d{4})$/u.exec(text);
  if (m) return found(calendarDay(+m[3]!, AR_MONTHS.indexOf(m[1]!) + 1, +m[2]!));
  if (/^\d{3,6}$/.test(text)) return found(fromSerial(+text));
  return { problem: 'date_unreadable' };
}

function found(day: string | null): DayReading {
  return day ? { day } : { problem: 'date_unreadable' };
}
