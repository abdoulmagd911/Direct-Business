// What the achievements doors answer (migration 20261001210000_perf_achievements.sql): api.achievements,
// api.achievement, api.achievement_categories. Plain types, no React.

export type ReportKind = 'bd_monthly' | 'partnerships' | 'commercial_quarterly' | 'improvements';

export type AchievementRow = {
  id: string;
  /** ACH-2026-0042 (V531): shown beside the date and the organisation everywhere. */
  number: string;
  repeat_of: string | null;
  repeat_of_number: string | null;
  mou_side: 'client' | 'supplier_partner' | null;
  plan_id: string;
  year: number;
  department_id: string;
  category: string;
  category_en: string;
  category_ar: string;
  parent_category: string | null;
  has_deal_value: boolean;
  title: string;
  count: number;
  deal_value: number | null;
  value_report_kind: ReportKind | null;
  value_report_period: string | null;
  partner_id: string | null;
  owner_id: string | null;
  happened_on: string | null;
  logged_at: string;
  origin: 'person' | 'task' | 'report' | 'import' | 'backfill';
  source_kind: ReportKind | null;
  source_period: string | null;
  date_from_report: boolean;
  use_as_example: boolean;
  version: number;
  line_en: string;
  line_ar: string;
  can_edit: boolean;
  participants: string[];
  past_work: boolean;
  needs_owner: boolean;
  backfilled: boolean;
  draft: boolean;
  no_evidence: boolean;
  logged_late: boolean;
  moved: boolean;
};

export type AchievementRef = {
  id: string;
  system: string;
  system_en: string;
  system_ar: string;
  value: string;
  url: string | null;
  version: number;
};

export type AchievementDetail = AchievementRow & {
  notes: string | null;
  before_value: number | null;
  after_value: number | null;
  created_by: string;
  moved_from: string | null;
  move_reason: string | null;
  moved_by: string | null;
  import_key: string | null;
  refs: AchievementRef[];
  participant_roles: { id: string; person_id: string; role: string | null }[];
};

export type AchievementPage = { rows: AchievementRow[]; total: number; more: boolean };

export type Category = {
  id: string;
  plan_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  parent_id: string | null;
  parent_code: string | null;
  is_money_link: boolean;
  has_deal_value: boolean;
  /** An MoU (V521): logged with an organisation, it names the side it was signed with. */
  sets_prospect: boolean;
  required_ref_system: string | null;
  sort: number;
  active: boolean;
  version: number;
};

/** The list's filters, kept in the address (`?category=…&mine=1&month=2026-09&backfilled=1&past=1&owner=none`). */
/** A possible repeat (V531), from api.achievement_repeats. */
export type RepeatMatch = { id: string; number: string; title: string; happened_on: string; score: number };

export type ListFilter = {
  category?: string;
  mine?: boolean;
  month?: string;
  backfilled?: boolean;
  past?: boolean;
  needsOwner?: boolean;
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function filterOf(q: Record<string, string | string[] | undefined>): ListFilter {
  const one = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : undefined);
  const month = one('month');
  return {
    category: one('category')?.toUpperCase() || undefined,
    mine: one('mine') === '1' || undefined,
    month: month && MONTH.test(month) ? month : undefined,
    backfilled: one('backfilled') === '1' || undefined,
    past: one('past') === '1' || undefined,
    needsOwner: one('owner') === 'none' || undefined,
  };
}

/** The filter as api.achievements reads it. */
export function apiFilter(f: ListFilter): Record<string, unknown> {
  return {
    ...(f.category ? { category: f.category } : {}),
    ...(f.mine ? { scope: 'mine' } : {}),
    ...(f.month ? { month: f.month } : {}),
    ...(f.backfilled ? { backfilled: true } : {}),
    ...(f.past ? { past_work: true } : {}),
    ...(f.needsOwner ? { needs_owner: true } : {}),
  };
}

/** The filter as an address. */
export function hrefOf(f: ListFilter): string {
  const q = new URLSearchParams();
  if (f.category) q.set('category', f.category);
  if (f.mine) q.set('mine', '1');
  if (f.month) q.set('month', f.month);
  if (f.backfilled) q.set('backfilled', '1');
  if (f.past) q.set('past', '1');
  if (f.needsOwner) q.set('owner', 'none');
  const s = q.toString();
  return `/kpis/achievements${s ? `?${s}` : ''}`;
}
