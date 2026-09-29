// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOM, ExportButton, exportList, type ExportButtonLabels, type ExportColumn } from '@/core/export';
import { toast } from '@/ui/Toast';
import { readCsv, sampleColumns, sampleRows, standIn, type SampleRow } from './list-tools';
import { blobBytes, readXlsx } from './xlsx-reader';

/**
 * The old app's missed export rows (the Architect's round 13, SCENARIOS-OLD.csv):
 * - **OLD-037** — a person without Finance never exports a money column, whatever the screen shows: every export asks
 *   "may this session see Finance", and a money column left out is named with its reason.
 * - **OLD-053** — an Arabic reader's file has its column titles and its list values (statuses, types) in Arabic; the
 *   data cells (names, numbers, IDs) are written verbatim.
 * - **OLD-054** — no Export where the list registers no column (the old My day Export downloaded the whole workspace).
 * Sabotages: `export-keeps-money-without-finance`, `export-names-no-money-column-left-out`,
 * `export-writes-list-values-as-stored`, `export-button-shows-with-nothing-to-export` (tests/sabotage/export-lists.mjs).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = new Date('2026-09-29T11:05:33Z');
/** Made-up amounts no other cell can hold: every one starts 987654. */
const rows: SampleRow[] = sampleRows(40).map((r, i) => ({ ...r, amount: 987654.25 + i }));
const MONEY = /987654/;

async function table(blob: Blob, format: 'csv' | 'xlsx'): Promise<string[][]> {
  if (format === 'csv') {
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blobBytes(blob));
    return readCsv(text.slice(BOM.length));
  }
  const book = await readXlsx(await blobBytes(blob));
  return [...book.rows.values()].map((r) => [...r.values()].map((c) => String(c.value)));
}

describe('OLD-037 — money only for a person who may see Finance', () => {
  for (const format of ['csv', 'xlsx'] as const)
    for (const visible of [['number', 'partner', 'amount', 'status'], undefined])
      it(`OLD-037: a member without Finance exports no money column, even one the screen shows (${format}, ${visible ? 'the screen names its columns' : 'every column'})`, async () => {
        const out = await exportList({
          list: 'Invoices',
          columns: sampleColumns,
          page: standIn(rows, { count: true }).page,
          format,
          lang: 'en',
          at,
          visible,
          seesFinance: false,
          financeOnly: 'Finance only',
        });
        const [head, ...body] = await table(out.blob, format);
        expect(head, 'no money column').not.toContain('Amount (SAR)');
        expect(
          body.flat().filter((v) => MONEY.test(v)),
          'no amount in any cell',
        ).toEqual([]);
        expect(body).toHaveLength(rows.length);
        expect(out.omitted, 'the money column is named, with its reason').toEqual([
          { key: 'amount', reason: 'Finance only' },
        ]);
      });

  it('OLD-037: a person who may see Finance exports the money column', async () => {
    const out = await exportList({
      list: 'Invoices',
      columns: sampleColumns,
      page: standIn(rows, { count: true }).page,
      format: 'csv',
      lang: 'en',
      at,
      seesFinance: true,
      financeOnly: 'Finance only',
    });
    const [head, ...body] = await table(out.blob, 'csv');
    const amount = head!.indexOf('Amount (SAR)');
    expect(amount, 'the money column').toBeGreaterThanOrEqual(0);
    expect(body.map((r) => Number(r[amount]))).toEqual(rows.map((r) => r.amount));
    expect(out.omitted).toEqual([]);
  });
});

