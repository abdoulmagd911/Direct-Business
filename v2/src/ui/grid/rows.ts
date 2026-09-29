import { readDay, type DateOrder } from './dates';

/**
 * The Past work grid's rows (P5-2c, V400): pasted cells mapped to fields, read and checked, then sent as **one
 * request** — origin `backfill`, so the rows are marked Backfilled, raise no notices and are never "logged late".
 * A row that cannot be saved is named in the preview with every reason, and left out of the request; nothing is
 * guessed for it.
 */
export type PastWorkMode = 'tasks' | 'achievements';

/** `kind` is the status of a task, or the category of an achievement. */
export const FIELDS = ['title', 'happened_on', 'kind', 'organisation', 'notes'] as const;
export type Field = (typeof FIELDS)[number];

export interface Mapping {
  /** The first pasted row holds the headers. */
  hasHeader: boolean;
  /** How "03/04/2026" reads; null refuses a date that could be either. */
  dateOrder: DateOrder | null;
  /** The pasted column (0-based) each field comes from, or null. */
  columns: Record<Field, number | null>;
}

/** A status or a category the row may name, in either language, or by its key. */
export interface Choice {
  key: string;
  en: string;
  ar: string;
}

export type OrgMatch = { kind: 'one'; id: string } | { kind: 'none' } | { kind: 'many' };

export type Problem =
  | 'title_missing'
  | 'date_missing'
  | 'date_unreadable'
  | 'date_ambiguous'
  | 'date_in_future'
  | 'kind_missing'
  | 'kind_unknown'
  | 'organisation_unknown'
  | 'organisation_ambiguous'
  | 'organisation_checking'
  | 'repeated';

export interface PastRow {
  /** The row's line in the paste (the header is line 1 when there is one), to find it in the sheet. */
  line: number;
  title: string;
  happenedOn: string | null;
  /** The chosen status or category key. */
  kind: string | null;
  organisation: { name: string; id: string | null } | null;
  notes: string | null;
  problems: Problem[];
}

export interface ReadOptions {
  mode: PastWorkMode;
  mapping: Mapping;
  /** Riyadh's today (`YYYY-MM-DD`, D20): a past entry may be dated any day up to it, never after (V400). */
  today: string;
  choices: readonly Choice[];
  /** The status a task row without one takes (Done: past work is mostly finished); achievements have none. */
  defaultKind?: string | null;
  /** The organisations already looked up by name; a name not yet looked up is "checking". */
  organisations: ReadonlyMap<string, OrgMatch>;
}

const HEADERS: Record<Field, string[]> = {
  title: ['title', 'task', 'subject', 'achievement', 'what', 'العنوان', 'المهمة', 'الموضوع', 'الإنجاز'],
  happened_on: ['date', 'happened', 'happened on', 'day', 'done on', 'التاريخ', 'اليوم', 'تاريخ الإنجاز'],
  kind: ['status', 'category', 'type', 'الحالة', 'الفئة', 'النوع', 'التصنيف'],
  organisation: [
    'organisation',
    'organization',
    'partner',
    'client',
    'supplier',
    'company',
    'الجهة',
    'الشريك',
    'العميل',
    'المورد',
  ],
  notes: ['notes', 'note', 'details', 'comment', 'comments', 'description', 'ملاحظات', 'التفاصيل', 'الوصف'],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * A first guess at the mapping from the pasted table's first row: a header naming a field (in English or Arabic) maps
 * it. When fewer than two headers are recognised the first row is data, and the columns are taken in the grid's own
 * order (title, date, status or category, organisation, notes).
 */
export function guessMapping(table: readonly string[][]): Mapping {
  const first = (table[0] ?? []).map(norm);
  const columns = Object.fromEntries(FIELDS.map((f) => [f, null])) as Record<Field, number | null>;
  for (const f of FIELDS) {
    const at = first.findIndex((h, i) => HEADERS[f].includes(h) && !Object.values(columns).includes(i));
    if (at >= 0) columns[f] = at;
  }
  const found = Object.values(columns).filter((v) => v !== null).length;
  if (found >= 2) return { hasHeader: true, dateOrder: 'dmy', columns };
  const width = Math.max(0, ...table.map((r) => r.length));
  FIELDS.forEach((f, i) => (columns[f] = i < width ? i : null));
  return { hasHeader: false, dateOrder: 'dmy', columns };
}

function choose(cell: string, choices: readonly Choice[]): string | null {
  const c = norm(cell);
  return choices.find((x) => [x.key, x.en, x.ar].some((v) => norm(v) === c))?.key ?? null;
}

export function readRows(table: readonly string[][], o: ReadOptions): PastRow[] {
  const { columns } = o.mapping;
  const at = (row: readonly string[], f: Field) => (columns[f] === null ? '' : (row[columns[f]!] ?? '').trim());
  const seen = new Set<string>();
  const start = o.mapping.hasHeader ? 1 : 0;
  return table.slice(start).map((row, i) => {
    const problems: Problem[] = [];
    const title = at(row, 'title');
    if (!title) problems.push('title_missing');

    const date = readDay(at(row, 'happened_on'), o.mapping.dateOrder);
    const happenedOn = 'day' in date ? date.day : null;
    if ('problem' in date) problems.push(date.problem);
    else if (date.day > o.today) problems.push('date_in_future');

    const kindCell = at(row, 'kind');
    let kind: string | null = null;
    if (kindCell) {
      kind = choose(kindCell, o.choices);
      if (!kind) problems.push('kind_unknown');
    } else if (o.mode === 'tasks' && o.defaultKind) kind = o.defaultKind;
    else problems.push('kind_missing');

    const orgName = at(row, 'organisation');
    let organisation: PastRow['organisation'] = null;
    if (orgName) {
      const match = o.organisations.get(orgName);
      organisation = { name: orgName, id: match?.kind === 'one' ? match.id : null };
      if (!match) problems.push('organisation_checking');
      else if (match.kind === 'none') problems.push('organisation_unknown');
      else if (match.kind === 'many') problems.push('organisation_ambiguous');
    }

    const identity = [norm(title), happenedOn, norm(orgName)].join('\u{0001}');
    if (title && happenedOn && seen.has(identity)) problems.push('repeated');
    seen.add(identity);

    return {
      line: start + i + 1,
      title,
      happenedOn,
      kind,
      organisation,
      notes: at(row, 'notes') || null,
      problems,
    };
  });
}

/** The organisation names a paste needs looked up, once each. */
export function organisationNames(table: readonly string[][], mapping: Mapping): string[] {
  const c = mapping.columns.organisation;
  if (c === null) return [];
  const rows = table.slice(mapping.hasHeader ? 1 : 0);
  return [...new Set(rows.map((r) => (r[c] ?? '').trim()).filter(Boolean))];
}

export interface BackfillRequest {
  mode: PastWorkMode;
  origin: 'backfill';
  rows: { title: string; happened_on: string; kind: string; organisation_id: string | null; notes: string | null }[];
}

/** One request per paste: every row with no problem, and only those (V400). */
export function toRequest(rows: readonly PastRow[], mode: PastWorkMode): BackfillRequest {
  return {
    mode,
    origin: 'backfill',
    rows: rows
      .filter((r) => r.problems.length === 0)
      .map((r) => ({
        title: r.title,
        happened_on: r.happenedOn!,
        kind: r.kind!,
        organisation_id: r.organisation?.id ?? null,
        notes: r.notes,
      })),
  };
}
