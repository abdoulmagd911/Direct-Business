import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/no-forbidden-words.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/screens.mjs "blind-no-forbidden-words" turns this red.
describe('the words check refuses the names the app never says (V59)', () => {
  it('refuses Direct KSA, DirectKSA, Direct Corporate, B2B and MICE in catalogs and strings', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify({ a: 'Direct KSA', b: 'DirectKSA', c: 'B2B clients', d: 'MICE events' }),
      'src/ui/a.tsx': `export const A = () => <span>Direct Corporate</span>;\nexport const b = 'new B2B deal';\n`,
    });
    const got = await findings(check, root);
    expect(got.filter((f) => f.file === 'messages/en.json')).toHaveLength(4);
    expect(got.filter((f) => f.file === 'src/ui/a.tsx').map((f) => f.line)).toEqual([1, 2]);
  });

  it('refuses Company and Margin on screen (V52, V73) but not in code', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify({ a: 'Company card', b: 'Margin' }),
      'src/ui/c.tsx': `export const A = () => <span>Companies</span>;\nexport const cap = 'companies.identify';\n`,
    });
    const got = await findings(check, root);
    expect(got.filter((f) => f.file === 'messages/en.json')).toHaveLength(2);
    expect(got.filter((f) => f.file === 'src/ui/c.tsx').map((f) => f.line)).toEqual([1]);
  });

  it('allows Direct, Commercial and words that merely contain the letters', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify({
        a: 'Direct',
        b: 'Commercial Workspace',
        c: 'Directly',
        d: 'submice',
      }),
      'src/ui/b.tsx': `// the check refuses "B2B" (V59)\nexport const A = () => <span>Commercial</span>;\n`,
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
