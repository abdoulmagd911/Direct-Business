// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPastedTable } from '@/ui/grid/paste';
import { PastWorkGrid, type PastWorkGridProps } from '@/ui/grid/PastWorkGrid';
import { guessMapping, readRows, toRequest, type BackfillRequest, type OrgMatch } from '@/ui/grid/rows';
import { isSourceReport, periodLastDay, periodsFor, type SourceReport } from '@/ui/grid/source';
import { toast } from '@/ui/Toast';
import { excelPaste, LABELS, ORGS, STATUSES, TODAY } from './grid-tools';

/**
 * Past work comes from the department's reports (the owner's V506, V504; the Architect's relay of 30 Sep): every paste
 * names the report it comes from — BD monthly, Partnerships, Commercial quarterly or Improvements, and which one — and
 * that report is every row's evidence; Save waits until one is picked. An undated row takes the report's last day,
 * marked as the report's; a dated row keeps its own day. Past work starts on 1 January 2025. Made-up rows (rule 7).
 * Sabotages: `grid-lets-a-2024-row-in`, `grid-leaves-an-undated-row-undated`, `grid-dates-an-undated-row-today`,
 * `grid-saves-without-a-report`, `grid-offers-a-report-not-yet-over`, `grid-counts-february-as-30-days`,
 * `grid-keys-a-row-by-its-report`, `grid-reads-a-report-day-in-the-computers-zone` (tests/sabotage/grid.mjs).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Q1_2025: SourceReport = { kind: 'commercial_quarterly', period: '2025-Q1' };
const MARCH_2025: SourceReport = { kind: 'bd_monthly', period: '2025-03' };

const paste = (rows: string[][]) => readPastedTable(excelPaste([['Title', 'Date', 'Status', 'Partner'], ...rows]));
const read = (rows: string[][], source?: SourceReport | null) => {
  const table = paste(rows);
  return readRows(table, {
    mode: 'tasks',
    mapping: guessMapping(table),
    today: TODAY,
    choices: STATUSES,
    defaultKind: 'done',
    organisations: ORGS,
    source,
  });
};

describe('V506 — the report a paste comes from', () => {
  it('knows each report period’s last day, February and leap years included', () => {
    expect(periodLastDay('2025-01')).toBe('2025-01-31');
    expect(periodLastDay('2025-02'), 'February 2025 has 28 days').toBe('2025-02-28');
    expect(periodLastDay('2028-02'), 'February 2028 has 29 days').toBe('2028-02-29');
    expect(periodLastDay('2025-04')).toBe('2025-04-30');
    expect(periodLastDay('2025-Q1')).toBe('2025-03-31');
    expect(periodLastDay('2025-Q2')).toBe('2025-06-30');
    expect(periodLastDay('2025-Q4')).toBe('2025-12-31');
    for (const bad of ['2025-13', '2025-00', '2025-Q5', '25-01', '2025-1', '', 'March 2025'])
      expect(periodLastDay(bad), bad).toBeNull();
  });

  it('names the same last days and the same reports in every time zone (PRF-139)', () => {
    const original = process.env.TZ;
    try {
      const seen = ['UTC', 'Asia/Riyadh', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'].map(
        (tz) => {
          process.env.TZ = tz;
          return [periodLastDay('2025-02'), periodLastDay('2025-Q1'), periodsFor('bd_monthly', TODAY).at(-1)].join(' ');
        },
      );
      expect(new Set(seen), seen.join(' | ')).toEqual(new Set(['2025-02-28 2025-03-31 2026-08']));
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('offers the reports from January 2025 to the last one over by today', () => {
    const months = periodsFor('bd_monthly', TODAY);
    expect(months[0]).toBe('2025-01');
    expect(months.at(-1), 'September is not over on 29 September').toBe('2026-08');
    expect(months).toHaveLength(20);
    expect(periodsFor('bd_monthly', '2026-09-30').at(-1), 'September is over on its last day').toBe('2026-09');
    expect(periodsFor('commercial_quarterly', TODAY)).toEqual([
      '2025-Q1',
      '2025-Q2',
      '2025-Q3',
      '2025-Q4',
      '2026-Q1',
      '2026-Q2',
    ]);
    expect(periodsFor('commercial_quarterly', '2026-09-30').at(-1)).toBe('2026-Q3');
    expect(periodsFor('partnerships', TODAY)).toEqual(months);
    expect(periodsFor('improvements', TODAY)).toEqual(months);
  });

  it('takes only one of the four reports, of its own length, already over', () => {
    expect(isSourceReport(MARCH_2025, TODAY)).toBe(true);
    expect(isSourceReport(Q1_2025, TODAY)).toBe(true);
    expect(isSourceReport(null, TODAY)).toBe(false);
    expect(isSourceReport({ kind: 'weekly' as SourceReport['kind'], period: '2025-03' }, TODAY), 'a fifth report').toBe(
      false,
    );
    expect(isSourceReport({ kind: 'bd_monthly', period: '2025-Q1' }, TODAY), 'a quarter of a monthly').toBe(false);
    expect(isSourceReport({ kind: 'commercial_quarterly', period: '2025-03' }, TODAY), 'a month of a quarterly').toBe(
      false,
    );
    expect(isSourceReport({ kind: 'bd_monthly', period: '2026-09' }, TODAY), 'not over yet').toBe(false);
    expect(isSourceReport({ kind: 'bd_monthly', period: '2024-12' }, TODAY), 'before past work starts').toBe(false);
  });

  it('refuses a row dated before 1 January 2025, and takes 1 January itself', () => {
    const rows = read(
      [
        ['Made-up call', '31/12/2024', 'Done', 'Test Co A'],
        ['Made-up visit', '01/01/2025', 'Done', 'Test Co A'],
      ],
      MARCH_2025,
    );
    expect(rows[0]!.problems, 'before past work starts (V506)').toEqual(['date_before_start']);
    expect(rows[1]!.problems).toEqual([]);
  });

  it('sends the report with every paste, and never a paste without one', () => {
    const request = toRequest(
      read([['Made-up call', '05/03/2025', 'Done', 'Test Co A']], MARCH_2025),
      'tasks',
      MARCH_2025,
    );
    expect(request.source).toEqual({ kind: 'bd_monthly', period: '2025-03', last_day: '2025-03-31' });
    expect(() => toRequest([], 'tasks', { kind: 'bd_monthly', period: 'March' })).toThrow();
  });
});

describe('V504 — an undated row takes the report’s last day', () => {
  it('dates an undated row on the report’s last day, marked as the report’s', () => {
    const [row] = read([['Made-up offer', '', 'Done', 'Test Co B']], Q1_2025);
    expect(row).toMatchObject({ happenedOn: '2025-03-31', dateFromReport: true, problems: [] });
    const request = toRequest([row!], 'tasks', Q1_2025);
    expect(request.rows[0]).toMatchObject({ happened_on: '2025-03-31', date_from_report: true });
  });

  it('keeps a dated row’s own day, whatever the report', () => {
    const [row] = read([['Made-up offer', '12/02/2025', 'Done', 'Test Co B']], Q1_2025);
    expect(row).toMatchObject({ happenedOn: '2025-02-12', dateFromReport: false, problems: [] });
  });

  it('still refuses an undated row while no report is picked, and a date it cannot read', () => {
    expect(read([['Made-up offer', '', 'Done', 'Test Co B']], null)[0]!.problems).toEqual(['date_missing']);
    expect(read([['Made-up offer', 'soon', 'Done', 'Test Co B']], Q1_2025)[0]!.problems).toEqual(['date_unreadable']);
  });

  it('knows the same undated work in March’s monthly and Q1’s quarterly as one row', () => {
    const work = [['Made-up offer', '', 'Done', 'Test Co B']];
    expect(read(work, MARCH_2025)[0]!.key).toBe(read(work, Q1_2025)[0]!.key);
  });
});

describe('the grid asks for the report before it saves', () => {
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
  const UNDATED = ['Made-up offer', '', 'Done', 'Test Co B'];
  const draw = (props: Partial<PastWorkGridProps>, row: string[] = UNDATED) => {
    const save = vi.fn<(r: BackfillRequest) => Promise<{ requestId: string }>>(async () => ({ requestId: 'req-t-1' }));
    const all: PastWorkGridProps = {
      mode: 'tasks',
      choices: STATUSES,
      defaultKind: 'done',
      lang: 'en',
      labels: LABELS,
      today: TODAY,
      resolveOrganisations: async (names) =>
        new Map<string, OrgMatch>(names.map((n) => [n, ORGS.get(n) ?? { kind: 'none' }])),
      save,
      ...props,
    };
    act(() => root.render(<PastWorkGrid {...all} />));
    const area = host.querySelector<HTMLTextAreaElement>('[data-past-work-paste]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(area, excelPaste([['Title', 'Date', 'Status', 'Partner'], row]));
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return { save };
  };
  const saveButton = () => host.querySelector<HTMLButtonElement>('[data-past-work-save]')!;

  it('shows the two pickers, asks for the report and keeps Save off until one is picked', async () => {
    // A dated row, ready in every other way: only the missing report holds it back.
    const { save } = draw({}, ['Made-up offer', '12/02/2025', 'Done', 'Test Co B']);
    await settle();
    expect(host.querySelector('[data-past-work-summary]')!.textContent).toContain('1 rows ready · 0 refused');
    const pickers = host.querySelectorAll('[data-past-work-source] [role="combobox"]');
    expect(pickers, 'the report and which one').toHaveLength(2);
    expect(pickers[1]!.hasAttribute('disabled') || pickers[1]!.getAttribute('data-disabled') !== null).toBe(true);
    expect(host.querySelector('[data-past-work-pick-source]')?.textContent).toBe(LABELS.pickSource);
    expect(saveButton().disabled, 'no Save without a report (V506)').toBe(true);
    act(() => saveButton().click());
    expect(save).not.toHaveBeenCalled();
  });

  it('starts on the report the person last used, dates the undated row from it and sends it', async () => {
    const onSourceChange = vi.fn();
    const { save } = draw({ source: Q1_2025, onSourceChange });
    await settle();
    expect(host.querySelector('[data-past-work-pick-source]')).toBeNull();
    const cell = host.querySelector('[data-past-work-preview] tbody [data-date-from-report]');
    expect(cell?.textContent, 'the report’s last day, marked as such').toBe(`2025-03-31${LABELS.fromReport}`);
    expect(saveButton().disabled).toBe(false);
    act(() => saveButton().click());
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].source).toEqual({
      kind: 'commercial_quarterly',
      period: '2025-Q1',
      last_day: '2025-03-31',
    });
    expect(save.mock.calls[0]![0].rows[0]).toMatchObject({ happened_on: '2025-03-31', date_from_report: true });
    expect(onSourceChange, 'a remembered report is not a new pick').not.toHaveBeenCalled();
  });

  it('does not start on a remembered report that is not one to pick', async () => {
    const { save } = draw({ source: { kind: 'bd_monthly', period: '2026-09' } });
    await settle();
    expect(host.querySelector('[data-past-work-pick-source]')).not.toBeNull();
    expect(saveButton().disabled).toBe(true);
    expect(host.querySelector('[data-past-work-preview] tbody [data-problems]')?.textContent).toBe(
      LABELS.problems.date_missing,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
