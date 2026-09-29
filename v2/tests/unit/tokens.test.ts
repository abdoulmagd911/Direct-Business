import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCALE, SHADOWS, TABLE, THEMES } from './tokens.table';

const css = readFileSync(join(__dirname, '..', '..', 'src', 'ui', 'tokens.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const m = css.match(new RegExp(selector.replace(/[[\]']/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\}'));
  if (!m) throw new Error(`no block for ${selector}`);
  const out: Record<string, string> = {};
  for (const line of m[1]!.split('\n')) {
    const mm = line.match(/^\s*--([\w-]+)\s*:\s*(.+?);\s*$/);
    if (mm) out[mm[1]!] = mm[2]!;
  }
  return out;
}
const norm = (s: string) =>
  s
    .replace(/\s+/g, '')
    .replace(/\d*\.?\d+/g, (n) => String(parseFloat(n)))
    .toLowerCase();

describe('tokens.css equals the design system table (V200)', () => {
  const blocks = Object.fromEntries(THEMES.map((t) => [t, block(`[data-theme='${t}']`)]));

  it.each(Object.entries(TABLE))('%s', (token, values) => {
    THEMES.forEach((theme, i) => {
      expect(norm(blocks[theme]![token] ?? '(missing)'), `${theme} --${token}`).toBe(norm(values[i]!));
    });
  });

  it.each(THEMES)('%s shadows', (theme) => {
    expect(norm(blocks[theme]!['shadow-1'] ?? '')).toBe(norm(SHADOWS[theme]![0]));
    expect(norm(blocks[theme]!['shadow-2'] ?? '')).toBe(norm(SHADOWS[theme]![1]));
  });

  it('every theme declares the same set of tokens', () => {
    const keys = THEMES.map((t) => Object.keys(blocks[t]!).sort().join(','));
    expect(new Set(keys).size).toBe(1);
  });

  it('the scale (type, spacing, radius, density defaults) is on :root', () => {
    const root = block(':root');
    for (const [k, v] of Object.entries(SCALE)) expect(root[k], `--${k}`).toBe(v);
    const compact = block("[data-density='compact']");
    expect(compact['row-h']).toBe('32px');
    expect(compact['control-h'], 'compact tightens tables only').toBeUndefined();
  });

  it('Direct: the accent is never the label colour of a filled button', () => {
    const d = blocks.direct!;
    expect(d.primary).not.toBe(d.accent);
    expect(d.link).not.toBe(d.accent);
  });
});
