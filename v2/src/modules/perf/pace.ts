// What the KPI pace page reads (api.kpi_pace, Landing 54) and how it is drawn. Every figure — the actual, the pace,
// the status, the share of a target due by each day — is the database's (one copy of the rule, perf.pace_pct and
// perf.pace_status); nothing here works a pace out again. The helpers below only place what was read on the screen.
import type { Tone } from '@/ui/Chip';

export type PaceStatus = 'on_track' | 'at_risk' | 'behind' | 'not_started' | 'not_measured';

export type PaceRow = {
  /** `<target id>:<measure>` — a target is one KPI by count, and one more by deal value where it names one. */
  id: string;
  target_id: string;
  plan_id: string;
  category_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  measure: 'count' | 'value';
  department_id: string;
  department_en: string;
  department_ar: string | null;
  target: number;
  actual: number;
  /** A whole percent, or null when there is nothing to judge yet. */
  pace: number | null;
  status: PaceStatus;
  responsible: {
    id: string;
    full_name_en: string;
    full_name_ar: string | null;
    nickname_en: string | null;
    display_name_en: string | null;
    display_name_ar: string | null;
  } | null;
  /** The days something was achieved, each with that day's figure. */
  daily: { day: string; value: number }[];
  /** The projects the month's achievements belong to, each with how many. */
  initiatives: { id: string; name: string; count: number }[];
};

export type PaceAnswer = {
  /** The first of the month, `YYYY-MM-01`. */
  month: string;
  /** Today in Riyadh. */
  today: string;
  working_days: number;
  days_passed: number;
  share: number;
  bands: { on_track: number; at_risk: number };
  years: number[];
  can_edit: boolean;
  can_see_projects: boolean;
  /** Every day of the month with the share of a month's target due by its end. */
  days: { day: string; working: boolean; share: number }[];
  counts: { on_track: number; at_risk: number; behind: number };
  rows: PaceRow[];
};

/** The pill's tone for each status: the word always shows, the colour only backs it. */
export const STATUS_TONE: Record<PaceStatus, Tone> = {
  on_track: 'success',
  at_risk: 'warning',
  behind: 'danger',
  not_started: 'neutral',
  not_measured: 'neutral',
};

/** How much of the bar is filled: the pace, never under 0 or over the whole bar. */
export function barFill(pace: number | null): number {
  if (pace === null || !Number.isFinite(pace)) return 0;
  return Math.max(0, Math.min(100, pace));
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `YYYY-MM` moved by a number of months. */
export function shiftMonth(month: string, by: number): string {
  const m = MONTH.exec(month);
  if (!m) return month;
  const at = Number(m[1]) * 12 + (Number(m[2]) - 1) + by;
  return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`;
}

/** The same month in another year. */
export function inYear(month: string, year: number): string {
  return `${year}-${month.slice(5, 7)}`;
}

export type Curve = {
  /** The target due by the end of each day, the whole month. */
  target: { x: number; y: number }[];
  /** The running actual, up to today (the whole month once it is over; nothing before it begins). */
  actual: { x: number; y: number }[];
  /** The top of the scale. */
  max: number;
  /** Where today stands along the month (0 to 1), or null when today is not in it. */
  today: number | null;
};

/**
 * The two lines of the chart for one KPI, placed on a 0–1 square (x along the month, y up the scale): the target due
 * day by day (the database's share of each day) and the running actual to date.
 */
export function curveOf(row: PaceRow, answer: Pick<PaceAnswer, 'days' | 'today'>): Curve {
  const days = answer.days;
  const n = days.length;
  const at = (i: number) => (n > 1 ? i / (n - 1) : 0);
  const byDay = new Map(row.daily.map((d) => [d.day, Number(d.value)]));
  const total = row.daily.reduce((sum, d) => sum + Number(d.value), 0);
  const target = Number(row.target);
  const max = Math.max(target, total, 1);
  const todayIndex = days.findIndex((d) => d.day === answer.today);
  const first = days[0]?.day ?? '';
  const last = days[n - 1]?.day ?? '';
  // days are ISO dates, so they compare as text
  const upTo = answer.today < first ? -1 : answer.today > last ? n - 1 : todayIndex;
  let running = 0;
  const actual: Curve['actual'] = [];
  days.forEach((d, i) => {
    running += byDay.get(d.day) ?? 0;
    if (i <= upTo) actual.push({ x: at(i), y: running / max });
  });
  return {
    target: days.map((d, i) => ({ x: at(i), y: (target * Number(d.share)) / max })),
    actual,
    max,
    today: todayIndex >= 0 ? at(todayIndex) : null,
  };
}
