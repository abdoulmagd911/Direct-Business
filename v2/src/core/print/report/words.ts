import type { Bi, Lang, Status } from './model';

/**
 * The fixed words a report document prints around its content (V301). They live here, not in the screen catalogs,
 * because a document prints in a language of its own — an Arabic PDF is made while the screens are in English
 * (Arabic screens wait for P6-7) — and the catalogs load one language at a time. A report's own titles (sections,
 * categories, KPIs) are settings with both labels (V76), never words from this table.
 */
export const DOC_WORDS = {
  monthly_report: { en: 'Monthly report', ar: 'التقرير الشهري' },
  quarterly_report: { en: 'Quarterly report', ar: 'التقرير الربعي' },
  page_of: { en: 'Page {n} of {m}', ar: 'صفحة {n} من {m}' },
  draft: { en: 'Draft', ar: 'مسودة' },
  issued_on: { en: 'Issued {date}', ar: 'صدر في {date}' },
  not_measured: { en: 'not measured', ar: 'غير مقاس' },
  vs: { en: 'vs {label}', ar: 'مقابل {label}' },
  sar: { en: 'SAR', ar: 'ريال' },
  points: { en: '{n} pts', ar: '{n} نقطة' },
  quarter: { en: 'Q{q} {year}', ar: 'الربع {q} {year}' },
  status_on_track: { en: 'On track', ar: 'على المسار' },
  status_at_risk: { en: 'At risk', ar: 'مهدد بالتأخر' },
  status_behind: { en: 'Behind', ar: 'متأخر' },
  status_not_measured: { en: 'Not measured', ar: 'غير مقاس' },
  status_done: { en: 'Done', ar: 'منجز' },
  status_carried_over: { en: 'Carried over', ar: 'مرحل' },
} as const satisfies Record<string, Bi>;

export type DocWord = keyof typeof DOC_WORDS;

/** Arabic ordinal names of the quarters, as the department's reports write them ("الربع الأول"). */
const QUARTER_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع'] as const;

/** A document word with its `{placeholders}` filled. */
export function word(key: DocWord, lang: Lang, vars: Record<string, string | number> = {}): string {
  return DOC_WORDS[key][lang].replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? `{${k}}`));
}

export function statusWord(status: Status, lang: Lang): string {
  return word(`status_${status}` as DocWord, lang);
}

/** "Q3 2026" / "الربع الثالث 2026". */
export function quarterName(q: 1 | 2 | 3 | 4, year: number, lang: Lang): string {
  return word('quarter', lang, { q: lang === 'ar' ? (QUARTER_AR[q - 1] ?? String(q)) : q, year });
}
