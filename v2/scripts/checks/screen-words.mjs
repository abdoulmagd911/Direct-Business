// @ts-check
// On screen the owner's words are Partner (never Company — V52) and Revenue · Cost · Profit (never Margin — V73).
// Checked in the wording catalogs and in JSX text; code may still say `companies.identify` or `margin` (a column, a
// type). The names the app never says at all (V59) are forbidden-words.mjs.
import { defineCheck, lineOf, literals, parseSource, select } from './lib.mjs';

const CHECK = 'screen-words';
const SCREEN_WORDS = /\bcompan(?:y|ies)\b|\bmargins?\b/gi;

export default defineCheck({
  name: CHECK,
  rule: 'V52/V73: on screen never "Company" or "Margin" — say Partner, and Revenue · Cost · Profit',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const say = (/** @type {string} */ found) => `"${found}" on screen — say Partner / Revenue · Cost · Profit`;
    for (const file of select(ctx, ['messages/*.json'])) {
      const text = ctx.read(file);
      SCREEN_WORDS.lastIndex = 0;
      for (let m; (m = SCREEN_WORDS.exec(text));)
        out.push({ check: CHECK, file, line: lineOf(text, m.index), message: say(m[0]) });
    }
    for (const file of select(ctx, ['src/**/*.{ts,tsx,js,jsx}'])) {
      const sf = parseSource(file, ctx.read(file));
      for (const lit of literals(sf)) {
        if (lit.kind !== 'jsx') continue;
        SCREEN_WORDS.lastIndex = 0;
        for (let m; (m = SCREEN_WORDS.exec(lit.text));)
          out.push({ check: CHECK, file, line: lit.line, message: say(m[0]) });
      }
    }
    return out;
  },
});
