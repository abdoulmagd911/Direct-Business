import { formatDate, formatNumber } from '@/core/i18n/format';
import { docText } from '../text';
import { pick, type Bi, type Cell, type Column, type Figure, type Lang, type ReportDoc } from './model';
import { quarterName, statusWord, word } from './words';

/**
 * Formatting shared by the PDF and the PPTX, so both say exactly the same thing (V301). Gregorian dates and Latin
 * digits in both languages (V40), Riyadh's calendar (D20); every string ends in `docText`.
 */

/** A bilingual text as printed in `lang` (V403's fallback), with Latin digits (V40). */
export function textOf(value: Bi, lang: Lang): string {
  return docText(pick(value, lang));
}

/**
 * A report's calendar date (`YYYY-MM-DD`, Riyadh — D20) as noon UTC, so no time zone can move it to another day.
 * Anything else is refused by name: a document never prints "Invalid Date".
 */
export function calendarDay(iso: string): Date {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso)
    throw new Error(`print: "${iso}" is not a calendar date (YYYY-MM-DD)`);
  return d;
}

/**
 * Checks what a report's pages are built from before any rendering starts — react-pdf turns an error thrown while it
 * lays out a page into a meaningless one, so a bad date must be refused here, by name.
 */
export function checkPrintable(doc: Pick<ReportDoc, 'period' | 'issuedOn'>): void {
  const start = calendarDay(doc.period.start);
  const end = calendarDay(doc.period.end);
  if (start > end) throw new Error(`print: the period ends (${doc.period.end}) before it starts (${doc.period.start})`);
  if (doc.issuedOn !== null) calendarDay(doc.issuedOn);
}

/** The report's number as printed (V40: Latin digits), or null for a draft. */
export function numberOf(doc: Pick<ReportDoc, 'number'>): string | null {
  return doc.number === null ? null : docText(doc.number);
}

/** "September 2026" / "سبتمبر 2026", or "Q3 2026" / "الربع الثالث 2026". */
export function periodLabel(doc: Pick<ReportDoc, 'kind' | 'period'>, lang: Lang): string {
  const start = calendarDay(doc.period.start);
  if (doc.kind === 'quarterly') {
    const q = (Math.floor(start.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
    return docText(quarterName(q, start.getUTCFullYear(), lang));
  }
  return docText(formatDate(start, lang, { day: undefined, month: 'long', year: 'numeric' }));
}

export function reportTitle(doc: Pick<ReportDoc, 'kind'>, lang: Lang): string {
  return word(doc.kind === 'quarterly' ? 'quarterly_report' : 'monthly_report', lang);
}

/** "30 September 2026" / "30 سبتمبر 2026". */
export function longDate(iso: string, lang: Lang): string {
  return docText(formatDate(calendarDay(iso), lang, { month: 'long' }));
}

/** A figure's number and its unit, apart (the unit prints muted beside the number — §2.5). */
export function figureParts(f: Figure, lang: Lang): { number: string; unit: string | null } {
  if (f.kind === 'not_measured') return { number: '—', unit: null };
  switch (f.unit) {
    case 'sar':
      return { number: docText(formatNumber(f.value, lang, { maximumFractionDigits: 0 })), unit: word('sar', lang) };
    case 'percent':
      return { number: docText(`${formatNumber(f.value, lang, { maximumFractionDigits: 1 })}%`), unit: null };
    default:
      return { number: docText(formatNumber(f.value, lang, { maximumFractionDigits: 0 })), unit: null };
  }
}

/** A figure as one string: "11,500 SAR", "87.5%", "—". */
export function figureText(f: Figure, lang: Lang): string {
  const p = figureParts(f, lang);
  return p.unit ? `${p.number} ${p.unit}` : p.number;
}

/**
 * The change from last year's figure to this one, in percent, or null when it cannot be said: either side not
 * measured, or last year was 0 (a change from nothing has no percentage).
 */
export function change(current: Figure, previous: Figure | null): { percent: number; text: string } | null {
  if (!previous || current.kind !== 'number' || previous.kind !== 'number' || previous.value === 0) return null;
  const percent = ((current.value - previous.value) / Math.abs(previous.value)) * 100;
  const rounded = Math.round(percent * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return { percent: rounded, text: `${sign}${formatNumber(Math.abs(rounded), 'en', { maximumFractionDigits: 1 })}%` };
}

/** A table cell's text in one language. Numbers follow the column; a status prints its word (never colour alone). */
export function cellText(cell: Cell, column: Column, lang: Lang): string {
  if (cell === null) return '—';
  if (typeof cell === 'number')
    return docText(formatNumber(cell, lang, { maximumFractionDigits: column.kind === 'number' ? 1 : 0 }));
  if (typeof cell === 'string') return docText(cell);
  if ('id' in cell) return docText(cell.id);
  if ('status' in cell) return statusWord(cell.status, lang);
  if ('figure' in cell) return figureText(cell.figure, lang);
  if (!('ar' in cell)) return '—';
  return textOf(cell, lang);
}
