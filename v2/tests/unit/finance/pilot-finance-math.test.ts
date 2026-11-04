// Workstream E pilot checks: the finance rules decided 4 Nov 2026, tested
// against TEST pilot fixtures only. These tests pin the shared helpers in
// finance-math.ts; company pages and the import engine must use those
// helpers (or merge with them) rather than re-implementing the rules, so a
// fix in one place fixes every page.

import { describe, expect, it } from 'vitest';
import {
  applyRefundLine,
  approvedCost,
  companyFigures,
  costOf,
  directReportRow,
  fillMissing,
  groupCodes,
  isFullyPaid,
  isWaitingForIssuing,
  matchDiscounts,
  missingNumbers,
  profitOf,
  revenueOf,
  sortCodesByTotalDiscount,
  tenderFigures,
  waitingFlags,
  walletFigures,
  type PilotInvoice,
} from '@/modules/finance/finance-math';
import {
  betaApprovedRefund,
  betaGroupedInvoice,
  filledRecord,
  filledRecordArrival,
  gammaConsumedTender,
  gammaTender,
  missingInvoiceArrival,
  missingInvoiceRecord,
  pilotCompanies,
  pilotDiscountRows,
  receiptRefCollision,
  testAlphaTrading,
  testBetaContracting,
  testGammaProjects,
} from './pilot-fixtures';

const allPilotInvoices: PilotInvoice[] = pilotCompanies.flatMap((c) => c.invoices);

describe('revenue, cost and profit', () => {
  it('counts only fully paid invoices, less any wallet top-up part', () => {
    expect(revenueOf(testAlphaTrading.invoices[1]!)).toBe(800); // 1000 less 200 top-up
    expect(revenueOf(testAlphaTrading.invoices[2]!)).toBeNull(); // partially paid
    expect(revenueOf(testAlphaTrading.invoices[3]!)).toBeNull(); // draft
    expect(revenueOf(testAlphaTrading.invoices[4]!)).toBeNull(); // waiting for issuing
  });

  it('counts approved expenses only; pending expenses are not cost', () => {
    expect(costOf(betaGroupedInvoice)).toBe(1200); // approved 1200; pending 300 ignored
    expect(approvedCost([{ status: 'Pending', amount: 250 }])).toBeNull();
  });

  it('leaves cost and profit empty, never 0, when nothing is approved yet', () => {
    const invoice = testAlphaTrading.invoices[0]!;
    expect(revenueOf(invoice)).toBe(49);
    expect(costOf(invoice)).toBeNull();
    expect(profitOf(invoice)).toBeNull();
  });

  it('rolls a company up with the same gate: cancelled cost never counts', () => {
    const alpha = companyFigures(testAlphaTrading.invoices);
    expect(alpha).toMatchObject({ revenue: 849, cost: 600, profit: 249, countedInvoices: 2, skippedInvoices: 3 });
    expect(alpha).toMatchObject({ received: 1349, remaining: 900, unknownRemaining: 0 });
    const beta = companyFigures(testBetaContracting.invoices);
    expect(beta).toMatchObject({ revenue: 2800, cost: 1700, profit: 1100, countedInvoices: 2, skippedInvoices: 1 });
  });

  it('does not let Direct’s "Total Revenue" column pass as revenue', () => {
    const row = directReportRow(2000, 0, 1200);
    expect(row.reportTotalRevenue).toBe(800);
    expect(row.workspaceRevenue).toBe(2000);
    expect(row.workspaceProfit).toBe(800);
    expect(row.reportTotalRevenue).toBe(row.workspaceProfit);
    expect(row.reportTotalRevenue).not.toBe(row.workspaceRevenue);
  });

  it('keeps an approved refund as its own line and never rewrites the invoice amount', () => {
    const before = profitOf(betaGroupedInvoice);
    expect(before).toBe(800); // 2000 less approved 1200
    const after = applyRefundLine(before, [betaApprovedRefund, { status: 'Pending', amount: 999 }]);
    expect(after).toMatchObject({ profitBeforeRefund: 800, refundAdjustment: 100, profitAfterRefund: 700 });
    expect(betaGroupedInvoice.amount).toBe(2000);
  });
});

describe('wallet arithmetic', () => {
  it('reproduces the TEST company wallet: 1000 less 49 is 951, less 382.90 held is 568.10', () => {
    expect(walletFigures({ topups: 1000, invoices: 49, held: 382.9 })).toEqual({ balance: 951, available: 568.1 });
  });

  it('keeps held money out of what is available', () => {
    expect(walletFigures({ topups: 500, invoices: 100, held: 400 }).available).toBe(0);
  });
});

describe('tender figures', () => {
  it('shows expected and actual profit side by side, plus what is left', () => {
    expect(tenderFigures(gammaTender)).toEqual({
      expectedGp: 20000, // 100,000 less 80,000 expected cost
      actualGp: 15000, // 60,000 invoiced less 45,000 approved cost
      remaining: 40000, // 100,000 less 60,000 invoiced
      consumed: false,
    });
  });

  it('flags a fully used tender as consumed', () => {
    const figures = tenderFigures(gammaConsumedTender);
    expect(figures.remaining).toBe(0);
    expect(figures.consumed).toBe(true);
  });

  it('agrees with the company roll-up on the same tender invoices', () => {
    const gamma = companyFigures(testGammaProjects.invoices);
    expect(gamma.profit).toBe(tenderFigures(gammaTender).actualGp);
  });
});

