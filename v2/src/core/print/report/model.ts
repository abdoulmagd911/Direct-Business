/**
 * The report as documents print it — one model behind the PDF and the PPTX (V34, V301), built from an issued
 * report's frozen snapshot or from a live draft (spec §3.9). Everything in it is already a figure or a sentence in
 * both languages: the renderers only lay it out, they never compute a figure (§1a: nothing stores a copy).
 *
 * The layout follows the department's own issued reports (V34): a 16:9 deck — a cover, "this period vs the same
 * period last year" as tiles, achievements by category, the KPI table, challenges and next-period targets.
 */

export type Lang = 'ar' | 'en';

/**
 * A text in the report's two languages. Reports print in Arabic by default, with an English copy on request (V403):
 * the Arabic is required (issuing refuses a line without it), the English is optional — a line typed only in Arabic
 * prints its Arabic in the English copy too.
 */
export type Bi = { ar: string; en?: string | null };

export type Unit = 'count' | 'sar' | 'percent';

/** A figure, or the honest absence of one (M60: "not measured" is never 0). */
export type Figure = { kind: 'number'; value: number; unit: Unit } | { kind: 'not_measured' };

export interface Tile {
  key: string;
  label: Bi;
  current: Figure;
  /** The same period last year; null when the tile has no comparison. */
  previous: Figure | null;
  /** Which way is good news (complaints: down). Colours the change; its sign still says it (colour never alone). */
  better?: 'up' | 'down';
}

export interface Line {
  text: Bi;
  /** A non-money amount from cited achievements (V67), or an invoice amount; printed with its label. */
  amount?: { value: number; unit: Unit; label: Bi | null } | null;
}

export interface LineGroup {
  /** The achievement category, or null for an ungrouped list (challenges, targets). */
  title: Bi | null;
  lines: Line[];
}

export type Status = 'on_track' | 'at_risk' | 'behind' | 'not_measured' | 'done' | 'carried_over';

export type Cell = null | string | number | Bi | { id: string } | { status: Status } | { figure: Figure };

export interface Column {
  key: string;
  title: Bi;
  kind: 'text' | 'id' | 'number' | 'status';
  /** A share of the table's width; the widths of a table add up to 1. */
  width: number;
}

export type Section =
  | { kind: 'tiles'; key: string; title: Bi; currentLabel: Bi; previousLabel: Bi; tiles: Tile[] }
  | { kind: 'lines'; key: string; title: Bi; groups: LineGroup[] }
  | { kind: 'table'; key: string; title: Bi; columns: Column[]; rows: Cell[][] };

export interface ReportDoc {
  kind: 'monthly' | 'quarterly';
  status: 'draft' | 'issued';
  /** `<dept>-M-2026-09` once issued (spec §3.9); null for a draft. */
  number: string | null;
  department: Bi;
  /** ISO dates, Riyadh calendar (D20). */
  period: { start: string; end: string };
  /** ISO date of issue; null for a draft. */
  issuedOn: string | null;
  sections: Section[];
}

/**
 * The language a text is printed in, in a document in `lang`: its own when it has it, else the other (V403 — the
 * English copy prints a line with no English in Arabic; a draft's line not yet in Arabic prints its English rather
 * than a blank). The caller sets that text's direction from it.
 */
export function printedIn(value: Bi, lang: Lang): Lang {
  const has = (l: Lang) => Boolean((l === 'ar' ? value.ar : value.en)?.trim());
  const other: Lang = lang === 'ar' ? 'en' : 'ar';
  return has(lang) || !has(other) ? lang : other;
}

/** The text a document in `lang` prints for `value` (see `printedIn`). */
export function pick(value: Bi, lang: Lang): string {
  return (printedIn(value, lang) === 'ar' ? value.ar : value.en) ?? '';
}
