// The Fully Paid gate (owner decisions, 4 Nov 2026). Only wordings that mean fully paid
// count. Everything else is either ignored by rule or held for a person — never guessed.
//
// Counts: Invoice - Fully Paid, Fully Paid, Fully Paid + Receivables,
// Fully Paid (Audit Required), receipt Fully Applied, preview Paid, Remaining 0.00.
// Ignored: Draft, Cancelled, Partially (paid or settled), Waiting (including Waiting for
// Issuing and Issued - Waiting for Settlement), Unpaid, Overdue, Void.
// "Fully Paid - Unpaid" counts ONLY with a Remaining check of 0.00; without it, ignored.
// A status nobody has named is held: outcome 'unknown', never counted, never silently
// dropped — the review screen shows it with a plain reason.

import { whyText, type Why } from './reasons';

export type PaidVerdict = {
  outcome: 'counts' | 'ignored' | 'unknown';
  /** True for Fully Paid (Audit Required): counts, and is flagged for audit. */
  auditRequired: boolean;
  /** Plain reason, in English words (what is stored); the review screen words `why` in the person's language. */
  reason: string;
  why: Why;
};

/** A verdict with its reason: the sentence is made from the code (reasons.ts), so the two never differ. */
const verdict = (outcome: PaidVerdict['outcome'], auditRequired: boolean, why: Why): PaidVerdict => ({
  outcome,
  auditRequired,
  reason: whyText(why),
  why,
});

function normaliseStatus(status: unknown): string {
  return String(status ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const COUNTS = new Set([
  'invoice - fully paid',
  'fully paid',
  'fully paid + receivables',
  'fully paid (audit required)',
  'paid',
  'fully applied',
]);

const IGNORED = new Set([
  'draft',
  'cancelled',
  'canceled',
  'void',
  'voided',
  'partially paid',
  'partially settled',
  'partially',
  'waiting',
  'waiting for issuing',
  'waiting for issuance',
  'waiting for settlement',
  'issued - waiting for settlement',
  'issued-waiting for settlement',
  'issued waiting for settlement',
  'unpaid',
  'overdue',
  'pending',
  'pending payment',
]);

export function fullyPaidVerdict(status: unknown, remaining: number | null): PaidVerdict {
  const text = normaliseStatus(status);
  if (COUNTS.has(text)) return verdict('counts', text === 'fully paid (audit required)', { code: 'paid' });
  if (IGNORED.has(text)) {
    return verdict('ignored', false, { code: 'paid_not', values: { status: String(status ?? '').trim() } });
  }
  if (text === 'fully paid - unpaid') {
    if (remaining === 0) return verdict('counts', false, { code: 'paid_nothing_left' });
    return verdict('ignored', false, { code: 'paid_and_unpaid' });
  }
  // Remaining 0.00 with a status that is not on the ignored list counts: the row is paid
  // in full even when its status words do not say so plainly.
  if (remaining === 0) return verdict('counts', false, { code: 'paid_nothing_left' });
  if (text === '') return verdict('unknown', false, { code: 'no_status' });
  return verdict('unknown', false, { code: 'status_unknown', values: { status: String(status ?? '').trim() } });
}

/** An expense line counts as cost only when its Status is exactly Approved. */
export function isApprovedExpense(status: unknown): boolean {
  return normaliseStatus(status) === 'approved';
}
