import type { ExportColumn, PageFetcher } from '@/core/export';

/**
 * A made-up list (rule 7: Test Co names, INV-T numbers, made-up amounts) and a stand-in for the API that answers it
 * the way PostgREST does: at most `cap` rows a request, whatever was asked, and the exact count on request.
 */
export type SampleRow = {
  id: string;
  partner: string;
  number: string;
  status: 'open' | 'done' | 'late';
  amount: number;
  share: number | null;
  due: string;
  updatedAt: string;
  paid: boolean;
  roles: string[];
};

const STATUSES: SampleRow['status'][] = ['open', 'done', 'late'];

export function sampleRows(n: number): SampleRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${String(i + 1).padStart(5, '0')}`,
    partner: `Test Co ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`,
    number: `INV-T-${String(i + 1).padStart(4, '0')}`,
    status: STATUSES[i % STATUSES.length]!,
    amount: ((i * 7919) % 250000) + 0.5,
    share: i % 10 === 0 ? null : (i % 1000) / 10,
    due: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    // 21:30 UTC is 00:30 the next day in Riyadh — the case a UTC date would get wrong.
    updatedAt: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T21:30:00.000Z`,
    paid: i % 2 === 0,
    roles: i % 4 === 0 ? ['Supplier', 'Client'] : ['Client'],
  }));
}

export const sampleColumns: ExportColumn<SampleRow>[] = [
  { key: 'number', header: 'Invoice', kind: 'id', value: (r) => r.number },
  { key: 'partner', header: 'Partner', kind: 'text', value: (r) => r.partner },
  { key: 'status', header: 'Status', kind: 'text', value: (r) => r.status },
  { key: 'amount', header: 'Amount (SAR)', kind: 'money', value: (r) => r.amount },
  { key: 'share', header: 'Share', kind: 'percent', value: (r) => r.share },
  { key: 'due', header: 'Due', kind: 'date', value: (r) => r.due },
  { key: 'updated', header: 'Updated', kind: 'datetime', value: (r) => r.updatedAt },
  { key: 'paid', header: 'Paid', kind: 'boolean', value: (r) => r.paid },
  { key: 'roles', header: 'Roles', kind: 'text', value: (r) => r.roles },
];

export interface StandIn<T> {
  page: PageFetcher<T>;
  /** Every range asked for, in order. */
  asked: [number, number][];
}

/**
 * The API stand-in: filters (the list's chips), answers `rows.slice(from, min(to + 1, from + cap))` — PostgREST's
 * max-rows — and the exact count when `count` is on.
 */
export function standIn<T>(
  rows: readonly T[],
  opts: { cap?: number; count?: boolean; where?: (r: T) => boolean } = {},
): StandIn<T> {
  const cap = opts.cap ?? 1000;
  const asked: [number, number][] = [];
  const page: PageFetcher<T> = async (from, to) => {
    asked.push([from, to]);
    const list = opts.where ? rows.filter(opts.where) : rows;
    const data = list.slice(from, Math.min(to + 1, from + cap));
    return { data, error: null, count: opts.count ? list.length : null };
  };
  return { page, asked };
}

/** An RFC 4180 reader for the tests: quoted fields, doubled quotes, CRLF — enough to count and read rows back. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
