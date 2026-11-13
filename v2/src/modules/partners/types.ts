// The shapes api.partners, api.partner, api.hover_partner, api.notes, api.contracts and api.partner_references answer
// (V98, V146–V154), as the screens read them. Nothing here is computed: every figure comes from the database.

export const SIDES = ['client', 'supplier_partner'] as const;
export type Side = (typeof SIDES)[number];
export const STATUSES = ['prospect', 'active', 'at_risk', 'lost'] as const;
export type Status = (typeof STATUSES)[number];

/** The list page each side is (registry keys; TECH-SPEC §8). */
export const SIDE_PAGE: Record<Side, string> = { client: 'clients', supplier_partner: 'suppliers_partners' };
export const SIDE_ROUTE: Record<Side, string> = { client: '/clients', supplier_partner: '/suppliers' };
export const sideOfRoute = (segment: string): Side | null =>
  segment === 'clients' ? 'client' : segment === 'suppliers' ? 'supplier_partner' : null;

export type SideJson = {
  id: string;
  side: Side;
  on: boolean;
  type_id: string;
  type: string;
  tier_id: string | null;
  fields: Record<string, unknown>;
  since: string | null;
  until: string | null;
  version: number;
  status: Status | null;
  owner_id: string | null;
};

export type PartnerRow = {
  id: string;
  number: string;
  trade_name_en: string;
  trade_name_ar: string | null;
  type: string | null;
  status: Status | null;
  owner_id: string | null;
  sides: SideJson[];
  priority_id: string | null;
  key_partner: boolean;
  logo_file_id: string | null;
  last_activity_on: string | null;
  flags: string[];
  archived: boolean;
  version: number;
  /** FIX-01 (D28): the row's added-at, the stable tie-break when two rows sort the same. */
  created_at: string;
};

export type PartnersAnswer = { total: number; rows: PartnerRow[] };

export type StatusChange = {
  id: string;
  status: Status;
  effective_on: string;
  reason_id: string | null;
  note: string | null;
  set_by: string | null;
  set_at: string;
};
export type SideOwner = { id: string; person_id: string; from: string; to: string | null; reason: string | null };
export type SideFull = SideJson & { status_history: StatusChange[]; owners: SideOwner[] };

export type Identifier = {
  id: string;
  kind: 'payments_client_id' | 'vat' | 'cr' | 'discount_code' | 'email' | 'phone' | 'name';
  subkind: string | null;
  value: string;
  valid_from: string | null;
  valid_to: string | null;
  source: string;
  reason: string | null;
  added_by: string | null;
  added_at: string;
};

export type Contact = {
  id: string;
  partner_id: string;
  name_en: string;
  name_ar: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean;
  role_id: string | null;
  sides: Side[];
  version: number;
};

export type Reference = {
  id: string;
  side: Side | null;
  system: string;
  system_en: string;
  system_ar: string | null;
  value: string;
  url: string | null;
  link: string | null;
  version: number;
};

export type ContractTerm = {
  id: string;
  term: string;
  name_en: string;
  name_ar: string | null;
  unit: string;
  before: string | null;
  after: string | null;
  achievement_id: string | null;
  logged: boolean;
  version: number;
};
export type Contract = {
  id: string;
  side: Side;
  kind: 'contract' | 'agreement';
  title: string;
  start_on: string;
  end_on: string | null;
  reminders_on: boolean;
  reminder_days: number[] | null;
  reminder_days_in_force: number[];
  renewal_task_id: string | null;
  notes: string | null;
  version: number;
  terms: ContractTerm[];
  files: unknown[];
  /** The database's own state for today in Riyadh (partner.contract_state): "expiring" follows the
   *  partner.contract_expiring_from_days setting, the same rule as the list's Contract expiring flag. */
  status?: 'not_started' | 'active' | 'expiring' | 'expired';
  /** Days to its last day (null with no end). */
  days_left?: number | null;
};

