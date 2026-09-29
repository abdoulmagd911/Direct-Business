// @ts-check
// V59 — the app's wording never says "Direct KSA", "DirectKSA", "Direct Corporate", "B2B" or "MICE" — nor, since the
// owner's list of 29 Sep, "Google", "Zoom", "Keep me signed in" or "GMV". The department is "Commercial"; the product
// is "Commercial Workspace". Scanned: the message catalogs (messages/*.json), the e-mail templates
// (supabase/templates/*.html — V145), every piece of literal text in src/ (strings, template pieces, JSX text — the
// page templates, and the settings' defaults), and — since V404 — the string literals of every migration from
// SEEDS_FROM on: list values and seeds are wording too, and the segment is Government, never "B2G" beside it. In data
// (seeds here, and the database's own copy, core.banned_word) only V59's five and B2G are banned: Google, Zoom, the
// sign-in tick and GMV are words for the chrome, and a meeting channel or a reference system may be named after them
// (QA-67). Older migrations are history (V103); WORDS-01 scans the database they build. Comments are not wording.
// Spacing, hyphens and case do not matter ("Direct-KSA", "b2b").
import { defineCheck, lineOf, literals, parseSource, select, sqlLiterals } from './lib.mjs';

const CHECK = 'forbidden-words';

/** The first migration whose seeds this check reads (V404). */
export const SEEDS_FROM = '20260929091000';

/** @type {[RegExp, string][]} */
export const FORBIDDEN = [
  [/\bdirect[\s\-_.]*ksa\b/gi, 'Direct KSA'],
  [/\bdirect[\s\-_.]*corporate\b/gi, 'Direct Corporate'],
  [/\bb[\s\-_.]*2[\s\-_.]*b\b/gi, 'B2B'],
  // V404: the segment is Government, never with "(B2G)" after it.
  [/\bb[\s\-_.]*2[\s\-_.]*g\b/gi, 'B2G'],
  [/\bmice\b/gi, 'MICE'],
  // The owner's additions (29 Sep): the door has no Google or Zoom (V59), no "keep me signed in" tick (V74), and the
  // money words are Revenue · Cost · Profit (V73) — never GMV.
  [/\bgoogle\b/gi, 'Google'],
  [/\bzoom\b/gi, 'Zoom'],
  [/\bkeep[\s\-_.]+me[\s\-_.]+signed[\s\-_.]+in\b/gi, 'Keep me signed in'],
  [/\bgmv\b/gi, 'Sales (GMV)'],
];

/** The words banned in data too — list values, seeds, names typed in (V59, V404): the database holds this list. */
export const FORBIDDEN_IN_DATA = FORBIDDEN.filter(([, word]) =>
  ['Direct KSA', 'Direct Corporate', 'B2B', 'B2G', 'MICE'].includes(word),
);

/**
 * @param {string} text
 * @param {[RegExp, string][]} [list]
 * @returns {{ index: number, word: string, found: string }[]}
 */
export function forbiddenIn(text, list = FORBIDDEN) {
  const out = [];
  for (const [re, word] of list) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(text));) out.push({ index: m.index, word, found: m[0] });
  }
  return out.sort((a, b) => a.index - b.index);
}

export default defineCheck({
  name: CHECK,
  rule: 'V59/V73/V74/V404: never "Direct KSA", "Direct Corporate", "B2B", "B2G", "MICE", "Google", "Zoom", "Keep me signed in" or "GMV" in the catalogs, the e-mail templates or page text; never V59\'s five or "B2G" in seeds',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const say = (/** @type {string} */ word, /** @type {string} */ found) =>
      `"${found}" — the app never says ${word} (V59); the department is Commercial`;
    for (const file of select(ctx, ['messages/*.json', 'supabase/templates/*.html'])) {
      const text = ctx.read(file);
      for (const f of forbiddenIn(text))
        out.push({ check: CHECK, file, line: lineOf(text, f.index), message: say(f.word, f.found) });
    }
    for (const file of select(ctx, ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}'])) {
      const sf = parseSource(file, ctx.read(file));
      for (const lit of literals(sf)) {
        if (lit.kind === 'regex') continue;
        for (const f of forbiddenIn(lit.text))
          out.push({ check: CHECK, file, line: lit.line, message: say(f.word, f.found) });
      }
    }
    for (const file of select(ctx, ['supabase/migrations/*.sql'])) {
      if ((file.split('/').pop() ?? '').slice(0, 14) < SEEDS_FROM) continue;
      const text = ctx.read(file);
      for (const lit of sqlLiterals(text))
        for (const f of forbiddenIn(lit.text, FORBIDDEN_IN_DATA))
          out.push({ check: CHECK, file, line: lineOf(text, lit.offset + 1 + f.index), message: say(f.word, f.found) });
    }
    return out;
  },
});
