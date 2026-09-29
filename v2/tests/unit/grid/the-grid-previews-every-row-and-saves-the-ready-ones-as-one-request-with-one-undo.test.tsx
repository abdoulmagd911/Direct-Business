// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PastWorkGrid, type PastWorkLabels } from '@/ui/grid/PastWorkGrid';
import type { BackfillRequest, OrgMatch } from '@/ui/grid/rows';
import { toast } from '@/ui/Toast';
import { excelPaste, ORGS, STATUSES, TODAY, twentyTasks } from './grid-tools';

/**
 * The Past work grid in a browser (jsdom): a paste shows every row in the preview — ready rows marked Backfilled,
 * refused rows with their reasons — asks for the organisations once, and Save sends the ready rows as one request,
 * then offers one Undo for all of them. The header switch and the column choices are the person's, remembered by
 * the screen.
 * Sabotages: `grid-sends-a-request-per-row`, `grid-offers-no-undo`, `grid-sends-a-refused-row` (tests/sabotage/grid.mjs).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: PastWorkLabels = {
  pasteHere: 'Paste rows from Excel or Google Sheets',
  hasHeader: 'The first row holds the headers',
  fields: { title: 'Title', happened_on: 'Date', kind: 'Status', organisation: 'Organisation', notes: 'Notes' },
  noColumn: 'Not in the paste',
  column: (l, h) => (h ? `Column ${l} · ${h}` : `Column ${l}`),
  dateOrder: 'Dates read',
  dayFirst: 'Day first',
  monthFirst: 'Month first',
  line: 'Line',
  ready: 'Backfilled',
  problems: {
    title_missing: 'No title',
    date_missing: 'No date',
    date_unreadable: 'The date cannot be read',
    date_ambiguous: 'The date could be two days',
    date_in_future: 'The date is after today',
    kind_missing: 'No status',
    kind_unknown: 'Unknown status',
    organisation_unknown: 'Unknown organisation',
    organisation_ambiguous: 'More than one organisation has this name',
    organisation_checking: 'Checking the organisation',
    repeated: 'The same row twice',
  },
  summary: (r, x) => `${r} rows ready · ${x} refused`,
  save: (n) => `Save ${n} rows`,
  saved: (n) => `${n} rows saved as past work`,
  undo: 'Undo',
  failed: 'Could not save',
};

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

async function settle() {
  for (let i = 0; i < 10; i++) await act(async () => new Promise((r) => setTimeout(r, 0)));
}

function paste(text: string) {
  const area = host.querySelector<HTMLTextAreaElement>('[data-past-work-paste]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(area, text);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function draw() {
  const save = vi.fn<(r: BackfillRequest) => Promise<{ requestId: string }>>(async () => ({ requestId: 'req-t-0001' }));
  const undo = vi.fn<(id: string) => Promise<void>>(async () => {});
  const resolve = vi.fn(
    async (names: string[]) => new Map<string, OrgMatch>(names.map((n) => [n, ORGS.get(n) ?? { kind: 'none' }])),
  );
  const onMappingChange = vi.fn();
  act(() =>
    root.render(
      <PastWorkGrid
        mode="tasks"
        choices={STATUSES}
        defaultKind="done"
        lang="en"
        labels={labels}
        today={TODAY}
        resolveOrganisations={resolve}
        save={save}
        undo={undo}
        onMappingChange={onMappingChange}
      />,
    ),
  );
  return { save, undo, resolve, onMappingChange };
}

const lines = () => [...host.querySelectorAll<HTMLTableRowElement>('[data-past-work-preview] tbody tr')];

describe('the Past work grid', () => {
  it('previews 20 pasted rows and saves them as one request with one Undo', async () => {
    const { save, undo, resolve } = draw();
    paste(excelPaste(twentyTasks()));
    await settle();
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve.mock.calls[0]![0].sort()).toEqual(['Test Co A', 'Test Co B']);
    expect(lines()).toHaveLength(20);
    expect(lines().every((tr) => tr.dataset.ready === 'true')).toBe(true);
    expect(host.querySelector('[data-past-work-summary]')!.textContent).toBe('20 rows ready · 0 refused');

    const button = host.querySelector<HTMLButtonElement>('[data-past-work-save]')!;
    expect(button.textContent).toBe('Save 20 rows');
    act(() => button.click());
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0]).toMatchObject({ mode: 'tasks', origin: 'backfill' });
    expect(save.mock.calls[0]![0].rows).toHaveLength(20);

    const [title, opts] = vi.mocked(toast.done).mock.calls[0]!;
    expect(title).toBe('20 rows saved as past work');
    expect(opts?.undo?.label).toBe('Undo');
    await act(async () => void (await opts!.undo!.onUndo()));
    expect(undo).toHaveBeenCalledWith('req-t-0001');
    // The paste is cleared for the next one.
    expect(host.querySelector<HTMLTextAreaElement>('[data-past-work-paste]')!.value).toBe('');
  });

  it('names the refused rows and saves only the ready ones', async () => {
    const { save } = draw();
    paste(
      excelPaste([
        ['Title', 'Date', 'Status', 'Partner'],
        ['Made-up visit', '29/09/2026', 'Done', 'Test Co A'],
        ['Made-up call', '30/09/2026', 'Done', 'Test Co A'],
        ['Made-up offer', '02/09/2026', 'Done', 'Nobody Known'],
      ]),
    );
    await settle();
    const problems = lines().map((tr) => tr.querySelector('[data-problems]')?.textContent ?? 'ready');
    expect(problems).toEqual(['ready', 'The date is after today', 'Unknown organisation']);
    expect(host.querySelector('[data-past-work-summary]')!.textContent).toBe('1 rows ready · 2 refused');
    act(() => host.querySelector<HTMLButtonElement>('[data-past-work-save]')!.click());
    await settle();
    expect(save.mock.calls[0]![0].rows.map((r) => r.title)).toEqual(['Made-up visit']);
  });

  it('lets the person say the first row is data, and tells the screen to remember it', async () => {
    const { onMappingChange } = draw();
    paste(excelPaste(twentyTasks()));
    await settle();
    act(() => host.querySelector<HTMLButtonElement>('[data-past-work-mapping] [role="checkbox"]')!.click());
    await settle();
    expect(onMappingChange).toHaveBeenLastCalledWith(expect.objectContaining({ hasHeader: false }));
    expect(lines()).toHaveLength(21);
    expect(lines()[0]!.querySelector('[data-problems]')!.textContent).toContain('The date cannot be read');
  });
});
