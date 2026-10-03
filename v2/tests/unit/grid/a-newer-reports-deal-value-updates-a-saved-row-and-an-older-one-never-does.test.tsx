// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPastedTable } from '@/ui/grid/paste';
import { PastWorkGrid, type PastWorkGridProps } from '@/ui/grid/PastWorkGrid';
import {
  fieldsFor,
  guessMapping,
  readAmount,
  readRows,
  toRequest,
  updatesHeld,
  type BackfillRequest,
  type HeldKey,
  type OrgMatch,
} from '@/ui/grid/rows';
import { reportIsNewer, type SourceReport } from '@/ui/grid/source';
import { toast } from '@/ui/Toast';
import { CATEGORIES, excelPaste, LABELS, ORGS, TODAY, VALUE_KINDS } from './grid-tools';

/**
 * V502, as the Architect answered on #105 (1 Oct): an achievement's deal value comes from the report, and where reports
 * disagree the newest issued report's value stands — settled by the database, which the preview only foretells. Only
 * Contract signed and MoU carry a value; the Value (SAR) column is offered with achievements and never with tasks; a
 * row from a newer report (a later last day; the quarterly beating the monthly on the same day) says it updates the
 * saved row, and one from an older or the same report, or over a value a person typed, is left out as saved before.
 * Made-up rows and amounts (rule 7). Sabotages: `grid-takes-a-value-for-a-category-without-one`,
 * `grid-lets-an-older-report-replace-a-saved-value`, `grid-lets-a-report-replace-a-typed-value`,
 * `grid-lets-the-monthly-beat-the-quarterly`, `grid-sends-a-value-with-a-task`, `grid-reads-an-arabic-amount-as-no-amount`,
 * `grid-updates-a-saved-row-with-the-same-value`, `grid-offers-the-value-column-for-tasks`,
 * `grid-reads-a-value-in-a-task-paste`, `grid-calls-an-update-backfilled` (tests/sabotage/grid.mjs).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const JAN: SourceReport = { kind: 'bd_monthly', period: '2025-01' };
const MARCH: SourceReport = { kind: 'bd_monthly', period: '2025-03' };
const JUNE: SourceReport = { kind: 'bd_monthly', period: '2025-06' };
const Q1: SourceReport = { kind: 'commercial_quarterly', period: '2025-Q1' };

const HEADER = ['Title', 'Date', 'Category', 'Partner', 'Value (SAR)'];
const table = (rows: string[][]) => readPastedTable(excelPaste([HEADER, ...rows]));
const CONTRACT = 'Contracts and agreements';
const read = (
  rows: string[][],
  o: {
    source?: SourceReport | null;
    saved?: ReadonlyMap<string, boolean | HeldKey>;
    mode?: 'tasks' | 'achievements';
  } = {},
) => {
  const t = table(rows);
  return readRows(t, {
    mode: o.mode ?? 'achievements',
    mapping: guessMapping(t, fieldsFor({ people: false, value: true })),
    today: TODAY,
    choices: CATEGORIES,
    valueKinds: VALUE_KINDS,
    organisations: ORGS,
    source: o.source ?? MARCH,
    saved: o.saved,
  });
};

describe('V502 — an amount as a sheet writes it', () => {
  it('reads Latin, Arabic-Indic and Eastern digits, either thousands mark, either decimal point', () => {
    expect(readAmount('1250000')).toBe(1250000);
    expect(readAmount('1,250,000')).toBe(1250000);
    expect(readAmount('1 250 000.50')).toBe(1250000.5);
    expect(readAmount('١٬٢٥٠٬٠٠٠'), 'Arabic-Indic digits and thousands mark').toBe(1250000);
    expect(readAmount('١٢٥٠٫٥٠'), 'Arabic decimal point').toBe(1250.5);
    expect(readAmount('۱۲۵۰'), 'Eastern Arabic digits').toBe(1250);
    expect(readAmount('SAR 500')).toBe(500);
    expect(readAmount('12 500 ريال')).toBe(12500);
    expect(readAmount('0')).toBe(0);
  });

  it('refuses what is not an amount — never a guess', () => {
    for (const bad of ['abc', '-5', '1.234', '12.', '1e6', '1,2,x', '1234567890123', '', '٣٫٥٫٥'])
      expect(readAmount(bad), `“${bad}” is not an amount`).toBeNull();
  });
});

describe('V502 — which report is newer', () => {
  it('is the later last day; on the same day the quarterly beats the monthly', () => {
    expect(reportIsNewer(MARCH, JAN)).toBe(true);
    expect(reportIsNewer(JAN, MARCH)).toBe(false);
    expect(reportIsNewer(MARCH, MARCH), 'the same report is not newer than itself').toBe(false);
    expect(reportIsNewer(Q1, MARCH), 'both end 31 March: the quarterly wins').toBe(true);
    expect(reportIsNewer(MARCH, Q1), 'the monthly never beats the quarterly of its day').toBe(false);
    expect(reportIsNewer(Q1, { kind: 'commercial_quarterly', period: '2025-Q1' })).toBe(false);
    expect(reportIsNewer({ kind: 'partnerships', period: '2025-03' }, MARCH), 'two monthlies of one day tie').toBe(
      false,
    );
    expect(reportIsNewer(JUNE, Q1)).toBe(true);
  });
});

describe('V502 — the Value (SAR) column', () => {
  it('is offered with achievements only where a category carries a value, and never with tasks', () => {
    expect(fieldsFor({ people: false, value: false })).not.toContain('value');
    expect(fieldsFor({ people: true, value: true })).toEqual([
      'title',
      'happened_on',
      'kind',
      'organisation',
      'notes',
      'person',
      'value',
    ]);
    expect(guessMapping(table([]), fieldsFor({ people: false, value: true })).columns.value, 'by its header').toBe(4);
    expect(guessMapping(table([]), fieldsFor({ people: false, value: false })).columns.value ?? null).toBeNull();
  });

  it('reads a value on a category that has one, and refuses it on any other', () => {
    const [contract, saving, unreadable, none] = read([
      ['Made-up agreement', '12/02/2025', CONTRACT, 'Test Co B', '1,250,000'],
      ['Made-up saving', '12/02/2025', 'Cost savings', 'Test Co B', '5,000'],
      ['Made-up deal', '12/02/2025', CONTRACT, 'Test Co B', 'a lot'],
      ['Made-up second deal', '12/02/2025', CONTRACT, 'Test Co B', ''],
    ]);
    expect(contract).toMatchObject({ value: 1250000, problems: [] });
    expect(saving!.problems, 'Cost savings has no deal value (V505)').toEqual(['value_not_allowed']);
    expect(unreadable!.problems).toEqual(['value_unreadable']);
    expect(none).toMatchObject({ value: null, problems: [] });
  });

  it('is never read for a task, even from a remembered mapping that names a column', () => {
    const [row] = read([['Made-up call', '12/02/2025', 'Done', 'Test Co B', 'not an amount']], { mode: 'tasks' });
    expect(row!.value, 'a task carries no figure').toBeNull();
    expect(
      row!.problems.filter((p) => p.startsWith('value')),
      'no value problem for a task',
    ).toEqual([]);
  });

  it('is sent as `value` for achievements, and not at all for tasks', () => {
    const [row] = read([['Made-up agreement', '12/02/2025', CONTRACT, 'Test Co B', '1,250,000']]);
    expect(toRequest([row!], 'achievements', MARCH).rows[0]!.value, 'the amount, a number').toBe(1250000);
    const sent = toRequest([{ ...row!, value: 7 }], 'tasks', MARCH).rows[0]!;
    expect('value' in sent, 'a task row carries no value key').toBe(false);
  });
});

describe('V502 — a held key and a newer report', () => {
  const [row] = read([['Made-up agreement', '12/02/2025', CONTRACT, 'Test Co B', '1,250,000']]);
  const key = row!.key;
  const held = (h: HeldKey) =>
    read([['Made-up agreement', '12/02/2025', CONTRACT, 'Test Co B', '1,250,000']], {
      saved: new Map([[key, h]]),
      source: MARCH,
    })[0]!;

  it('updates the saved row when its value came from an older report', () => {
    const r = held({ amount: 900000, from: JAN });
    expect(r.updatesSaved, 'March is newer than January').toBe(true);
    expect(r.problems).toEqual([]);
  });

  it('updates the saved row when its value is blank, or when the quarterly beats the monthly of its day', () => {
    expect(held({ amount: null, from: null }).updatesSaved, 'a blank value is filled').toBe(true);
    const q = read([['Made-up agreement', '12/02/2025', CONTRACT, 'Test Co B', '1,250,000']], {
      saved: new Map([[key, { amount: 900000, from: MARCH }]]),
      source: Q1,
    })[0]!;
    expect(q.updatesSaved, 'Q1 and March both end 31 March; the quarterly wins').toBe(true);
  });

  it('leaves the row out as saved before when the saved value is from the same or a newer report', () => {
    for (const from of [MARCH, JUNE, Q1]) {
      const r = held({ amount: 900000, from });
      expect(r.updatesSaved, `a value from ${from.period} is not replaced by March’s`).toBe(false);
      expect(r.problems).toEqual(['already_saved']);
    }
  });

  it('never replaces a value a person typed, and does not call the same amount an update', () => {
    expect(held({ amount: 900000, from: 'typed' })).toMatchObject({ updatesSaved: false, problems: ['already_saved'] });
    expect(held({ amount: 1250000, from: JAN })).toMatchObject({ updatesSaved: false, problems: ['already_saved'] });
  });

  it('leaves a row with no value out as saved before, and takes a plain "held" answer as before', () => {
    const t = read([['Made-up agreement', '12/02/2025', CONTRACT, 'Test Co B', '']], {
      saved: new Map([[key, { amount: null, from: null }]]),
    })[0]!;
    expect(t).toMatchObject({ updatesSaved: false, problems: ['already_saved'] });
    expect(
      read([['Made-up agreement', '12/02/2025', CONTRACT, 'Test Co B', '1,250,000']], {
        saved: new Map([[key, true]]),
      })[0]!.problems,
      'a held key with no detail is saved before',
    ).toEqual(['already_saved']);
    expect(updatesHeld({ amount: null, from: null }, 5, null), 'no report picked, no update').toBe(false);
  });
});

describe('V502 — the grid says so before it saves', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
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
  const ROW = ['Made-up agreement', '12/02/2025', CONTRACT, 'Test Co B', '1,250,000'];
  const draw = (props: Partial<PastWorkGridProps>, header = HEADER, row = ROW) => {
    const save = vi.fn<(r: BackfillRequest) => Promise<{ requestId: string }>>(async () => ({ requestId: 'req-t-1' }));
    const all: PastWorkGridProps = {
      mode: 'achievements',
      choices: CATEGORIES,
      valueKinds: VALUE_KINDS,
      lang: 'en',
      labels: LABELS,
      today: TODAY,
      source: MARCH,
      resolveOrganisations: async (names) =>
        new Map<string, OrgMatch>(names.map((n) => [n, ORGS.get(n) ?? { kind: 'none' }])),
      save,
      ...props,
    };
    act(() => root.render(<PastWorkGrid {...all} />));
    const area = host.querySelector<HTMLTextAreaElement>('[data-past-work-paste]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(area, excelPaste([header, row]));
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return { save };
  };
  const saveButton = () => host.querySelector<HTMLButtonElement>('[data-past-work-save]')!;
  const previewRow = () => host.querySelector<HTMLElement>('[data-past-work-preview] tbody tr')!;

  it('shows the value, and says a row from a newer report updates the saved one — then sends it', async () => {
    const { save } = draw({
      savedKeys: async (keys) => new Map(keys.map((k) => [k, { amount: 900000, from: JAN } as HeldKey])),
    });
    await settle();
    expect(previewRow().querySelector('[data-value]')?.textContent, 'the value column').toBe('1250000');
    expect(previewRow().hasAttribute('data-updates-saved'), 'marked as an update').toBe(true);
    expect(previewRow().textContent).toContain(LABELS.updatesSaved);
    expect(previewRow().textContent, 'not "Backfilled": it changes a saved row').not.toContain(LABELS.ready);
    expect(saveButton().disabled).toBe(false);
    act(() => saveButton().click());
    await settle();
    expect(save.mock.calls[0]![0].rows[0]).toMatchObject({ kind: 'contract', value: 1250000 });
  });

  it('leaves a row whose saved value is from a newer report out as saved before', async () => {
    const { save } = draw({
      savedKeys: async (keys) => new Map(keys.map((k) => [k, { amount: 900000, from: JUNE } as HeldKey])),
    });
    await settle();
    expect(previewRow().textContent).toContain(LABELS.problems.already_saved);
    expect(previewRow().hasAttribute('data-updates-saved')).toBe(false);
    expect(saveButton().disabled, 'nothing ready to save').toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('takes a plain set of held keys as before: saved before, no update', async () => {
    draw({ savedKeys: async (keys) => new Set(keys) });
    await settle();
    expect(previewRow().textContent).toContain(LABELS.problems.already_saved);
  });

  it('refuses a value on a category that has none, naming why', async () => {
    draw({}, HEADER, ['Made-up saving', '12/02/2025', 'Cost savings', 'Test Co B', '5,000']);
    await settle();
    expect(previewRow().querySelector('[data-problems]')?.textContent).toBe(LABELS.problems.value_not_allowed);
  });

  it('offers no value column for tasks, nor for achievements where no category carries a value', async () => {
    draw({ mode: 'tasks', choices: [{ key: 'done', en: 'Done', ar: 'منجزة' }], defaultKind: 'done' }, HEADER, [
      'Made-up call',
      '12/02/2025',
      'Done',
      'Test Co B',
      'abc',
    ]);
    await settle();
    expect(host.querySelector('[data-value]'), 'a task has no value column').toBeNull();
    expect(host.querySelector(`[aria-label="${LABELS.fields.value}"]`), 'no mapping for a value').toBeNull();
    expect(previewRow().querySelector('[data-problems]'), 'a task is not refused for a value').toBeNull();
    draw({ valueKinds: [] });
    await settle();
    expect(host.querySelector('[data-value]'), 'no category carries a value').toBeNull();
  });
});
