// @ts-check
// A18 — two builders once collided on decision numbers and file numbers. Decision IDs in docs/v2/DECISIONS.md are
// unique and in range (V1–V99 architect and oversight, V100–V199 builder A, V200–V299 builder B, V300–V399 builder C,
// V400–V499 the owner's decisions relayed by the oversight — from 29 Sep; V410; V500–V599 owner decisions and the
// oversight's rulings from 30 Sep; V600–V699 the architect — #130); local ports used by v2's scripts and
// configs are in the sessions' blocks (A 9300–9399, B 9400–9499, C 9500–9599, QA 9600–9699), or the Supabase stack's
// own (5432, 54320–54329).
import fs from 'node:fs';
import path from 'node:path';
import { defineCheck, lineOf, select } from './lib.mjs';

const CHECK = 'v2-ids';

/** @param {number} p */
function portAllowed(p) {
  return (p >= 9300 && p <= 9699) || p === 5432 || (p >= 54320 && p <= 54329);
}

export default defineCheck({
  name: CHECK,
  rule: 'A18: decision IDs unique and within V1–V699; local ports within 9300–9699 (or the Supabase stack)',
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
        if (!(id >= 1 && id <= 699)) out.push({ check: CHECK, file: rel, line, message: `V${id} is outside V1–V699` });
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
            message: `port ${port} is outside the sessions' blocks (A, B, C and QA: 9300–9699) and the Supabase stack's`,
          });
      }
    }
    return out;
  },
});
