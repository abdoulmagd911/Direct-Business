// @ts-check
// V59 — the app's wording never says "Direct KSA", "DirectKSA", "Direct Corporate", "B2B" or "MICE" — nor, since the
// owner's list of 29 Sep, "Google", "Zoom", "Keep me signed in" or "GMV". The department is "Commercial"; the product
// is "Commercial Workspace". Scanned: the message catalogs (messages/*.json), the e-mail templates
// (supabase/templates/*.html — V145) and every piece of literal text in src/ (strings, template pieces, JSX text — the
// page templates). Comments are not wording. Spacing, hyphens and case do not matter ("Direct-KSA", "b2b").
import { defineCheck, lineOf, literals, parseSource, select } from './lib.mjs';

const CHECK = 'forbidden-words';

/** @type {[RegExp, string][]} */
export const FORBIDDEN = [
  [/\bdirect[\s\-_.]*ksa\b/gi, 'Direct KSA'],
  [/\bdirect[\s\-_.]*corporate\b/gi, 'Direct Corporate'],
  [/\bb[\s\-_.]*2[\s\-_.]*b\b/gi, 'B2B'],
  [/\bmice\b/gi, 'MICE'],
  // The owner's additions (29 Sep): the door has no Google or Zoom (V59), no "keep me signed in" tick (V74), and the
  // money words are Revenue · Cost · Profit (V73) — never GMV.
  [/\bgoogle\b/gi, 'Google'],
  [/\bzoom\b/gi, 'Zoom'],
  [/\bkeep[\s\-_.]+me[\s\-_.]+signed[\s\-_.]+in\b/gi, 'Keep me signed in'],
  [/\bgmv\b/gi, 'Sales (GMV)'],
];

/** @param {string} text @returns {{ index: number, word: string, found: string }[]} */
export function forbiddenIn(text) {
  const out = [];
  for (const [re, word] of FORBIDDEN) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(text));) out.push({ index: m.index, word, found: m[0] });
  }
  return out.sort((a, b) => a.index - b.index);
}

export default defineCheck({
  name: CHECK,
  rule: 'V59/V73/V74: never "Direct KSA", "Direct Corporate", "B2B", "MICE", "Google", "Zoom", "Keep me signed in" or "GMV" in the catalogs, the e-mail templates or page text',
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
    return out;
  },
});
