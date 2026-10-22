/**
 * Text as documents print it (PDF, PPTX, spreadsheets). Builder C's lane (V300).
 *
 * - V40: Latin digits in both languages. Arabic text typed by a person — or drafted by the on-device translator
 *   (V76) — may carry Arabic-Indic digits and separators; a document never prints them.
 * - V58: people and partners inside a frozen report are entity tokens (`{{partner:<id>}}`), rendered with the name
 *   they have when the document is made, so a rename changes no figure and no hash.
 */

const ARABIC_INDIC = /[\u{0660}-\u{0669}]/gu; // ٠–٩
const EXTENDED_ARABIC_INDIC = /[\u{06F0}-\u{06F9}]/gu; // ۰–۹ (Persian and Urdu forms)

/** Arabic-Indic digits, and the Arabic decimal, thousands and percent signs, to their Latin forms (V40). */
export function latinDigits(s: string): string {
  return s
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u{066B}/gu, '.') // ٫ Arabic decimal separator
    .replace(/\u{066C}/gu, ',') // ٬ Arabic thousands separator
    .replace(/\u{066A}/gu, '%'); // ٪ Arabic percent sign
}

/** Every string a document prints goes through here: one Unicode form, Latin digits. */
export function docText(s: string): string {
  return latinDigits(s.normalize('NFC'));
}

/** The entity kinds a report may name by token (V58). */
export type EntityKind = 'partner' | 'person';

const TOKEN = /\{\{(partner|person):([0-9a-fA-F-]{1,64})\}\}/g;

/**
 * Replaces each `{{partner:<id>}}` / `{{person:<id>}}` with the current name. A token whose record the lookup does
 * not know is kept visible as "—", never as the raw token and never as an empty string (a gap must show).
 */
export function resolveEntityTokens(text: string, nameOf: (kind: EntityKind, id: string) => string | null): string {
  return text.replace(TOKEN, (_all, kind: EntityKind, id: string) => nameOf(kind, id) ?? '—');
}

/** The ids a text names by token, so a caller can fetch exactly those names first. */
export function entityTokens(text: string): { kind: EntityKind; id: string }[] {
  return [...text.matchAll(TOKEN)].map((m) => ({ kind: m[1] as EntityKind, id: m[2] as string }));
}
