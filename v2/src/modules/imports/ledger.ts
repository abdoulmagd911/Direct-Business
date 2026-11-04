// What Finance and Codes pages read from an imported record. Plain figures only:
//
// revenue = invoice or transaction amount less any wallet top-up part.
// cost = approved expenses only. A missing cost stays empty, never 0.
// profit = revenue - cost, empty while either side is missing.
// Totals count fully-paid records only. Provisional records (Waiting for Issuing) are
// shown as a subset of those totals ("of which Provisional"), never hidden and never
// double-counted. Records whose paid state is not known yet (transaction-list rows with
// no invoice file behind them) sit in the unconfirmed bucket until an invoice arrives.

import { roundMoney } from './money';

export type LedgerFigures = { revenue: number | null; cost: number | null; profit: number | null };

export function deriveFigures(record: {
  amount: number | null;
  wallet_topup: number;
  cost: number | null;
}): LedgerFigures {
  const revenue = record.amount === null ? null : roundMoney(record.amount - (record.wallet_topup ?? 0));
  const cost = record.cost;
  const profit = revenue === null || cost === null ? null : roundMoney(revenue - cost);
  return { revenue, cost, profit };
}

export type LedgerRecord = {
  amount: number | null;
  wallet_topup: number;
  cost: number | null;
  fully_paid: boolean;
  provisional: boolean;
};

export type LedgerTotals = {
  records: number;
  revenue: number;
  cost: number;
  profit: number;
  /** Records with a revenue figure but no cost yet: profit is not final for them. */
  cost_pending_records: number;
};

function emptyTotals(): LedgerTotals {
  return { records: 0, revenue: 0, cost: 0, profit: 0, cost_pending_records: 0 };
}

function addInto(totals: LedgerTotals, figures: LedgerFigures): void {
  totals.records += 1;
  if (figures.revenue !== null) totals.revenue = roundMoney(totals.revenue + figures.revenue);
  if (figures.cost !== null) totals.cost = roundMoney(totals.cost + figures.cost);
  if (figures.profit !== null) totals.profit = roundMoney(totals.profit + figures.profit);
  if (figures.revenue !== null && figures.cost === null) totals.cost_pending_records += 1;
}

export function ledgerBuckets(records: LedgerRecord[]): {
  totals: LedgerTotals;
  provisional: LedgerTotals;
  unconfirmed: LedgerTotals;
} {
  const totals = emptyTotals();
  const provisional = emptyTotals();
  const unconfirmed = emptyTotals();
  for (const record of records) {
    const figures = deriveFigures(record);
    if (!record.fully_paid && !record.provisional) {
      addInto(unconfirmed, figures);
    } else {
      addInto(totals, figures);
      if (record.provisional) addInto(provisional, figures);
    }
  }
  return { totals, provisional, unconfirmed };
}
