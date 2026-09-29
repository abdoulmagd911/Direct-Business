// @ts-check
// V137 — a migration reaches the cloud database as text, and the tool that carries it sends Unicode in normalized
// form (NFC): combining marks written out of their canonical order come back reordered, so the database would run
// something other than this file and its checksum would not match (V113). It happened once, to the Arabic marks in
// norm.fold. A migration's text must therefore be unchanged by NFC normalization; a mark that must stand alone is
// written as an escape — \uXXXX inside a regular expression, U&'\XXXX' in a string.
import { defineCheck } from './lib.mjs';

const CHECK = 'normalized-text';
// Applied before this check existed; the rule it carries is re-spelled with escapes by
// 20260929060400_norm_fold_escapes.sql, and a merged migration is never edited (A9).
const SETTLED = new Set(['supabase/migrations/20260929060000_norm.sql']);

export default defineCheck({
  name: CHECK,
  rule: 'V137: a migration is unchanged by Unicode NFC normalization, so the cloud runs exactly this file',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    for (const file of ctx.files().filter((f) => /^supabase\/migrations\/.*\.sql$/.test(f) && !SETTLED.has(f))) {
      const text = ctx.read(file);
      if (text.normalize('NFC') === text) continue;
      const lines = text.split('\n');
      const at = lines.findIndex((l) => l.normalize('NFC') !== l);
      const bad = [...(lines[at] ?? '')]
        .filter((ch) => /\p{M}/u.test(ch))
        .map((ch) => `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`);
      out.push({
        check: CHECK,
        file,
        line: at + 1,
        message:
          `changes under Unicode NFC normalization (marks ${bad.join(' ')}) — the cloud would run different text ` +
          `than this file (V137); write the marks as escapes: \\uXXXX in a regular expression, U&'\\XXXX' in a string`,
      });
    }
    return out;
  },
});
