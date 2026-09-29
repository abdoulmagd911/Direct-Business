import { TIME_ZONE } from '@/core/i18n/format';

/**
 * What a list exports: its columns, in the list's order, each with the header the person sees and the kind of value it
 * holds. The kind decides how the value is written (spec §3.11 Export): numbers as numbers, dates as Riyadh dates
 * (D20), IDs as text exactly as stored, every text through `csvGuard` (CP5).
 */
export type ExportKind = 'text' | 'id' | 'number' | 'money' | 'percent' | 'date' | 'datetime' | 'boolean';

export interface ExportColumn<T> {
  /** Distinct within the list; names the column in errors. */
  key: string;
  /** The column's header in the person's language (from the catalog). */
  header: string;
  kind: ExportKind;
  /**
   * The row's value. `null`/`undefined`/`''` export as an empty cell — "not measured" stays empty, never 0 (M60).
   * `percent` is in percent points (87.5 means 87.5%), as the list shows it. `date` takes a calendar date
   * (`YYYY-MM-DD`) or a moment; `datetime` takes a moment (an ISO timestamp or a Date). `text` also takes a list of
   * texts (joined with "; ").
   */
  value: (row: T) => unknown;
  /** Excel column width in characters (a default by kind otherwise). */
  width?: number;
}

/** One cell, typed — the CSV and the Excel writers both start from this. */
export type Cell =
  | { t: 'empty' }
  | { t: 'text'; v: string }
  | { t: 'number'; v: number }
  | { t: 'date'; y: number; m: number; d: number }
  | { t: 'datetime'; y: number; m: number; d: number; h: number; mi: number; s: number }
  | { t: 'bool'; v: boolean };

/** A value that does not fit its column — a mapping mistake, refused by name instead of "[object Object]" in a file. */
export class ExportColumnError extends Error {
  constructor(column: string, kind: ExportKind, value: unknown) {
    const shown = typeof value === 'string' ? `"${value.slice(0, 40)}"` : Object.prototype.toString.call(value);
    super(`export: column "${column}" (${kind}) cannot hold ${shown}`);
    this.name = 'ExportColumnError';
  }
}

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

const riyadhParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** A moment's wall clock in Riyadh (D20). */
export function riyadhClock(at: Date): { y: number; m: number; d: number; h: number; mi: number; s: number } {
  const p: Record<string, number> = {};
  for (const part of riyadhParts.formatToParts(at)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { y: p.year!, m: p.month!, d: p.day!, h: p.hour!, mi: p.minute!, s: p.second! };
}

/** A moment with its offset: `2026-09-29T21:30:00Z`, `…+00:00`, `…+0300`. */
const MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

function moment(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  // A moment carries a time and its offset. A bare date would be read as UTC midnight, and a time without an offset
  // in the computer's own zone (PRF-139) — either could land on the wrong Riyadh day, so both are refused.
  if (typeof v === 'string' && MOMENT.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function calendarDay(v: string): { y: number; m: number; d: number } | null {
  const m = CALENDAR_DAY.exec(v);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d
    ? { y, m: mo, d }
    : null;
}

/** The typed cell for one value of one column. Throws `ExportColumnError` when the value cannot be that kind. */
export function cellOf(column: Pick<ExportColumn<unknown>, 'key' | 'kind'>, raw: unknown): Cell {
  if (raw === null || raw === undefined || raw === '') return { t: 'empty' };
  const fail = () => new ExportColumnError(column.key, column.kind, raw);
  switch (column.kind) {
    case 'text': {
      if (typeof raw === 'string') return { t: 'text', v: raw };
      if (typeof raw === 'number' && Number.isFinite(raw)) return { t: 'text', v: String(raw) };
      if (typeof raw === 'boolean') return { t: 'text', v: String(raw) };
      if (Array.isArray(raw) && raw.every((x) => typeof x === 'string')) {
        const joined = raw.filter(Boolean).join('; ');
        return joined ? { t: 'text', v: joined } : { t: 'empty' };
      }
      throw fail();
    }
    case 'id': {
      // Exactly as stored: "INV-T-0001", "00123". A number is only taken while it is still exact.
      if (typeof raw === 'string') return { t: 'text', v: raw };
      if (typeof raw === 'number' && Number.isSafeInteger(raw)) return { t: 'text', v: String(raw) };
      throw fail();
    }
    case 'number':
    case 'money':
    case 'percent': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && PLAIN_NUMBER.test(raw) ? Number(raw) : NaN;
      if (!Number.isFinite(n) || Math.abs(n) >= 1e15) throw fail();
      return { t: 'number', v: Object.is(n, -0) ? 0 : n };
    }
    case 'date': {
      if (typeof raw === 'string') {
        const day = calendarDay(raw);
        if (day) return { t: 'date', ...day };
      }
      const at = moment(raw);
      if (!at) throw fail();
      const { y, m, d } = riyadhClock(at);
      return { t: 'date', y, m, d };
    }
    case 'datetime': {
      const at = moment(raw);
      if (!at) throw fail();
      return { t: 'datetime', ...riyadhClock(at) };
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { t: 'bool', v: raw };
      throw fail();
    }
  }
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** `2026-09-29`. */
export function dayText(c: { y: number; m: number; d: number }): string {
  return `${pad(c.y, 4)}-${pad(c.m)}-${pad(c.d)}`;
}

/** `2026-09-29 14:05:33`. */
export function clockText(c: { y: number; m: number; d: number; h: number; mi: number; s: number }): string {
  return `${dayText(c)} ${pad(c.h)}:${pad(c.mi)}:${pad(c.s)}`;
}

/**
 * A number the way a spreadsheet reads it: a dot, no thousands separator, no currency — and never the exponent form
 * JavaScript prints for tiny fractions ("1e-7"). Numbers of 10^15 and over are refused by `cellOf`.
 */
export function plainNumber(n: number): string {
  const s = String(n);
  const m = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
  if (!m) return s;
  // Move the point in JavaScript's own shortest digits, so no float noise is added ("1.23e-7" → "0.000000123").
  const [, sign, int, frac = '', exp] = m;
  const digits = int! + frac;
  const point = int!.length + Number(exp);
  const body =
    point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + '0'.repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return sign + body;
}
