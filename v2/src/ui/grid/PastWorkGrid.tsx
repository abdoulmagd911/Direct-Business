'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TIME_ZONE } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { cn } from '@/ui/cn';
import { StatusChip } from '@/ui/Chip';
import { Textarea } from '@/ui/Input';
import { Select, type SelectOption } from '@/ui/Select';
import { toast } from '@/ui/Toast';
import { readPastedTable } from './paste';
import {
  fieldsFor,
  type HeldKey,
  guessMapping,
  keysToCheck,
  organisationNames,
  personNames,
  readRows,
  toRequest,
  type BackfillRequest,
  type Choice,
  type Field,
  type Mapping,
  type OrgMatch,
  type OwnerUnknown,
  type OwnField,
  type PastWorkMode,
  type PersonMatch,
  type Problem,
} from './rows';
import {
  isSourceReport,
  periodsFor,
  SOURCE_PERIOD,
  SOURCE_REPORTS,
  type SourceReport,
  type SourceReportKind,
} from './source';

/** The grid's words, from the screen's catalog (like the table's `labels`). */
export interface PastWorkLabels {
  /** "Source report" — the report the rows come from, their evidence (V506). */
  source: string;
  /** The four reports: "BD monthly", "Partnerships", "Commercial quarterly", "Improvements". */
  sourceKinds: Record<SourceReportKind, string>;
  /** "Which report" — its month, or its quarter. */
  period: string;
  /** A quarter's name: "Q1 2025". A month is named by the calendar in the reader's language. */
  quarter: (n: number, year: number) => string;
  /** Beside Save until a report is picked: "Pick the report these rows come from". */
  pickSource: string;
  /** Beside a date an undated row took (V504): "the report's last day". */
  fromReport: string;
  /** The paste area: "Paste rows from Excel or Google Sheets". */
  pasteHere: string;
  /** "The first row holds the headers". */
  hasHeader: string;
  /**
   * Each field's name; `kind` is "Status" for tasks, "Category" for achievements; `person` where it is offered; `value`
   * ("Value (SAR)") where achievements may carry a deal value (V502).
   */
  fields: Record<OwnField, string> & { person?: string; value?: string };
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
  /** A row ready to save that updates a saved row's deal value from a newer report (V502): "Updates a saved row". */
  updatesSaved: string;
  /** Why a row is refused, one sentence each. */
  problems: Record<Problem, string>;
  /**
   * Where the paste names people: the chip on a row saved with an Unknown owner (V491), and why — "Owner unknown: no
   * name", "… no one has this name", "… more than one person has this name".
   */
  ownerUnknown?: Record<OwnerUnknown, string>;
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
  /**
   * The categories that carry a deal value (V502, V505: Contract signed, MoU). Offered with achievements, it adds the Value
   * (SAR) column — sent as `value` — and a value on any other category is refused.
   */
  valueKinds?: readonly string[];
  lang: 'ar' | 'en';
  labels: PastWorkLabels;
  /**
   * The report the person last pasted from (the screen keeps it per person, like the mapping): the pickers start on it
   * when it is still one they may pick. Without it nothing is picked, and Save waits for a report (V506).
   */
  source?: SourceReport | null;
  onSourceChange?: (source: SourceReport) => void;
  /** The person's remembered mapping (the screen keeps it per person); a guess from the paste otherwise. */
  mapping?: Mapping | null;
  onMappingChange?: (mapping: Mapping) => void;
  /** Looks organisations up by name, once per paste — every name, in one call. */
  resolveOrganisations: (names: string[]) => Promise<ReadonlyMap<string, OrgMatch>>;
  /**
   * Offers the person column, where the screen may backfill for others (the BD Daily Tasks load, a manager), and looks
   * the pasted names up — once per paste, every name in one call. The database decides a match (OLD-059: real names
   * beat nicknames and e-mail prefixes; exactly one match or none); the grid holds every other answer for a person.
   */
  resolvePeople?: (names: string[]) => Promise<ReadonlyMap<string, PersonMatch>>;
  /**
   * Which of these row keys the database already holds (OLD-PRF-045) — every ready row, in one call; those rows are
   * named "already saved" and left out, so pasting the same rows twice adds nothing. Answering with a map from each held
   * key to its deal value and where that came from (`HeldKey`) lets a row from a newer report say it updates the saved
   * row instead (V502, which the database settles when it saves).
   */
  savedKeys?: (keys: string[]) => Promise<ReadonlySet<string> | ReadonlyMap<string, HeldKey>>;
  /** Builder A's `api.backfill_tasks` / `api.backfill_achievements` (P5-1, P5-4): one request, one Undo. */
  save: (request: BackfillRequest) => Promise<{ requestId: string | null }>;
  /**
   * Every row needs a named owner (V605): the screen says so when the signed-in person is in no team. A row with no
   * owner takes `fallbackOwner` (one picker for the paste, the screen's) or is refused until one is picked.
   */
  ownerNeeded?: boolean;
  fallbackOwner?: { id: string; name: string } | null;
  /** The words for a refused save, when the screen has better ones than `labels.failed` (V605). */
  failedSaying?: (error: unknown) => string | null;
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
 * The answers to one kind of lookup, asked once per paste: every item not yet answered or asked, in one call. An
 * answer is kept whenever it arrives — the grid redraws while a lookup waits, and that must not lose it. A failed call
 * says so once and is not asked again for the same items; they stay "checking", so their rows are never saved on a
 * guess. An item the answer leaves out also stays "checking".
 */
function useLookup<V>(
  wanted: readonly string[],
  ask: ((items: string[]) => Promise<ReadonlyMap<string, V>>) | undefined,
  failed: string,
): [ReadonlyMap<string, V>, (learnt: ReadonlyMap<string, V>) => void] {
  const [known, setKnown] = useState<ReadonlyMap<string, V>>(new Map());
  const waiting = useRef(new Set<string>());
  const gaveUp = useRef('');
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!ask) return;
    const missing = wanted.filter((n) => !known.has(n) && !waiting.current.has(n));
    const key = missing.join('\u{0001}');
    if (!missing.length || gaveUp.current === key) return;
    for (const n of missing) waiting.current.add(n);
    ask(missing).then(
      (found) => {
        for (const n of found.keys()) waiting.current.delete(n);
        if (mounted.current) setKnown((prev) => new Map([...prev, ...found]));
      },
      () => {
        for (const n of missing) waiting.current.delete(n);
        gaveUp.current = key;
        if (mounted.current) toast.failed(failed);
      },
    );
  }, [wanted, known, ask, failed]);
  const learn = useCallback((learnt: ReadonlyMap<string, V>) => setKnown((prev) => new Map([...prev, ...learnt])), []);
  return [known, learn];
}

