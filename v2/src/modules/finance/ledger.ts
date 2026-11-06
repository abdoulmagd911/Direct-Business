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
  if (f.project) out.project = f.project;
  return out;
}

/** The filter an address asks for; anything unreadable is no filter, never an error page. */
export function ledgerFilterFromQuery(q: {
  company?: string;
  client?: string;
  kind?: string;
  code?: string;
  project?: string;
}): LedgerFilter {
  const kind = (LEDGER_KINDS as readonly string[]).includes(q.kind ?? '')
    ? (q.kind as LedgerFilter['kind'])
    : undefined;
  return {
    ...(q.company ? { partner: q.company } : {}),
    ...(q.client ? { clientId: q.client } : {}),
    ...(kind ? { kind } : {}),
    ...(q.code ? { code: q.code } : {}),
    ...(q.project ? { project: q.project } : {}),
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
  p_project?: string;
} {
  return {
    p_from: from,
    p_to: to,
    ...(f.partner ? { p_partner: f.partner } : {}),
    ...(f.clientId ? { p_client_id: f.clientId } : {}),
    ...(f.kind ? { p_kind: f.kind } : {}),
    ...(f.code ? { p_code: f.code } : {}),
    ...(f.project ? { p_project: f.project } : {}),
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

/**
 * The filtered view as a file: the unit rows first (the view itself), then one totals line. A cost with no
 * approved expense stays empty in the file, never 0 — the same rule as on screen.
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
  for (const r of report.rows as LedgerRow[]) {
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
