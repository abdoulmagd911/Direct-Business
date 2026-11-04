/**
 * Workstream B: the Finance ledger's address and its export describe the same filtered view — a saved view
 * reopened from its address asks for the same rows the export files, and a cost with no approved expense stays
 * empty in the file, never 0.
 */
import { describe, expect, it } from 'vitest';
import {
  ledgerFilterFromQuery,
  ledgerFilterQuery,
  ledgerReadArgs,
  ledgerRowsToCsv,
  sameLedgerFilter,
} from '@/modules/finance/ledger';
import type { LedgerReport } from '@/modules/finance/types';

const headers = {
  created: 'Created',
  company: 'Company',
  transaction: 'Transaction no.',
  invoice: 'Invoice no.',
  kind: 'Type',
  revenue: 'Revenue',
  cost: 'Cost',
  profit: 'Profit',
  dpin: 'Tax invoice no.',
  flags: 'Flags',
  total: 'Totals',
};

const report = (rows: LedgerReport['rows']): LedgerReport => ({
  from: '2026-01-01',
  to: '2026-01-31',
  partner: null,
  client_id: null,
  kind: null,
  code: null,
  project: null,
  totals: { units: rows.length, revenue: 100, cost: 40, profit: 60, without_cost: 1, received: 100, remaining: 0 },
  companies: [],
  by_company: [],
  invoices: [],
  rows,
  truncated: false,
});

describe('the ledger filter survives its address', () => {
  it('a filter written to the address reads back the same', () => {
    const f = { partner: 'p1', clientId: '134', kind: 'billing' as const, code: 'SAVE10', project: 'launch' };
    expect(ledgerFilterFromQuery(ledgerFilterQuery(f))).toEqual(f);
    expect(sameLedgerFilter(ledgerFilterFromQuery(ledgerFilterQuery(f)), f)).toBe(true);
  });

  it('empty boxes and unknown kinds are no filter, never an error', () => {
    expect(ledgerFilterFromQuery({ company: '', kind: 'nope', code: '' })).toEqual({});
    expect(ledgerFilterQuery({})).toEqual({});
  });

  it('the read sends only values that are set', () => {
    expect(ledgerReadArgs({ code: 'SAVE10' }, '2026-01-01', '2026-01-31')).toEqual({
      p_from: '2026-01-01',
      p_to: '2026-01-31',
      p_code: 'SAVE10',
    });
  });
});

describe('the ledger export files the same view', () => {
  it('a missing cost stays empty in the file, never 0', () => {
    const csv = ledgerRowsToCsv(
      report([
        {
          invoice_id: 'i1',
          unit_kind: 'transaction',
          transaction_number: 'TR-1',
          invoice_number: null,
          partner_id: null,
          created_on: '2026-01-05',
          revenue: 100,
          cost: null,
          profit: null,
          dpin: null,
          flags: ['no_invoice_yet', 'cost_pending'],
        },
      ]),
      headers,
      () => 'No company',
    );
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('2026-01-05,No company,TR-1,,transaction,100,,,,no_invoice_yet cost_pending');
    expect(lines[2]).toBe('Totals,,,,,100,40,60,,');
  });

  it('a comma in a number is quoted, not split', () => {
    const csv = ledgerRowsToCsv(
      report([
        {
          invoice_id: 'i1',
          unit_kind: 'standalone',
          transaction_number: 'TR,2',
          invoice_number: 'INV-2',
          partner_id: null,
          created_on: '2026-01-06',
          revenue: 50,
          cost: 20,
          profit: 30,
          dpin: null,
          flags: [],
        },
      ]),
      headers,
      () => '',
    );
    expect(csv.split('\n')[1]).toContain('"TR,2"');
  });
});
