// @ts-check
// A17 — stored normalised keys (identifier value_key, invoice match keys) carry norm_version. A migration that creates
// or replaces any norm.* function must call norm.rebuild() after it (`perform norm.rebuild()` or
// `select norm.rebuild()`), or every stored key silently disagrees with the new folding. NORM-DRIFT tests the result
// in SQL; this check catches the migration that forgot.
import { defineCheck, lineOf, sqlCode } from './lib.mjs';

const CHECK = 'norm-rebuild-called';

export default defineCheck({
  name: CHECK,
  rule: 'A17: a migration that changes a norm.* function calls norm.rebuild() after it',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    for (const file of ctx.files().filter((f) => /^supabase\/migrations\/.*\.sql$/.test(f))) {
      const code = sqlCode(ctx.read(file));
      const defs = [...code.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:"?norm"?)\s*\.\s*"?(\w+)"?/gi)];
      const changing = defs.filter(
        (d) => (d[1] ?? '').toLowerCase() !== 'rebuild' && (d[1] ?? '').toLowerCase() !== 'drift',
      );
      if (!changing.length) continue;
      const last = /** @type {RegExpExecArray} */ (changing[changing.length - 1]);
      const calls = [...code.matchAll(/\b(?:perform|select)\s+(?:"?norm"?)\s*\.\s*"?rebuild"?\s*\(/gi)];
      const after = calls.some((c) => (c.index ?? 0) > (last.index ?? 0));
      if (!after)
        out.push({
          check: CHECK,
          file,
          line: lineOf(code, last.index ?? 0),
          message: `changes norm.${last[1]} but never calls norm.rebuild() after it — stored keys would go stale (A17)`,
        });
    }
    return out;
  },
});
