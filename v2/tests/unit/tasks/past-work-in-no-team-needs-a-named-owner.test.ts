/**
 * V605: someone in no team (the admin account, V444) has no default owner for past work — an Unknown owner or their
 * own default cannot be placed (V464). Every row needs a named owner: one picked Owner covers the rows that name none,
 * a pasted name that matches no one or more than one is refused (never a guess), and the database's "needs a team"
 * reads "Pick an owner". Made-up rows and people (rule 7).
 * Sabotages: tests/sabotage/tasks.mjs "past-work-no-team-sends-unowned-rows", "past-work-no-team-ignores-the-picked-owner",
 * "past-work-says-could-not-save".
 */
import { describe, expect, it } from 'vitest';
import { DbError } from '@/core/db/errors';
import { pastWorkRefusalKey } from '@/modules/tasks/pastWork';
import { readPastedTable } from '@/ui/grid/paste';
import { FIELDS, guessMapping, readRows, toRequest } from '@/ui/grid/rows';
import { excelPaste, ORGS, PEOPLE, SOURCE, STATUSES, TODAY } from '../grid/grid-tools';

const PICKED = { id: '00000000-0000-4000-8000-0000000000d1', name: 'Test Picked Owner' };
const ONE = '00000000-0000-4000-8000-0000000000c1';

const read = (rows: string[][], o: { fallbackOwner?: typeof PICKED | null; ownerNeeded?: boolean }) => {
  const table = readPastedTable(excelPaste(rows));
  return readRows(table, {
    mode: 'tasks',
    mapping: guessMapping(table, FIELDS),
    today: TODAY,
    choices: STATUSES,
    organisations: ORGS,
    people: PEOPLE,
    ...o,
  });
};

const NO_OWNER_COLUMN = [
  ['Title', 'Date', 'Status', 'Partner'],
  ['Sent the made-up proposal', '01/09/2026', 'Done', 'Test Co A'],
  ['Called the made-up lead', '02/09/2026', 'Done', 'Test Co B'],
];
const OWNER_COLUMN = [
  ['Title', 'Date', 'Status', 'Partner', 'Owner'],
  ['Sent the made-up proposal', '01/09/2026', 'Done', 'Test Co A', 'Test Person One'],
  ['Booked the made-up venue', '05/09/2026', 'Done', 'Test Co A', ''],
  ['Visited the made-up office', '03/09/2026', 'Done', 'Test Co A', 'Tester'],
];

describe('past work for someone in no team needs a named owner (V605)', () => {
  it('with no Owner column and no owner picked, no row is sent', () => {
    const rows = read(NO_OWNER_COLUMN, { ownerNeeded: true });
    expect(rows.map((r) => r.problems)).toEqual([['owner_needed'], ['owner_needed']]);
    expect(toRequest(rows, 'tasks', SOURCE).rows).toEqual([]);
  });

  it('one picked owner covers every row that names none', () => {
    const rows = read(NO_OWNER_COLUMN, { ownerNeeded: true, fallbackOwner: PICKED });
    expect(toRequest(rows, 'tasks', SOURCE).rows.map((r) => [r.person_id, r.owner_unknown])).toEqual([
      [PICKED.id, false],
      [PICKED.id, false],
    ]);
  });

  it('a named owner stays; an empty cell takes the picked owner; a name matching more than one is refused', () => {
    const rows = read(OWNER_COLUMN, { ownerNeeded: true, fallbackOwner: PICKED });
    expect(rows.map((r) => [r.person?.id ?? null, r.problems])).toEqual([
      [ONE, []],
      [PICKED.id, []],
      [null, ['owner_needed']],
    ]);
  });

  it('someone in a team is unchanged: an empty cell is saved as Unknown (V491)', () => {
    const rows = read(OWNER_COLUMN, {});
    expect(rows.map((r) => r.problems)).toEqual([[], [], []]);
    expect(toRequest(rows, 'tasks', SOURCE).rows.map((r) => r.owner_unknown)).toEqual([false, true, true]);
  });

  it('the database\'s "needs a team" reads "Pick an owner"; any other refusal keeps the grid\'s words', () => {
    expect(pastWorkRefusalKey(new DbError('RuleBroken', 'task.team_required'))).toBe('pages.tasks.add.owner_required');
    expect(pastWorkRefusalKey(new DbError('RuleBroken', 'task.title_required'))).toBeNull();
    expect(pastWorkRefusalKey(new Error('offline'))).toBeNull();
  });
});
