// Company, wallet, tender and discount-code figures for the Commercial Workspace.
//
// One place for the money rules decided 4 Nov 2026, so the company page, the
// Finance page and the import all use the same figures. Other workstreams
// (company pages, import engine) should use these helpers instead of writing
// their own copies; if their code already defines the same rules, this module
// is the seam to merge against, not a second truth.
//
// Rules in plain words:
// - Revenue is the invoice amount less any wallet top-up part, and only
//   fully paid invoices count. A wallet top-up on its own earns nothing.
// - Cost is approved expenses only. An expense that is still waiting, or was
//   refused, is not cost. When no approved expense exists, cost is empty
//   (null), never 0, and profit is empty too — 0 would pretend cost is known.
// - Profit is revenue less cost.
// - Direct's Revenue Report column "Total Revenue" is amount less expenses,
//   which is workspace profit, not workspace revenue. Never label it revenue.
// - Wallet balance is top-ups less invoices; available is balance less held.
// - A tender's expected profit is tender amount less expected cost; its
//   actual profit so far is invoiced less approved cost; what is left is
//   tender amount less invoiced. A tender with nothing left is flagged
//   consumed. The page must show expected and actual side by side.
// - Settlement is never shown and never used anywhere here.
// - No VAT anywhere here. Cost means expenses.
// - A discount-code row matches an invoice by the invoice number only, never
//   by a receipt reference and never by a tax number (DPIN/TTIN). Code text
//   is not unique: rows are grouped by code id, not by text.
// - The record date is the creation date.
// - An approved refund is a separate adjustment line. It never rewrites a
//   fully paid invoice amount.

/** Money is kept to two decimal places, so 0.1 + 0.2 style drift never shows. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function cleanWord(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Status words that mean an invoice is fully paid, as written in Direct. */
const FULLY_PAID_WORDS = [
  'invoice - fully paid',
  'fully paid',
  'fully paid + receivables',
  'fully paid (audit required)',
  'fully applied', // receipt wording
  'paid', // preview wording
];

/** Status words that always mean "not fully paid", whatever else the row says. */
const NOT_PAID_MARKERS = ['draft', 'cancelled', 'partially', 'waiting', 'unpaid', 'overdue'];

/**
 * Whether an invoice counts as fully paid. The status word decides, with two
 * guards: money still owed (a positive remaining amount) overrules a paid
 * word, and "Fully Paid - Unpaid" only counts when the remaining amount is
 * exactly 0, because that word on its own contradicts itself. A remaining
 * amount of exactly 0 with no contradicting word also counts, which is how
 * a row that only shows "Remaining 0.00" is read.
 */
export function isFullyPaid(status: string, remaining: number | null): boolean {
  const word = cleanWord(status);
  if (word === 'fully paid - unpaid') return remaining === 0;
  if (remaining !== null && remaining > 0) return false;
  if (NOT_PAID_MARKERS.some((marker) => word.includes(marker))) return false;
  if (FULLY_PAID_WORDS.includes(word)) return true;
  return remaining === 0;
}

/** Whether an invoice is waiting to be issued (provisional): it exists inside Direct but is not a tax invoice yet. */
export function isWaitingForIssuing(status: string): boolean {
  const word = cleanWord(status);
  return word.includes('waiting for issuing') || word === 'provisional' || word.includes('waiting for issuance');
}

/** The two flags a waiting-for-issuing invoice carries: its cost is still pending, and it is still waiting. */
export function waitingFlags(status: string): { costPending: boolean; waitingForIssuing: boolean } {
  const waiting = isWaitingForIssuing(status);
  return { costPending: waiting, waitingForIssuing: waiting };
}

export type Expense = { status: string; amount: number };

/** Approved expenses only; null when no approved expense exists (empty, never 0). */
export function approvedCost(expenses: Expense[]): number | null {
  const approved = expenses.filter((e) => cleanWord(e.status) === 'approved');
  if (approved.length === 0) return null;
  return round2(approved.reduce((sum, e) => sum + e.amount, 0));
}

export type PilotInvoice = {
  /** The 10-digit invoice number, or null when the invoice number is not known yet. */
  invoiceNumber: string | null;
  amount: number;
  /** The wallet top-up part inside the amount; 0 when the invoice holds no top-up. */
  walletTopup: number;
  status: string;
  /** Money still owed on the invoice, or null when it is not known. */
  remaining: number | null;
  expenses: Expense[];
  /** Transaction numbers grouped under this invoice; empty when none are linked yet. */
  transactionNumbers: string[];
};

/** Revenue of one invoice: amount less wallet top-up, only when fully paid; otherwise null (not counted). */
export function revenueOf(invoice: PilotInvoice): number | null {
  if (!isFullyPaid(invoice.status, invoice.remaining)) return null;
  return round2(invoice.amount - invoice.walletTopup);
}

