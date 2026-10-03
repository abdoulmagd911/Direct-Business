import { readDay, type DateOrder } from './dates';
import { PAST_WORK_FROM, periodLastDay, reportIsNewer, type SourceReport } from './source';

/**
 * The Past work grid's rows (P5-2c, V400): pasted cells mapped to fields, read and checked, then sent as **one
 * request** — origin `backfill`, so the rows are marked Backfilled, raise no notices and are never "logged late".
 * A row that cannot be saved is named in the preview with every reason, and left out of the request; nothing is
 * guessed for it. Every paste comes from one of the department's reports, which stands as its rows' evidence (V506).
 */
export type PastWorkMode = 'tasks' | 'achievements';

/**
 * `kind` is the status of a task, or the category of an achievement. `person` — whose work the row is — is offered
 * only where the screen may backfill for others (the one-time BD Daily Tasks load, a manager); without it every row
 * is the signed-in person's own. `value` — an achievement's deal value in SAR (V502) — is offered only for achievements,
 * and only a category that has a deal value takes one.
 */
export const FIELDS = ['title', 'happened_on', 'kind', 'organisation', 'notes', 'person', 'value'] as const;
export type Field = (typeof FIELDS)[number];
export type OwnField = Exclude<Field, 'person' | 'value'>;
/** The fields of a person's own past work — every field but `person` and `value`. */
export const OWN_FIELDS: readonly OwnField[] = ['title', 'happened_on', 'kind', 'organisation', 'notes'];

/** The columns a screen offers: the person's, where it may backfill for others; the value's, for achievements (V502). */
export function fieldsFor(o: { people: boolean; value: boolean }): readonly Field[] {
  return FIELDS.filter((f) => (f === 'person' ? o.people : f === 'value' ? o.value : true));
}

