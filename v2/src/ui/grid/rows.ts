import { readDay, type DateOrder } from './dates';

/**
 * The Past work grid's rows (P5-2c, V400): pasted cells mapped to fields, read and checked, then sent as **one
 * request** — origin `backfill`, so the rows are marked Backfilled, raise no notices and are never "logged late".
 * A row that cannot be saved is named in the preview with every reason, and left out of the request; nothing is
 * guessed for it.
 */
export type PastWorkMode = 'tasks' | 'achievements';

/**
 * `kind` is the status of a task, or the category of an achievement. `person` — whose work the row is — is offered
 * only where the screen may backfill for others (the one-time BD Daily Tasks load, a manager); without it every row
 * is the signed-in person's own.
 */
export const FIELDS = ['title', 'happened_on', 'kind', 'organisation', 'notes', 'person'] as const;
export type Field = (typeof FIELDS)[number];
export type OwnField = Exclude<Field, 'person'>;
/** The fields of a person's own past work — every field but `person`. */
export const OWN_FIELDS: readonly OwnField[] = ['title', 'happened_on', 'kind', 'organisation', 'notes'];

export interface Mapping {
  /** The first pasted row holds the headers. */
  hasHeader: boolean;
  /** How "03/04/2026" reads; null refuses a date that could be either. */
  dateOrder: DateOrder | null;
  /** The pasted column (0-based) each field comes from, or null (a mapping remembered before `person` lacks it). */
  columns: Record<OwnField, number | null> & { person?: number | null };
}

/** A status or a category the row may name, in either language, or by its key. */
export interface Choice {
  key: string;
  en: string;
  ar: string;
}

/** A name looked up in the database: exactly one match, none, or more than one — never a guess. */
export type OrgMatch = { kind: 'one'; id: string } | { kind: 'none' } | { kind: 'many' };
export type PersonMatch = OrgMatch;

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
  | 'person_missing'
  | 'person_unknown'
  | 'person_ambiguous'
  | 'person_checking'
  | 'repeated'
  | 'already_saved'
  | 'saved_checking';

