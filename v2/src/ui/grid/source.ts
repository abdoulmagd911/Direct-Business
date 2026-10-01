/**
 * The report a paste of past work comes from (V506): one of the department's four reports, and which one — its month,
 * or its quarter for the Commercial quarterly. It stands as the evidence of every row pasted from it, and an undated
 * row takes the report's last day (V504). Past work starts on 1 January 2025 (V506). Calendar arithmetic only, in
 * whole days — nothing here reads the computer's clock or time zone (PRF-139); the grid passes Riyadh's today (D20).
 */
export const SOURCE_REPORTS = ['bd_monthly', 'partnerships', 'commercial_quarterly', 'improvements'] as const;
export type SourceReportKind = (typeof SOURCE_REPORTS)[number];

/** How long each report covers. */
export const SOURCE_PERIOD: Readonly<Record<SourceReportKind, 'month' | 'quarter'>> = {
  bd_monthly: 'month',
  partnerships: 'month',
  commercial_quarterly: 'quarter',
  improvements: 'month',
};

/** The first day past work may carry (V506). */
export const PAST_WORK_FROM = '2025-01-01';

/** A report: its kind, and its period — `YYYY-MM` for a month, `YYYY-Qn` for a quarter. */
export interface SourceReport {
  kind: SourceReportKind;
  period: string;
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const QUARTER = /^(\d{4})-Q([1-4])$/;

/** The last calendar day of a period (`YYYY-MM-DD`), or null for a period that is not one. */
export function periodLastDay(period: string): string | null {
  const m = MONTH.exec(period);
  const q = QUARTER.exec(period);
  if (!m && !q) return null;
  const year = Number((m ?? q)![1]);
  const month = m ? Number(m[2]) : Number(q![2]) * 3;
  // Day 0 of the next month is the month's last day; Date.UTC only counts days here, no clock is read.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/**
 * The periods a report of this kind may be, oldest first: from the one holding 1 January 2025 to the last one that
 * has ended by today (a report is issued once its period is over).
 */
export function periodsFor(kind: SourceReportKind, today: string): string[] {
  const out: string[] = [];
  const quarterly = SOURCE_PERIOD[kind] === 'quarter';
  const [fromYear] = PAST_WORK_FROM.split('-').map(Number);
  const [toYear] = today.split('-').map(Number);
  for (let y = fromYear!; y <= toYear!; y++)
    for (let n = 1; n <= (quarterly ? 4 : 12); n++) {
      const period = quarterly ? `${y}-Q${n}` : `${y}-${String(n).padStart(2, '0')}`;
      if (periodLastDay(period)! <= today) out.push(period);
    }
  return out;
}

/**
 * Whether report `a` is newer than report `b` (V502, the Architect's answer of 1 Oct): the later last day; on the same
 * day the quarterly beats the monthly — March's monthly and Q1's quarterly both end 31 March, and the quarterly wins.
 * The database settles it when it saves (builder E's `perf.report_newer`); this only lets the preview say so first.
 */
export function reportIsNewer(a: SourceReport, b: SourceReport): boolean {
  const da = periodLastDay(a.period);
  const db = periodLastDay(b.period);
  if (!da || !db) return false;
  if (da !== db) return da > db;
  return SOURCE_PERIOD[a.kind] === 'quarter' && SOURCE_PERIOD[b.kind] === 'month';
}

/** A source the screen may send: a known kind, and a period of its length that has ended by today. */
export function isSourceReport(source: SourceReport | null | undefined, today: string): source is SourceReport {
  return !!source && SOURCE_REPORTS.includes(source.kind) && periodsFor(source.kind, today).includes(source.period);
}
