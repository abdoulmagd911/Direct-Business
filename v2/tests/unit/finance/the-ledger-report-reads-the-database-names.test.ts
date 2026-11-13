/**
 * The Finance ledger's report reads the unified ledger's answer under the database's own names (13 Nov sweep): read
 * under the report's names, the discount-code rows vanished from the page and the source counts and a code's total
 * discount were never shown. Its export heads every column it files.
 */
import { describe, expect, it } from 'vitest';
import { ledgerRowsToCsv } from '@/modules/finance/ledger';
import { ledgerReportOf } from '@/modules/finance/screens/ledger-report';

// The shape api.finance_unified_ledger answers (made-up values).
const answer = {
  from: '2026-01-01',
  to: '2026-11-13',
  partner: null,
  client_id: null,
  kind: null,
  code: null,
  project: null,
  totals: {
    units: 1,
    revenue: 900,
    cost: 500,
    profit: 400,
    without_cost: 0,
    received: 900,
    remaining: 0,
    manual_units: 0,
    import_units: 1,
    promo_units: 1,
    unconfirmed_import_units: 2,
  },
  companies: [
    { units: 1, partner_id: 'p1', trade_name_en: 'Made Up Co', trade_name_ar: null, partner_number: 'DK-P-9' },
  ],
  by_company: [],
  invoices: [],
  rows: [
    {
      invoice_id: 'import:1',
      unit_kind: 'transaction',
      transaction_number: 'TR-1',
      invoice_number: '9990000008',
      partner_id: 'p1',
      created_on: '2026-11-06',
      revenue: 900,
      cost: 500,
      profit: 400,
      dpin: null,
      flags: [],
      source: 'import',
      is_promo: false,
      discount_sar: null,
    },
  ],
  truncated: false,
  promo_rows: [
    {
      id: 'r1',
      code: 'MADEUP10',
      cost: 600,
      profit: 900,
      counted: true,
      revenue: 1500,
      direct_url: null,
      partner_id: 'p1',
      invoice_ref: '9990000001',
      record_date: '2026-10-05',
      discount_sar: 100,
      transaction_ref: 'TR-0',
    },
  ],
  code_discount: 100,
};

describe('the ledger report reads the database names', () => {
  it('keeps the discount-code rows, their numbers and their date', () => {
    const r = ledgerReportOf(answer);
    expect(r.promoRows).toEqual([
      {
        id: 'r1',
        partner_id: 'p1',
        transaction_number: 'TR-0',
        invoice_number: '9990000001',
        created_on: '2026-10-05',
        code: 'MADEUP10',
        discount_sar: 100,
        revenue: 1500,
        cost: 600,
        profit: 900,
        counted: true,
        direct_url: null,
      },
    ]);
  });

  it('shows the source counts, the unconfirmed count and a code total', () => {
    const r = ledgerReportOf(answer);
    expect(r.totals).toMatchObject({ manualUnits: 0, importUnits: 1, promoUnits: 1, unconfirmedImportUnits: 2 });
    expect(r.codeDiscount).toBe(100);
    expect(r.rows[0]).toMatchObject({ isPromo: false, discountSar: null, source: 'import' });
  });

  it('a missing part is empty, never invented', () => {
    const r = ledgerReportOf({ totals: { units: 0 } });
    expect(r.rows).toEqual([]);
    expect(r.promoRows).toEqual([]);
    expect(r.invoices).toEqual([]);
    expect(r.codeDiscount).toBeNull();
    expect(r.totals.unconfirmedImportUnits).toBeUndefined();
  });
});

describe('the ledger export heads every column it files', () => {
  it('the heading line, every row and the totals line have the same columns', () => {
    const csv = ledgerRowsToCsv(
      ledgerReportOf(answer),
      {
        created: 'Created',
        company: 'Partner',
        transaction: 'Transaction no.',
        invoice: 'Invoice no.',
        kind: 'Invoice type',
        source: 'Source',
        revenue: 'Revenue',
        cost: 'Cost',
        profit: 'Profit',
        dpin: 'Tax invoice no.',
        flags: 'Flags',
        total: 'Totals',
      },
      () => 'Made Up Co',
    );
    const [head, row, totals] = csv.split('\n').map((l) => l.split(','));
    expect(head).toEqual([
      'Created',
      'Partner',
      'Transaction no.',
      'Invoice no.',
      'Invoice type',
      'Source',
      'Revenue',
      'Cost',
      'Profit',
      'Tax invoice no.',
      'Flags',
    ]);
    expect(row).toHaveLength(head!.length);
    expect(totals).toHaveLength(head!.length);
    expect(row![head!.indexOf('Revenue')]).toBe('900');
    expect(row![head!.indexOf('Source')]).toBe('import');
  });
});
