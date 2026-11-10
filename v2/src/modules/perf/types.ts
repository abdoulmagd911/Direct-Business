// What the achievements doors answer (migration 20261001210000_perf_achievements.sql): api.achievements,
// api.achievement, api.achievement_categories. Plain types, no React.

/**
 * FIX-36 F073: a line's category prefix is not doubled at render — when the title already starts with the prefix
 * the line template prepended, the stored line reads "Cost saving: Cost saving: …"; one copy is stripped for
 * display. The stored line (and its sort order) is untouched.
 */
export function displayLine(line: string): string {
  const i = line.indexOf(': ');
  if (i < 0) return line;
  const prefix = line.slice(0, i);
  const rest = line.slice(i + 2);
  return rest.startsWith(`${prefix}: `) ? `${prefix}: ${rest.slice(prefix.length + 2)}` : line;
}

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
  /** FIX-35: the task this achievement was logged from (00014) — the number only when the reader may see the task. */
  source_task_id: string | null;
  source_task_number: string | null;
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
  /** The sentences a report line is drafted from (V76); the database defaults them to '{title}'. */
  line_template_en: string;
  line_template_ar: string;
  sort: number;
  active: boolean;
  version: number;
};

/** One target of a plan (FIX-23, api.targets): the month, the count and deal-value total expected, and what the
 * month has achieved so far (read, never stored). */
export type TargetRow = {
  id: string;
  plan_id: string;
  category_id: string;
  category_code: string;
  category_name_en: string;
  category_name_ar: string;
  /** The first of the month, YYYY-MM-01. */
  month: string;
  target_count: number;
  target_value: number | null;
  achieved_count: number;
  achieved_value: number;
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
  /** FIX-01: the list's sort; absent, the server's own order (newest logged first) stands. */
  sort?: AchievementSortKey;
};

/** FIX-01: the achievements sort — newest or oldest logged, title, or the achievement's own date. */
export const ACHIEVEMENT_SORTS = ['newest', 'oldest', 'title', 'date'] as const;
export type AchievementSortKey = (typeof ACHIEVEMENT_SORTS)[number];

/**
 * FIX-01 (D28): one list sorted, stably — the tie-break is always added-at (`logged_at`) then id, so two rows in
 * the same place never swap. Newest and oldest log by when the achievement was logged; date by the day it happened
 * (an undated one sits last); title by the line as it reads on screen.
 */
export function sortAchievements(
  rows: readonly AchievementRow[],
  sort: AchievementSortKey | undefined,
  locale: 'en' | 'ar',
): AchievementRow[] {
  if (!sort) return [...rows];
  const byAdded = (a: AchievementRow, b: AchievementRow) =>
    a.logged_at < b.logged_at ? 1 : a.logged_at > b.logged_at ? -1 : a.id < b.id ? -1 : 1;
  const line = (r: AchievementRow) => (locale === 'ar' ? r.line_ar : r.line_en);
  return [...rows].sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return a.logged_at < b.logged_at ? -1 : a.logged_at > b.logged_at ? 1 : a.id < b.id ? -1 : 1;
      case 'title':
        return line(a).localeCompare(line(b)) || byAdded(a, b);
      case 'date': {
        if (a.happened_on === null && b.happened_on === null) return byAdded(a, b);
        if (a.happened_on === null) return 1;
        if (b.happened_on === null) return -1;
        return a.happened_on < b.happened_on ? 1 : a.happened_on > b.happened_on ? -1 : byAdded(a, b);
      }
      default:
        return byAdded(a, b);
    }
  });
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function filterOf(q: Record<string, string | string[] | undefined>): ListFilter {
  const one = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : undefined);
  const month = one('month');
  const sort = one('sort');
  return {
    category: one('category')?.toUpperCase() || undefined,
    mine: one('mine') === '1' || undefined,
    month: month && MONTH.test(month) ? month : undefined,
    backfilled: one('backfilled') === '1' || undefined,
    past: one('past') === '1' || undefined,
    needsOwner: one('owner') === 'none' || undefined,
    sort: sort && (ACHIEVEMENT_SORTS as readonly string[]).includes(sort) ? (sort as AchievementSortKey) : undefined,
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
  if (f.sort) q.set('sort', f.sort);
  const s = q.toString();
  return `/kpis/achievements${s ? `?${s}` : ''}`;
}
