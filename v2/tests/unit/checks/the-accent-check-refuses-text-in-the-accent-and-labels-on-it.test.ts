import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/accent-fill-only.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/screens.mjs "blind-accent-fill-only" turns this red.
describe('the accent check refuses text in the accent and labels on it (V60)', () => {
  it('refuses text-accent, bg-accent outside the fill files, a label on the fill, and text-on-accent elsewhere', async () => {
    const root = fixture({
      'src/ui/Button.tsx': [
        `export const a = 'text-accent';`,
        `export const b = 'bg-accent';`,
        `export const c = 'bg-accent text-on-accent';`,
        `export const d = 'text-on-accent';`,
        ``,
      ].join('\n'),
      'src/ui/x.css': `.a { color: var(--accent); }\n.b { background: var(--accent-hover); }\n`,
    });
    const got = await findings(check, root);
    expect(got.filter((f) => f.file === 'src/ui/Button.tsx').map((f) => f.line)).toEqual([1, 2, 3, 3, 3, 4]);
    expect(got.filter((f) => f.file === 'src/ui/x.css').map((f) => f.line)).toEqual([1, 2]);
  });

  it('allows the fill in the kit files that draw marks, links in --link, and the check mark on the fill', async () => {
    const root = fixture({
      'src/ui/Chip.tsx': `export const a = 'border-accent bg-accent-soft';\nexport const b = 'bg-accent';\n`,
      'src/ui/Checkbox.tsx': `export const a = 'data-[state=checked]:bg-accent';\nexport const b = 'text-on-accent';\n`,
      'src/ui/EntityLink.tsx': `export const a = 'text-link hover:underline';\n`,
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
