import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/no-physical-css.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/blind-checks.mjs "no-physical-css" turns this red.
describe('the physical-CSS check refuses left and right', () => {
  it('refuses physical utilities, inline styles and CSS declarations', async () => {
    const root = fixture({
      'src/ui/a.tsx': [
        `export const A = () => <div className="ml-2 md:pr-4 text-left">x</div>;`,
        `export const B = () => <div className={'rounded-l-md border-r-2 -left-1'} />;`,
        `export const C = () => <div style={{ marginLeft: 4, left: 0, textAlign: 'right' }} />;`,
        ``,
      ].join('\n'),
      'src/ui/a.css': `.x { margin-left: 4px; }\n.y { right: 0; text-align: left; }\n.z { border-top-right-radius: 4px; }\n`,
    });
    const got = await findings(check, root);
    const byFile = (f: string) =>
      got
        .filter((x) => x.file === f)
        .map((x) => x.line)
        .sort((a, b) => a - b);
    expect(byFile('src/ui/a.tsx')).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    expect(byFile('src/ui/a.css')).toEqual([1, 2, 2, 3]);
  });

  it('allows logical utilities, words that merely contain left or right, and custom properties', async () => {
    const root = fixture({
      'src/ui/b.tsx': [
        `export const A = () => <div className="ms-2 pe-4 text-start start-0 rounded-s-md border-e">left and right</div>;`,
        `export const k = 'copyright-notice';`,
        `export const B = () => <div style={{ marginInlineStart: 4, insetInlineEnd: 0 }} />;`,
        ``,
      ].join('\n'),
      'src/ui/b.css': `:root { --left-gap: 4px; }\n.x { margin-inline-start: 4px; inset-inline-end: 0; text-align: start; }\n`,
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
