/**
 * Landing 32 (Finance F-B) — the made-up ledger the Landing 32 tests draw. Every name, number and amount is invented:
 * "Made-up Org", client ID 990001, code MADEUP10.
 */
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { LedgerReport, LedgerRow } from '../../../src/modules/finance/types';

export const row = (n: number, over: Partial<LedgerRow> = {}): LedgerRow => ({
  invoice_id: `inv-${n}`,
  unit_kind: 'transaction',
  transaction_number: `TX-MADE-${n}`,
  invoice_number: `IN-MADE-${n}`,
  partner_id: 'p-made-up',
  created_on: '2026-10-12',
  revenue: 1000 + n,
  cost: 600,
  profit: 400 + n,
  dpin: null,
  flags: [],
  source: 'import',
  isPromo: false,
  discountSar: null,
  counted: true,
  excluded_by: null,
  not_counted_reason: null,
  excluded_row_level: false,
  number: `TX-MADE-${n}`,
  source_partner_id: 'p-made-up',
  merged_by: null,
  code_state: null,
  ...over,
});

/** A row excluded by hand (Include can undo it). */
export const byHand = (n: number, over: Partial<LedgerRow> = {}) =>
  row(n, {
    counted: false,
    cost: null,
    profit: null,
    excluded_by: 'invoice',
    excluded_row_level: true,
    not_counted_reason: 'Made-up test booking',
    ...over,
  });

/** A row a list rule in Settings catches (no Include from the row). */
export const byList = (n: number, over: Partial<LedgerRow> = {}) =>
  row(n, {
    counted: false,
    cost: null,
    profit: null,
    excluded_by: 'client_id',
    excluded_row_level: false,
    not_counted_reason: 'Made-up internal account',
    ...over,
  });

export const report = (rows: LedgerRow[], over: Partial<LedgerReport> = {}): LedgerReport => ({
  from: '2026-10-01',
  to: '2026-10-31',
  partner: null,
  client_id: null,
  kind: null,
  code: null,
  project: null,
  companies: [
    {
      partner_id: 'p-made-up',
      partner_number: 'P-990001',
      trade_name_en: 'Made-up Org',
      trade_name_ar: null,
      units: rows.length,
    },
  ],
  by_company: [
    {
      partner_id: 'p-made-up',
      units: 2,
      revenue: 43210,
      cost: 30100,
      profit: 13110,
      without_cost: 0,
      received: 43210,
      remaining: 0,
    },
  ],
  invoices: [],
  rows,
  truncated: false,
  promoRows: [],
  codeDiscount: null,
  canToggle: false,
  ...over,
  totals: {
    units: rows.filter((r) => r.counted !== false).length,
    revenue: 43210,
    cost: 30100,
    profit: 13110,
    without_cost: 0,
    received: 43210,
    remaining: 0,
    manualUnits: 0,
    importUnits: 2,
    excludedUnits: 0,
    excludedRevenue: 0,
    ...over.totals,
  },
});

export const inWords = (node: ReactNode, locale: 'en' | 'ar' = 'en') => (
  <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
    {node}
  </NextIntlClientProvider>
);

/** Every element carrying a hook: from its opening tag to the next element carrying the same hook (or the end). */
export const parts = (out: string, hook: string): string[] => {
  const at = [...out.matchAll(new RegExp(`<[a-z0-9]+[^>]*\\s${hook}(?:=|\\s|>)`, 'g'))].map((m) => m.index);
  return at.map((from, i) => out.slice(from, at[i + 1]));
};
