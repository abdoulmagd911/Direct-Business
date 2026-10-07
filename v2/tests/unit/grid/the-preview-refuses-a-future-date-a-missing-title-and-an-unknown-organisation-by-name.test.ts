import { describe, expect, it } from 'vitest';
import { readDay } from '@/ui/grid/dates';
import { readPastedTable } from '@/ui/grid/paste';
import { guessMapping, organisationNames, readRows, toRequest, type Mapping } from '@/ui/grid/rows';
import { CATEGORIES, excelPaste, ORGS, SOURCE, STATUSES, TODAY } from './grid-tools';

/**
 * The preview names every row that will be refused, with every reason (plan P5-2c, V400): a date after today, a
 * missing title, an organisation not known or not one, a status or category not in the list, a date that could be
 * two days, the same row twice. Refused rows are left out of the request; nothing is guessed for them.
 * Sabotages: `grid-lets-a-future-date-in`, `grid-takes-an-unknown-organisation`, `grid-sends-a-refused-row`,
 * `grid-guesses-an-ambiguous-date`, `grid-reads-dates-month-first` (tests/sabotage/grid.mjs).
 */
const paste = [
  ['Title', 'Date', 'Status', 'Partner'],
  ['Made-up visit', '29/09/2026', 'Done', 'Test Co A'], // today: fine
  ['Made-up call', '30/09/2026', 'Done', 'Test Co A'], // tomorrow
  ['', '01/09/2026', 'Done', ''], // no title
  ['Made-up offer', '02/09/2026', 'Done', 'Nobody Known'],
  ['Made-up meeting', '03/09/2026', 'Done', 'Sample Travel'],
  ['Made-up review', '04/09/2026', 'Parked', ''],
  ['Made-up visit', '29/09/2026', 'Done', 'Test Co A'], // the first row again
  ['Made-up plan', 'next week', '', ''],
];
const table = readPastedTable(excelPaste(paste));
const mapping = guessMapping(table);
const rows = readRows(table, {
  mode: 'tasks',
  mapping,
  today: TODAY,
  choices: STATUSES,
  defaultKind: 'done',
  organisations: ORGS,
});

describe('the preview', () => {
  it('names each refused row with its reasons', () => {
    expect(rows.map((r) => [r.line, r.problems])).toEqual([
      [2, []],
      [3, ['date_in_future']],
      [4, ['title_missing']],
      [5, ['organisation_unknown']],
      [6, ['organisation_ambiguous']],
      [7, ['kind_unknown']],
      [8, ['repeated']],
      [9, ['date_unreadable']],
    ]);
  });

  it('sends only the ready rows', () => {
    const request = toRequest(rows, 'tasks', SOURCE);
    expect(request.rows.map((r) => r.title)).toEqual(['Made-up visit']);
  });

  it('asks for every organisation once, and holds a row back until its organisation is known', () => {
    expect(organisationNames(table, mapping)).toEqual(['Test Co A', 'Nobody Known', 'Sample Travel']);
    const early = readRows(table, {
      mode: 'tasks',
      mapping,
      today: TODAY,
      choices: STATUSES,
      defaultKind: 'done',
      organisations: new Map(),
    });
    expect(early[0]!.problems).toEqual(['organisation_checking']);
    expect(toRequest(early, 'tasks', SOURCE).rows).toEqual([]);
  });

  it('refuses an achievement without a category, and reads a category in either language', () => {
    const t = readPastedTable(
      excelPaste([
        ['A made-up signing', '2026-09-10', 'العقود والاتفاقيات'],
        ['A made-up saving', '2026-09-11', ''],
      ]),
    );
    const m: Mapping = {
      hasHeader: false,
      dateOrder: 'dmy',
      columns: { title: 0, happened_on: 1, kind: 2, organisation: null, notes: null },
    };
    const r = readRows(t, { mode: 'achievements', mapping: m, today: TODAY, choices: CATEGORIES, organisations: ORGS });
    expect(r.map((x) => [x.kind, x.problems])).toEqual([
      ['contract', []],
      [null, ['kind_missing']],
    ]);
  });
});

describe('a pasted date', () => {
  it('reads in the order the person chose, and refuses one that could be two days', () => {
    expect(readDay('03/04/2026', 'dmy')).toEqual({ day: '2026-04-03' });
    expect(readDay('03/04/2026', 'mdy')).toEqual({ day: '2026-03-04' });
    expect(readDay('03/04/2026', null)).toEqual({ problem: 'date_ambiguous' });
    expect(readDay('29/09/2026', null)).toEqual({ day: '2026-09-29' });
    expect(readDay('09/29/2026', null)).toEqual({ day: '2026-09-29' });
    expect(readDay('05/05/2026', null)).toEqual({ day: '2026-05-05' });
  });

  it('reads ISO dates, month names, Excel serial days and Arabic digits', () => {
    expect(readDay('2026-09-29', 'dmy')).toEqual({ day: '2026-09-29' });
    expect(readDay('2026-09-29 14:05', 'dmy')).toEqual({ day: '2026-09-29' });
    expect(readDay('29 Sep 2026', 'dmy')).toEqual({ day: '2026-09-29' });
    expect(readDay('Sep 29, 2026', 'dmy')).toEqual({ day: '2026-09-29' });
    expect(readDay('45658', 'dmy')).toEqual({ day: '2025-01-01' });
    expect(readDay('٢٩/٠٩/٢٠٢٦', 'dmy')).toEqual({ day: '2026-09-29' });
  });

  it('refuses what is not a day', () => {
    for (const bad of ['31/02/2026', '29/09/26', '2026-13-01', 'soon', '12'])
      expect(readDay(bad, 'dmy'), bad).toEqual({ problem: 'date_unreadable' });
    expect(readDay('  ', 'dmy')).toEqual({ problem: 'date_missing' });
  });
});
