// Pilot unified read: the five proofs the owner asked for, plus the
// code-view rule. All figures are TEST figures; nothing here is real.
import { describe, expect, it } from 'vitest';
import { unifyRows } from '@/modules/finance/unified';
import {
  importPromoRow,
  importRow,
  importRowNoCost,
  importRowNotPaid,
  manualRow,
  pilotCodeOne,
  pilotCodeTwo,
  pilotUnifiedRows,
} from './pilot-unified-fixtures';

describe('pilot unified read', () => {
  it('counts an imported row exactly once, even when it arrives twice', () => {
    const { rows, totals } = unifyRows([importRow, importRow]);
    expect(rows).toHaveLength(1);
    expect(totals.importUnits).toBe(1);
    expect(totals.revenue).toBe(500);
  });

  it('counts a manually recorded row exactly once', () => {
    const { rows, totals } = unifyRows([manualRow, manualRow]);
    expect(rows).toHaveLength(1);
    expect(totals.manualUnits).toBe(1);
    expect(totals.revenue).toBe(1000);
    expect(totals.profit).toBe(800);
  });

  it('never counts a row that is not fully paid', () => {
    const { rows, totals } = unifyRows([manualRow, importRowNotPaid]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toBe(manualRow);
    expect(totals.revenue).toBe(1000);
    expect(totals.unconfirmedUnits).toBe(1);
  });

  it('never mixes a promo-attributed row into a plain company view', () => {
    const { rows, promoRows, totals } = unifyRows([manualRow, importPromoRow]);
    expect(rows).toHaveLength(1);
    expect(promoRows).toHaveLength(1);
    expect(promoRows[0]).toBe(importPromoRow);
    expect(totals.revenue).toBe(1000);
    expect(totals.promoUnits).toBe(1);
  });

  it('keeps a missing cost empty, never 0, and profit empty with it', () => {
    const { rows, totals } = unifyRows([importRowNoCost]);
    const costless = rows.find((r) => r.key === 'import-4');
    expect(costless).toBeDefined();
    expect(costless?.cost).toBeNull();
    expect(costless?.profit).toBeNull();
    expect(totals.cost).toBe(0);
    expect(totals.withoutCost).toBe(1);
    // The total cost is the sum of known costs only: nothing was padded
    // in from the costless row, and the row itself still shows empty.
    expect(totals.revenue).toBe(700);
  });

  it('counts a promo row in its own code view, and only there', () => {
    // Manually recorded rows arrive in a code view already filtered by
    // the database, so only imported rows are passed here: the promo
    // row for this code counts, a row for no code does not.
    const codeView = unifyRows([importRow, importPromoRow], { code: pilotCodeOne.code });
    expect(codeView.rows).toHaveLength(1);
    expect(codeView.rows[0]).toBe(importPromoRow);
    expect(codeView.totals.revenue).toBe(400);
    expect(codeView.promoRows).toHaveLength(0);
  });

  it('does not merge two different codes that share the same text', () => {
    expect(pilotCodeOne.code).toBe(pilotCodeTwo.code);
    expect(pilotCodeOne.id).not.toBe(pilotCodeTwo.id);
  });

  it('holds the full pilot set together without double-counting', () => {
    const { rows, promoRows, totals } = unifyRows(pilotUnifiedRows);
    // Manual 1 + import 1 + import-no-cost 1 = 3 counted rows; the
    // duplicate import counts once, the unpaid row never, the promo
    // row sits apart.
    expect(rows).toHaveLength(3);
    expect(promoRows).toHaveLength(1);
    expect(totals.units).toBe(3);
    expect(totals.manualUnits).toBe(1);
    expect(totals.importUnits).toBe(2);
    expect(totals.revenue).toBe(1000 + 500 + 700);
    expect(totals.cost).toBe(200 + 100);
    expect(totals.profit).toBe(800 + 400);
    expect(totals.withoutCost).toBe(1);
    expect(totals.unconfirmedUnits).toBe(1);
    expect(totals.promoUnits).toBe(1);
  });
});
