// TEST pilot fixtures for the Commercial Workspace finance checks (workstream E).
//
// TEST DATA ONLY. Every name is plainly a test name, every number is a round
// test number, and no real customer name, email or phone appears here. The
// wallet reference figures (top-ups 1000, invoices 49, balance 951, held
// 382.90, available 568.10) mirror the known TEST company wallet, so a
// reader can check the arithmetic against a real test wallet without
// copying any real company data.
//
// Three TEST companies, one per payment shape:
// - TEST Alpha Trading: prepaid-heavy, two prepaid client ids.
// - TEST Beta Contracting: postpaid with a credit limit, two client ids.
// - TEST Gamma Projects: tender, two tender client ids.
// Two TEST discount codes share the same text under two different ids, to
// prove rows are keyed by id, not by text.

import type { DiscountRow, PilotInvoice } from '@/modules/finance/finance-math';

export type TestCompanyFile = { kind: 'agreement' | 'cr' | 'vat' | 'national_address'; fileName: string };

export type TestCompany = {
  name: string;
  clientIds: {
    id: string;
    paymentShape: 'prepaid' | 'postpaid' | 'tender';
    creditLimit: number | null;
    creditTermDays: number | null;
  }[];
  files: TestCompanyFile[];
  invoices: PilotInvoice[];
};

export const testFiles: TestCompanyFile[] = [
  { kind: 'agreement', fileName: 'TEST-agreement.pdf' },
  { kind: 'cr', fileName: 'TEST-cr.pdf' },
  { kind: 'vat', fileName: 'TEST-vat.pdf' },
  { kind: 'national_address', fileName: 'TEST-national-address.pdf' },
];

/** Fully paid invoice 49.00 with no expenses yet: revenue 49, cost empty, profit empty. */
export const alphaWalletInvoice: PilotInvoice = {
  invoiceNumber: '1000000001',
  amount: 49,
  walletTopup: 0,
  status: 'Fully Paid',
  remaining: 0,
  expenses: [],
  transactionNumbers: ['TEST-TX-1001'],
};

/** Prepaid-heavy TEST company. Wallet reference: top-ups 1000, invoices 49, held 382.90. */
export const testAlphaTrading: TestCompany = {
  name: 'TEST Alpha Trading',
  clientIds: [
    { id: 'TEST-PREPAID-001', paymentShape: 'prepaid', creditLimit: null, creditTermDays: null },
    { id: 'TEST-PREPAID-002', paymentShape: 'prepaid', creditLimit: null, creditTermDays: null },
  ],
  files: testFiles,
  invoices: [
    alphaWalletInvoice,
    {
      invoiceNumber: '1000000002',
      amount: 1000,
      walletTopup: 200,
      status: 'Invoice - Fully Paid',
      remaining: 0,
      expenses: [{ status: 'Approved', amount: 600 }],
      transactionNumbers: ['TEST-TX-1002'],
    },
    {
      invoiceNumber: '1000000003',
      amount: 500,
      walletTopup: 0,
      status: 'Partially Paid',
      remaining: 200,
      expenses: [{ status: 'Approved', amount: 100 }],
      transactionNumbers: ['TEST-TX-1003'],
    },
    {
      invoiceNumber: '1000000004',
      amount: 300,
      walletTopup: 0,
      status: 'Draft',
      remaining: 300,
      expenses: [],
      transactionNumbers: ['TEST-TX-1004'],
    },
    {
      invoiceNumber: '1000000005',
      amount: 400,
      walletTopup: 0,
      status: 'Waiting for Issuing',
      remaining: 400,
      expenses: [{ status: 'Pending', amount: 250 }],
      transactionNumbers: ['TEST-TX-1005'],
    },
  ],
};

/** One invoice grouping two transactions, plus an approved refund on a fully paid invoice. */
export const betaGroupedInvoice: PilotInvoice = {
  invoiceNumber: '2000000001',
  amount: 2000,
  walletTopup: 0,
  status: 'Fully Paid + Receivables',
  remaining: 0,
  expenses: [
    { status: 'Approved', amount: 1200 },
    { status: 'Pending', amount: 300 },
  ],
  transactionNumbers: ['TEST-TX-2001', 'TEST-TX-2002'],
};

