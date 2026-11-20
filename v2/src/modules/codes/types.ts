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
  /** Whose code it is — the organisation it is an identifier of (null when that organisation was removed). */
  partner_id?: string | null;
  partner_name?: string | null;
  partner_name_ar?: string | null;
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
  /** The organisation the row is recorded under — what Exclude / Include takes (Landing 32). */
  partner_id?: string | null;
  /** The row's own number — what Exclude / Include takes. */
  number?: string | null;
  /** The kind of rule that keeps the row out of the count; empty when no rule does (e.g. not fully paid). */
  excluded_by?: string | null;
  /** True when the row was excluded by hand on the row itself (Include undoes it); false when a list rule catches it. */
  excluded_row_level?: boolean;
};

export type CodeAttribution = {
  id: string;
  partner_id: string;
  partner_name: string | null;
  partner_name_ar?: string | null;
  is_promo: boolean;
};

export type CodeDetail = {
  id: string;
  code: string;
  valid_from: string | null;
  valid_to: string | null;
  state: CodeState;
  /** Whose code it is (null when that organisation was removed). */
  partner_id?: string | null;
  partner_name?: string | null;
  partner_name_ar?: string | null;
  /** The configured discount value (the latest code_terms row's fee_percent); empty when no terms row exists, never 0. */
  fee_percent: number | null;
  totals: {
    total_discount: number | null;
    total_collected: number | null;
    total_cost: number | null;
    total_profit: number | null;
    units: number;
  };
  ledger: CodeLedgerRow[];
  attributions: CodeAttribution[];
  /** True when the reader is an admin: only an admin excludes a row from the count or includes it again. */
  can_toggle?: boolean;
};

export type CompanyCodeRow = {
  partner_id: string;
  partner_name: string | null;
  partner_name_ar?: string | null;
  codes: number;
  total_discount: number | null;
  total_collected: number | null;
  total_profit: number | null;
};

export type PartnerOption = { id: string; name: string };