export interface Mapping {
  /** The first pasted row holds the headers. */
  hasHeader: boolean;
  /** How "03/04/2026" reads; null refuses a date that could be either. */
  dateOrder: DateOrder | null;
  /** The pasted column (0-based) each field comes from, or null (a mapping remembered before `person` lacks it). */
  columns: Record<OwnField, number | null> & { person?: number | null; value?: number | null };
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
/** Why a past row's owner is Unknown (V491): no name pasted, no one has the name, or more than one has it. */
export type OwnerUnknown = 'missing' | 'none' | 'many';

export type Problem =
  | 'title_missing'
  | 'date_missing'
  | 'date_unreadable'
  | 'date_ambiguous'
  | 'date_in_future'
  | 'date_before_start'
  | 'kind_missing'
  | 'kind_unknown'
  | 'value_unreadable'
  | 'value_not_allowed'
  | 'organisation_unknown'
  | 'organisation_ambiguous'
  | 'organisation_checking'
  | 'person_checking'
  | 'repeated'
  | 'already_saved'
  | 'saved_checking';

export interface PastRow {
  /** The row's line in the paste (the header is line 1 when there is one), to find it in the sheet. */
  line: number;
  title: string;
  happenedOn: string | null;
  /** The row had no date, so it took the report's last day (V504) — shown as the report's, never as the sheet's. */
  dateFromReport: boolean;
  /** The chosen status or category key. */
  kind: string | null;
  /** An achievement's deal value in SAR (V502), from the pasted column; null when the row has none. */
  value: number | null;
  /**
   * The key is already saved, but this row brings its deal value from a newer report than the one the saved value came
   * from (or the saved value is blank) — so saving updates that row instead of leaving it out (V502).
   */
  updatesSaved: boolean;
  organisation: { name: string; id: string | null } | null;
  notes: string | null;
  /**
   * Whose work it is, where the paste may name people: the name as pasted, the one person it matched, or why the owner
   * is Unknown — no name, no one, or more than one (V491: past work may be saved with an Unknown owner, never a guess).
   */
  person: { name: string; id: string | null; unknown: OwnerUnknown | null } | null;
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
  /**
   * Riyadh's today (`YYYY-MM-DD`, D20): a past entry may be dated any day from 1 January 2025 (V506) up to it, never
   * after (V400).
   */
  today: string;
  /** The report the paste comes from (V506): an undated row takes its last day (V504). Without it a date is needed. */
  source?: SourceReport | null;
  choices: readonly Choice[];
  /** The status a task row without one takes (Done: past work is mostly finished); achievements have none. */
  defaultKind?: string | null;
  /** The categories that carry a deal value (V502, V505): only these take a `value`. */
  valueKinds?: readonly string[];
  /** The organisations already looked up by name; a name not yet looked up is "checking". */
  organisations: ReadonlyMap<string, OrgMatch>;
  /**
   * The people already looked up by name (OLD-059), when the paste may name them; a name not yet looked up is
   * "checking". Without it the person column is not read and every row is the signed-in person's own.
   */
  people?: ReadonlyMap<string, PersonMatch>;
  /**
   * Which rows' keys the database already holds (OLD-PRF-045): `true` is saved before, `false` is new, a key not yet
   * asked is "checking". Without it only repeats inside the paste are caught. A held key may come with what its deal
   * value is and where it came from (`HeldKey`), so a row from a newer report can say it updates it (V502).
   */
  saved?: ReadonlyMap<string, boolean | HeldKey>;
}

/**
 * What the database holds under a key, as far as the deal value goes (V502): its amount, and where that came from — the
 * report it was read from, `typed` when a person typed it (a report never replaces that), or null when it is blank.
 */
export interface HeldKey {
  amount: number | null;
  from: SourceReport | 'typed' | null;
}

/** Whether saving a row with this value updates the held row instead of leaving it out — the database's rule (V502). */
export function updatesHeld(held: HeldKey, value: number | null, source: SourceReport | null | undefined): boolean {
  if (value === null || !source || value === held.amount) return false;
  if (held.amount === null) return true;
  return held.from !== null && held.from !== 'typed' && reportIsNewer(source, held.from);
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
  value: [
    'value',
    'deal value',
    'value (sar)',
    'value sar',
    'amount',
    'sar',
    'القيمة',
    'قيمة الصفقة',
    'المبلغ',
    'قيمة العقد',
  ],
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
  // `value` has a column only where the screen offers it, so a mapping remembered before it existed still fits.
  const columns = Object.fromEntries(
    FIELDS.filter((f) => f !== 'value' || fields.includes('value')).map((f) => [f, null]),
  ) as Record<Field, number | null>;
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

/**
 * An amount in SAR as a sheet has it (V502): Latin, Arabic-Indic or Eastern digits, thousands separators of either
 * script, a decimal point of either, at most two decimals (the database keeps numeric(14,2)), never negative. A
 * trailing SAR or ريال is ignored. Null when it is not an amount — never a guess.
 */
export function readAmount(cell: string): number | null {
  const plain = cell
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/(?:sar|ريال|ر\.\s?س)/gi, '')
    .replace(/[\s\u00a0,٬]/g, '')
    .replace('٫', '.');
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(plain)) return null;
  return Number(plain);
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

    // An undated row takes the report's last day (V504); a date in the sheet is always read as the sheet has it.
    const dateCell = at(row, 'happened_on');
    const reportDay = !dateCell && o.source ? periodLastDay(o.source.period) : null;
    const date = reportDay ? { day: reportDay } : readDay(dateCell, o.mapping.dateOrder);
    const happenedOn = 'day' in date ? date.day : null;
    if ('problem' in date) problems.push(date.problem);
    else if (date.day > o.today) problems.push('date_in_future');
    else if (date.day < PAST_WORK_FROM) problems.push('date_before_start');

    const kindCell = at(row, 'kind');
    let kind: string | null = null;
    if (kindCell) {
      kind = choose(kindCell, o.choices);
      if (!kind) problems.push('kind_unknown');
    } else if (o.mode === 'tasks' && o.defaultKind) kind = o.defaultKind;
    else problems.push('kind_missing');

