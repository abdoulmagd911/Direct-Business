// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOM, ExportButton, type ExportButtonLabels, type PageFetcher } from '@/core/export';
import { toast } from '@/ui/Toast';
import { readCsv, sampleColumns, sampleRows, standIn, type SampleRow } from './list-tools';

/**
 * The Export button (P3-12): a click reads the whole list and hands the browser one file named with the list; while it
 * reads, the button waits and a second click starts nothing; a failure says why in the screen's words (never "Exported"
 * over a short file); CSV and Excel are offered from a menu, one format is a plain button.
 * Sabotages: `button-does-not-wait`, `button-says-done-on-a-failure`, `button-names-no-reason`, `button-offers-one-format`
 * (tests/sabotage/export-lists.mjs).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: ExportButtonLabels = {
  export: 'Export',
  csv: 'CSV',
  excel: 'Excel',
  failed: 'Export failed',
  changed: 'The list changed while it was exported. Export again.',
  tooMany: 'Too many rows for one file.',
  tooLong: 'A cell is too long for Excel.',
  done: (n) => `Exported ${n.toLocaleString('en')} rows`,
};

let host: HTMLDivElement;
let root: Root;
let saved: { name: string; blob: Blob }[];
let blobs: Map<string, Blob>;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  saved = [];
  blobs = new Map();
  let n = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    const url = `blob:test/${++n}`;
    blobs.set(url, b as Blob);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push({ name: this.download, blob: blobs.get(this.href)! });
  });
  vi.spyOn(toast, 'done').mockImplementation(() => 0);
  vi.spyOn(toast, 'failed').mockImplementation(() => 0);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

function draw(page: PageFetcher<SampleRow>, formats?: ('csv' | 'xlsx')[]) {
  act(() =>
    root.render(
      <ExportButton
        list="Invoices"
        columns={sampleColumns}
        page={page}
        lang="en"
        labels={labels}
        rowKey={(r) => r.id}
        formats={formats}
      />,
    ),
  );
  return host.querySelector<HTMLButtonElement>('[data-export-button]')!;
}

/** jsdom's Blob has no `text()`: read the bytes, keeping the byte-order mark. */
function textOf(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(new TextDecoder('utf-8', { ignoreBOM: true }).decode(new Uint8Array(reader.result as ArrayBuffer)));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function settle() {
  for (let i = 0; i < 20; i++) await act(async () => new Promise((r) => setTimeout(r, 0)));
}

describe('the Export button', () => {
  it('downloads the whole list as one CSV named with the list', async () => {
    const rows = sampleRows(2500);
    const button = draw(standIn(rows, { cap: 1000, count: true }).page, ['csv']);
    expect(button.textContent).toBe('Export');
    act(() => button.click());
    await settle();
    expect(saved).toHaveLength(1);
    expect(saved[0]!.name).toMatch(/^Invoices_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/);
    const text = await textOf(saved[0]!.blob);
    expect(text.startsWith(BOM)).toBe(true);
    const table = readCsv(text.slice(BOM.length));
    expect(table.length - 1).toBe(2500);
    expect(toast.done).toHaveBeenCalledWith('Exported 2,500 rows');
    expect(toast.failed).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
  });

  it('writes only the columns the person sees, and names one it leaves out, and why (OA23)', async () => {
    act(() =>
      root.render(
        <ExportButton
          list="Invoices"
          columns={sampleColumns}
          page={standIn(sampleRows(4), { count: true }).page}
          lang="en"
          labels={{ ...labels, omitted: (cols) => `Not in the file: ${cols}` }}
          formats={['csv']}
          visible={['number', 'partner', 'actions']}
          omit={{ actions: 'buttons, not data' }}
          headers={{ actions: 'Actions' }}
        />,
      ),
    );
    act(() => host.querySelector<HTMLButtonElement>('[data-export-button]')!.click());
    await settle();
    const table = readCsv((await textOf(saved[0]!.blob)).slice(BOM.length));
    expect(table[0]).toEqual(['Invoice', 'Partner']);
    expect(toast.done, 'the done toast names the column left out').toHaveBeenCalledWith('Exported 4 rows', {
      description: 'Not in the file: Actions — buttons, not data',
    });
  });

  it('waits while it reads, and a second click starts nothing', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls: number[] = [];
    const page: PageFetcher<SampleRow> = async (from, to) => {
      calls.push(from);
      await gate;
      return { data: sampleRows(3).slice(from, to + 1), error: null, count: 3 };
    };
    const button = draw(page, ['csv']);
    act(() => button.click());
    await settle();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    act(() => button.click());
    await settle();
    expect(calls).toEqual([0]);
    expect(saved).toHaveLength(0);
    release();
    await settle();
    expect(saved).toHaveLength(1);
    expect(button.disabled).toBe(false);
  });

  it('says why when the list changed while it was read, and saves nothing', async () => {
    let first = true;
    const rows = sampleRows(2500);
    const page: PageFetcher<SampleRow> = async (from, to) => {
      const list = first ? rows : rows.slice(0, 2400);
      const count = first ? 2500 : 2400;
      first = false;
      return { data: list.slice(from, Math.min(to + 1, from + 1000)), error: null, count };
    };
    const button = draw(page, ['csv']);
    act(() => button.click());
    await settle();
    expect(saved).toHaveLength(0);
    expect(toast.done).not.toHaveBeenCalled();
    expect(toast.failed).toHaveBeenCalledWith('Export failed', labels.changed);
  });

  it('says it failed when a page is refused', async () => {
    const page: PageFetcher<SampleRow> = async () => ({
      data: null,
      error: { code: '42501', message: 'access.denied' },
    });
    const button = draw(page, ['xlsx']);
    act(() => button.click());
    await settle();
    expect(saved).toHaveLength(0);
    expect(toast.failed).toHaveBeenCalledWith('Export failed', undefined);
  });

  it('offers CSV and Excel from a menu by default', async () => {
    const button = draw(standIn(sampleRows(12)).page);
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await settle();
    const items = [...document.querySelectorAll<HTMLElement>('[data-export-format]')];
    expect(items.map((i) => i.dataset.exportFormat)).toEqual(['csv', 'xlsx']);
    expect(items.map((i) => i.textContent)).toEqual(['CSV', 'Excel']);
    act(() => items[1]!.click());
    await settle();
    expect(saved.map((s) => s.name)).toEqual([expect.stringMatching(/^Invoices_.*\.xlsx$/)]);
    expect(saved[0]!.blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});
