// @ts-check
// A9 — forward-only, timestamped migrations in supabase/migrations/. The old app patched its schema in place (some of
// it never in the repository) and edited functions by string replacement. Refused here:
//   · a file name that is not YYYYMMDDHHMMSS_<module>_<what>.sql (lower case, digits, underscores) or a date that
//     does not exist; two files with one timestamp; an empty file;
//   · editing, deleting or renaming a migration that the base branch already has (a merged migration is history:
//     fix forward with a new one);
//   · a new migration that sorts before the newest one on the base branch (it would run out of order on a database
//     that already has the base applied);
//   · pg_get_functiondef (functions are declared whole in migrations, never patched by string replacement).
// The base is V2_BASE_REF (CI: origin/<pull request base>, or the commit before a push), else origin/v2/main. When the
// base cannot be read the check fails and says so — it never passes by default.
import { defineCheck, lineOf, sqlCode } from './lib.mjs';

const CHECK = 'forward-only-migrations';
const DIR = 'supabase/migrations';
const NAME = /^(\d{14})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/;

/** @param {string} ts14 */
function validTimestamp(ts14) {
  const [y, mo, d, h, mi, s] = [0, 4, 6, 8, 10, 12].map((i, k) => Number(ts14.slice(i, i + (k === 0 ? 4 : 2))));
  const dt = new Date(Date.UTC(/** @type {number} */ (y), /** @type {number} */ (mo) - 1, d, h, mi, s));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === /** @type {number} */ (mo) - 1 &&
    dt.getUTCDate() === d &&
    dt.getUTCHours() === h &&
    dt.getUTCMinutes() === mi &&
    dt.getUTCSeconds() === s &&
    /** @type {number} */ (y) >= 2026
  );
}

export default defineCheck({
  name: CHECK,
  rule: 'A9: migrations are forward-only, timestamped YYYYMMDDHHMMSS_<module>_<what>.sql, never edited once merged',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const files = ctx.files().filter((f) => f.startsWith(DIR + '/') && f !== `${DIR}/.gitkeep`);
    /** @type {Map<string, string>} */
    const stamps = new Map();
    for (const file of files) {
      const base = file.slice(DIR.length + 1);
      if (base.includes('/')) {
        out.push({
          check: CHECK,
          file,
          line: 0,
          message: 'migrations live directly in supabase/migrations/, no sub-folders',
        });
        continue;
      }
      const m = NAME.exec(base);
      if (!m) {
        out.push({ check: CHECK, file, line: 0, message: 'name must be YYYYMMDDHHMMSS_<module>_<what>.sql' });
        continue;
      }
      const stamp = /** @type {string} */ (m[1]);
      if (!validTimestamp(stamp))
        out.push({ check: CHECK, file, line: 0, message: `timestamp ${stamp} is not a real date and time (2026 on)` });
      if (stamps.has(stamp))
        out.push({ check: CHECK, file, line: 0, message: `timestamp ${stamp} is also used by ${stamps.get(stamp)}` });
      stamps.set(stamp, file);
      const text = ctx.read(file);
      if (!sqlCode(text).trim()) out.push({ check: CHECK, file, line: 0, message: 'empty migration' });
      const code = sqlCode(text);
      const re = /\bpg_get_functiondef\b/gi;
      for (let x; (x = re.exec(code));)
        out.push({
          check: CHECK,
          file,
          line: lineOf(code, x.index),
          message: 'pg_get_functiondef — declare the whole function in the migration, never patch it by string',
        });
    }

    // Compare with the base branch.
    if (!ctx.repoRoot) return out; // a fixture folder outside git: names and contents only
    const baseRef = ctx.env.V2_BASE_REF || 'origin/v2/main';
    if (/^0+$/.test(baseRef)) return out; // the first push of a branch: nothing to compare with
    let mergeBase = '';
    try {
      ctx.git(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]);
      mergeBase = ctx.git(['merge-base', baseRef, 'HEAD']).trim();
    } catch {
      out.push({
        check: CHECK,
        file: DIR,
        line: 0,
        message: `cannot read the base ${baseRef} to compare migrations with — fetch it (git fetch origin v2/main) or set V2_BASE_REF`,
      });
      return out;
    }
    // Migrations at the merge base that changed or went away (working tree included).
    const changed = ctx
      .git(['diff', '--name-status', '--no-renames', mergeBase, '--', DIR])
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('\t'));
    for (const [status, file] of changed) {
      if (!file || file.endsWith('/.gitkeep')) continue;
      if (status === 'M' || status === 'D' || status === 'T')
        out.push({
          check: CHECK,
          file: file.replace(/^.*?supabase\/migrations\//, `${DIR}/`),
          line: 0,
          message: `${status === 'D' ? 'deletes' : 'edits'} a migration the base branch already has — fix forward with a new migration`,
        });
    }
    // New migrations must sort after the newest one on the base tip.
    const onBase = ctx
      .git(['ls-tree', '-r', '--name-only', baseRef, '--', DIR])
      .split('\n')
      .filter(Boolean)
      .map((f) => f.slice(f.lastIndexOf('/') + 1))
      .map((b) => NAME.exec(b)?.[1])
      .filter(Boolean)
      .sort();
    const newest = onBase[onBase.length - 1];
    if (newest) {
      const baseNames = new Set(
        ctx
          .git(['ls-tree', '-r', '--name-only', baseRef, '--', DIR])
          .split('\n')
          .filter(Boolean)
          .map((f) => f.slice(f.lastIndexOf('/') + 1)),
      );
      for (const [stamp, file] of stamps) {
        const name = file.slice(DIR.length + 1);
        if (!baseNames.has(name) && stamp <= newest)
          out.push({
            check: CHECK,
            file,
            line: 0,
            message: `new migration sorts before ${newest}, the newest on ${baseRef} — give it a later timestamp`,
          });
      }
    }
    return out;
  },
});
