// @ts-check
// A10 — each rule has one home. Name and identifier folding (Arabic letter forms, harakat, tatweel, digits) lives in
// SQL (norm.*); the browser asks the database. The old app wrote the same folding three times (SQL, preview JS,
// mock) and they drifted. A folding table in app code is refused: a literal holding two or more alef forms, harakat
// or tatweel (as characters or \u escapes), or a character class of Arabic letter variants.
import ts from 'typescript';
import { defineCheck, lineOfNode, literals, parseSource, select, walkAst } from './lib.mjs';

const CHECK = 'one-copy';
const ALEF_FORMS = /[أإآٱ]/g;
const MARKS = /[ً-ٰٟـ]/;
const MARK_ESCAPES = /\\u06(?:4[0bBcCdDeEfF]|5[0-9a-fA-F]|70)/;
const VARIANT_LETTER = /^[أإآٱىئيةهؤوکكی]$/;
const VARIANT_CLASS = /\[[^\]]*(?:ى[^\]]*ي|ي[^\]]*ى|ة[^\]]*ه|ه[^\]]*ة|ؤ[^\]]*و|ک[^\]]*ك|ی[^\]]*ي)[^\]]*\]/;

export default defineCheck({
  name: CHECK,
  rule: 'A10: no Arabic/identifier folding table in app code — folding lives in SQL (norm.*)',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    for (const file of select(ctx, ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}'])) {
      const sf = parseSource(file, ctx.read(file));
      for (const lit of literals(sf)) {
        if (lit.kind === 'jsx') continue;
        const alefs = new Set(lit.text.match(ALEF_FORMS) ?? []);
        const hit =
          alefs.size >= 2 ||
          MARKS.test(lit.text) ||
          MARK_ESCAPES.test(lit.text) ||
          (lit.kind === 'regex' && VARIANT_CLASS.test(lit.text));
        if (hit)
          out.push({
            check: CHECK,
            file,
            line: lit.line,
            message: 'an Arabic folding table in app code — call the database (norm.*) instead (A10)',
          });
      }
      // a map object keyed by letter variants: { 'أ': 'ا', 'إ': 'ا' }
      walkAst(sf, (n) => {
        if (!ts.isObjectLiteralExpression(n)) return;
        const keys = n.properties
          .map((p) => (p.name && (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name)) ? p.name.text : ''))
          .filter((k) => VARIANT_LETTER.test(k));
        if (new Set(keys).size >= 2)
          out.push({
            check: CHECK,
            file,
            line: lineOfNode(sf, n),
            message: 'a map of Arabic letter variants in app code — folding lives in SQL (norm.*) (A10)',
          });
      });
    }
    return out;
  },
});