describe('OLD-053 — titles and list values in the reader’s language, data verbatim', () => {
  const WORDS = {
    en: { status: { open: 'Open', done: 'Done', late: 'Late' }, roles: { Client: 'Client', Supplier: 'Supplier' } },
    ar: { status: { open: 'مفتوحة', done: 'منجزة', late: 'متأخرة' }, roles: { Client: 'عميل', Supplier: 'مورد' } },
  } as const;
  const TITLES = {
    en: { number: 'Invoice', partner: 'Partner', status: 'Status', roles: 'Roles' },
    ar: { number: 'الفاتورة', partner: 'الشريك', status: 'الحالة', roles: 'الأدوار' },
  } as const;
  // One row holds a status no list names: it is written as stored, never dropped or blanked.
  const listed = rows.slice(0, 12).map((r, i) => (i === 5 ? { ...r, status: 'on_hold' as SampleRow['status'] } : r));
  const columns = (lang: 'en' | 'ar'): ExportColumn<SampleRow>[] => [
    { key: 'number', header: TITLES[lang].number, kind: 'id', value: (r) => r.number },
    { key: 'partner', header: TITLES[lang].partner, kind: 'text', value: (r) => r.partner },
    { key: 'status', header: TITLES[lang].status, kind: 'text', value: (r) => r.status, words: WORDS[lang].status },
    { key: 'roles', header: TITLES[lang].roles, kind: 'text', value: (r) => r.roles, words: WORDS[lang].roles },
  ];

  for (const format of ['csv', 'xlsx'] as const)
    for (const lang of ['ar', 'en'] as const)
      it(`OLD-053: a reader in ${lang} gets the titles and the statuses and types in ${lang}, and the names and IDs as stored (${format})`, async () => {
        const out = await exportList({
          list: lang === 'ar' ? 'الفواتير' : 'Invoices',
          columns: columns(lang),
          page: standIn(listed, { count: true }).page,
          format,
          lang,
          at,
          seesFinance: true,
          financeOnly: 'Finance only',
        });
        const [head, ...body] = await table(out.blob, format);
        expect(head).toEqual(Object.values(TITLES[lang]));
        const words: Record<string, string> = WORDS[lang].status;
        expect(
          body.map((r) => r[2]),
          'each status in the reader’s words',
        ).toEqual(listed.map((r) => words[r.status] ?? r.status));
        expect(body[5]![2], 'a value no list names is written as stored').toBe('on_hold');
        const roles: Record<string, string> = WORDS[lang].roles;
        expect(body.map((r) => r[3])).toEqual(listed.map((r) => r.roles.map((x) => roles[x]).join('; ')));
        expect(
          body.map((r) => [r[0], r[1]]),
          'the data cells verbatim',
        ).toEqual(listed.map((r) => [r.number, r.partner]));
      });
});

describe('OLD-054 — Export only where a list registers columns', () => {
  const labels: ExportButtonLabels = {
    export: 'Export',
    csv: 'CSV',
    excel: 'Excel',
    failed: 'Export failed',
    changed: 'The list changed while it was exported.',
    tooMany: 'Too many rows for one file.',
    tooLong: 'A cell is too long for Excel.',
    done: (n) => `Exported ${n} rows`,
    omitted: (cols) => `Not in the file: ${cols}`,
    financeOnly: 'Finance only',
  };
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });
  const money = sampleColumns.filter((c) => c.kind === 'money');
  const render = (props: {
    columns: readonly ExportColumn<SampleRow>[];
    visible?: string[];
    omit?: Record<string, string>;
    seesFinance: boolean;
  }) => {
    act(() =>
      root.render(<ExportButton list="My day" page={standIn(rows).page} lang="en" labels={labels} {...props} />),
    );
    return host.querySelector('[data-export-button]');
  };

  it('OLD-054: a page with no list column shows no Export', () => {
    expect(render({ columns: [], seesFinance: true }), 'no columns').toBeNull();
  });
  it('OLD-054: a list whose only visible column is its buttons shows no Export', () => {
    expect(
      render({ columns: sampleColumns, visible: ['actions'], omit: { actions: 'buttons' }, seesFinance: true }),
    ).toBeNull();
  });
  it('OLD-054: a list of money alone shows no Export to a person without Finance, and one to a person with it', () => {
    expect(render({ columns: money, seesFinance: false }), 'nothing to export without Finance').toBeNull();
    expect(render({ columns: money, seesFinance: true }), 'money to export with Finance').not.toBeNull();
  });
  it('OLD-037: the button leaves the money out for a person without Finance, and says so', async () => {
    vi.spyOn(toast, 'done').mockImplementation(() => 0);
    vi.spyOn(toast, 'failed').mockImplementation(() => 0);
    const files: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      files.push(b as Blob);
      return 'blob:test/1';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    act(() =>
      root.render(
        <ExportButton
          list="Invoices"
          columns={sampleColumns}
          page={standIn(rows.slice(0, 4), { count: true }).page}
          lang="en"
          labels={labels}
          formats={['csv']}
          visible={['number', 'amount']}
          headers={{ amount: 'Amount (SAR)' }}
          seesFinance={false}
        />,
      ),
    );
    act(() => host.querySelector<HTMLButtonElement>('[data-export-button]')!.click());
    for (let i = 0; i < 20; i++) await act(async () => new Promise((r) => setTimeout(r, 0)));
    const [head, ...body] = await table(files[0]!, 'csv');
    expect(head).toEqual(['Invoice']);
    expect(body.flat().filter((v) => MONEY.test(v))).toEqual([]);
    expect(toast.done).toHaveBeenCalledWith('Exported 4 rows', {
      description: 'Not in the file: Amount (SAR) — Finance only',
    });
  });
});