/** A preview cell: tighter on a phone, so the Title column keeps the spare width (QA 7 Oct). */
const CELL = 'px-2 py-2 sm:px-3';

/**
 * The Past work grid (P5-2c; V400): paste rows from a spreadsheet, check how their columns map, see every row that
 * will be refused and why, then save the rest as one request — Backfilled, no notices, one Undo.
 */
export function PastWorkGrid(props: PastWorkGridProps) {
  const { labels, mode, lang } = props;
  const [text, setText] = useState('');
  const [own, setOwn] = useState<Mapping | null>(null);
  const [saving, setSaving] = useState(false);
  const offersValue = mode === 'achievements' && !!props.valueKinds?.length;
  const fields: readonly Field[] = fieldsFor({ people: !!props.resolvePeople, value: offersValue });
  const today = props.today ?? riyadhToday();
  // The report the person last used, when it is still one to pick; otherwise nothing is picked.
  const [first] = useState(() => (isSourceReport(props.source, today) ? props.source : null));
  const [kind, setKind] = useState<SourceReportKind | null>(first?.kind ?? null);
  const [period, setPeriod] = useState<string | null>(first?.period ?? null);
  const source = useMemo(() => {
    const picked = kind && period ? { kind, period } : null;
    return isSourceReport(picked, today) ? picked : null;
  }, [kind, period, today]);
  const pick = (k: SourceReportKind, p: string | null) => {
    setKind(k);
    setPeriod(p);
    const next = p ? { kind: k, period: p } : null;
    if (isSourceReport(next, today)) props.onSourceChange?.(next);
  };

  const table = useMemo(() => readPastedTable(text), [text]);
  const width = Math.max(0, ...table.map((r) => r.length));
  const remembered = props.mapping;
  const mapping = useMemo(
    () => own ?? fit(remembered, width) ?? guessMapping(table, fields),
    [own, remembered, width, table, fields],
  );
  /** On a phone an optional column the paste does not hold is left out of the preview (the Title keeps the width). */
  const hideIfEmpty = (f: Field) =>
    (f === 'organisation' || f === 'notes' || f === 'value') && mapping.columns[f] == null
      ? 'max-sm:hidden'
      : undefined;
  const setMapping = (m: Mapping) => {
    setOwn(m);
    props.onMappingChange?.(m);
  };

  const orgNames = useMemo(() => organisationNames(table, mapping), [table, mapping]);
  const [orgs] = useLookup(orgNames, props.resolveOrganisations, labels.failed);
  const peopleNames = useMemo(
    () => (props.resolvePeople ? personNames(table, mapping) : []),
    [table, mapping, props.resolvePeople],
  );
  const [people] = useLookup(peopleNames, props.resolvePeople, labels.failed);

  const { choices, defaultKind, resolvePeople, ownerNeeded, fallbackOwner } = props;
  const read = useCallback(
    (saved: ReadonlyMap<string, boolean | HeldKey> | undefined) =>
      readRows(table, {
        mode,
        mapping,
        today,
        choices,
        defaultKind,
        valueKinds: offersValue ? props.valueKinds : undefined,
        organisations: orgs,
        people: resolvePeople ? people : undefined,
        ownerNeeded,
        fallbackOwner,
        saved,
        source,
      }),
    [
      table,
      mode,
      mapping,
      today,
      choices,
      defaultKind,
      orgs,
      people,
      resolvePeople,
      ownerNeeded,
      fallbackOwner,
      source,
      offersValue,
      props.valueKinds,
    ],
  );
  const savedKeys = props.savedKeys;
  const askSaved = useMemo(
    () =>
      savedKeys &&
      (async (keys: string[]) => {
        const held = await savedKeys(keys);
        return new Map<string, boolean | HeldKey>(
          keys.map((k) => [k, held instanceof Map ? (held.get(k) ?? false) : held.has(k)]),
        );
      }),
    [savedKeys],
  );
  // The keys of the rows ready but for "saved before?" — asked once, every one in one call (OLD-PRF-045).
  const toCheck = useMemo(() => (askSaved ? keysToCheck(read(new Map())) : []), [askSaved, read]);
  const [saved, learnSaved] = useLookup(toCheck, askSaved, labels.failed);
  const rows = useMemo(() => read(askSaved ? saved : undefined), [read, askSaved, saved]);
  const ready = rows.filter((r) => r.problems.length === 0).length;
  const choiceName = (key: string | null) => {
    const c = props.choices.find((x) => x.key === key);
    return c ? (lang === 'ar' ? c.ar : c.en) : '';
  };

  async function onSave() {
    if (!source || saving) return;
    const request = toRequest(rows, mode, source);
    if (!request.rows.length) return;
    setSaving(true);
    try {
      const { requestId } = await props.save(request);
      // These rows are saved now: pasted again, they are "saved before" without asking.
      learnSaved(new Map(request.rows.map((r) => [r.import_key, true])));
      const undo = props.undo;
      toast.done(labels.saved(request.rows.length), {
        undo: requestId && undo ? { label: labels.undo, onUndo: () => undo(requestId) } : undefined,
      });
      props.onSaved?.({ requestId, rows: request.rows.length });
      setText('');
    } catch (e) {
      toast.failed(props.failedSaying?.(e) ?? labels.failed);
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

  const periodName = (p: string) => {
    const [y, rest] = p.split('-');
    if (rest!.startsWith('Q')) return labels.quarter(Number(rest!.slice(1)), Number(y));
    return monthName(lang, Number(y), Number(rest));
  };
  const periods = kind ? periodsFor(kind, today).reverse() : [];

  return (
    <div className="flex flex-col gap-4" data-past-work-grid={mode}>
      <div className="flex flex-wrap items-end gap-3" data-past-work-source>
        <div className="flex min-w-48 flex-col gap-1 text-sm">
          <span className="text-muted">{labels.source}</span>
          <Select
            aria-label={labels.source}
            placeholder={labels.source}
            value={kind ?? ''}
            options={SOURCE_REPORTS.map((k) => ({ value: k, label: labels.sourceKinds[k] }))}
            onValueChange={(v) => {
              const next = v as SourceReportKind;
              // A month and a quarter are not the same report: a new length of period asks for the report again.
              pick(next, kind && SOURCE_PERIOD[kind] === SOURCE_PERIOD[next] ? period : null);
            }}
          />
        </div>
        <div className="flex min-w-48 flex-col gap-1 text-sm">
          <span className="text-muted">{labels.period}</span>
          <Select
            aria-label={labels.period}
            placeholder={labels.period}
            disabled={!kind}
            value={period ?? ''}
            options={periods.map((p) => ({ value: p, label: periodName(p) }))}
            onValueChange={(p) => kind && pick(kind, p)}
          />
        </div>
      </div>

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
                className="size-6"
                label={labels.hasHeader}
                checked={mapping.hasHeader}
                onCheckedChange={(v) => setMapping({ ...mapping, hasHeader: v })}
              />
              {labels.hasHeader}
            </label>
            {fields.map((f) => (
              <div key={f} className="flex min-w-40 flex-col gap-1 text-sm">
                <span className="text-muted">{labels.fields[f]}</span>
                <Select
                  aria-label={labels.fields[f]}
                  value={mapping.columns[f] == null ? 'none' : String(mapping.columns[f])}
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
                  <th className={cn(CELL, 'text-start font-medium')}>{labels.line}</th>
                  {fields.map((f) => (
                    <th
                      key={f}
                      className={cn(CELL, 'text-start font-medium', f === 'title' && 'w-full min-w-24', hideIfEmpty(f))}
                      data-column={f}
                    >
                      {labels.fields[f]}
                    </th>
                  ))}
                  <th className={cn(CELL, 'text-start font-medium')} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.line}
                    className="border-t border-border"
                    data-line={r.line}
                    data-ready={!r.problems.length}
                    data-updates-saved={r.updatesSaved || undefined}
                  >
                    <td className={cn(CELL, 'font-data text-muted')}>{r.line}</td>
                    <td className={CELL}>{r.title}</td>
                    <td className={CELL} data-date-from-report={r.dateFromReport || undefined}>
                      <span className="font-data">{r.happenedOn ?? ''}</span>
                      {r.dateFromReport ? <span className="ms-2 text-muted">{labels.fromReport}</span> : null}
                    </td>
                    <td className={CELL}>{choiceName(r.kind)}</td>
                    <td className={cn(CELL, hideIfEmpty('organisation'))}>{r.organisation?.name ?? ''}</td>
                    <td className={cn(CELL, 'text-muted', hideIfEmpty('notes'))}>{r.notes ?? ''}</td>
                    {props.resolvePeople ? (
                      <td className={CELL} data-owner-unknown={r.person?.unknown ?? undefined}>
                        {r.person?.unknown ? (
                          <StatusChip tone="warning">
                            {labels.ownerUnknown?.[r.person.unknown] ?? r.person.name}
                          </StatusChip>
                        ) : (
                          (r.person?.name ?? '')
                        )}
                      </td>
                    ) : null}
                    {offersValue ? (
                      <td className={cn(CELL, 'font-data', hideIfEmpty('value'))} data-value>
                        {r.value ?? ''}
                      </td>
                    ) : null}
                    <td className={CELL}>
                      {r.problems.length ? (
                        <ul className="flex flex-col gap-0.5 text-danger" data-problems={r.problems.join(' ')}>
                          {r.problems.map((p) => (
                            <li key={p}>{labels.problems[p]}</li>
                          ))}
                        </ul>
                      ) : (
                        <StatusChip tone="neutral">{r.updatesSaved ? labels.updatesSaved : labels.ready}</StatusChip>
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
              {source ? null : (
                <span className="ms-2 text-warning" data-past-work-pick-source>
                  {labels.pickSource}
                </span>
              )}
            </span>
            <Button
              variant="primary"
              loading={saving}
              disabled={!ready || !source}
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

/** A month's name in the reader's language — the Gregorian calendar, Latin digits (V40): "March 2025", «مارس 2025». */
function monthName(lang: 'ar' | 'en', year: number, month: number): string {
  return new Intl.DateTimeFormat(lang, {
    month: 'long',
    year: 'numeric',
    calendar: 'gregory',
    numberingSystem: 'latn',
    timeZone: 'UTC',
  }).format(Date.UTC(year, month - 1, 15));
}

/** A remembered mapping that still fits the paste (no column beyond its width), or null to guess afresh. */
function fit(m: Mapping | null | undefined, width: number): Mapping | null {
  if (!m) return null;
  return Object.values(m.columns).every((c) => c === null || c === undefined || c < width) ? m : null;
}
