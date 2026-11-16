import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import tokens from '../../src/ui/tokens.json';

/**
 * The design tokens (Landing 31, the V21 boards): src/ui/tokens.json is the exported file — every colour, radius,
 * shadow, spacing and motion value — and src/ui/tokens.css is generated from it (scripts/tokens/build.mjs). The CSS
 * must equal the JSON in every theme; System is Light, and Dark on a dark device; and the colour rules the boards
 * state hold in every theme.
 */
const css = readFileSync(join(__dirname, '..', '..', 'src', 'ui', 'tokens.css'), 'utf8');

function vars(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.replace(/\s+/g, ' ').trim();
  return out;
}
/** The declarations of the rule whose selector list is exactly `selector` (outside any media query unless `media`). */
function block(selector: string, media = false): Record<string, string> {
  const source = media
    ? (css.match(/@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}/)?.[1] ?? '')
    : css.replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}/, '');
  const at = source.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no block for ${selector}`);
  return vars(source.slice(source.indexOf('{', at) + 1, source.indexOf('}', at)));
}
const norm = (s: string) =>
  s
    .replace(/\s+/g, '')
    .replace(/\d*\.?\d+/g, (n) => String(parseFloat(n)))
    .toLowerCase();

const DRAWN = ['light', 'dark', 'direct', 'turquoise'] as const;
type Drawn = (typeof DRAWN)[number];
const selectorOf: Record<Drawn, string> = {
  light: "[data-theme='light'],\n[data-theme='system']",
  dark: "[data-theme='dark']",
  direct: "[data-theme='direct']",
  turquoise: "[data-theme='turquoise']",
};
const blocks = Object.fromEntries(DRAWN.map((t) => [t, block(selectorOf[t])])) as Record<Drawn, Record<string, string>>;
const colors = tokens.colors as Record<string, Record<Drawn, string>>;
const effects = tokens.effects as Record<string, Record<Drawn, string>>;

/** WCAG 2 contrast of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
      number,
      number,
      number,
    ];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('tokens.css equals the exported tokens file (tokens.json)', () => {
  it('names the five themes: Light, Dark, Direct, Turquoise and System', () => {
    expect(tokens.themes).toEqual(['light', 'dark', 'direct', 'turquoise', 'system']);
  });

  it.each(Object.keys(colors))('colour %s, in every theme', (name) => {
    for (const theme of DRAWN) expect(norm(blocks[theme][name] ?? '(missing)'), theme).toBe(norm(colors[name]![theme]));
  });

  it.each(Object.keys(effects))('effect %s, in every theme', (name) => {
    for (const theme of DRAWN)
      expect(norm(blocks[theme][name] ?? '(missing)'), theme).toBe(norm(effects[name]![theme]));
  });

  it('every theme declares the same set of tokens, and nothing the file does not name', () => {
    const named = [...Object.keys(colors), ...Object.keys(effects)].sort().join(',');
    for (const theme of DRAWN) expect(Object.keys(blocks[theme]).sort().join(','), theme).toBe(named);
  });

  it('System has no values of its own: Light, and Dark when the device is dark', () => {
    // Light's rule is shared with System by its selector list (selectorOf.light); the dark device repeats Dark
    expect(block("[data-theme='system']", true)).toEqual(blocks.dark);
  });

  it('the scale and the motion values are on :root', () => {
    const root = block(':root');
    for (const [k, v] of Object.entries({ ...tokens.scale, ...tokens.motion }))
      expect(norm(root[k] ?? ''), `--${k}`).toBe(norm(v));
  });
});

describe('the colour rules of the look hold in every theme', () => {
  it('primary buttons are the deep orange with a white label, in every theme', () => {
    for (const theme of DRAWN) {
      expect(colors.primary![theme], theme).toBe('#C8460C');
      expect(colors['on-primary']![theme], theme).toBe('#FFFFFF');
      expect(contrast(colors.primary![theme], colors['on-primary']![theme]), theme).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the accent is never the button fill, and nothing white could be read on the vivid orange', () => {
    for (const theme of DRAWN) expect(colors.accent![theme], theme).not.toBe(colors.primary![theme]);
    expect(colors.accent!.light).toBe('#F06820');
    expect(contrast('#F06820', '#FFFFFF'), 'white on the accent orange fails text contrast').toBeLessThan(4.5);
  });

  it('Revenue green is #127A3D in Light and Direct, and each dark theme’s own lifted green', () => {
    expect(colors.success!.light).toBe('#127A3D');
    expect(colors.success!.direct).toBe('#127A3D');
    expect(colors.success!.dark).toBe('#6FD39A');
    expect(colors.success!.turquoise).toBe('#4ADE80');
    for (const theme of ['dark', 'turquoise'] as const)
      expect(
        contrast(colors.success![theme], colors.raised![theme]),
        `${theme}: the lifted green on a card`,
      ).toBeGreaterThanOrEqual(9);
  });

  it('the named palette of Light is the brief’s', () => {
    expect({
      frame: colors['nav-bg']!.light,
      accent: colors.accent!.light,
      circle: colors['accent-soft']!.light,
      icon: colors['accent-ink']!.light,
      link: colors.link!.light,
      warning: colors.warning!.light,
      warningGround: colors['warning-soft']!.light,
      error: colors.danger!.light,
      heading: colors.strong!.light,
      secondary: colors.muted!.light,
      page: colors.bg!.light,
      card: colors.raised!.light,
    }).toEqual({
      frame: '#323E48',
      accent: '#F06820',
      circle: '#FFEDE2',
      icon: '#AD3B09',
      link: '#1D5FD1',
      warning: '#95420A',
      warningGround: '#FFF1D6',
      error: '#B42318',
      heading: '#1F1612',
      secondary: '#6B6560',
      page: '#F7F6F3',
      card: '#FFFFFF',
    });
  });

  it.each(DRAWN)('%s: text reads at 4.5:1 or better (WCAG AA) on a card and on the page', (theme) => {
    const on = (fg: string, bg: string) => contrast(colors[fg]![theme], colors[bg]![theme]);
    for (const fg of ['text', 'strong', 'muted', 'link', 'success', 'warning', 'danger', 'info', 'accent-text'])
      expect(on(fg, 'raised'), `${fg} on a card`).toBeGreaterThanOrEqual(4.5);
    for (const fg of ['text', 'strong', 'muted']) expect(on(fg, 'bg'), `${fg} on the page`).toBeGreaterThanOrEqual(4.5);
    for (const tone of ['success', 'warning', 'danger', 'info', 'neutral'])
      expect(on(tone, `${tone}-soft`), `the ${tone} pill`).toBeGreaterThanOrEqual(4.5);
    expect(on('accent-ink', 'accent-soft'), 'the icon on its circle').toBeGreaterThanOrEqual(3);
    expect(on('nav-text', 'nav-bg'), 'the drawer label').toBeGreaterThanOrEqual(4.5);
    expect(on('nav-active-text', 'nav-active'), 'the active drawer item').toBeGreaterThanOrEqual(4.5);
    expect(on('on-sel', 'sel'), 'a picked chip').toBeGreaterThanOrEqual(4.5);
    expect(on('on-inverse', 'inverse'), 'a toast').toBeGreaterThanOrEqual(4.5);
  });

  it('nothing is under 12px, and the shape is rounded: pills, 16px cards, 20px dialogs', () => {
    expect(parseFloat(tokens.scale['t-xs'])).toBeGreaterThanOrEqual(12);
    expect(tokens.scale['r-lg']).toBe('16px');
    expect(tokens.scale['r-xl']).toBe('20px');
    expect(tokens.scale['r-pill']).toBe('999px');
  });

  it('Compact tightens rows only: controls keep their size (V8)', () => {
    const compact = block("[data-density='compact']");
    expect(compact['row-h']).toBe('32px');
    expect(compact['control-h']).toBeUndefined();
  });
});
