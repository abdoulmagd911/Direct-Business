import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/one-copy.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/blind-checks.mjs "one-copy" turns this red.
describe('the one-copy check refuses a folding table in app code', () => {
  it('refuses alef-form tables, harakat and tatweel, as characters or escapes', async () => {
    const root = fixture({
      'src/core/search/fold.ts': [
        `export const f1 = (s: string) => s.replace(/[أإآ]/g, 'ا');`,
        `export const f2 = (s: string) => s.replace(/[\\u064B-\\u065F]/g, '');`,
        `export const f3 = (s: string) => s.replace(/[ىي]/g, 'ي');`,
        `export const TABLE = 'أإ';`,
        `export const MAP = { 'أ': 'ا', 'إ': 'ا' } as const;`,
        ``,
      ].join('\n'),
    });
    const got = await findings(check, root);
    expect(got.map((f) => f.line)).toEqual([1, 2, 3, 4, 5]);
  });

  it('allows Arabic text that is not a folding table', async () => {
    const root = fixture({
      'src/ui/lang.tsx': `export const Toggle = () => <button lang="ar">ع</button>;\nexport const ar = 'مساحة العمل التجارية';\n`,
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
