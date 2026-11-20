// The Finance ledger's address and export (workstream B): pure helpers, so the page, the saved views and the
// Discount Codes page all build the same address and the same file from the same filtered view — never two
// divergent copies. The Codes page reuses the report itself (FinanceReport); it only fixes `code` in the filter.

import type { LedgerFilter, LedgerReport, LedgerRow } from './types';

export const LEDGER_KINDS = ['transaction', 'standalone', 'billing', 'credit_note', 'wallet_topup'] as const;

/** The filter as the address carries it: empty values are left out, so a saved view never stores an empty box. */
export function ledgerFilterQuery(f: LedgerFilter): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.partner) out.company = f.partner;
  if (f.clientId) out.client = f.clientId;
  if (f.kind) out.kind = f.kind;
  if (f.code) out.code = f.code;
  return out;
}

/** The filter an address asks for; anything unreadable is no filter, never an error page. */
export function ledgerFilterFromQuery(q: {
  company?: string;
  client?: string;
  kind?: string;
  code?: string;
}): LedgerFilter {
  const kind = (LEDGER_KINDS as readonly string[]).includes(q.kind ?? '')
    ? (q.kind as LedgerFilter['kind'])
    : undefined;
  return {
    ...(q.company ? { partner: q.company } : {}),
    ...(q.client ? { clientId: q.client } : {}),
    ...(kind ? { kind } : {}),
    ...(q.code ? { code: q.code } : {}),
  };
}

/** The read's arguments for a filter and a period: only values that are set are sent. */
export function ledgerReadArgs(
  f: LedgerFilter,
  from: string,
  to: string,
): {
  p_from: string;
  p_to: string;
  p_partner?: string;
  p_client_id?: string;
  p_kind?: string;
  p_code?: string;
} {
  return {
    p_from: from,
    p_to: to,
    ...(f.partner ? { p_partner: f.partner } : {}),
    ...(f.clientId ? { p_client_id: f.clientId } : {}),
    ...(f.kind ? { p_kind: f.kind } : {}),
    ...(f.code ? { p_code: f.code } : {}),
  };
}

/** True when two filters ask for the same view (saved views compare on this, not on box order). */
export function sameLedgerFilter(a: LedgerFilter, b: LedgerFilter): boolean {
  return JSON.stringify(ledgerFilterQuery(a)) === JSON.stringify(ledgerFilterQuery(b));
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A ledger row counts unless the read says it does not (Landing 32: the ledger lists the rows left out, too). */
export const isCounted = (r: { counted?: boolean }): boolean => r.counted !== false;

/**
 * The filtered view as a file: the unit rows first (the view itself), then one totals line. A cost with no
 * approved expense stays empty in the file, never 0 — the same rule as on screen. Only rows that count are filed:
 * the totals line is over counted rows, so a row left out by an exclusion never sits above a total it is not in.
 */
export function ledgerRowsToCsv(
  report: LedgerReport,
  headers: {
    created: string;
    company: string;
    transaction: string;
    invoice: string;
    kind: string;
    source: string;
    revenue: string;
    cost: string;
    profit: string;
    dpin: string;
    flags: string;
    total: string;
  },
  companyName: (partnerId: string | null) => string,
): string {
  const lines: string[] = [
    [
      headers.created,
      headers.company,
      headers.transaction,
      headers.invoice,
      headers.kind,
      // every row carries its source after its kind: without this heading every later column sat under the wrong name
      headers.source,
      headers.revenue,
      headers.cost,
      headers.profit,
      headers.dpin,
      headers.flags,
    ]
      .map(csvCell)
      .join(','),
  ];
  const money = (n: number | null) => (n === null ? '' : String(Math.round(n * 100) / 100));
  for (const r of (report.rows as LedgerRow[]).filter(isCounted)) {
    lines.push(
      [
        r.created_on,
        companyName(r.partner_id),
        r.transaction_number,
        r.invoice_number,
        r.unit_kind,
        r.source ?? '',
        money(r.revenue),
        money(r.cost),
        money(r.profit),
        r.dpin,
        r.flags.join(' '),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  const t = report.totals;
  lines.push(
    [headers.total, '', '', '', '', '', money(t.revenue), money(t.cost), money(t.profit), '', '']
      .map(csvCell)
      .join(','),
  );
  return lines.join('\n');
}

/**
 * Whether the ledger (and "Is it counted?" under it) may ask its read: it waits only while the figures above are still
 * on their way, so the tiles are asked first. A figures read that FAILED never holds it (Landing 34): held until the
 * figures were ready, the ledger sat on "Loading" for good after a failed first load, with no Try again of its own.
 */
export const ledgerMayAsk = (figures: 'loading' | 'ready' | 'failed'): boolean => figures !== 'loading';

/** The parts of the page a phone keeps in the Ledger view: an address that points at one of them opens that view. */
export const opensLedgerView = (hash: string): boolean => /^#finance-(ledger|counted|company)/.test(hash);
