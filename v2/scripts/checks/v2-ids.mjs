// @ts-check
// A18 — two builders once collided on decision numbers and file numbers. Decision IDs in docs/v2/DECISIONS.md are
// unique and in range (V1–V99 architect and oversight, V100–V199 builder A, V200–V299 builder B, V400–V499 the
// owner's decisions relayed by the oversight — from 29 Sep); local ports used by
// v2's scripts and configs are in the builders' blocks (A 9300–9399, B 9400–9499), or the Supabase stack's own
// (5432, 54320–54329).
import fs from 'node:fs';
import path from 'node:path';
import { defineCheck, lineOf, select } from './lib.mjs';

const CHECK = 'v2-ids';

/** @param {number} p */
function portAllowed(p) {
  return (p >= 9300 && p <= 9499) || p === 5432 || (p >= 54320 && p <= 54329);
}

export default defineCheck({
  name: CHECK,
  rule: 'A18: decision IDs unique and within V1–V299 or V400–V499; local ports within 9300–9499 (or the Supabase stack)',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const candidates = ['../docs/v2/DECISIONS.md', 'docs/v2/DECISIONS.md'];
    const rel = candidates.find((c) => fs.existsSync(path.join(ctx.root, c)));
    if (!rel) {
      out.push({ check: CHECK, file: 'docs/v2/DECISIONS.md', line: 0, message: 'docs/v2/DECISIONS.md not found' });
    } else {
      const text = fs.readFileSync(path.join(ctx.root, rel), 'utf8');
      /** @type {Map<number, number>} */
      const seen = new Map();
      for (const m of text.matchAll(/^\*\*V(\d+)\s+—/gm)) {
        const id = Number(m[1]);
        const line = lineOf(text, m.index ?? 0);
        if (!((id >= 1 && id <= 299) || (id >= 400 && id <= 499)))
          out.push({ check: CHECK, file: rel, line, message: `V${id} is outside V1–V299 and V400–V499` });
        if (seen.has(id))
          out.push({ check: CHECK, file: rel, line, message: `V${id} is used twice (first on line ${seen.get(id)})` });
        else seen.set(id, line);
      }
    }
    const portRe =
      /(?:(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})\b)|(?:--port[= ](\d{2,5})\b)|(?:\bPORT\s*[=:]\s*['"]?(\d{2,5})\b)|(?:\bport\s*[=:]\s*(\d{2,5})\b)/g;
    const files = select(
      ctx,
      [
        'package.json',
        '*.config.{ts,mjs,js}',
        'scripts/**/*.{mjs,ts,js,sh}',
        'tests/**/*.{ts,tsx,mjs}',
        'supabase/**/*.toml',
        '.env.example',
      ],
      ['scripts/checks/v2-ids.mjs'],
    );
    for (const file of files) {
      const text = ctx.read(file);
      portRe.lastIndex = 0;
      for (let m; (m = portRe.exec(text));) {
        const port = Number(m[1] ?? m[2] ?? m[3] ?? m[4]);
        if (!portAllowed(port))
          out.push({
            check: CHECK,
            file,
            line: lineOf(text, m.index),
            message: `port ${port} is outside the builders' blocks (A 9300–9399, B 9400–9499) and the Supabase stack's`,
          });
      }
    }
    return out;
  },
});
