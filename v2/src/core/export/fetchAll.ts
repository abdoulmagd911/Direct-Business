import { toDbError, type PostgrestLikeError } from '@/core/db/errors';

/**
 * Reads a whole list, page by page (A7). The API answers at most 1,000 rows a request and says nothing when it cuts a
 * list short — the old app's totals were silently truncated that way. So:
 *
 * - the next page starts where the rows **received** end, never where the rows asked for would end: a server that caps
 *   pages lower than we ask (300, 500) is still read to the last row;
 * - reading stops at an **empty** page, or at the list's count when the first page reports one (`count: 'exact'`) —
 *   never at a merely short page;
 * - when the count is known and the rows read differ from it (the list changed while it was read), the export is
 *   refused by name rather than handed over with rows missing or twice;
 * - when `key` is given, a row read twice (an order that is not stable across pages) is refused the same way.
 *
 * `page(from, to)` is the list's own query with its chips applied, ending in `.range(from, to)` — this module never
 * makes a database client of its own (one client, A4). It resolves like supabase-js: `{ data, error, count }`.
 */
export type PageResult<T> = {
  data: T[] | null;
  error: PostgrestLikeError | null;
  count?: number | null;
};

export type PageFetcher<T> = (from: number, to: number) => PromiseLike<PageResult<T>>;

export interface FetchAllOptions<T> {
  /** Rows asked for per request (the API's cap is 1,000). */
  pageSize?: number;
  /** The most rows an export may hold; more is refused, never cut. Excel's sheet holds 1,048,575 below its header. */
  limit?: number;
  /** A row's identity, to refuse a row read twice. */
  key?: (row: T) => string;
  signal?: AbortSignal;
  onProgress?: (read: number, total: number | null) => void;
}

export const PAGE_SIZE = 1000;
export const EXPORT_LIMIT = 1_048_575;

/** The export was refused rather than handed over wrong. `reason` names the case; the message says it in words. */
export class ExportRefused extends Error {
  constructor(
    readonly reason: 'changed' | 'repeated' | 'too_many' | 'no_progress',
    message: string,
  ) {
    super(message);
    this.name = 'ExportRefused';
  }
}

export async function fetchAll<T>(page: PageFetcher<T>, opts: FetchAllOptions<T> = {}): Promise<T[]> {
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const limit = opts.limit ?? EXPORT_LIMIT;
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError(`fetchAll: page size ${pageSize}`);
  const rows: T[] = [];
  const seen = opts.key ? new Set<string>() : null;
  let total: number | null = null;

  for (;;) {
    opts.signal?.throwIfAborted();
    if (total !== null && rows.length >= total) break;
    const from = rows.length;
    const res = await page(from, from + pageSize - 1);
    opts.signal?.throwIfAborted();
    if (res.error) throw toDbError(res.error);
    if (from === 0 && typeof res.count === 'number') total = res.count;
    const got = res.data ?? [];
    if (got.length === 0) break;
    if (got.length > pageSize)
      throw new ExportRefused('no_progress', `fetchAll: a page answered ${got.length} rows for ${pageSize} asked`);
    for (const row of got) {
      if (seen) {
        const k = opts.key!(row);
        if (seen.has(k))
          throw new ExportRefused(
            'repeated',
            `The row ${k} was read twice: the list's order is not stable across pages. Nothing was exported.`,
          );
        seen.add(k);
      }
      rows.push(row);
    }
    if (rows.length > limit)
      throw new ExportRefused(
        'too_many',
        `The list holds more than ${limit.toLocaleString('en')} rows — more than one sheet can hold. Narrow it with the chips first.`,
      );
    opts.onProgress?.(rows.length, total);
  }

  if (total !== null && rows.length !== total)
    throw new ExportRefused(
      'changed',
      `The list changed while it was exported (${total.toLocaleString('en')} rows counted, ${rows.length.toLocaleString('en')} read). Export again.`,
    );
  return rows;
}
