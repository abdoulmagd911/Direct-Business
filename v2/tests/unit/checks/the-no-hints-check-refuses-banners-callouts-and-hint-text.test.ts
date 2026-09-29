import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/ui-no-hints.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/screens.mjs "blind-ui-no-hints" turns this red.
describe('the no-hints check refuses banners, callouts and hint text (V11)', () => {
  it('refuses a hint or banner component, its export, a hint prop, a banner class and a "Note:" sentence', async () => {
    const root = fixture({
      'src/ui/a.tsx': [
        `export function Banner() { return null; }`,
        `export const A = () => <Callout>x</Callout>;`,
        `export const B = () => <input hint="type here" />;`,
        `export const C = () => <div className="banner">x</div>;`,
        `export const D = () => <p>Note: this is explained here</p>;`,
        ``,
      ].join('\n'),
      'messages/en.json': JSON.stringify({ a: { b: 'Tip: click here' }, c: 'Fine' }),
    });
    const got = await findings(check, root);
    expect(
      got
        .filter((f) => f.file === 'src/ui/a.tsx')
        .map((f) => f.line)
        .sort((a, b) => a - b),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(got.filter((f) => f.file === 'messages/en.json')).toHaveLength(1);
  });

  it('allows an empty state line, a confirm sentence and a description prop', async () => {
    const root = fixture({
      'src/ui/b.tsx': [
        `export const A = () => <div data-state="empty">Nothing here yet</div>;`,
        `export const B = () => <Dialog description="Adds a helper" title="Add helper" />;`,
        `export const C = () => <p>Removed. You can undo this from the toast.</p>;`,
        ``,
      ].join('\n'),
      'messages/en.json': JSON.stringify({ state: { empty: 'Nothing here yet' } }),
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
