// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PastWorkGrid, type PastWorkGridProps } from '@/ui/grid/PastWorkGrid';
import { readPastedTable } from '@/ui/grid/paste';
import {
  guessMapping,
  FIELDS,
  readRows,
  toRequest,
  type BackfillRequest,
  type OrgMatch,
  type PersonMatch,
} from '@/ui/grid/rows';
import { toast } from '@/ui/Toast';
import { excelPaste, LABELS, ORGS, PEOPLE, STATUSES, TODAY, twentyTasks } from './grid-tools';

/**
 * The old app's missed Past work rows (the Architect's round 13, SCENARIOS-OLD.csv):
 * - **OLD-059** — where the screen may backfill for others, the grid offers a Person column and asks the database for
 *   every pasted name at once; it keeps exactly one match and holds every other answer (none, more than one, an empty
 *   cell) for a person to settle — never a guess. The rule itself (real names beat nicknames and e-mail prefixes) is the
 *   database's, where name folding lives (A10).
 * - **OLD-PRF-045** — the same row twice in a paste is named and left out; a row the database already holds (by its
 *   key: whose, title, day, status or category, organisation) is named "saved before" and left out, so pasting the same
 *   rows again adds nothing; every row sent carries its key, so the database can keep one.
 * - A lookup's answer that arrives after the grid redrew is kept (a row stayed "checking" for good before).
 * Sabotages: `grid-takes-one-of-many-people`, `grid-reads-people-it-was-not-offered`, `grid-forgets-saved-rows`,
 * `grid-key-ignores-case`, `grid-drops-a-late-answer`, `grid-asks-again-while-waiting` (tests/sabotage/grid.mjs).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ONE = '00000000-0000-4000-8000-0000000000c1';
const TWO = '00000000-0000-4000-8000-0000000000c2';

/** Six made-up rows naming people the database answers in every way. */
const PASTE = [
  ['Title', 'Date', 'Status', 'Partner', 'Notes', 'Owner'],
  ['Sent the made-up proposal', '01/09/2026', 'Done', 'Test Co A', '', 'Test Person One'],
  ['Called the made-up lead', '02/09/2026', 'Done', 'Test Co B', '', 'tp.two'],
  ['Visited the made-up office', '03/09/2026', 'Done', 'Test Co A', '', 'Tester'],
  ['Wrote the made-up summary', '04/09/2026', 'Done', 'Test Co B', '', 'Test Persn One'],
  ['Booked the made-up venue', '05/09/2026', 'Done', 'Test Co A', '', ''],
  ['Checked the made-up list', '06/09/2026', 'Done', 'Test Co B', '', 'Someone Not Asked'],
];

const lookup = <V,>(known: ReadonlyMap<string, V>, missing: V) =>
  vi.fn(async (names: string[]) => new Map<string, V>(names.map((n) => [n, known.get(n) ?? missing])));

describe('OLD-059 — a pasted name is matched by the database, never guessed', () => {
  const table = readPastedTable(excelPaste(PASTE));
  const people = new Map([...PEOPLE].filter(([n]) => n !== 'Someone Not Asked'));

  it('OLD-059: maps the Owner column to Person only where the screen offers it', () => {
    expect(guessMapping(table, FIELDS).columns.person, 'offered').toBe(5);
    expect(guessMapping(table).columns.person ?? null, 'not offered').toBeNull();
  });

  it('OLD-059: keeps exactly one match, and holds none, more than one, an empty cell and a name not yet answered', () => {
    const rows = readRows(table, {
      mode: 'tasks',
      mapping: guessMapping(table, FIELDS),
      today: TODAY,
      choices: STATUSES,
      organisations: ORGS,
      people,
    });
    expect(rows.map((r) => [r.person?.name ?? '', r.person?.id ?? null, r.problems])).toEqual([
      ['Test Person One', ONE, []],
      ['tp.two', TWO, []],
      ['Tester', null, ['person_ambiguous']],
      ['Test Persn One', null, ['person_unknown']],
      ['', null, ['person_missing']],
      ['Someone Not Asked', null, ['person_checking']],
    ]);
    const request = toRequest(rows, 'tasks');
    expect(
      request.rows.map((r) => r.person_id),
      'only the rows with one match are sent, with that person',
    ).toEqual([ONE, TWO]);
  });

  it('OLD-059: reads no person where the screen does not offer the column — every row is the signed-in person’s', () => {
    const mapping = guessMapping(table, FIELDS);
    const rows = readRows(table, { mode: 'tasks', mapping, today: TODAY, choices: STATUSES, organisations: ORGS });
    expect(rows.every((r) => r.person === null && r.problems.length === 0)).toBe(true);
    expect(toRequest(rows, 'tasks').rows.map((r) => r.person_id)).toEqual(Array(6).fill(null));
  });
});