describe('fully paid gating', () => {
  it.each([
    'Invoice - Fully Paid',
    'Fully Paid',
    'Fully Paid + Receivables',
    'Fully Paid (Audit Required)',
    'Fully Applied',
    'Paid',
  ])('counts "%s" as fully paid', (status) => {
    expect(isFullyPaid(status, 0)).toBe(true);
    expect(isFullyPaid(status, null)).toBe(true);
  });

  it.each([
    'Draft',
    'Cancelled',
    'Partially Paid',
    'Waiting for Settlement',
    'Unpaid',
    'Overdue',
    'Issued - Waiting for Settlement',
    'Waiting for Issuing',
  ])('never counts "%s" as fully paid', (status) => {
    expect(isFullyPaid(status, 0)).toBe(false);
    expect(isFullyPaid(status, null)).toBe(false);
  });

  it('counts "Fully Paid - Unpaid" only when the remaining check passes', () => {
    expect(isFullyPaid('Fully Paid - Unpaid', 0)).toBe(true);
    expect(isFullyPaid('Fully Paid - Unpaid', 50)).toBe(false);
    expect(isFullyPaid('Fully Paid - Unpaid', null)).toBe(false);
  });

  it('lets money still owed overrule a paid word, and reads Remaining 0.00 as paid', () => {
    expect(isFullyPaid('Fully Paid', 50)).toBe(false);
    expect(isFullyPaid('', 0)).toBe(true);
    expect(isFullyPaid('Draft', 0)).toBe(false);
  });

  it('flags waiting-for-issuing invoices as cost pending and waiting', () => {
    expect(isWaitingForIssuing('Waiting for Issuing')).toBe(true);
    expect(waitingFlags('Waiting for Issuing')).toEqual({ costPending: true, waitingForIssuing: true });
    expect(waitingFlags('Fully Paid')).toEqual({ costPending: false, waitingForIssuing: false });
  });
});

describe('discount matching and code identity', () => {
  it('matches rows by invoice number only', () => {
    const { matched, unmatched } = matchDiscounts(allPilotInvoices, pilotDiscountRows);
    const byInvoice = new Map(matched.map((m) => [m.invoiceNumber, m.totalDiscount]));
    expect(byInvoice.get('1000000002')).toBe(100);
    expect(byInvoice.get('1000000001')).toBe(10);
    expect(byInvoice.get('2000000001')).toBe(250);
    expect(unmatched).toEqual([]);
  });

  it('never matches through a receipt reference, even a 10-digit one', () => {
    const { matched, unmatched } = matchDiscounts(allPilotInvoices, [receiptRefCollision.rowClaimingReceiptRef]);
    expect(matched).toEqual([]);
    expect(unmatched).toEqual([receiptRefCollision.rowClaimingReceiptRef]);
    // The receipt reference really exists on a pilot transaction, which is what makes this a trap:
    expect(receiptRefCollision.receiptRef).toBe('4000000004');
    expect(allPilotInvoices.some((i) => i.invoiceNumber === '4000000004')).toBe(false);
  });

  it('keeps the same code text under two ids as two separate codes', () => {
    const groups = groupCodes(pilotDiscountRows);
    expect(groups).toHaveLength(2);
    const first = groups.find((g) => g.codeId === 'TEST-CODE-001')!;
    const second = groups.find((g) => g.codeId === 'TEST-CODE-002')!;
    expect(first.codeText).toBe('TESTSAVE10');
    expect(second.codeText).toBe('TESTSAVE10');
    expect(first.totalDiscount).toBe(110);
    expect(first.uses).toBe(2);
    expect(second.totalDiscount).toBe(250);
    expect(second.uses).toBe(1);
  });

  it('sorts codes by total discount, largest first', () => {
    const sorted = sortCodesByTotalDiscount(groupCodes(pilotDiscountRows));
    expect(sorted.map((g) => g.codeId)).toEqual(['TEST-CODE-002', 'TEST-CODE-001']);
  });
});

describe('progressive fill and grouped invoices', () => {
  it('flags the missing invoice number, then clears the flag when it arrives', () => {
    expect(missingNumbers(missingInvoiceRecord)).toEqual(['invoice number']);
    const { record, filled } = fillMissing(missingInvoiceRecord, missingInvoiceArrival);
    expect(record).toEqual({ transactionNumber: 'TEST-TX-9001', invoiceNumber: '9000000001' });
    expect(filled).toEqual(['invoice number']);
    expect(missingNumbers(record)).toEqual([]);
  });

  it('never overwrites a number that is already there', () => {
    const { record, filled } = fillMissing(filledRecord, filledRecordArrival);
    expect(record).toEqual(filledRecord);
    expect(filled).toEqual([]);
  });

  it('keeps one invoice grouping two transactions together', () => {
    expect(betaGroupedInvoice.transactionNumbers).toEqual(['TEST-TX-2001', 'TEST-TX-2002']);
    expect(betaGroupedInvoice.transactionNumbers).toHaveLength(2);
  });
});
