import { describe, expect, it } from 'vitest';
import { readPastedTable } from '@/ui/grid/paste';
import { guessMapping, readRows, toRequest } from '@/ui/grid/rows';
import { excelPaste, ORGS, STATUSES, TODAY, twentyTasks } from './grid-tools';

/**
 * The plan's P5-2c test: a pasted block of 20 made-up rows maps to 20 rows and one request — origin `backfill`
 * (Backfilled, no notices, never "logged late" — V400), each row with its real date, its status, its organisation.
 * Sabotages: `grid-forgets-the-origin`, `grid-reads-the-header-as-a-row` (tests/sabotage/grid.mjs); one request per paste
 * in the component: `grid-sends-a-request-per-row`.
 */
describe('a pasted block of 20 rows', () => {
  const table = readPastedTable(excelPaste(twentyTasks()));
  const mapping = guessMapping(table);
  const rows = readRows(table, {
    mode: 'tasks',
    mapping,
    today: TODAY,
    choices: STATUSES,
    defaultKind: 'done',
    organisations: ORGS,
  });

  it('maps its header to the fields', () => {
    expect(mapping).toEqual({
      hasHeader: true,
      dateOrder: 'dmy',
      columns: { title: 0, happened_on: 1, kind: 2, organisation: 3, notes: 4 },
    });
  });

  it('reads 20 rows, every one ready, with its real date', () => {
    expect(rows).toHaveLength(20);
    expect(rows.filter((r) => r.problems.length)).toEqual([]);
    expect(rows[0]).toMatchObject({ line: 2, happenedOn: '2026-09-01', kind: 'in_progress' });
    expect(rows[19]).toMatchObject({ line: 21, happenedOn: '2026-09-20', kind: 'done' });
    expect(rows[4]!.notes).toBe('Called twice;\nsent the "final" terms');
  });

  it('makes one request of 20 rows, marked backfill', () => {
    const request = toRequest(rows, 'tasks');
    expect(request.origin).toBe('backfill');
    expect(request.mode).toBe('tasks');
    expect(request.rows).toHaveLength(20);
    expect(request.rows[1]).toEqual({
      title: 'Follow up the made-up offer 2',
      happened_on: '2026-09-02',
      kind: 'done',
      organisation_id: '00000000-0000-4000-8000-00000000000a',
      notes: null,
    });
  });

  it('takes a paste without headers in the grid’s own column order', () => {
    const bare = readPastedTable(excelPaste(twentyTasks().slice(1)));
    const m = guessMapping(bare);
    expect(m.hasHeader).toBe(false);
    const r = readRows(bare, {
      mode: 'tasks',
      mapping: m,
      today: TODAY,
      choices: STATUSES,
      defaultKind: 'done',
      organisations: ORGS,
    });
    expect(toRequest(r, 'tasks').rows).toHaveLength(20);
  });
});
