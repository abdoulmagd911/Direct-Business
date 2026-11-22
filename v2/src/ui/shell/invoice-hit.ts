// An invoice the top search found by its number (api.search → `invoices`; Landing 37, Finance F-C). The search has
// answered invoices since V458, and the palette never drew them: a number typed into the search box said "Nothing
// matches" even for an invoice that was there. No invoice has a page of its own, so a hit opens the Finance Ledger on
// the invoice's own day — on the part of the Ledger the invoice is listed in.

export type InvoiceHit = {
  invoice_id: string;
  ref: string;
  kind?: string | null;
  customer_name?: string | null;
  created_on?: string | null;
  total_sar?: number | null;
  /** The status word as recorded (Pending, Draft, Fully Paid …). */
  status?: string | null;
  /** What the word means for counting: only `paid` counts. */
  pay_state?: string | null;
  source?: 'manual' | 'import' | null;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True when the hit is in the figures: a hit that does not say is not called uncounted. */
export const invoiceHitCounts = (h: Pick<InvoiceHit, 'pay_state'>): boolean =>
  h.pay_state === undefined || h.pay_state === null || h.pay_state === 'paid';

/**
 * Where a hit opens: the Finance Ledger for the invoice's own day. One that is not fully paid yet is listed under
 * "Not yet counted", so the address points there; a counted one is among the Ledger's rows.
 */
export function invoiceHitRoute(h: Pick<InvoiceHit, 'created_on' | 'pay_state'>): string {
  const anchor = invoiceHitCounts(h) ? '#finance-ledger' : '#finance-ledger-waiting';
  const day = h.created_on && DAY.test(h.created_on) ? h.created_on : null;
  return day ? `/finance?period=custom&from=${day}&to=${day}${anchor}` : `/finance${anchor}`;
}

/** The hits of an answer, as far as they can be drawn: a hit with no number is no hit. */
export function invoiceHitsOf(answer: unknown, limit = 8): InvoiceHit[] {
  const list = (answer as { invoices?: unknown } | null)?.invoices;
  if (!Array.isArray(list)) return [];
  return (list as InvoiceHit[])
    .filter((h) => h && typeof h.ref === 'string' && h.ref !== '' && typeof h.invoice_id === 'string')
    .slice(0, limit);
}