    // A deal value (V502): achievements only, and only a category that has one — never read for a task.
    let value: number | null = null;
    const valueCell = o.mode === 'achievements' ? at(row, 'value') : '';
    if (valueCell) {
      value = readAmount(valueCell);
      if (value === null) problems.push('value_unreadable');
      else if (kind && !(o.valueKinds ?? []).includes(kind)) problems.push('value_not_allowed');
    }

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
    // beat nicknames and e-mail prefixes, exactly one match or none). Every other answer — no name, no one, more than
    // one — leaves the owner Unknown for a manager to assign (V491), never a guess; a name not yet answered waits.
    let person: PastRow['person'] = null;
    if (o.people && columns.person !== null && columns.person !== undefined) {
      const name = at(row, 'person');
      const match = name ? o.people.get(name) : undefined;
      if (name && !match) problems.push('person_checking');
      const unknown: OwnerUnknown | null = !name
        ? 'missing'
        : match?.kind === 'none' || match?.kind === 'many'
          ? match.kind
          : null;
      person = { name, id: match?.kind === 'one' ? match.id : null, unknown };
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
    // Held already: left out as saved before — unless it brings a deal value from a newer report (V502), which the
    // database then writes over the older, keeping that in the change log.
    let updatesSaved = false;
    if (!problems.length && o.saved) {
      const before = o.saved.get(key);
      if (before === undefined) problems.push('saved_checking');
      else if (typeof before === 'object' && updatesHeld(before, value, o.source)) updatesSaved = true;
      else if (before) problems.push('already_saved');
    }

    return {
      line: start + i + 1,
      title,
      happenedOn,
      dateFromReport: reportDay !== null,
      kind,
      value,
      updatesSaved,
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
  /** The report every row comes from, its evidence (V506), with the last day its undated rows took (V504). */
  source: { kind: SourceReport['kind']; period: string; last_day: string };
  rows: {
    title: string;
    /**
     * The day it happened; **null for a row the report dated** (V504), which the database dates on `source.last_day` and
     * marks as the report's — the flag below says so too, for a server that reads it.
     */
    happened_on: string | null;
    /** The row had no date in the report and took its last day (V504). */
    date_from_report: boolean;
    kind: string;
    /** An achievement's deal value in SAR (V502); sent for achievements only, null when the row has none. */
    value?: number | null;
    organisation_id: string | null;
    notes: string | null;
    /** Whose work; null with `owner_unknown` false is the signed-in person's own. */
    person_id: string | null;
    /** The owner is Unknown (V491): past work a manager assigns later, under Needs an owner. */
    owner_unknown: boolean;
    /** The row's identity (`PastRow.key`): the database keeps one row per key, so a second paste adds nothing. */
    import_key: string;
  }[];
}

/**
 * One request per paste: every row with no problem, and only those (V400), with the report they come from — never
 * without one (V506).
 */
export function toRequest(rows: readonly PastRow[], mode: PastWorkMode, source: SourceReport): BackfillRequest {
  const lastDay = periodLastDay(source.period);
  if (!lastDay) throw new Error(`not a report period: ${source.period}`);
  return {
    mode,
    origin: 'backfill',
    source: { kind: source.kind, period: source.period, last_day: lastDay },
    rows: rows
      .filter((r) => r.problems.length === 0)
      .map((r) => ({
        title: r.title,
        happened_on: r.dateFromReport ? null : r.happenedOn!,
        date_from_report: r.dateFromReport,
        kind: r.kind!,
        ...(mode === 'achievements' ? { value: r.value } : {}),
        organisation_id: r.organisation?.id ?? null,
        notes: r.notes,
        person_id: r.person?.id ?? null,
        owner_unknown: r.person?.unknown != null,
        import_key: r.key,
      })),
  };
}