export type Note = {
  id: string;
  kind: 'comment' | 'update' | 'activity' | 'meeting_note' | 'escalation';
  body: string | null;
  happened_on: string;
  logged_at: string;
  logged_late: boolean;
  type: string | null;
  type_en: string | null;
  type_ar: string | null;
  outcome: string | null;
  outcome_en: string | null;
  outcome_ar: string | null;
  meaning: string | null;
  next_step: string | null;
  next_step_on: string | null;
  next_step_task_id: string | null;
  author_id: string | null;
  edited_at: string | null;
  version: number;
  mine: boolean;
  mentions: string[];
  /** The My day note it was made from (V433) — null for a reader who may not see it, so a private note's chip hides (V454). */
  from_note?: { id: string; title: string | null } | null;
  /** A line the system wrote (D5): its type and values; the screen words it in the reader's language. Null on a person's note. */
  event?: { type: string; values: { task_id: string; number: string | null; title: string | null } | null } | null;
};

/** One custom field of a side (partner.side_field), as the card carries it: its two labels, its type and, for a
 *  select, its options (`[{ key, en, ar }]`). The values sit in the side's `fields`. */
export type SideFieldDef = {
  side: Side;
  key: string;
  label_en: string;
  label_ar: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options: Record<string, unknown>[] | null;
};

/** A task on the organisation the reader may see (the card's Related list, D5): open first, at most 20. */
export type CardTask = {
  id: string;
  number: string;
  title: string;
  due_on: string | null;
  owner_id: string | null;
  closed_at: string | null;
};

export type PartnerCard = {
  id: string;
  number: string;
  trade_name_en: string;
  trade_name_ar: string | null;
  official_name_en: string | null;
  official_name_ar: string | null;
  priority_id: string | null;
  key_partner: boolean;
  website: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  notes: string | null;
  archived_at: string | null;
  merged_into_id: string | null;
  logo_file_id: string | null;
  client_since: string | null;
  version: number;
  sides: SideFull[];
  /** The custom fields' definitions for the sides the reader may see (labels in both languages); may be absent on
   *  an older card, so the screen falls back to the key. */
  side_fields?: SideFieldDef[];
  identifiers: Identifier[];
  owner_id: string | null;
  contacts: Contact[];
  /** The tasks on it the reader may see, open first (D5) — the Related tab's list. */
  tasks?: CardTask[];
  credit_limits: { id: string; amount_sar: number; prepaid_only: boolean; effective_from: string }[] | null;
  references: Reference[];
  last_activity_on: string | null;
  stale_on: string | null;
  next_step: { note_id: string; text: string; on: string } | null;
  flags: string[];
  counts: {
    contracts: number;
    files: number;
    /** Files on the partner the reader cannot see (F-B6-02): the Files section tells "none" from "hidden". */
    files_hidden: number;
    notes: number;
  };
};

/** One file on a company, as api.files answers it (the existing file doors). */
export type CompanyFile = {
  id: string;
  link_id: string;
  kind: string;
  kind_en: string;
  kind_ar: string | null;
  purpose: string;
  side: Side | null;
  display_name_en: string | null;
  display_name_ar: string | null;
  original_name: string | null;
  mime: string;
  size_bytes: number;
  sensitivity: string;
  status: string;
  review_on: string | null;
  review_due: boolean;
  added_by: string | null;
  /** The uploader's name, in English (FIX-46): the files read names the uploader, as /files does. */
  added_by_name: string | null;
  added_at: string;
  version: number;
};

/** One row of the All files archive, as api.company_files answers it. */
export type ArchiveFile = {
  id: string;
  link_id: string;
  partner_id: string;
  partner_name: string;
  partner_name_ar: string | null;
  kind: string;
  kind_en: string;
  kind_ar: string | null;
  purpose: string;
  side: Side | null;
  display_name_en: string | null;
  display_name_ar: string | null;
  original_name: string | null;
  mime: string;
  size_bytes: number;
  sensitivity: string;
  status: string;
  added_by: string | null;
  added_at: string;
};

/** One row of the All files archive, as api.all_files answers it. */
export type AllFilesRow = {
  id: string;
  link_id: string;
  display_name: string | null;
  display_name_ar: string | null;
  original_name: string | null;
  kind: string;
  kind_en: string;
  kind_ar: string | null;
  purpose: string;
  side: Side | null;
  size: number;
  sensitivity: string;
  status: string;
  review_on: string | null;
  added_by: string | null;
  added_by_name: string | null;
  added_at: string;
  record_label: string | null;
  record_link: string | null;
  entity_table: string;
  entity_id: string;
};

/** api.all_files: the filtered rows with the total before paging, and the live filter options. */
export type AllFilesAnswer = {
  total: number;
  rows: AllFilesRow[];
  facets: { sides: string[]; purposes: string[]; statuses: string[] };
  uploaders: { id: string; name: string | null }[];
};

