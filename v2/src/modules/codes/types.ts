// The shapes api.codes_list, api.codes_detail and api.codes_by_company answer in. Nothing here is computed:
// every figure comes from the database, from the Finance report's own counted units (finance.money_row), so the
// codes report is the same report as Finance, filtered to a code's invoices — never a second calculation.

export type CodeState = 'active' | 'inactive' | 'expired';

export type CodeRow = {
  id: string;
  code: string;
  valid_from: string | null;
  valid_to: string | null;
  state: CodeState;
  /** Counted uses only; empty when the code has no counted use, never 0. */
  total_discount: number | null;
  total_collected: number | null;
  units: number;
};

export type CodeLedgerRow = {
  use_id: string;
  invoice_id: string;
  ref: string;
  created_on: string;
  status_word: string | null;
  discount_sar: number;
  source: 'promo' | 'manual';
  direct_url: string | null;
  counted: boolean;
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  excluded_reason: string | null;
};

export type CodeAttribution = {
  id: string;
  partner_id: string;
  partner_name: string | null;
  is_promo: boolean;
};

export type CodeDetail = {
  id: string;
  code: string;
  valid_from: string | null;
  valid_to: string | null;
  state: CodeState;
  totals: {
    total_discount: number | null;
    total_collected: number | null;
    total_cost: number | null;
    total_profit: number | null;
    units: number;
  };
  ledger: CodeLedgerRow[];
  attributions: CodeAttribution[];
};

export type CompanyCodeRow = {
  partner_id: string;
  partner_name: string | null;
  codes: number;
  total_discount: number | null;
  total_collected: number | null;
  total_profit: number | null;
};

export type PartnerOption = { id: string; name: string };
