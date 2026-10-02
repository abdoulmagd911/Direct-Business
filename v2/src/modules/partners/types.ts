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
  state?: { status: string; days?: number };
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
  identifiers: Identifier[];
  owner_id: string | null;
  contacts: Contact[];
  credit_limits: { id: string; amount_sar: number; prepaid_only: boolean; effective_from: string }[] | null;
  references: Reference[];
  last_activity_on: string | null;
  stale_on: string | null;
  next_step: { note_id: string; text: string; on: string } | null;
  flags: string[];
  counts: { contracts: number; files: number; notes: number };
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

export const nameOf = (x: { name_en: string; name_ar?: string | null } | undefined, locale: 'en' | 'ar') =>
  x ? (locale === 'ar' && x.name_ar ? x.name_ar : x.name_en) : '';
export const tradeName = (p: { trade_name_en: string; trade_name_ar?: string | null }, locale: 'en' | 'ar') =>
  locale === 'ar' && p.trade_name_ar ? p.trade_name_ar : p.trade_name_en;
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