describe('OLD-PRF-045 — a row pasted twice is added once', () => {
  const read = (rows: string[][], saved?: ReadonlyMap<string, boolean>) => {
    const table = readPastedTable(excelPaste(rows));
    return readRows(table, {
      mode: 'tasks',
      mapping: guessMapping(table),
      today: TODAY,
      choices: STATUSES,
      defaultKind: 'done',
      organisations: ORGS,
      saved,
    });
  };

  it('OLD-PRF-045: names the same row twice in one paste, whatever its case and spacing, and sends it once', () => {
    const [head, a, b] = twentyTasks();
    const again = [a![0]!.toUpperCase().replace(/ /g, '  '), a![1]!, a![2]!, a![3]!, 'another note'];
    const rows = read([head!, a!, b!, again]);
    expect(rows.map((r) => r.problems)).toEqual([[], [], ['repeated']]);
    expect(toRequest(rows, 'tasks').rows).toHaveLength(2);
  });

  it('OLD-PRF-045: keeps a row with another status or another day', () => {
    const [head, a] = twentyTasks();
    const rows = read([
      head!,
      a!,
      [a![0]!, a![1]!, 'Cancelled', a![3]!, ''],
      [a![0]!, '21/09/2026', a![2]!, a![3]!, ''],
    ]);
    expect(rows.map((r) => r.problems)).toEqual([[], [], []]);
  });

  it('OLD-PRF-045: names a row the database already holds, and waits for its answer before sending anything', () => {
    const first = read(twentyTasks());
    const held = new Map(first.map((r, i) => [r.key, i < 5]));
    const waiting = read(twentyTasks(), new Map());
    expect(waiting.every((r) => r.problems.join() === 'saved_checking')).toBe(true);
    expect(toRequest(waiting, 'tasks').rows, 'nothing is sent before the answer').toEqual([]);
    const second = read(twentyTasks(), held);
    expect(second.filter((r) => r.problems.includes('already_saved'))).toHaveLength(5);
    expect(toRequest(second, 'tasks').rows.map((r) => r.import_key)).toEqual(first.slice(5).map((r) => r.key));
  });
});