/** Postpaid TEST company with a credit limit of 100,000 and a 45-day term. */
export const testBetaContracting: TestCompany = {
  name: 'TEST Beta Contracting',
  clientIds: [
    { id: 'TEST-POSTPAID-001', paymentShape: 'postpaid', creditLimit: 100000, creditTermDays: 45 },
    { id: 'TEST-POSTPAID-002', paymentShape: 'postpaid', creditLimit: 100000, creditTermDays: 45 },
  ],
  files: testFiles,
  invoices: [
    betaGroupedInvoice,
    {
      invoiceNumber: '2000000002',
      amount: 800,
      walletTopup: 0,
      status: 'Fully Paid (Audit Required)',
      remaining: 0,
      expenses: [{ status: 'Approved', amount: 500 }],
      transactionNumbers: ['TEST-TX-2003'],
    },
    {
      invoiceNumber: '2000000003',
      amount: 700,
      walletTopup: 0,
      status: 'Cancelled',
      remaining: 700,
      expenses: [{ status: 'Approved', amount: 400 }],
      transactionNumbers: ['TEST-TX-2004'],
    },
  ],
};

/** Approved refund on Beta's grouped invoice: a separate line, never a rewrite of the 2000. */
export const betaApprovedRefund = { status: 'Approved', amount: 100 };

/** Tender TEST company. Tender one: amount 100,000, expected cost 80,000, invoiced 60,000, approved cost 45,000. */
export const gammaTender = {
  tenderAmount: 100000,
  expectedCogs: 80000,
  invoicedTotal: 60000,
  approvedCogs: 45000,
};

/** Tender two: fully used, so the consumed flag must show. */
export const gammaConsumedTender = {
  tenderAmount: 10000,
  expectedCogs: 8000,
  invoicedTotal: 10000,
  approvedCogs: 9000,
};

export const testGammaProjects: TestCompany = {
  name: 'TEST Gamma Projects',
  clientIds: [
    { id: 'TEST-TENDER-001', paymentShape: 'tender', creditLimit: null, creditTermDays: null },
    { id: 'TEST-TENDER-002', paymentShape: 'tender', creditLimit: null, creditTermDays: null },
  ],
  files: testFiles,
  invoices: [
    {
      invoiceNumber: '3000000001',
      amount: 60000,
      walletTopup: 0,
      status: 'Fully Paid',
      remaining: 0,
      expenses: [{ status: 'Approved', amount: 45000 }],
      transactionNumbers: ['TEST-TX-3001'],
    },
  ],
};

export const pilotCompanies: TestCompany[] = [testAlphaTrading, testBetaContracting, testGammaProjects];

/** Same code text under two different ids: text must never be the key. */
export const pilotDiscountRows: DiscountRow[] = [
  { codeId: 'TEST-CODE-001', codeText: 'TESTSAVE10', invoiceNumber: '1000000002', discount: 100 },
  { codeId: 'TEST-CODE-002', codeText: 'TESTSAVE10', invoiceNumber: '2000000001', discount: 250 },
  { codeId: 'TEST-CODE-001', codeText: 'TESTSAVE10', invoiceNumber: '1000000001', discount: 10 },
];

/**
 * Receipt-reference collision trap: transaction TEST-TX-1002 carries receipt
 * reference 4000000004, which is a 10-digit number, but no invoice carries
 * that number. A discount row claiming invoice number 4000000004 must stay
 * unmatched even though the receipt reference exists.
 */
export const receiptRefCollision = {
  transactionNumber: 'TEST-TX-1002',
  receiptRef: '4000000004',
  rowClaimingReceiptRef: {
    codeId: 'TEST-CODE-001',
    codeText: 'TESTSAVE10',
    invoiceNumber: '4000000004',
    discount: 50,
  } as DiscountRow,
};

/** A record with a transaction but no invoice number yet, for progressive fill. */
export const missingInvoiceRecord = { transactionNumber: 'TEST-TX-9001', invoiceNumber: null };

/** The later import that brings the missing invoice number, and nothing else new. */
export const missingInvoiceArrival = { transactionNumber: 'TEST-TX-9001', invoiceNumber: '9000000001' };

/** A record whose numbers are already filled: a later import must never overwrite them. */
export const filledRecord = { transactionNumber: 'TEST-TX-9002', invoiceNumber: '9000000002' };

export const filledRecordArrival = { transactionNumber: 'TEST-TX-9999', invoiceNumber: '9000000009' };
