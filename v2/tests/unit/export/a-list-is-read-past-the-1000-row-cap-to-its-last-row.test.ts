import { describe, expect, it } from 'vitest';
import { DbError } from '@/core/db/errors';
import { ExportRefused, fetchAll, type PageFetcher } from '@/core/export';
import { sampleRows, standIn, type SampleRow } from './list-tools';

/**
 * A7: the API answers at most 1,000 rows a request and says nothing when it cuts a list short. `fetchAll` reads
 * every row, in order, once — also from a server capped lower than it asks — and refuses, by name, a list that
 * changed while it was read, a row read twice, a list too big for a sheet, and a failed page.
 * Sabotages: `fetchall-stops-at-a-short-page`, `fetchall-steps-by-the-page-asked`, `fetchall-ignores-the-count`,
 * `fetchall-keeps-a-repeated-row`, `fetchall-swallows-a-failed-page` (tests/sabotage/export-lists.mjs).
 */
const rows = sampleRows(2500);
const ids = (list: SampleRow[]) => list.map((r) => r.id);

describe('fetchAll', () => {
  it('reads 2,500 rows through a 1,000-row cap, in order, each once', async () => {
    const api = standIn(rows, { cap: 1000, count: true });
    const got = await fetchAll(api.page, { key: (r) => r.id });
    expect(got).toHaveLength(2500);
    expect(ids(got)).toEqual(ids(rows));
    expect(api.asked).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('reads to the last row when the server caps lower than asked and gives no count', async () => {
    const api = standIn(rows, { cap: 300 });
    const got = await fetchAll(api.page);
    expect(ids(got)).toEqual(ids(rows));
    // Each page starts where the rows received end; the read ends on an empty page.
    expect(api.asked[1]).toEqual([300, 1299]);
    expect(api.asked.at(-1)).toEqual([2500, 3499]);
  });

  it('applies the chips — the rows exported are the list the person sees', async () => {
    const api = standIn(rows, { count: true, where: (r) => r.status === 'late' });
    const got = await fetchAll(api.page);
    expect(got).toHaveLength(rows.filter((r) => r.status === 'late').length);
    expect(got.every((r) => r.status === 'late')).toBe(true);
  });

  it('reads an empty list as empty, in one request', async () => {
    const api = standIn<SampleRow>([], { count: true });
    expect(await fetchAll(api.page)).toEqual([]);
    expect(api.asked).toHaveLength(1);
  });

  it('refuses a list that lost rows while it was read', async () => {
    const shrinking = (): PageFetcher<SampleRow> => {
      let first = true;
      return async (from, to) => {
        const list = first ? rows : rows.slice(0, 2400);
        const count = first ? rows.length : list.length;
        first = false;
        return { data: list.slice(from, Math.min(to + 1, from + 1000)), error: null, count };
      };
    };
    await expect(fetchAll(shrinking())).rejects.toMatchObject({ name: 'ExportRefused', reason: 'changed' });
    await expect(fetchAll(shrinking())).rejects.toThrow('2,500 rows counted, 2,400 read');
  });

  it('refuses a row read twice (an order that is not stable across pages)', async () => {
    const shifted = [rows[999]!, ...rows];
    let calls = 0;
    const page: PageFetcher<SampleRow> = async (from, to) => {
      const list = calls++ === 0 ? rows : shifted;
      return { data: list.slice(from, Math.min(to + 1, from + 1000)), error: null, count: null };
    };
    const refused = await fetchAll(page, { key: (r) => r.id }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ExportRefused);
    expect((refused as ExportRefused).reason).toBe('repeated');
    expect((refused as Error).message).toContain('r01000');
  });

  it('refuses more rows than one sheet holds instead of cutting them', async () => {
    const api = standIn(rows, { cap: 1000 });
    await expect(fetchAll(api.page, { limit: 2000 })).rejects.toMatchObject({ reason: 'too_many' });
  });

  it('turns a failed page into the typed error, never a shorter list', async () => {
    let calls = 0;
    const page: PageFetcher<SampleRow> = async (from, to) =>
      calls++ === 1
        ? { data: null, error: { code: '42501', message: 'access.needs_level' } }
        : { data: rows.slice(from, to + 1), error: null };
    const e = await fetchAll(page).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(DbError);
    expect((e as DbError).kind).toBe('PermissionDenied');
  });

  it('stops when the export is cancelled', async () => {
    const ctrl = new AbortController();
    const api = standIn(rows, { cap: 1000 });
    const read = fetchAll(api.page, { signal: ctrl.signal, onProgress: () => ctrl.abort() });
    await expect(read).rejects.toThrow(/abort/i);
    expect(api.asked).toHaveLength(1);
  });

  it('reports its progress against the count', async () => {
    const seen: [number, number | null][] = [];
    await fetchAll(standIn(rows, { count: true }).page, { onProgress: (n, t) => seen.push([n, t]) });
    expect(seen).toEqual([
      [1000, 2500],
      [2000, 2500],
      [2500, 2500],
    ]);
  });
});
