// Import screen (Nov 2026): the Confirm call's payload, built from the preview the person saw.
import { describe, expect, it } from 'vitest';
import { buildPreview, existingFromImportLedger, toApplyPayload, type NormalisedRow } from '@/modules/imports';

function row(patch: Partial<NormalisedRow> & { rowNos: number[] }): NormalisedRow {
  return {
    kind: 'invoice',
    transaction_ref: null,
    invoice_ref: null,
    tax_no: null,
    record_date: null,
    date_note: null,
    amount: null,
    wallet_topup: 0,
    cost: null,
    expense_lines: 0,
    status_text: null,
    fully_paid: false,
    audit_required: false,
    provisional: false,
    product: null,
    source_promo: null,
    promo_before: null,
    promo_discount: null,
    promo_after: null,
    expense_gate: null,
    direct_url: null,
    direct_ref: null,
    ...patch,
  };
}

describe('toApplyPayload', () => {
  it('sends one apply row per written preview row, with the apply function’s field names', () => {
    const records = [
      row({
        rowNos: [2],
        invoice_ref: '1163000002',
        amount: 500,
        record_date: '2026-11-02',
        status_text: 'Invoice - Fully Paid',
        fully_paid: true,
      }),
    ];
    const preview = buildPreview([], records, [], {});
    const payload = toApplyPayload(preview, records, {});
    expect(payload.rows).toHaveLength(1);
    expect(payload.rows[0]).toMatchObject({
      row_no: 2,
      kind: 'invoice',
      invoice_ref: '1163000002',
      amount: 500,
      wallet_topup: 0,
      record_date: '2026-11-02',
      fully_paid: true,
    });
    expect(payload.held).toEqual([]);
    expect(payload.decisions).toEqual({});
  });

  it('leaves held rows out of the write and sends them apart with their reasons', () => {
    const records = [row({ rowNos: [2], invoice_ref: '1163000002', amount: 500, fully_paid: true })];
    const held = [{ row_no: 3, reason: 'Not fully paid (Draft): not counted' }];
    const preview = buildPreview([], records, held, {});
    expect(preview.counts.excluded).toBe(1);
    const payload = toApplyPayload(preview, records, {});
    expect(payload.rows).toHaveLength(1);
    expect(payload.held).toEqual(held);
  });

  it('carries a kept duplicate’s choice through to the apply call', () => {
    const records = [
      row({ rowNos: [2], invoice_ref: '1163000002', amount: 500, fully_paid: true }),
      row({ rowNos: [3], invoice_ref: '1163000002', amount: 500, fully_paid: true }),
    ];
    const preview = buildPreview([], records, [], { 3: 'keep' });
    const payload = toApplyPayload(preview, records, { 3: 'keep' });
    expect(payload.rows).toHaveLength(2);
    expect(payload.rows[1]).toMatchObject({ row_no: 3, duplicate: true });
    expect(payload.decisions).toEqual({ 3: 'keep' });
  });
});

describe('existingFromImportLedger', () => {
  it('maps the ledger’s stored rows onto the shape the preview matches against', () => {
    const existing = existingFromImportLedger({
      records: [
        {
          transaction_ref: '1163000002',
          invoice_ref: '1163000002',
          tax_no: 'DPIN-T-100002',
          record_date: '2026-11-02',
          amount_sar: 500,
          wallet_topup_sar: 0,
          cost_sar: 100,
          status_text: 'Invoice - Fully Paid',
          fully_paid: true,
          provisional: false,
          source_promo: null,
          product: 'Flight',
        },
      ],
    });
    expect(existing).toEqual([
      {
        transaction_ref: '1163000002',
        invoice_ref: '1163000002',
        tax_no: 'DPIN-T-100002',
        record_date: '2026-11-02',
        amount: 500,
        wallet_topup: 0,
        cost: 100,
        status_text: 'Invoice - Fully Paid',
        fully_paid: true,
        provisional: false,
        source_promo: null,
        product: 'Flight',
      },
    ]);
  });

  it('treats a missing answer as no stored rows, never inventing any', () => {
    expect(existingFromImportLedger(null)).toEqual([]);
    expect(existingFromImportLedger({})).toEqual([]);
    expect(existingFromImportLedger({ records: null })).toEqual([]);
  });
});
