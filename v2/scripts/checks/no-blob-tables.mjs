// @ts-check
// A1 — every fact is a row in a typed table; no blobs of business data (the old app kept everything in one JSON row,
// app_state, and the last writer won). A json/jsonb column is allowed only where the spec names it (per-category custom
// fields, change-log before/after, settings values, snapshots …) and only when listed, with its reason, in
// scripts/checks/jsonb-columns.txt as `schema.table.column — reason`.
import { defineCheck, lineOf, sqlColumns } from './lib.mjs';

const CHECK = 'no-blob-tables';
const LIST = 'scripts/checks/jsonb-columns.txt';

export default defineCheck({
  name: CHECK,
  rule: `A1: a json/jsonb column only when listed with its reason in ${LIST}`,
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    /** @type {Map<string, string>} */
    const allowed = new Map();
    if (ctx.exists(LIST))
      for (const raw of ctx.read(LIST).split('\n')) {
        const l = raw.replace(/#.*$/, '').trim();
        if (!l) continue;
        const [col, ...reason] = l.split(/\s+—\s+|\s+--\s+/);
        allowed.set(/** @type {string} */ (col).trim().toLowerCase(), reason.join(' ').trim());
      }
    for (const file of ctx.files().filter((f) => /^supabase\/migrations\/.*\.sql$/.test(f))) {
      const sql = ctx.read(file);
      for (const c of sqlColumns(sql)) {
        if (!/^jsonb?\b/.test(c.type)) continue;
        const key = `${c.table}.${c.column}`;
        const reason = allowed.get(key);
        if (reason === undefined || reason.length < 10)
          out.push({
            check: CHECK,
            file,
            line: lineOf(sql, c.offset),
            message: `${key} is ${c.type.split(/\s/)[0]} — business facts are typed columns; list it in ${LIST} with its reason if the spec calls for it`,
          });
      }
    }
    return out;
  },
});
