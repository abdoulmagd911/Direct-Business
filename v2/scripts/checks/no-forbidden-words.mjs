// @ts-check
// V59 — never in the app's wording: "Direct KSA", "DirectKSA", "Direct Corporate", "B2B", "MICE". The department is
// "Commercial" / "الإدارة التجارية"; the sign-in title "Commercial Workspace" / "مساحة العمل التجارية". Checked in
// the wording catalogs and in every string of src/ (a code comment may cite the rule; a string may not use the word).
// On screen the owner's words are Partner (never Company — V52) and Revenue · Cost · Profit (never Margin — V73):
// checked in the catalogs and in JSX text; code may still say `companies.identify` or `margin`.
import { defineCheck, lineOf, literals, parseSource, select } from './lib.mjs';

const WORDS = /Direct\s?KSA|DirectKSA|Direct Corporate|\bB2B\b|\bMICE\b/g;
const SCREEN_WORDS = /\bCompan(?:y|ies)\b|\bMargins?\b/g;

export default defineCheck({
  name: 'no-forbidden-words',
  rule: 'V59/V52/V73: "Direct KSA", "DirectKSA", "Direct Corporate", "B2B", "MICE" never; on screen never "Company" or "Margin"',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const check = 'no-forbidden-words';
    for (const file of select(ctx, ['messages/*.json'])) {
      const text = ctx.read(file);
      for (const re of [WORDS, SCREEN_WORDS]) {
        re.lastIndex = 0;
        for (let m; (m = re.exec(text));) out.push({ check, file, line: lineOf(text, m.index), message: `"${m[0]}"` });
      }
    }
    for (const file of select(ctx, ['src/**/*.{ts,tsx,js,jsx}'])) {
      const sf = parseSource(file, ctx.read(file));
      for (const lit of literals(sf)) {
        if (lit.kind === 'regex') continue;
        WORDS.lastIndex = 0;
        for (let m; (m = WORDS.exec(lit.text));)
          out.push({ check, file, line: lit.line, message: `"${m[0]}" in a string` });
        if (lit.kind === 'jsx') {
          SCREEN_WORDS.lastIndex = 0;
          for (let m; (m = SCREEN_WORDS.exec(lit.text));)
            out.push({
              check,
              file,
              line: lit.line,
              message: `"${m[0]}" on screen — say Partner / Revenue · Cost · Profit`,
            });
        }
      }
    }
    return out;
  },
});
