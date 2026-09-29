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
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  /** The rows written below the header — the list's count. */
  rows: number;
}

/** Reads the whole list and writes it as one file (spec §3.11 Export). Nothing is downloaded here — see `saveFile`. */
export async function exportList<T>(input: ExportListInput<T>): Promise<ExportResult> {
  const at = input.at ?? new Date();
  const rows = await fetchAll(input.page, { key: input.key, signal: input.signal, onProgress: input.onProgress });
  input.signal?.throwIfAborted();
  const body =
    input.format === 'csv'
      ? toCsv(rows, input.columns)
      : await toXlsx(rows, input.columns, { sheet: input.list, rtl: input.lang === 'ar', at });
  const blob = new Blob([body as BlobPart], { type: MIME[input.format] });
  return { blob, fileName: exportFileName(input.list, at, input.format), rows: rows.length };
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
