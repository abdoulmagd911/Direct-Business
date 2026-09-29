import type { PastWorkLabels } from '@/ui/grid/PastWorkGrid';
import type { Choice, OrgMatch, PersonMatch } from '@/ui/grid/rows';

/** Made-up past work (rule 7: Test Co names, made-up tasks) and the lookups a screen would give the grid. */
export const TODAY = '2026-09-29';

export const STATUSES: Choice[] = [
  { key: 'not_started', en: 'Not started', ar: 'لم تبدأ' },
  { key: 'in_progress', en: 'In progress', ar: 'قيد التنفيذ' },
  { key: 'done', en: 'Done', ar: 'منجزة' },
  { key: 'cancelled', en: 'Cancelled', ar: 'ملغاة' },
];

export const CATEGORIES: Choice[] = [
  { key: 'contract', en: 'Contracts and agreements', ar: 'العقود والاتفاقيات' },
  { key: 'cost_saving', en: 'Cost savings', ar: 'وفورات التكلفة' },
];

export const ORGS = new Map<string, OrgMatch>([
  ['Test Co A', { kind: 'one', id: '00000000-0000-4000-8000-00000000000a' }],
  ['Test Co B', { kind: 'one', id: '00000000-0000-4000-8000-00000000000b' }],
  ['Sample Travel', { kind: 'many' }],
  ['Nobody Known', { kind: 'none' }],
]);

/**
 * What the database answers for pasted person names (OLD-059) — its rule, not the grid's: a real name, a nickname or an
 * e-mail prefix that fits exactly one person, or none, or more than one. Made-up people (rule 7).
 */
export const PEOPLE = new Map<string, PersonMatch>([
  ['Test Person One', { kind: 'one', id: '00000000-0000-4000-8000-0000000000c1' }],
  ['tp.two', { kind: 'one', id: '00000000-0000-4000-8000-0000000000c2' }],
  ['Tester', { kind: 'many' }],
  ['Test Persn One', { kind: 'none' }],
]);

/** The grid's words, as a screen's catalog gives them. */
export const LABELS: PastWorkLabels = {
  pasteHere: 'Paste rows from Excel or Google Sheets',
  hasHeader: 'The first row holds the headers',
  fields: {
    title: 'Title',
    happened_on: 'Date',
    kind: 'Status',
    organisation: 'Organisation',
    notes: 'Notes',
    person: 'Person',
  },
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
    person_missing: 'Whose work is it?',
    person_unknown: 'No one on the team has this name',
    person_ambiguous: 'More than one person has this name',
    person_checking: 'Checking the name',
    repeated: 'The same row twice',
    already_saved: 'Saved before',
    saved_checking: 'Checking whether it was saved before',
  },
  summary: (r, x) => `${r} rows ready · ${x} refused`,
  save: (n) => `Save ${n} rows`,
  saved: (n) => `${n} rows saved as past work`,
  undo: 'Undo',
  failed: 'Could not save',
};

/** A pasted block as Excel puts it on the clipboard: tabs, CRLF, a closing line break. */
export function excelPaste(rows: string[][]): string {
  const cell = (c: string) => (/[\t\n"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return rows.map((r) => r.map(cell).join('\t')).join('\r\n') + '\r\n';
}

/** Twenty made-up rows of past tasks under a header, dated through September 2026, day first. */
export function twentyTasks(): string[][] {
  return [
    ['Title', 'Date', 'Status', 'Partner', 'Notes'],
    ...Array.from({ length: 20 }, (_, i) => [
      `Follow up the made-up offer ${i + 1}`,
      `${String(i + 1).padStart(2, '0')}/09/2026`,
      i % 3 === 0 ? 'In progress' : 'Done',
      i % 2 ? 'Test Co A' : 'Test Co B',
      i === 4 ? 'Called twice;\nsent the "final" terms' : '',
    ]),
  ];
}
