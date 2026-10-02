import { afterEach, describe, expect, it } from 'vitest';
import { readDay } from '@/ui/grid/dates';
import { riyadhToday } from '@/ui/grid/PastWorkGrid';
import { readPastedTable } from '@/ui/grid/paste';
import { guessMapping, readRows } from '@/ui/grid/rows';
import { ORGS, STATUSES } from './grid-tools';

/**
 * PRF-139 (the scenario catalogue, oversight 29 Sep 16:03): the grid reads a pasted date, and tells today from the
 * future, the same way whatever the computer's time zone — the tests run in UTC, a person's browser in Riyadh — and
 * at Riyadh's midnight, when UTC is still on the day before (D20). In the Arabic locale a sheet shows its dates with
 * Arabic-Indic digits, unseen right-to-left marks and Arabic month names; each is read as the same day.
 * Sabotages: `grid-today-in-the-computers-zone`, `grid-keeps-direction-marks`, `grid-reads-no-arabic-month`
 * (tests/sabotage/grid.mjs).
 */
const ZONES = ['UTC', 'Asia/Riyadh', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'] as const;
const original = process.env.TZ;

afterEach(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});

function inEveryZone<T>(run: () => T): T[] {
  return ZONES.map((tz) => {
    process.env.TZ = tz;
    return run();
  });
}

/** An RLM, as an Arabic sheet writes it after a day and a month. */
const RLM = '\u{200F}';

describe("Riyadh's today", () => {
  it.each([
    ['2026-09-29T20:59:59Z', '2026-09-29'],
    ['2026-09-29T21:00:00Z', '2026-09-30'],
    ['2026-12-31T21:30:00Z', '2027-01-01'],
    ['2028-02-28T21:00:00Z', '2028-02-29'],
  ])('at %s is %s in every zone', (instant, day) => {
    for (const today of inEveryZone(() => riyadhToday(new Date(instant)))) expect(today, "Riyadh's day").toBe(day);
  });

  it('tells today from the future by Riyadh, not by UTC', () => {
    // 21:30 UTC on 29 September: already 00:30 on the 30th in Riyadh.
    const table = readPastedTable('Title\tDate\nMade-up visit\t30/09/2026\nMade-up call\t01/10/2026');
    const results = inEveryZone(() =>
      readRows(table, {
        mode: 'tasks',
        mapping: guessMapping(table),
        today: riyadhToday(new Date('2026-09-29T21:30:00Z')),
        choices: STATUSES,
        defaultKind: 'done',
        organisations: ORGS,
      }).map((r) => r.problems),
    );
    for (const problems of results) {
      expect(problems[0], "Riyadh's today is not the future").toEqual([]);
      expect(problems[1]).toEqual(['date_in_future']);
    }
  });
});

describe('a pasted date', () => {
  const cases: [string, string][] = [
    ['29/09/2026', '2026-09-29'],
    ['2026-09-29', '2026-09-29'],
    ['29 Sep 2026', '2026-09-29'],
    ['Sep 29, 2026', '2026-09-29'],
    ['46294', '2026-09-29'], // Excel's serial day
    ['31/12/2026', '2026-12-31'],
    ['29/02/2028', '2028-02-29'],
  ];

  it.each(cases)('%s is %s in every zone', (raw, day) => {
    for (const read of inEveryZone(() => readDay(raw, 'dmy'))) expect(read).toEqual({ day });
  });

  it.each([
    ['٢٩/٠٩/٢٠٢٦', 'Arabic-Indic digits'],
    [`٢٩${RLM}/٩${RLM}/٢٠٢٦`, 'right-to-left marks after the day and the month'],
    [`29${RLM}/09${RLM}/2026`, 'right-to-left marks with Latin digits'],
    ['\u{2067}29/09/2026\u{2069}', 'an isolate around the date'],
  ])('from an Arabic sheet: %j (%s) is the same day', (raw) => {
    for (const read of inEveryZone(() => readDay(raw, 'dmy')))
      expect(read, 'an Arabic sheet date is read').toEqual({ day: '2026-09-29' });
  });

  it("reads every Arabic month name as the browser's Arabic calendar writes it", () => {
    for (let month = 1; month <= 12; month++) {
      const at = new Date(Date.UTC(2026, month - 1, 7, 9));
      const long = new Intl.DateTimeFormat('ar', { dateStyle: 'long', calendar: 'gregory', timeZone: 'UTC' });
      const written = long.format(at); // "٧ سبتمبر ٢٠٢٦", with its marks if the locale adds them
      const day = `2026-${String(month).padStart(2, '0')}-07`;
      expect(readDay(written, null), `${written} is read as ${day}`).toEqual({ day });
      const name = new Intl.DateTimeFormat('ar', { month: 'long', calendar: 'gregory', timeZone: 'UTC' }).format(at);
      expect(readDay(`${name} 7، 2026`, null), 'month first, with the Arabic comma').toEqual({ day });
    }
  });

  it('refuses an Arabic word that is not a month', () => {
    expect(readDay('7 تجربة 2026', null)).toEqual({ problem: 'date_unreadable' });
  });
});
