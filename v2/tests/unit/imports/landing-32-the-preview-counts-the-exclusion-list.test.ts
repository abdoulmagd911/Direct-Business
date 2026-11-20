/**
 * Landing 32 (Finance F-B), A2 — the import preview counts the exclusion list. When the list catches the import's
 * organisation or discount code, every row the import will store is added to "Left out by rule"; rows the list names
 * one by one (by their folded number) are counted the same way. Held rows are already there and are never counted
 * twice; a skipped duplicate writes nothing and is not counted. The rows are still STORED: the other four counts and
 * the preview itself are untouched. No answer from the check counts nothing. Every value is made up.
 * Sabotage: tests/sabotage/landing-32-finance-ledger.mjs "rule-excluded-rows-are-not-counted",
 * "named-rows-are-not-counted", "held-rows-are-counted-twice", "numbers-are-compared-unfolded".
 */
import { describe, expect, it } from 'vitest';
import {
  countRuleExcluded,
  foldNumber,
  ruleCheckOf,
  toApplyPayload,
  type ExistingRecord,
  type Preview,
  type PreviewRow,
  type RuleCheck,
} from '@/modules/imports';

const values = (transaction: string | null, invoice: string | null): ExistingRecord => ({
  transaction_ref: transaction,
  invoice_ref: invoice,
  tax_no: null,
  record_date: '2026-10-12',
  amount: 1500,
  wallet_topup: 0,
  cost: null,
  status_text: 'Fully Paid',
  fully_paid: true,
  provisional: false,
  source_promo: null,
  product: null,
});

const stored = (rowNo: number, outcome: PreviewRow['outcome'], transaction: string, invoice: string): PreviewRow => ({
  row_no: rowNo,
  row_nos: [rowNo],
  kind: 'transaction',
  outcome,
  reasons: [],
  whys: [],
  duplicate: false,
  transaction_ref: transaction,
  invoice_ref: invoice,
  matched: null,
  changes: [],
  values: values(transaction, invoice),
  promo_before: null,
  promo_discount: null,
  promo_after: null,
});
/** A held row: not written, already in "Left out by rule". */
const heldRow = (rowNo: number): PreviewRow => ({
  ...stored(rowNo, 'excluded', '', ''),
  transaction_ref: null,
  invoice_ref: null,
  values: null,
});
/** A duplicate left at its default (skip): it writes nothing. */
const skipped = (rowNo: number, transaction: string): PreviewRow => ({
  ...stored(rowNo, 'unchanged', transaction, ''),
  duplicate: true,
  values: null,
});

const preview = (): Preview => ({
  counts: { new: 2, updated: 1, unchanged: 2, excluded: 1, needs_linking: 1 },
  rows: [
    stored(2, 'new', 'TR-MADE-0002', '9990000002'),
    stored(3, 'new', 'TR-MADE-0003', '9990000003'),
    stored(4, 'updated', 'TR-MADE-0004', '9990000004'),
    stored(5, 'unchanged', 'TR-MADE-0005', '9990000005'),
    skipped(6, 'TR-MADE-0002'),
    stored(7, 'needs_linking', 'TR-MADE-0007', ''),
    heldRow(8),
  ],
  problems: [],
  clashes: [],
});

const none: RuleCheck = { excluded: false, kind: null, value: null, reason: null, numbers: [] };
const whole: RuleCheck = {
  excluded: true,
  kind: 'client_id',
  value: '990001',
  reason: 'Made-up internal account',
  numbers: [],
};

describe('the preview counts the exclusion list', () => {
  it('a rule on the organisation adds every row the import stores to Left out by rule', () => {
    const got = countRuleExcluded(preview(), whole);
    // 1 held row + the 5 rows that will be written (2 new, 1 updated, 1 unchanged, 1 needs linking)
    expect(got.counts.excluded).toBe(6);
    expect(got.rowNos).toEqual([2, 3, 4, 5, 7]);
    expect(got.whole).toBe(true);
  });

  it('a held row is not counted a second time, and a skipped duplicate is not counted at all', () => {
    const got = countRuleExcluded(preview(), whole);
    expect(got.rowNos).not.toContain(8);
    expect(got.rowNos).not.toContain(6);
  });

  it('the rows are still stored: the other four counts and what Confirm sends are untouched', () => {
    const before = preview();
    const sentBefore = JSON.stringify(toApplyPayload(before, [], {}));
    const got = countRuleExcluded(before, whole);
    expect(got.counts).toMatchObject({ new: 2, updated: 1, unchanged: 2, needs_linking: 1 });
    expect(before, 'the preview itself is not changed').toEqual(preview());
    expect(JSON.stringify(toApplyPayload(before, [], {}))).toBe(sentBefore);
  });

  it('rows the list names one by one are counted the same way, by transaction or invoice number', () => {
    const got = countRuleExcluded(preview(), { ...none, numbers: ['tr made 0003', '9990000005'] });
    expect(got.rowNos).toEqual([3, 5]);
    expect(got.counts.excluded).toBe(3);
    expect(got.whole).toBe(false);
  });

  it('a number is compared the way the database folds it', () => {
    expect(foldNumber(' TR-MADE-0003 ')).toBe('tr made 0003');
    expect(foldNumber('TR.MADE/0003')).toBe('trmade 0003');
    expect(foldNumber('٩٩٩٠٠٠٠٠٠٥')).toBe('9990000005');
    expect(foldNumber(null)).toBe('');
    // the list may hold the number as it was typed: it is folded before comparing, too
    expect(countRuleExcluded(preview(), { ...none, numbers: ['TR-MADE-0004'] }).rowNos).toEqual([4]);
  });

  it('a list that catches nothing adds nothing', () => {
    const got = countRuleExcluded(preview(), none);
    expect(got.counts).toEqual(preview().counts);
    expect(got.rowNos).toEqual([]);
  });

  it('no answer from the check counts nothing — the screen says the list could not be checked', () => {
    expect(countRuleExcluded(preview(), null)).toEqual({ counts: preview().counts, rowNos: [], whole: false });
  });
});

describe('the check’s answer is read once', () => {
  it('reads the rule that catches the import', () => {
    expect(
      ruleCheckOf({
        excluded: true,
        kind: 'discount_code',
        value: 'MADEUP10',
        reason: 'Made-up staff code',
        numbers: ['tr made 0003', '', 4],
      }),
    ).toEqual({
      excluded: true,
      kind: 'discount_code',
      value: 'MADEUP10',
      reason: 'Made-up staff code',
      numbers: ['tr made 0003'],
    });
  });

  it('anything that is not such an answer is no answer — never "nothing is excluded"', () => {
    expect(ruleCheckOf(null)).toBeNull();
    expect(ruleCheckOf({})).toBeNull();
    expect(ruleCheckOf([])).toBeNull();
    expect(ruleCheckOf({ excluded: 'no' })).toBeNull();
  });
});
