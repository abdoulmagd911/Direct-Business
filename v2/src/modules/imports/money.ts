// Plain reading of money and dates from Direct files. Never silently turns a bad value
// into 0: an amount or date that cannot be read comes back null, and the normaliser turns
// that into a row problem with a plain reason. Arabic-Indic digits, a decimal comma, and
// an accounting (500) negative are all read as the person wrote them.

const AR_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٫': '.',
  '٬': ',',
  '−': '-',
};

function asciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹٫٬−]/g, (c) => AR_DIGITS[c] ?? c);
}

/** Money as a number, or null when the cell is empty or cannot be read. Never 0 by guess. */
export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  const ascii = asciiDigits(String(value)).trim();
  if (ascii === '') return null;
  const negative = /^\(.*\)$/.test(ascii) || /^-/.test(ascii.replace(/[^\d.,-]/g, ''));
  let cleaned = ascii.replace(/[^\d.,]/g, '');
  if (cleaned === '') return null;
  if (/,\d{1,2}$/.test(cleaned) && cleaned.includes('.') && cleaned.lastIndexOf('.') < cleaned.lastIndexOf(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.'); // 1.250,50
  } else if (/,\d{1,2}$/.test(cleaned) && !cleaned.includes('.') && (cleaned.match(/,/g) ?? []).length === 1) {
    cleaned = cleaned.replace(',', '.'); // 1250,50
  } else {
    cleaned = cleaned.replace(/,/g, ''); // 1,250.50
  }
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed * 100) / 100;
  return negative ? -Math.abs(rounded) : rounded;
}

/** A date as YYYY-MM-DD, or null when it is not a real calendar day. */
export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = asciiDigits(String(value)).trim();
  if (text === '') return null;
  const datePart = text.split(/[ T]/)[0] ?? '';
  let year: number;
  let month: number;
  let day: number;
  let match = datePart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = datePart.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
    if (month > 12 && day <= 12) {
      const swap = month;
      month = day;
      day = swap;
    }
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null; // e.g. 30 Feb: looks like a date, is not one
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Round to halalas (2 decimals), so sums never drift by a fraction of a riyal. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** "Issued 1160000133" -> "1160000133". "Need to issue" (and anything else) -> null. */
export function parseIssuedInvoice(text: unknown): string | null {
  if (text === null || text === undefined) return null;
  const match = asciiDigits(String(text)).match(/issued\s+(\d+)/i);
  return match ? (match[1] ?? null) : null;
}

/** A 10-digit invoice number, digits only, or null. The only key promo rows may match on. */
export function tenDigitRef(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const digits = asciiDigits(String(value)).trim();
  return /^\d{10}$/.test(digits) ? digits : null;
}