/** A company's wallet roll-up, as api.company_summary answers it. Held and available stay null: no workspace
 *  table records a hold, so they are shown empty rather than guessed. */
export type CompanyWallet = {
  topped_up: number;
  wallet_spent: number;
  invoiced_total: number;
  balance: number;
  held: number | null;
  available: number | null;
};

/** A company's counted (Fully Paid) money, as api.company_summary answers it. Cost and profit stay null while
 *  every counted unit is still Provisional — missing cost is empty, never 0. */
export type CompanyFinanceTotals = {
  units: number;
  revenue: number;
  cost: number | null;
  profit: number | null;
  provisional_units: number;
  provisional_revenue: number;
  cost_pending: boolean;
  waiting_for_issuing: boolean;
  waiting_count: number;
};

/** One discount code's counted totals for a company, as api.company_summary answers it. */
export type CompanyCodeTotal = { code: string; units: number; revenue: number; profit: number };

/** One tender of a company, as api.company_summary answers it. Expected cost and expected profit stay null:
 *  a tender carries no expected-cost field, so they are never guessed. */
export type CompanyTender = {
  id: string;
  number: string;
  title: string;
  state: 'applied' | 'signed';
  signed_on: string | null;
  client_id_named: boolean;
  tender_amount: number | null;
  invoiced: number | null;
  remaining: number | null;
  units: number | null;
  approved_cost: number | null;
  cost_pending: boolean;
  actual_profit: number | null;
  expected_cost: number | null;
  expected_profit: number | null;
};

/** Everything the company page's Finance tab reads in one go. The money parts are null for a reader without
 *  Finance view — shown as no access, never as zeros. */
export type CompanySummary = {
  partner_id: string;
  finance_visible: boolean;
  wallet: CompanyWallet | null;
  finance: CompanyFinanceTotals | null;
  codes: CompanyCodeTotal[] | null;
  tenders: CompanyTender[] | null;
};

export type HoverPartner = {
  id: string;
  number: string;
  trade_name_en: string;
  trade_name_ar: string | null;
  logo_file_id: string | null;
  key_partner: boolean;
  owner_id: string | null;
  sides: { side: Side; type: string; status: Status | null }[];
};

/** A settings-list entry as api.list answers it (both names, the key; side lists carry their side). */
export type ListEntry = {
  id: string;
  key: string;
  name_en: string;
  name_ar: string | null;
  sort: number | null;
  active: boolean;
  side?: Side;
  status?: string | null;
  activity_type_id?: string | null;
  meaning?: string | null;
  counts_as_demo?: boolean;
  [column: string]: unknown;
};

/** A name is plain text: a seeded name that carries markup ("<b>…</b>") shows without it, never as literal tags (F106). */
const stripTags = (s: string) => s.replace(/<[^>]*>/g, '');

export const nameOf = (x: { name_en: string; name_ar?: string | null } | undefined, locale: 'en' | 'ar') =>
  x ? stripTags(locale === 'ar' && x.name_ar ? x.name_ar : x.name_en) : '';

/**
 * The client priority scale (D16): High / Medium / Low. The work-priority words (an executive directive is a task
 * word) are not client levels, so the client pickers show only this scale — plus a priority already stored on the
 * record, so an existing value never vanishes from its own picker.
 */
export const clientPriorities = (all: ListEntry[], includeId?: string | null) => {
  const scale = all.filter((x) => x.key === 'high' || x.key === 'medium' || x.key === 'low');
  const stored = includeId ? all.find((x) => x.id === includeId) : undefined;
  return stored && !scale.some((x) => x.id === stored.id) ? [...scale, stored] : scale;
};
export const tradeName = (p: { trade_name_en: string; trade_name_ar?: string | null }, locale: 'en' | 'ar') =>
  stripTags(locale === 'ar' && p.trade_name_ar ? p.trade_name_ar : p.trade_name_en);
export const statusTone = (s: Status | null): 'success' | 'warning' | 'danger' | 'neutral' | 'info' =>
  s === 'active'
    ? 'success'
    : s === 'at_risk'
      ? 'warning'
      : s === 'lost'
        ? 'danger'
        : s === 'prospect'
          ? 'info'
          : 'neutral';
