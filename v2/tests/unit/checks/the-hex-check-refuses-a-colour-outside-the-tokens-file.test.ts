import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/no-hex.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/blind-checks.mjs "no-hex" turns this red.
describe('the hex check refuses a colour outside src/ui/tokens.css', () => {
  it('refuses hex, functional and named colours and Tailwind palette colours', async () => {
    const root = fixture({
      'src/ui/a.tsx': [
        `export const A = () => <div style={{ color: '#FF0000' }} />;`,
        `export const B = () => <div className="bg-red-500 hover:text-white" />;`,
        `export const C = () => <div style={{ background: 'rgb(1 2 3)', borderColor: 'white' }} />;`,
        `export const D = () => <div className="bg-[#0b6b66]/50" />;`,
        ``,
      ].join('\n'),
      'src/ui/a.css': `.x { color: #fff; }\n.y { background: hsl(10 20% 30%); }\n.z { border-color: black; }\n`,
    });
    const got = await findings(check, root);
    const byFile = (f: string) =>
      got
        .filter((x) => x.file === f)
        .map((x) => x.line)
        .sort((a, b) => a - b);
    expect(byFile('src/ui/a.tsx')).toEqual([1, 2, 2, 3, 3, 4]);
    expect(byFile('src/ui/a.css')).toEqual([1, 2, 3]);
  });

  it('allows the tokens file itself, token utilities, anchors and ids', async () => {
    const root = fixture({
      'src/ui/tokens.css': `[data-theme="light"] { --bg: #F2F3EF; --shadow-1: 0 1px 2px rgba(26,31,28,.06); }\n`,
      'src/ui/b.tsx': [
        `export const A = () => <a href="#main" className="bg-surface text-muted border-border ring-focus">x</a>;`,
        `export const id = 'section-add';`,
        `export const B = () => <div style={{ color: 'var(--text)' }} />;`,
        ``,
      ].join('\n'),
      'src/ui/b.css': `.x { color: var(--text); background: transparent; border-color: currentColor; }\n`,
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
