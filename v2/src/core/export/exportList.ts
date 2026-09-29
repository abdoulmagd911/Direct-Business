import type { ExportColumn } from './columns';
import { toCsv } from './csv';
import { exportFileName } from './fileName';
import { fetchAll, type FetchAllOptions, type PageFetcher } from './fetchAll';
import { toXlsx } from './xlsx';

export type ExportFormat = 'csv' | 'xlsx';

export const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export interface ExportListInput<T> {
  /** The list's name as the person sees it — names the file and the sheet. */
  list: string;
  columns: readonly ExportColumn<T>[];
  /**
   * The list's own query with its chips applied, one range at a time — e.g.
   * `(from, to) => listQuery(chips).order('number').range(from, to)`, with `{ count: 'exact' }` in its `select` so a
   * list that changes while it is read is refused. The order must be total (end on a unique column).
   */
  page: PageFetcher<T>;
  format: ExportFormat;
  /** The person's language: an Arabic workbook reads right to left. */
  lang: 'ar' | 'en';
  /** A row's identity, to refuse a row read twice. */
  key?: FetchAllOptions<T>['key'];
  signal?: AbortSignal;
  onProgress?: FetchAllOptions<T>['onProgress'];
  /** The export time (tests pass one). */
  at?: Date;
  /**
   * The keys of the columns the person sees on the list, in their order (OA23). When given, the file holds exactly
   * these — a role never exports a column its screen hides from it — and each one is either exported or named in
   * `omit` with its reason; one with neither is refused (`ExportColumnMissing`), never dropped unseen.
   */
  visible?: readonly string[];
  /** A visible column that cannot be a cell (a row's buttons), with the reason the person is told, in their words. */
  omit?: Readonly<Record<string, string>>;
  /**
   * May this session see Finance (`me.levels.finance` above none)? Asked of every export (OLD-037): without it no
   * money column is written, whatever the screen shows — each one is named in `omitted` with `financeOnly`.
   */
  seesFinance: boolean;
  /** The person's words for a money column left out: "Finance only". */
  financeOnly: string;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  /** The rows written below the header — the list's count. */
  rows: number;
  /** The visible columns left out of the file, each with its reason (OA23). */
  omitted: { key: string; reason: string }[];
}

/** A visible column with no export column and no reason to leave it out — a screen that would drop it unseen (OA23). */
export class ExportColumnMissing extends Error {
  constructor(readonly key: string) {
    super(`export: the visible column "${key}" has no export column and no reason it is left out (OA23)`);
    this.name = 'ExportColumnMissing';
  }
}

/** The file's columns: the visible ones, in their order, when the screen names them; every column otherwise. */
export function fileColumns<T>(
  columns: readonly ExportColumn<T>[],
  visible?: readonly string[],
  omit?: Readonly<Record<string, string>>,
): { columns: ExportColumn<T>[]; omitted: ExportResult['omitted'] } {
  if (!visible) return { columns: [...columns], omitted: [] };
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const out: ExportColumn<T>[] = [];
  const omitted: ExportResult['omitted'] = [];
  for (const key of visible) {
    const column = byKey.get(key);
    if (column) out.push(column);
    else if (omit && Object.hasOwn(omit, key)) omitted.push({ key, reason: omit[key]! });
    else throw new ExportColumnMissing(key);
  }
  return { columns: out, omitted };
}

/**
 * What the file will hold, before anything is read: the visible columns (OA23), less every money column when the
 * session may not see Finance (OLD-037) — each left-out column named with its reason. Throws `ExportColumnMissing`.
 */
export function plannedColumns<T>(
  input: Pick<ExportListInput<T>, 'columns' | 'visible' | 'omit' | 'seesFinance' | 'financeOnly'>,
): { columns: ExportColumn<T>[]; omitted: ExportResult['omitted'] } {
  const planned = fileColumns(input.columns, input.visible, input.omit);
  if (input.seesFinance) return planned;
  const money = planned.columns.filter((c) => c.kind === 'money');
  return {
    columns: planned.columns.filter((c) => c.kind !== 'money'),
    omitted: [...planned.omitted, ...money.map((c) => ({ key: c.key, reason: input.financeOnly }))],
  };
}

/** Reads the whole list and writes it as one file (spec §3.11 Export). Nothing is downloaded here — see `saveFile`. */
export async function exportList<T>(input: ExportListInput<T>): Promise<ExportResult> {
  const at = input.at ?? new Date();
  // Before any read: a visible column with no place in the file is refused at once (OA23); money needs Finance.
  const { columns, omitted } = plannedColumns(input);
  const rows = await fetchAll(input.page, { key: input.key, signal: input.signal, onProgress: input.onProgress });
  input.signal?.throwIfAborted();
  const body =
    input.format === 'csv'
      ? toCsv(rows, columns)
      : await toXlsx(rows, columns, { sheet: input.list, rtl: input.lang === 'ar', at });
  const blob = new Blob([body as BlobPart], { type: MIME[input.format] });
  return { blob, fileName: exportFileName(input.list, at, input.format), rows: rows.length, omitted };
}

/** Hands a file to the browser's download. */
export function saveFile(blob: Blob, fileName: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = doc.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    doc.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoked well after the click: revoking at once cancels the download in some browsers (FileSaver.js waits 40 s).
    setTimeout(() => URL.revokeObjectURL(url), 40_000);
  }
}