export interface PastRow {
  /** The row's line in the paste (the header is line 1 when there is one), to find it in the sheet. */
  line: number;
  title: string;
  happenedOn: string | null;
  /** The chosen status or category key. */
  kind: string | null;
  organisation: { name: string; id: string | null } | null;
  notes: string | null;
  /** Whose work it is, when the paste names people: the name as pasted and the one person it matched. */
  person: { name: string; id: string | null } | null;
  /**
   * The row's identity — whose, title, day, status or category, organisation — the same text however often it is
   * pasted: two rows with one key are the same row (OLD-PRF-045), and the database keeps one.
   */
  key: string;
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
  /**
   * The people already looked up by name (OLD-059), when the paste may name them; a name not yet looked up is
   * "checking". Without it the person column is not read and every row is the signed-in person's own.
   */
  people?: ReadonlyMap<string, PersonMatch>;
  /**
   * Which rows' keys the database already holds (OLD-PRF-045): `true` is saved before, `false` is new, a key not yet
   * asked is "checking". Without it only repeats inside the paste are caught.
   */
  saved?: ReadonlyMap<string, boolean>;
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
  person: ['person', 'owner', 'staff', 'employee', 'assignee', 'done by', 'name', 'الموظف', 'الشخص', 'المنفذ', 'الاسم'],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * A first guess at the mapping from the pasted table's first row: a header naming a field (in English or Arabic) maps
 * it. When fewer than two headers are recognised the first row is data, and the columns are taken in the grid's own
 * order (title, date, status or category, organisation, notes, and person where the screen offers it).
 */
export function guessMapping(table: readonly string[][], fields: readonly Field[] = OWN_FIELDS): Mapping {
  const first = (table[0] ?? []).map(norm);
  const columns = Object.fromEntries(FIELDS.map((f) => [f, null])) as Record<Field, number | null>;
  for (const f of fields) {
    const at = first.findIndex((h, i) => HEADERS[f].includes(h) && !Object.values(columns).includes(i));
    if (at >= 0) columns[f] = at;
  }
  const found = Object.values(columns).filter((v) => v !== null).length;
  if (found >= 2) return { hasHeader: true, dateOrder: 'dmy', columns };
  const width = Math.max(0, ...table.map((r) => r.length));
  fields.forEach((f, i) => (columns[f] = i < width ? i : null));
  return { hasHeader: false, dateOrder: 'dmy', columns };
}

function choose(cell: string, choices: readonly Choice[]): string | null {
  const c = norm(cell);
  return choices.find((x) => [x.key, x.en, x.ar].some((v) => norm(v) === c))?.key ?? null;
}

export function readRows(table: readonly string[][], o: ReadOptions): PastRow[] {
  const { columns } = o.mapping;
  const at = (row: readonly string[], f: Field) => {
    const c = columns[f];
    return c === null || c === undefined ? '' : (row[c] ?? '').trim();
  };
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

    // Whose work: only where the screen offers the person column. The database matched each name (OLD-059: real names
    // beat nicknames and e-mail prefixes, exactly one match or none); the grid holds every other answer, never guesses.
    let person: PastRow['person'] = null;
    if (o.people && columns.person !== null && columns.person !== undefined) {
      const name = at(row, 'person');
      const match = name ? o.people.get(name) : undefined;
      person = name ? { name, id: match?.kind === 'one' ? match.id : null } : null;
      if (!name) problems.push('person_missing');
      else if (!match) problems.push('person_checking');
      else if (match.kind === 'none') problems.push('person_unknown');
      else if (match.kind === 'many') problems.push('person_ambiguous');
    }

    // The same row twice (OLD-PRF-045): whose, title, day, status or category and organisation — the matched person and
    // organisation once the database has answered, so two spellings of one organisation are one row.
    const key = JSON.stringify([
      o.mode,
      person?.id ?? norm(person?.name ?? ''),
      norm(title),
      happenedOn,
      kind,
      organisation?.id ?? norm(orgName),
    ]);
    if (title && happenedOn && seen.has(key)) problems.push('repeated');
    seen.add(key);
    if (!problems.length && o.saved) {
      const before = o.saved.get(key);
      if (before === undefined) problems.push('saved_checking');
      else if (before) problems.push('already_saved');
    }

    return {
      line: start + i + 1,
      title,
      happenedOn,
      kind,
      organisation,
      notes: at(row, 'notes') || null,
      person,
      key,
      problems,
    };
  });
}

/** The organisation names a paste needs looked up, once each. */
export function organisationNames(table: readonly string[][], mapping: Mapping): string[] {
  return namesIn(table, mapping, 'organisation');
}

/** The person names a paste needs looked up, once each (OLD-059). */
export function personNames(table: readonly string[][], mapping: Mapping): string[] {
  return namesIn(table, mapping, 'person');
}

function namesIn(table: readonly string[][], mapping: Mapping, field: 'organisation' | 'person'): string[] {
  const c = mapping.columns[field];
  if (c === null || c === undefined) return [];
  const rows = table.slice(mapping.hasHeader ? 1 : 0);
  return [...new Set(rows.map((r) => (r[c] ?? '').trim()).filter(Boolean))];
}

/** The keys the database is asked about: rows ready but for that answer (OLD-PRF-045). */
export function keysToCheck(rows: readonly PastRow[]): string[] {
  return rows.filter((r) => r.problems.length === 1 && r.problems[0] === 'saved_checking').map((r) => r.key);
}

export interface BackfillRequest {
  mode: PastWorkMode;
  origin: 'backfill';
  rows: {
    title: string;
    happened_on: string;
    kind: string;
    organisation_id: string | null;
    notes: string | null;
    /** Whose work; null is the signed-in person's own. */
    person_id: string | null;
    /** The row's identity (`PastRow.key`): the database keeps one row per key, so a second paste adds nothing. */
    import_key: string;
  }[];
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
        person_id: r.person?.id ?? null,
        import_key: r.key,
      })),
  };
}
