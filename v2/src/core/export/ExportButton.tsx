'use client';
import { Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui/Button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { toast } from '@/ui/Toast';
import type { ExportColumn } from './columns';
import { exportList, saveFile, type ExportFormat, type ExportListInput } from './exportList';
import { ExportRefused } from './fetchAll';
import { XlsxCellTooLong } from './xlsx';

/** The button's words, from the screen's catalog (like the table's `labels`). */
export interface ExportButtonLabels {
  /** "Export" */
  export: string;
  /** "CSV" */
  csv: string;
  /** "Excel" */
  excel: string;
  /** The failure toast's title: "Export failed". */
  failed: string;
  /** The list changed while it was read — "The list changed while it was exported. Export again." */
  changed: string;
  /** More rows than one sheet holds — "Too many rows for one file. Narrow the list with the chips first." */
  tooMany: string;
  /** A text too long for Excel — "A cell is too long for Excel. Export CSV instead." */
  tooLong: string;
  /** The done toast: "Exported 2,500 rows". */
  done: (rows: number) => string;
  /** Under the done toast when a visible column is left out (OA23): "Not in the file: Actions — buttons, not data". */
  omitted?: (columns: string) => string;
}

export interface ExportButtonProps<T> {
  /** The list's name as the person sees it (the file and sheet name). */
  list: string;
  columns: readonly ExportColumn<T>[];
  /** The list's own query with the chips applied, by range — see `exportList`. */
  page: ExportListInput<T>['page'];
  lang: 'ar' | 'en';
  labels: ExportButtonLabels;
  /** A row's identity, to refuse a row read twice. */
  rowKey?: (row: T) => string;
  /** The keys of the columns the person sees, in order — the file holds exactly these (OA23; see `exportList`). */
  visible?: readonly string[];
  /** A visible column that cannot be a cell, with the reason the person is told. */
  omit?: Readonly<Record<string, string>>;
  /** The header each visible key shows on screen, to name a left-out column (defaults to the key). */
  headers?: Readonly<Record<string, string>>;
  /** The formats offered (`app.export_formats`); one format makes a plain button. */
  formats?: readonly ExportFormat[];
  /** The screen takes over failures (a `DbError` carries its catalog key); by default a toast says why. */
  onError?: (error: unknown) => void;
  onDone?: (result: { fileName: string; rows: number; format: ExportFormat }) => void;
  size?: 'md' | 'sm' | 'xs';
}

/**
 * Export on every list (spec §3.11, P3-12): reads the list through `fetchAll` with its chips, writes CSV or Excel and
 * hands the file to the browser. The button waits (spinner) while it reads; leaving the page stops the read.
 */
export function ExportButton<T>({
  list,
  columns,
  page,
  lang,
  labels,
  rowKey,
  visible,
  omit,
  headers,
  formats = ['csv', 'xlsx'],
  onError,
  onDone,
  size = 'sm',
}: ExportButtonProps<T>) {
  const [busy, setBusy] = useState(false);
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);

  async function run(format: ExportFormat) {
    if (running.current) return;
    const ctrl = new AbortController();
    running.current = ctrl;
    setBusy(true);
    try {
      const out = await exportList({
        list,
        columns,
        page,
        format,
        lang,
        key: rowKey,
        signal: ctrl.signal,
        visible,
        omit,
      });
      if (ctrl.signal.aborted) return;
      saveFile(out.blob, out.fileName);
      const left = out.omitted.map((o) => `${headers?.[o.key] ?? o.key} — ${o.reason}`).join('; ');
      // A left-out column is always named, in the screen's sentence when it gives one (OA23).
      if (left) toast.done(labels.done(out.rows), { description: labels.omitted?.(left) ?? left });
      else toast.done(labels.done(out.rows));
      onDone?.({ fileName: out.fileName, rows: out.rows, format });
    } catch (error) {
      if (ctrl.signal.aborted) return;
      if (onError) onError(error);
      else toast.failed(labels.failed, reason(error, labels));
    } finally {
      running.current = null;
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }

  const words: Record<ExportFormat, string> = { csv: labels.csv, xlsx: labels.excel };
  const icon = <Download aria-hidden="true" />;

  if (formats.length === 1) {
    const only = formats[0]!;
    return (
      <Button
        variant="secondary"
        size={size}
        icon={icon}
        loading={busy}
        onClick={() => void run(only)}
        data-export-button
        data-export-format={only}
      >
        {labels.export}
      </Button>
    );
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size={size} icon={icon} loading={busy} data-export-button>
          {labels.export}
        </Button>
      </MenuTrigger>
      <MenuContent>
        {formats.map((f) => (
          <MenuItem key={f} onSelect={() => void run(f)} data-export-format={f}>
            {words[f]}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

/** Why an export failed, in the screen's words; unknown failures show the title alone. */
function reason(error: unknown, labels: ExportButtonLabels): string | undefined {
  if (error instanceof ExportRefused) {
    if (error.reason === 'changed' || error.reason === 'repeated') return labels.changed;
    if (error.reason === 'too_many') return labels.tooMany;
  }
  if (error instanceof XlsxCellTooLong) return labels.tooLong;
  return undefined;
}
