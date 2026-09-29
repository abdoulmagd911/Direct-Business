// @ts-check
// V59 — the app's wording never says "Direct KSA", "DirectKSA", "Direct Corporate", "B2B" or "MICE". The department
// is "Commercial"; the product is "Commercial Workspace". Scanned: the message catalogs (messages/*.json) and every
// piece of literal text in src/ (strings, template pieces, JSX text — the page templates). Comments are not wording.
// Spacing, hyphens and case do not matter ("Direct-KSA", "b2b").
import { defineCheck, lineOf, literals, parseSource, select } from './lib.mjs';

const CHECK = 'forbidden-words';

/** @type {[RegExp, string][]} */
export const FORBIDDEN = [
  [/\bdirect[\s\-_.]*ksa\b/gi, 'Direct KSA'],
  [/\bdirect[\s\-_.]*corporate\b/gi, 'Direct Corporate'],
  [/\bb[\s\-_.]*2[\s\-_.]*b\b/gi, 'B2B'],
  [/\bmice\b/gi, 'MICE'],
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
  rule: 'V59: never "Direct KSA", "DirectKSA", "Direct Corporate", "B2B" or "MICE" in the catalogs or page text',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const say = (/** @type {string} */ word, /** @type {string} */ found) =>
      `"${found}" — the app never says ${word} (V59); the department is Commercial`;
    for (const file of select(ctx, ['messages/*.json'])) {
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
