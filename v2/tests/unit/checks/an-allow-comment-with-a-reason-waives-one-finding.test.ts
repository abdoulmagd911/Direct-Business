import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/no-hex.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/blind-checks.mjs "allow-comment" (every comment waives, reason or not) turns this red.
describe('an allow comment with a reason waives one finding, and only that one', () => {
  it('waives the line it sits on or the next line, needs a reason, and names its check', async () => {
    const root = fixture({
      'src/ui/a.tsx': [
        `// check-allow: no-hex — the brand's print colour, fixed by the owner for documents`,
        `export const a = '#F06820';`,
        `export const b = '#F06821'; // check-allow: no-hex — short`,
        `export const c = '#F06822'; // check-allow: rule-7 — waives another check, not this one`,
        `export const d = '#F06823';`,
        ``,
      ].join('\n'),
    });
    const got = await findings(check, root);
    expect(got.map((f) => f.line)).toEqual([3, 4, 5]);
  });
});
