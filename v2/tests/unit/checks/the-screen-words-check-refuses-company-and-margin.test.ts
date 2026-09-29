import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/screen-words.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/screens.mjs "blind-screen-words" turns this red.
describe('the screen-words check refuses Company and Margin on screen (V52, V73)', () => {
  it('refuses them in a catalog and in JSX text, and lets code keep them', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify({ a: 'Companies', b: 'Gross margin', c: 'Partners' }, null, 1),
      'src/ui/a.tsx': [
        `export const A = () => <h1>Company files</h1>;`,
        `export const B = () => <td>Margin</td>;`,
        `const margin = row.margin; export const C = () => <td>{margin}</td>;`,
        `export const D = () => <p>Revenue · Cost · Profit</p>;`,
        ``,
      ].join('\n'),
    });
    const got = await findings(check, root);
    expect(got.filter((f) => f.file === 'messages/en.json').map((f) => f.line)).toEqual([2, 3]);
    expect(got.filter((f) => f.file === 'src/ui/a.tsx').map((f) => f.line)).toEqual([1, 2]);
    expect(got[0]?.message).toContain('say Partner');
  });
});