describe('the grid on a screen', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    vi.spyOn(toast, 'done').mockImplementation(() => 0);
    vi.spyOn(toast, 'failed').mockImplementation(() => 0);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });
  const settle = async () => {
    for (let i = 0; i < 10; i++) await act(async () => new Promise((r) => setTimeout(r, 0)));
  };
  const paste = (text: string) => {
    const area = host.querySelector<HTMLTextAreaElement>('[data-past-work-paste]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(area, text);
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const lines = () => [...host.querySelectorAll<HTMLTableRowElement>('[data-past-work-preview] tbody tr')];
  const saveButton = () => host.querySelector<HTMLButtonElement>('[data-past-work-save]')!;
  const draw = (props: Partial<PastWorkGridProps>) => {
    const save = vi.fn<(r: BackfillRequest) => Promise<{ requestId: string }>>(async () => ({ requestId: 'req-t-1' }));
    const all: PastWorkGridProps = {
      mode: 'tasks',
      choices: STATUSES,
      defaultKind: 'done',
      lang: 'en',
      labels: LABELS,
      today: TODAY,
      resolveOrganisations: lookup<OrgMatch>(ORGS, { kind: 'none' }),
      save,
      ...props,
    };
    act(() => root.render(<PastWorkGrid {...all} />));
    return { save, all };
  };

  it('OLD-059: offers the Person column, asks for every name once, and sends only the matched people', async () => {
    const resolvePeople = lookup<PersonMatch>(PEOPLE, { kind: 'none' });
    const { save } = draw({ resolvePeople });
    paste(excelPaste(PASTE));
    await settle();
    expect(host.querySelector('[aria-label="Person"]'), 'the Person column is offered').not.toBeNull();
    expect(resolvePeople).toHaveBeenCalledTimes(1);
    expect(resolvePeople.mock.calls[0]![0].sort()).toEqual(
      ['Someone Not Asked', 'Test Person One', 'Test Persn One', 'Tester', 'tp.two'].sort(),
    );
    expect(lines().map((tr) => tr.dataset.ready)).toEqual(['true', 'true', 'false', 'false', 'false', 'false']);
    act(() => saveButton().click());
    await settle();
    expect(save.mock.calls[0]![0].rows.map((r) => r.person_id)).toEqual([ONE, TWO]);
  });

  it('OLD-059: offers no Person column where the screen does not', async () => {
    draw({});
    paste(excelPaste(PASTE));
    await settle();
    expect(host.querySelector('[aria-label="Person"]')).toBeNull();
  });

  it('OLD-PRF-045: pasting the same 20 rows a second time adds nothing', async () => {
    const database = new Set<string>();
    const savedKeys = vi.fn(async (keys: string[]) => new Set(keys.filter((k) => database.has(k))));
    draw({
      savedKeys,
      save: async (r) => {
        for (const row of r.rows) database.add(row.import_key);
        return { requestId: 'req-t-1' };
      },
    });
    paste(excelPaste(twentyTasks()));
    await settle();
    expect(saveButton().textContent).toBe('Save 20 rows');
    act(() => saveButton().click());
    await settle();
    expect(database.size).toBe(20);

    paste(excelPaste(twentyTasks()));
    await settle();
    expect(savedKeys, 'the grid knows what it saved').toHaveBeenCalledTimes(1);
    expect(
      lines().every((tr) => tr.querySelector('[data-problems]')?.getAttribute('data-problems') === 'already_saved'),
    ).toBe(true);
    expect(host.querySelector('[data-past-work-summary]')!.textContent).toBe('0 rows ready · 20 refused');
    expect(saveButton().disabled).toBe(true);
  });

  it('keeps a lookup’s answer that arrives after the paste changed, and asks only once', async () => {
    let answer!: (m: ReadonlyMap<string, OrgMatch>) => void;
    const resolveOrganisations = vi.fn(() => new Promise<ReadonlyMap<string, OrgMatch>>((r) => (answer = r)));
    const { all } = draw({ resolveOrganisations });
    paste(excelPaste(twentyTasks()));
    await settle();
    expect(lines().every((tr) => tr.dataset.ready === 'false')).toBe(true);
    // While the lookup waits, the screen redraws and the person adds a row naming the same organisations.
    act(() => root.render(<PastWorkGrid {...all} labels={{ ...LABELS }} />));
    const more = [...twentyTasks(), ['Sent the made-up follow-up', '21/09/2026', 'Done', 'Test Co A', '']];
    paste(excelPaste(more));
    await settle();
    await act(async () => answer(ORGS));
    await settle();
    expect(resolveOrganisations, 'asked once').toHaveBeenCalledTimes(1);
    expect(
      lines().map((tr) => tr.dataset.ready),
      'the answer is kept',
    ).toEqual(Array(21).fill('true'));
  });
});
