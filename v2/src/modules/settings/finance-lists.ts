// The two lists of Settings → Finance (Landing 32, Finance F-B): what is taken out of the money (the exclusion list)
// and what is counted under another organisation (the merge list). Admins only — the database refuses anyone else
// (42501), and this is the same rule for the screen, so it never draws a card the database would refuse.
// Every entry is typed by the person: nothing here pre-fills, suggests or defaults a kind, a value or a reason.
import { errorKey } from '@/core/db/words';

/** The kinds the exclusion list offers, in the order of the select. */
export const EXCLUSION_KINDS = ['client_id', 'name', 'discount_code', 'tax_no'] as const;
export type ExclusionKind = (typeof EXCLUSION_KINDS)[number];

/** The kinds the merge list offers. */
export const MERGE_KINDS = ['client_id', 'discount_code'] as const;
export type MergeKind = (typeof MERGE_KINDS)[number];

/** One rule of api.finance_exclusion_rules. */
export type ExclusionRule = {
  id: string;
  kind: string;
  value: string;
  mode: 'exclude' | 'hide';
  reason: string | null;
  version: number;
  created_at?: string | null;
  created_by?: string | null;
  partner_id?: string | null;
  /** True for a rule made by Exclude on one Ledger row: undone there with Include, never here. */
  row_level: boolean;
  /** What it catches now: rows, and their revenue in riyals. */
  rows: number | null;
  amount_sar: number | null;
  imported_rows?: number | null;
  imported_amount_sar?: number | null;
};

/** One rule of api.finance_merge_rules. */
export type MergeRule = {
  id: string;
  kind: string;
  value: string;
  partner_id: string;
  partner_number: string | null;
  trade_name_en: string | null;
  trade_name_ar: string | null;
  reason: string | null;
  version: number;
  created_at?: string | null;
  created_by?: string | null;
  rows: number | null;
  amount_sar: number | null;
};

type WithRole = { person: { role: { is_admin: boolean } | null } };

/** Whether this person sees the two lists: an admin, and only on the Finance group of Settings. */
export function showsFinanceLists(me: WithRole, group: string): boolean {
  return group === 'finance' && me.person.role?.is_admin === true;
}

/** The rules of the list itself, and apart from them the ones made by Exclude on single Ledger rows. */
export function splitExclusionRules(rules: readonly ExclusionRule[]): {
  list: ExclusionRule[];
  rowLevel: ExclusionRule[];
} {
  return { list: rules.filter((r) => r.row_level !== true), rowLevel: rules.filter((r) => r.row_level === true) };
}

/** A rule's hook on the screen: `<kind>:<value>`. */
export const ruleHook = (r: { kind: string; value: string }) => `${r.kind}:${r.value}`;

/** What the add dialog of the exclusion list holds. It opens blank: the person chooses and types everything. */
export type ExclusionDraft = { kind: ExclusionKind | ''; value: string; reason: string };
export const blankExclusion = (): ExclusionDraft => ({ kind: '', value: '', reason: '' });

/** What the add dialog of the merge list holds; `partner` is the organisation the value is counted under. */
export type MergeDraft<P> = { kind: MergeKind | ''; value: string; partner: P | null; reason: string };
export const blankMerge = <P>(): MergeDraft<P> => ({ kind: '', value: '', partner: null, reason: '' });

/**
 * The value as it is kept while typing: a client ID is digits only (Arabic-Indic digits read as the digits they
 * are, anything else is dropped as it is typed); every other kind is the text as typed.
 */
export function typedRuleValue(kind: string, text: string): string {
  if (kind !== 'client_id') return text;
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/\D/g, '');
}

/** Whether a value can be saved for its kind: something typed, and digits only for a client ID. */
export function ruleValueOk(kind: string, value: string): boolean {
  const v = value.trim();
  return v.length > 0 && (kind !== 'client_id' || /^\d+$/.test(v));
}

/** A reason is required on every change to the lists: something typed, not spaces. */
const hasReason = (reason: string) => reason.trim().length > 0;

/** Add to the exclusion list needs a kind, a value and a reason — Save stays off without any of the three. */
export function exclusionDraftOk(d: ExclusionDraft): boolean {
  return (EXCLUSION_KINDS as readonly string[]).includes(d.kind) && ruleValueOk(d.kind, d.value) && hasReason(d.reason);
}

/** Add to the merge list needs a kind, a value, the organisation it is counted under, and a reason. */
export function mergeDraftOk<P>(d: MergeDraft<P>): boolean {
  return (
    (MERGE_KINDS as readonly string[]).includes(d.kind) &&
    ruleValueOk(d.kind, d.value) &&
    d.partner !== null &&
    hasReason(d.reason)
  );
}

/** What api.finance_exclusion_rule_save takes for a new rule: exactly what was typed, trimmed. */
export function exclusionFields(d: ExclusionDraft) {
  return { kind: d.kind, value: d.value.trim(), mode: 'exclude' as const, reason: d.reason.trim() };
}

/** What api.finance_merge_rule_save takes for a new rule. */
export function mergeFields(d: MergeDraft<{ id: string }>) {
  return { kind: d.kind, value: d.value.trim(), partner_id: d.partner?.id ?? null, reason: d.reason.trim() };
}

type Refusals = { has: (key: string) => boolean; failed: (key: string, detail: string) => string };

/**
 * A refusal in words (a rule that is already on the list — `finance.exclusion_rule_exists`,
 * `finance.merge_rule_exists` — reads as its own sentence; anything else as the kind's general line).
 */
export function refusalWords(e: unknown, words: Refusals): string {
  const { key, detail } = errorKey(e, words.has);
  return words.failed(key, detail);
}

/** The organisation a merge rule counts under, in the reader's language (the English name when there is no Arabic). */
export function mergeTargetName(r: Pick<MergeRule, 'trade_name_en' | 'trade_name_ar'>, locale: string): string {
  return (locale === 'ar' && r.trade_name_ar ? r.trade_name_ar : r.trade_name_en) ?? '';
}
