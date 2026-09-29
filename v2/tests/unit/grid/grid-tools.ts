import type { Choice, OrgMatch } from '@/ui/grid/rows';

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
