/**
 * V605: a locked area says why, in one line — never a bare word beside a lock. Every no-access state a screen draws
 * passes its sentence (`message`). The kit's gallery is the one exception: it shows the state itself.
 * Sabotage: tests/sabotage/tasks.mjs "locked-activity-says-only-activity".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../../src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

describe('a locked area says why (V605)', () => {
  it('every no-access state on a screen carries its sentence', () => {
    const bare: string[] = [];
    for (const f of files(SRC)) {
      const where = relative(SRC, f);
      if (where.startsWith('app/(app)/kit/') || where === 'ui/DataState.tsx') continue;
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/<DataState\b[^>]*kind=\{?["']no-access["']\}?[^>]*\/?>/gs)) {
        if (!/\bmessage=/.test(m[0])) bare.push(`${where}: ${m[0].replace(/\s+/g, ' ')}`);
      }
    }
    expect(bare, 'a locked area with no reason').toEqual([]);
  });
});
