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

export type PaidVerdict = {
  outcome: 'counts' | 'ignored' | 'unknown';
  /** True for Fully Paid (Audit Required): counts, and is flagged for audit. */
  auditRequired: boolean;
  /** Plain reason, in words, for the review screen. */
  reason: string;
};

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
  if (COUNTS.has(text)) {
    return {
      outcome: 'counts',
      auditRequired: text === 'fully paid (audit required)',
      reason: 'Fully paid',
    };
  }
  if (IGNORED.has(text)) {
    return { outcome: 'ignored', auditRequired: false, reason: `Not fully paid: ${String(status ?? '').trim()}` };
  }
  if (text === 'fully paid - unpaid') {
    if (remaining === 0) {
      return { outcome: 'counts', auditRequired: false, reason: 'Fully paid: nothing remaining' };
    }
    return {
      outcome: 'ignored',
      auditRequired: false,
      reason: 'Says fully paid and unpaid, with no remaining of 0.00 to settle it: not counted',
    };
  }
  // Remaining 0.00 with a status that is not on the ignored list counts: the row is paid
  // in full even when its status words do not say so plainly.
  if (remaining === 0) {
    return { outcome: 'counts', auditRequired: false, reason: 'Fully paid: nothing remaining' };
  }
  if (text === '') {
    return { outcome: 'unknown', auditRequired: false, reason: 'No status written: held for a person' };
  }
  return {
    outcome: 'unknown',
    auditRequired: false,
    reason: `Status "${String(status ?? '').trim()}" is not named yet: held for a person`,
  };
}

/** An expense line counts as cost only when its Status is exactly Approved. */
export function isApprovedExpense(status: unknown): boolean {
  return normaliseStatus(status) === 'approved';
}