/** Cost of one invoice: its approved expenses only; null when it has none approved. */
export function costOf(invoice: PilotInvoice): number | null {
  return approvedCost(invoice.expenses);
}

/** Profit of one invoice: revenue less cost; null when either side is unknown. */
export function profitOf(invoice: PilotInvoice): number | null {
  const revenue = revenueOf(invoice);
  const cost = costOf(invoice);
  if (revenue === null || cost === null) return null;
  return round2(revenue - cost);
}

/** Money received on one invoice: amount less what is still owed; null when what is owed is not known. */
export function receivedOf(invoice: PilotInvoice): number | null {
  if (invoice.remaining === null) return null;
  return round2(invoice.amount - invoice.remaining);
}

export type CompanyFigures = {
  /** Sum of fully paid revenue; 0 only when no fully paid invoice exists is still a sum, so this stays a number. */
  revenue: number;
  /** Sum of approved cost, or null when no counted invoice has an approved expense (empty, never 0). */
  cost: number | null;
  /** Revenue less cost, or null when cost is empty. */
  profit: number | null;
  countedInvoices: number;
  skippedInvoices: number;
  /** Money received, summed only over invoices whose remaining amount is known. */
  received: number;
  /** Money still owed, summed only over invoices whose remaining amount is known. */
  remaining: number;
  /** Invoices whose remaining amount is not known, so received/remaining above are partial. */
  unknownRemaining: number;
};

/** Company roll-up over its invoices. Only fully paid invoices feed revenue; cost stays empty, never 0. */
export function companyFigures(invoices: PilotInvoice[]): CompanyFigures {
  let revenue = 0;
  let cost: number | null = null;
  let counted = 0;
  let skipped = 0;
  let received = 0;
  let remaining = 0;
  let unknownRemaining = 0;
  for (const invoice of invoices) {
    const rev = revenueOf(invoice);
    if (rev === null) {
      skipped += 1;
    } else {
      counted += 1;
      revenue = round2(revenue + rev);
      const c = costOf(invoice);
      if (c !== null) cost = round2((cost ?? 0) + c);
    }
    const rec = receivedOf(invoice);
    if (rec === null) {
      unknownRemaining += 1;
    } else {
      received = round2(received + rec);
      remaining = round2(remaining + (invoice.remaining ?? 0));
    }
  }
  return {
    revenue: round2(revenue),
    cost,
    profit: cost === null ? null : round2(revenue - cost),
    countedInvoices: counted,
    skippedInvoices: skipped,
    received: round2(received),
    remaining: round2(remaining),
    unknownRemaining,
  };
}

export type WalletInput = { topups: number; invoices: number; held: number };
export type WalletFigures = { balance: number; available: number };

/** Wallet arithmetic: balance is top-ups less invoices; available is balance less held. */
export function walletFigures(input: WalletInput): WalletFigures {
  const balance = round2(input.topups - input.invoices);
  return { balance, available: round2(balance - input.held) };
}

export type TenderInput = { tenderAmount: number; expectedCogs: number; invoicedTotal: number; approvedCogs: number };
export type TenderFigures = {
  expectedGp: number;
  actualGp: number;
  remaining: number;
  /** True when nothing is left on the tender. A flag only: nothing here blocks new work. */
  consumed: boolean;
};

/** Tender figures: expected and actual profit side by side, what is left, and the consumed flag. */
export function tenderFigures(input: TenderInput): TenderFigures {
  const remaining = round2(input.tenderAmount - input.invoicedTotal);
  return {
    expectedGp: round2(input.tenderAmount - input.expectedCogs),
    actualGp: round2(input.invoicedTotal - input.approvedCogs),
    remaining,
    consumed: remaining <= 0,
  };
}

export type DirectReportRow = {
  /** What Direct's Revenue Report calls "Total Revenue": amount less expenses. That is workspace profit. */
  reportTotalRevenue: number;
  workspaceRevenue: number;
  workspaceProfit: number;
};

/**
 * The Revenue Report label trap, in one place: Direct's "Total Revenue" value
 * equals workspace profit, not workspace revenue. Any import or page that
 * reads that column as revenue understates revenue by exactly the cost.
 */
export function directReportRow(amount: number, walletTopup: number, expenses: number): DirectReportRow {
  const workspaceRevenue = round2(amount - walletTopup);
  return {
    reportTotalRevenue: round2(amount - expenses),
    workspaceRevenue,
    workspaceProfit: round2(workspaceRevenue - expenses),
  };
}

export type DiscountRow = {
  codeId: string;
  codeText: string;
  /** The invoice number this row claims to belong to. Only this field is ever matched on. */
  invoiceNumber: string;
  discount: number;
};

