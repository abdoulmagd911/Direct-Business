import { formatNumber, formatStoredDate } from '@/core/i18n/format';
import type { Side, SideFieldDef } from './types';

/** A select's option as stored (`{ key, en, ar }`; older rows may say label_/name_ instead). */
type Option = Record<string, unknown>;
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
const optionLabel = (o: Option, locale: 'en' | 'ar') =>
  (locale === 'ar' ? (text(o.ar) ?? text(o.label_ar) ?? text(o.name_ar)) : undefined) ??
  text(o.en) ??
  text(o.label_en) ??
  text(o.name_en);

/**
 * A side's custom field by its name, never its key: the definition's label in the reader's language. A value whose
 * definition was retired after it was stored has no label left, so it reads as its key in words ("payment_terms" →
 * "Payment terms"), never as a code.
 */
export function sideFieldLabel(def: SideFieldDef | undefined, key: string, locale: 'en' | 'ar'): string {
  const own = def ? ((locale === 'ar' ? text(def.label_ar) : undefined) ?? text(def.label_en)) : undefined;
  if (own) return own;
  const words = key.replace(/_+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A stored value in words: a yes/no field says Yes or No, a select says its option's label (the stored key only
 * when the option is gone), a date is written the one way, a number with its digits grouped; text as typed. Null for
 * an empty value, so the caller shows its own empty mark.
 */
export function sideFieldValue(
  def: SideFieldDef | undefined,
  value: unknown,
  locale: 'en' | 'ar',
  words: { yes: string; no: string },
): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? words.yes : words.no;
  if (def?.type === 'select') {
    const o = (def.options ?? []).find((x) => x && x.key === value);
    const label = o ? optionLabel(o, locale) : undefined;
    if (label) return label;
  }
  if (typeof value === 'number') return formatNumber(value, locale);
  if (typeof value === 'string') return formatStoredDate(value, locale) ?? value;
  return JSON.stringify(value);
}

/**
 * The fields a side shows, in the order its definitions set (then any stored key without a definition), each with
 * its label and its value in words. Only fields that hold a value are listed: a side has no door to fill a field in,
 * so an empty one would be a label with nothing to do.
 */
export function sideFieldRows(
  side: Side,
  values: Record<string, unknown> | null | undefined,
  defs: SideFieldDef[] | undefined,
  locale: 'en' | 'ar',
  words: { yes: string; no: string },
): { key: string; label: string; value: string }[] {
  const own = (defs ?? []).filter((d) => d.side === side);
  const stored = values ?? {};
  const keys = [...own.map((d) => d.key), ...Object.keys(stored).filter((k) => !own.some((d) => d.key === k))];
  const rows: { key: string; label: string; value: string }[] = [];
  for (const key of keys) {
    const def = own.find((d) => d.key === key);
    const value = sideFieldValue(def, stored[key], locale, words);
    if (value !== null) rows.push({ key, label: sideFieldLabel(def, key, locale), value });
  }
  return rows;
}
