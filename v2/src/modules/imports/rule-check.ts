// The exclusion list, counted in the import preview (Landing 32, A2). The database says whether the list catches
// this import (api.finance_import_rule_check): the whole organisation or discount code (`excluded`), or single rows
// named one by one (`numbers`). Such rows are still STORED on Confirm — exclusion is applied when figures are read —
// but they will not be counted, and the preview must say so before Confirm, never after. Pure: the review screen
// and the unit tests count with the same function. Nothing here changes what is sent to the database.

import type { Preview, PreviewCounts, PreviewRow } from './preview';

export type RuleCheck = {
  /** True when a list rule catches every money row of this import (its organisation, or its discount code). */
  excluded: boolean;
  kind: string | null;
  value: string | null;
  reason: string | null;
  /** Folded invoice / transaction numbers the list names one by one. */
  numbers: string[];
};

const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** The database's answer, read once; anything that is not such an answer is null (the check did not answer). */
export function ruleCheckOf(answer: unknown): RuleCheck | null {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null;
  const a = answer as Record<string, unknown>;
  if (typeof a.excluded !== 'boolean') return null;
  return {
    excluded: a.excluded,
    kind: text(a.kind),
    value: text(a.value),
    reason: text(a.reason),
    numbers: Array.isArray(a.numbers) ? a.numbers.filter((n): n is string => typeof n === 'string' && n !== '') : [],
  };
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';

/**
 * A number as the database folds it before comparing (norm.fold, for the characters a row number is written in):
 * one case, Arabic digits as Latin ones, no dots, anything that is not a letter or a digit as one space.
 */
export function foldNumber(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[٠-٩۰-۹]/g, (d) => String(ARABIC_DIGITS.indexOf(d) % 10))
    .replace(/\./g, '')
    .replace(/[^a-z0-9À-ɏء-غف-ي]+/g, ' ')
    .trim();
}

/** A preview row that will be written on Confirm: held rows and skipped duplicates write nothing. */
const isStored = (r: PreviewRow) => r.outcome !== 'excluded' && r.values !== null;

export type RuleCount = {
  /** The preview's counts with the rows the list catches ADDED to "Left out by rule"; the other four are untouched. */
  counts: PreviewCounts;
  /** The row numbers (as the file numbers them) the list catches: stored, not counted. */
  rowNos: number[];
  /** True when the list catches the whole import, not single rows. */
  whole: boolean;
};

/**
 * Count the rows of a preview the exclusion list catches. They are added to the "Left out by rule" count — beside
 * the held rows already there — and stay in their own outcome too (new, updated …), because they are still written.
 * No answer from the check (null) counts nothing: the screen says the list could not be checked.
 */
export function countRuleExcluded(preview: Preview, check: RuleCheck | null): RuleCount {
  if (!check) return { counts: preview.counts, rowNos: [], whole: false };
  const named = new Set(check.numbers.map((n) => foldNumber(n)).filter((n) => n !== ''));
  const hit = (r: PreviewRow) => {
    if (!isStored(r)) return false;
    if (check.excluded) return true;
    if (named.size === 0) return false;
    return [r.transaction_ref, r.invoice_ref, r.values?.transaction_ref, r.values?.invoice_ref].some(
      (n) => !!n && named.has(foldNumber(n)),
    );
  };
  const rowNos = preview.rows.filter(hit).map((r) => r.row_no);
  return {
    counts: { ...preview.counts, excluded: preview.counts.excluded + rowNos.length },
    rowNos,
    whole: check.excluded,
  };
}