export type DiscountMatch = {
  matched: { invoiceNumber: string; totalDiscount: number; codeIds: string[] }[];
  /** Rows whose invoice number matches no invoice. A row that only matches a receipt reference lands here. */
  unmatched: DiscountRow[];
};

/**
 * Discount matching by invoice number only. The function never sees a receipt
 * reference or a tax number, so a 10-digit number that is both a transaction
 * receipt reference and some other record's invoice number can only match
 * through the invoice number. Rows that match nothing are returned unmatched,
 * never dropped silently.
 */
export function matchDiscounts(invoices: PilotInvoice[], rows: DiscountRow[]): DiscountMatch {
  const invoiceNumbers = new Set(invoices.map((i) => i.invoiceNumber).filter((n): n is string => !!n));
  const totals = new Map<string, { totalDiscount: number; codeIds: Set<string> }>();
  const unmatched: DiscountRow[] = [];
  for (const row of rows) {
    if (!invoiceNumbers.has(row.invoiceNumber)) {
      unmatched.push(row);
      continue;
    }
    const entry = totals.get(row.invoiceNumber) ?? { totalDiscount: 0, codeIds: new Set<string>() };
    entry.totalDiscount = round2(entry.totalDiscount + row.discount);
    entry.codeIds.add(row.codeId);
    totals.set(row.invoiceNumber, entry);
  }
  return {
    matched: [...totals.entries()].map(([invoiceNumber, entry]) => ({
      invoiceNumber,
      totalDiscount: entry.totalDiscount,
      codeIds: [...entry.codeIds],
    })),
    unmatched,
  };
}

export type CodeGroup = {
  codeId: string;
  codeText: string;
  totalDiscount: number;
  uses: number;
  invoiceNumbers: string[];
};

/** Discount rows grouped by code id. Same text under two ids stays two groups: text is not unique. */
export function groupCodes(rows: DiscountRow[]): CodeGroup[] {
  const groups = new Map<string, CodeGroup>();
  for (const row of rows) {
    const group = groups.get(row.codeId) ?? {
      codeId: row.codeId,
      codeText: row.codeText,
      totalDiscount: 0,
      uses: 0,
      invoiceNumbers: [],
    };
    group.totalDiscount = round2(group.totalDiscount + row.discount);
    group.uses += 1;
    if (!group.invoiceNumbers.includes(row.invoiceNumber)) group.invoiceNumbers.push(row.invoiceNumber);
    groups.set(row.codeId, group);
  }
  return [...groups.values()];
}

/** Codes sorted by total discount, largest first, as the Codes page sorts them. */
export function sortCodesByTotalDiscount(groups: CodeGroup[]): CodeGroup[] {
  return [...groups].sort((a, b) => b.totalDiscount - a.totalDiscount);
}

export type NumberedRecord = { transactionNumber: string | null; invoiceNumber: string | null };

/** Which numbers a record is still missing, in plain words, for the flagged display. */
export function missingNumbers(record: NumberedRecord): string[] {
  const missing: string[] = [];
  if (!record.transactionNumber) missing.push('transaction number');
  if (!record.invoiceNumber) missing.push('invoice number');
  return missing;
}

/**
 * Progressive fill: a later import fills only the numbers that are still
 * missing. A number already on the record is never overwritten, and numbers
 * are never invented. Returns the filled record and what it filled, so the
 * caller can clear exactly those flags.
 */
export function fillMissing(
  existing: NumberedRecord,
  incoming: NumberedRecord,
): { record: NumberedRecord; filled: string[] } {
  const record = { ...existing };
  const filled: string[] = [];
  if (!record.transactionNumber && incoming.transactionNumber) {
    record.transactionNumber = incoming.transactionNumber;
    filled.push('transaction number');
  }
  if (!record.invoiceNumber && incoming.invoiceNumber) {
    record.invoiceNumber = incoming.invoiceNumber;
    filled.push('invoice number');
  }
  return { record, filled };
}

export type Refund = { status: string; amount: number };

/** Approved refunds only, summed as one separate adjustment line. */
export function approvedRefundTotal(refunds: Refund[]): number {
  return round2(refunds.filter((r) => cleanWord(r.status) === 'approved').reduce((sum, r) => sum + r.amount, 0));
}

export type ProfitAfterRefund = {
  profitBeforeRefund: number | null;
  refundAdjustment: number;
  profitAfterRefund: number | null;
};

/**
 * An approved refund sits as its own line under profit. It never rewrites
 * the fully paid invoice amount, and when profit itself is empty (cost still
 * missing), the after-refund figure stays empty too.
 */
export function applyRefundLine(profit: number | null, refunds: Refund[]): ProfitAfterRefund {
  const refundAdjustment = approvedRefundTotal(refunds);
  return {
    profitBeforeRefund: profit,
    refundAdjustment,
    profitAfterRefund: profit === null ? null : round2(profit - refundAdjustment),
  };
}
