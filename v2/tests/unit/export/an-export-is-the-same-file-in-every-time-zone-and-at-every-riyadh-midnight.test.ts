// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cellOf, exportFileName, exportList, ExportColumnError, type ExportColumn } from '@/core/export';
import { sampleColumns, sampleRows, standIn } from './list-tools';
import { blobBytes } from './xlsx-reader';

/**
 * PRF-139 (the scenario catalogue, oversight 29 Sep 16:03): the same export gives the same file whatever the
 * computer's time zone — the tests run in UTC, a person's browser in Riyadh — and at every Riyadh midnight: a day,
 * a month, a quarter and a year that start in Riyadh while UTC is still on the day before (D20). A moment written
 * without its offset would be read in the computer's own zone, so it is refused by name, never guessed.
 * Sabotages: `moment-without-offset-read-as-local`, `file-name-in-the-computers-zone` (tests/sabotage/export-lists.mjs).
 */
const ZONES = ['UTC', 'Asia/Riyadh', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'] as const;
const original = process.env.TZ;

afterEach(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
  vi.useRealTimers();
});

/** `run` once in each zone; every answer, in zone order. */
async function inEveryZone<T>(run: () => T | Promise<T>): Promise<T[]> {
  const out: T[] = [];
  for (const tz of ZONES) {
    process.env.TZ = tz;
    out.push(await run());
  }
  return out;
}

/** A Riyadh edge: the instant, and the wall clock Riyadh reads then. */
const EDGES = [
  ['2026-09-29T20:59:59Z', { y: 2026, m: 9, d: 29, h: 23, mi: 59, s: 59 }],
  ['2026-09-29T21:00:00Z', { y: 2026, m: 9, d: 30, h: 0, mi: 0, s: 0 }],
  ['2026-09-30T21:30:00.000Z', { y: 2026, m: 10, d: 1, h: 0, mi: 30, s: 0 }], // a month and a quarter
  ['2026-12-31T21:00:00+00:00', { y: 2027, m: 1, d: 1, h: 0, mi: 0, s: 0 }], // a year
  ['2027-01-01T00:30:00+03:00', { y: 2027, m: 1, d: 1, h: 0, mi: 30, s: 0 }],
  ['2028-02-28T22:15:00-05:00', { y: 2028, m: 2, d: 29, h: 6, mi: 15, s: 0 }], // a leap day
] as const;

describe('a date or a moment in the file', () => {
  const at: Pick<ExportColumn<unknown>, 'key' | 'kind'> = { key: 'updated', kind: 'datetime' };
  const on: Pick<ExportColumn<unknown>, 'key' | 'kind'> = { key: 'due', kind: 'date' };

  it.each(EDGES)('%s reads as the same Riyadh clock in every zone', async (instant, clock) => {
    const seen = await inEveryZone(() => [cellOf(at, instant), cellOf(on, instant)]);
    for (const [moment, day] of seen) {
      expect(moment).toEqual({ t: 'datetime', ...clock });
      expect(day).toEqual({ t: 'date', y: clock.y, m: clock.m, d: clock.d });
    }
  });

  it('keeps a calendar day as it is in every zone', async () => {
    for (const day of ['2026-12-31', '2027-01-01', '2028-02-29']) {
      const [y, m, d] = day.split('-').map(Number);
      for (const cell of await inEveryZone(() => cellOf(on, day))) expect(cell).toEqual({ t: 'date', y, m, d });
    }
  });

  it('refuses a moment written without its offset, in every zone', async () => {
    for (const raw of ['2026-09-29T21:30:00', '2026-09-29T21:30', '2026-09-29T21:30:00.000'])
      for (const kind of ['datetime', 'date'] as const) {
        const tried = await inEveryZone(() => {
          try {
            return cellOf({ key: 'updated', kind }, raw);
          } catch (e) {
            return e;
          }
        });
        for (const t of tried) {
          expect(t, `${raw} as ${kind} is refused, not read in the computer's zone`).toBeInstanceOf(ExportColumnError);
        }
      }
  });
});

describe('the whole file', () => {
  const rows = sampleRows(60);
  const run = (format: 'csv' | 'xlsx', lang: 'en' | 'ar') => async () => {
    const out = await exportList({
      seesFinance: true,
      financeOnly: 'Finance only',
      list: 'Invoices',
      columns: sampleColumns,
      page: standIn(rows).page,
      format,
      lang,
    });
    return { name: out.fileName, bytes: Array.from(await blobBytes(out.blob)) };
  };

  it.each([
    ['csv', 'en'],
    ['xlsx', 'en'],
    ['csv', 'ar'],
    ['xlsx', 'ar'],
  ] as const)('is byte for byte the same %s (%s) in every zone, named with the Riyadh clock', async (format, lang) => {
    // 21:30 UTC on the last day of the year: already 00:30 on 1 January in Riyadh.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-31T21:30:00Z'));
    const files = await inEveryZone(run(format, lang));
    for (const f of files) {
      expect(f.name, 'named with the Riyadh clock in every zone').toBe(`Invoices_2027-01-01_00-30-00.${format}`);
      expect(f.bytes, 'the same bytes in every zone').toEqual(files[0]!.bytes);
    }
  });

  it('names a file with the Riyadh clock at every edge, in every zone', async () => {
    for (const [instant, c] of EDGES) {
      const want = `Clients_${c.y}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}_${[c.h, c.mi, c.s]
        .map((n) => String(n).padStart(2, '0'))
        .join('-')}.csv`;
      for (const name of await inEveryZone(() => exportFileName('Clients', new Date(instant), 'csv')))
        expect(name, 'named with the Riyadh clock in every zone').toBe(want);
    }
  });
});
