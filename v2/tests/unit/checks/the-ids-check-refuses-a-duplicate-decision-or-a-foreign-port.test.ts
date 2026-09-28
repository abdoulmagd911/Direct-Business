import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/v2-ids.mjs';
import { findings, fixture } from './helpers';

// Ports outside the blocks are assembled at run time: the ids check reads this file too.
const j = (...parts: string[]) => parts.join('');

// Sabotage: tests/sabotage/blind-checks.mjs "v2-ids" turns this red.
describe('the ids check refuses a duplicate decision, an ID out of range, or a port outside the blocks', () => {
  it('refuses them', async () => {
    const root = fixture({
      'docs/v2/DECISIONS.md': '**V1 — a** x\n\n**V100 — b** x\n\n**V100 — c** x\n\n**V300 — d** x\n',
      'playwright.config.ts': j("const url = 'http://127.0.0.1:", "3000';\n"),
      'package.json': j('{ "scripts": { "dev": "next dev --port ', '8080" } }\n'),
    });
    const got = await findings(check, root);
    expect(got.map((f) => `${f.file}:${f.line}`).sort()).toEqual([
      'docs/v2/DECISIONS.md:5',
      'docs/v2/DECISIONS.md:7',
      'package.json:1',
      'playwright.config.ts:1',
    ]);
  });

  it('allows unique IDs in range and ports in the blocks or the Supabase stack', async () => {
    const root = fixture({
      'docs/v2/DECISIONS.md': '**V1 — a** x\n\n**V100 — b** x\n\n**V200 — c** x\n',
      'playwright.config.ts': "const a = 'http://127.0.0.1:9300'; const b = 'http://localhost:54321';\n",
      'package.json': '{ "scripts": { "dev": "next dev --port 9400" } }\n',
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
