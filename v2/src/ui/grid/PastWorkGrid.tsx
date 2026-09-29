'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TIME_ZONE } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { StatusChip } from '@/ui/Chip';
import { Textarea } from '@/ui/Input';
import { Select, type SelectOption } from '@/ui/Select';
import { toast } from '@/ui/Toast';
import { readPastedTable } from './paste';
import {
  FIELDS,
  guessMapping,
  organisationNames,
  readRows,
  toRequest,
  type BackfillRequest,
  type Choice,
  type Field,
  type Mapping,
  type OrgMatch,
  type PastWorkMode,
  type Problem,
} from './rows';

/** The grid's words, from the screen's catalog (like the table's `labels`). */
export interface PastWorkLabels {
  /** The paste area: "Paste rows from Excel or Google Sheets". */
  pasteHere: string;
  /** "The first row holds the headers". */
  hasHeader: string;
  /** Each field's name; `kind` is "Status" for tasks, "Category" for achievements. */
  fields: Record<Field, string>;
  /** "Not in the paste". */
  noColumn: string;
  /** A pasted column: "Column B · Title". */
  column: (letter: string, header: string | null) => string;
  /** "Dates read"; "Day first (29/09/2026)"; "Month first (09/29/2026)". */
  dateOrder: string;
  dayFirst: string;
  monthFirst: string;
  /** The preview's first column: "Line". */
  line: string;
  /** A row ready to save: "Backfilled". */
  ready: string;
  /** Why a row is refused, one sentence each. */
  problems: Record<Problem, string>;
  /** "18 rows ready · 2 refused". */
  summary: (ready: number, refused: number) => string;
  /** The save button: "Save 18 rows". */
  save: (rows: number) => string;
  /** The done toast: "18 rows saved as past work". */
  saved: (rows: number) => string;
  undo: string;
  failed: string;
}

export interface PastWorkGridProps {
  mode: PastWorkMode;
  /** Task statuses (locked meanings, V401) or achievement categories, with their names in both languages. */
  choices: readonly Choice[];
  /** A task row with no status takes this one (Done). */
  defaultKind?: string | null;
  lang: 'ar' | 'en';
  labels: PastWorkLabels;
  /** The person's remembered mapping (the screen keeps it per person); a guess from the paste otherwise. */
  mapping?: Mapping | null;
  onMappingChange?: (mapping: Mapping) => void;
  /** Looks organisations up by name, once per paste — every name, in one call. */
  resolveOrganisations: (names: string[]) => Promise<ReadonlyMap<string, OrgMatch>>;
  /** Builder A's `api.backfill_tasks` / `api.backfill_achievements` (P5-1, P5-4): one request, one Undo. */
  save: (request: BackfillRequest) => Promise<{ requestId: string | null }>;
  undo?: (requestId: string) => Promise<void>;
  onSaved?: (result: { requestId: string | null; rows: number }) => void;
  /** Riyadh's today; tests pass one. */
  today?: string;
}

const riyadhDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Riyadh's calendar day (D20), from its parts — never from one locale's layout of a date, which browsers change. */
export function riyadhToday(now = new Date()): string {
  const p: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of riyadhDay.formatToParts(now)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}`;
}

const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `C${i + 1}`);

/**
 * The Past work grid (P5-2c; V400): paste rows from a spreadsheet, check how their columns map, see every row that
 * will be refused and why, then save the rest as one request — Backfilled, no notices, one Undo.
 */
export function PastWorkGrid(props: PastWorkGridProps) {
  const { labels, mode, lang } = props;
  const [text, setText] = useState('');
  const [own, setOwn] = useState<Mapping | null>(null);
  const [orgs, setOrgs] = useState<ReadonlyMap<string, OrgMatch>>(new Map());
  const [saving, setSaving] = useState(false);
  const today = props.today ?? riyadhToday();

  const table = useMemo(() => readPastedTable(text), [text]);
  const width = Math.max(0, ...table.map((r) => r.length));
  const mapping = own ?? fit(props.mapping, width) ?? guessMapping(table);
  const setMapping = (m: Mapping) => {
    setOwn(m);
    props.onMappingChange?.(m);
  };

  const names = useMemo(() => organisationNames(table, mapping), [table, mapping]);
  const asked = useRef('');
  useEffect(() => {
    const missing = names.filter((n) => !orgs.has(n));
    const key = missing.join('\u{0001}');
    if (!missing.length || asked.current === key) return;
    asked.current = key;
    let live = true;
    props.resolveOrganisations(missing).then(
      (found) => {
        if (live) setOrgs((prev) => new Map([...prev, ...found]));
      },
      () => {
        if (live) toast.failed(labels.failed);
      },
    );
    return () => {
      live = false;
    };
  }, [names, orgs, props, labels.failed]);

  const rows = useMemo(
    () =>
      readRows(table, {
        mode,
        mapping,
        today,
        choices: props.choices,
        defaultKind: props.defaultKind,
        organisations: orgs,
      }),
    [table, mode, mapping, today, props.choices, props.defaultKind, orgs],
  );
  const ready = rows.filter((r) => r.problems.length === 0).length;
  const choiceName = (key: string | null) => {
    const c = props.choices.find((x) => x.key === key);
    return c ? (lang === 'ar' ? c.ar : c.en) : '';
  };

  async function onSave() {
    const request = toRequest(rows, mode);
    if (!request.rows.length || saving) return;
    setSaving(true);
    try {
      const { requestId } = await props.save(request);
      const undo = props.undo;
      toast.done(labels.saved(request.rows.length), {
        undo: requestId && undo ? { label: labels.undo, onUndo: () => undo(requestId) } : undefined,
      });
      props.onSaved?.({ requestId, rows: request.rows.length });
      setText('');
    } catch {
      toast.failed(labels.failed);
    } finally {
      setSaving(false);
    }
  }

  const header = mapping.hasHeader ? (table[0] ?? []) : [];
  const columnOptions: SelectOption[] = [
    { value: 'none', label: labels.noColumn },
    ...Array.from({ length: width }, (_, i) => ({
      value: String(i),
      label: labels.column(letter(i), header[i] || null),
    })),
  ];

  return (
    <div className="flex flex-col gap-4" data-past-work-grid={mode}>
      <Textarea
        aria-label={labels.pasteHere}
        placeholder={labels.pasteHere}
        rows={table.length ? 3 : 6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="font-data"
        data-past-work-paste
      />

      {table.length ? (
        <>
          <div className="flex flex-wrap items-end gap-3" data-past-work-mapping>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                label={labels.hasHeader}
                checked={mapping.hasHeader}
                onCheckedChange={(v) => setMapping({ ...mapping, hasHeader: v })}
              />
              {labels.hasHeader}
            </label>
            {FIELDS.map((f) => (
              <div key={f} className="flex min-w-40 flex-col gap-1 text-sm">
                <span className="text-muted">{labels.fields[f]}</span>
                <Select
                  aria-label={labels.fields[f]}
                  value={mapping.columns[f] === null ? 'none' : String(mapping.columns[f])}
                  options={columnOptions}
                  onValueChange={(v) =>
                    setMapping({ ...mapping, columns: { ...mapping.columns, [f]: v === 'none' ? null : Number(v) } })
                  }
                />
              </div>
            ))}
            <div className="flex min-w-40 flex-col gap-1 text-sm">
              <span className="text-muted">{labels.dateOrder}</span>
              <Select
                aria-label={labels.dateOrder}
                value={mapping.dateOrder ?? 'dmy'}
                options={[
                  { value: 'dmy', label: labels.dayFirst },
                  { value: 'mdy', label: labels.monthFirst },
                ]}
                onValueChange={(v) => setMapping({ ...mapping, dateOrder: v === 'mdy' ? 'mdy' : 'dmy' })}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm" data-past-work-preview>
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{labels.line}</th>
                  {FIELDS.map((f) => (
                    <th key={f} className="px-3 py-2 text-start font-medium">
                      {labels.fields[f]}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-start font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.line}
                    className="border-t border-border"
                    data-line={r.line}
                    data-ready={!r.problems.length}
                  >
                    <td className="px-3 py-2 font-data text-muted">{r.line}</td>
                    <td className="px-3 py-2">{r.title}</td>
                    <td className="px-3 py-2 font-data">{r.happenedOn ?? ''}</td>
                    <td className="px-3 py-2">{choiceName(r.kind)}</td>
                    <td className="px-3 py-2">{r.organisation?.name ?? ''}</td>
                    <td className="px-3 py-2 text-muted">{r.notes ?? ''}</td>
                    <td className="px-3 py-2">
                      {r.problems.length ? (
                        <ul className="flex flex-col gap-0.5 text-danger" data-problems={r.problems.join(' ')}>
                          {r.problems.map((p) => (
                            <li key={p}>{labels.problems[p]}</li>
                          ))}
                        </ul>
                      ) : (
                        <StatusChip tone="neutral">{labels.ready}</StatusChip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted" data-past-work-summary>
              {labels.summary(ready, rows.length - ready)}
            </span>
            <Button
              variant="primary"
              loading={saving}
              disabled={!ready}
              onClick={() => void onSave()}
              data-past-work-save
            >
              {labels.save(ready)}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** A remembered mapping that still fits the paste (no column beyond its width), or null to guess afresh. */
function fit(m: Mapping | null | undefined, width: number): Mapping | null {
  if (!m) return null;
  return Object.values(m.columns).every((c) => c === null || c < width) ? m : null;
}
