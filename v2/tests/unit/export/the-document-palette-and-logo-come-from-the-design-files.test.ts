import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOC_FONT_BASE, DOC_FONT_FILES } from '@/core/print/fonts';
import { parseLogoSvg } from '@/core/print/logo';
import { DOC_TOKENS, paletteFromDocument, paletteFromTokensCss } from '@/core/print/palette';
import { TABLE, THEMES } from '../tokens.table';
import { V2 } from './pdf-tools';

/**
 * Documents draw with the Direct theme's tokens, the official logo files and the self-hosted document fonts (V60,
 * V301) — read from the design files, never copied into code, so a change to the palette or the logo reaches every
 * document; and every font is a WOFF file the request proxy serves without a session check.
 * Sabotage: `fonts-ship-a-ttf` (tests/sabotage/export.mjs).
 */
const tokensCss = fs.readFileSync(path.join(V2, 'src/ui/tokens.css'), 'utf8');
const DIRECT = THEMES.indexOf('direct');

describe('the document palette and logo come from the design files', () => {
  it('reads every document token from the Direct theme of tokens.css, equal to the design table', () => {
    const palette = paletteFromTokensCss(tokensCss);
    for (const t of DOC_TOKENS) expect(palette[t].toLowerCase(), `--${t}`).toBe(TABLE[t]?.[DIRECT]?.toLowerCase());
  });

  it('refuses a theme that lacks a token documents need, naming it', () => {
    const at = tokensCss.indexOf("[data-theme='direct']");
    const broken = tokensCss.slice(0, at) + tokensCss.slice(at).replace(/--nav-mark:[^;]+;/, '');
    expect(() => paletteFromTokensCss(broken)).toThrow(/--nav-mark/);
    expect(() => paletteFromTokensCss(tokensCss, 'no-such-theme')).toThrow(/no-such-theme/);
  });

  it('reads the tokens from the page in the browser, through a probe it removes again', () => {
    const values = new Map(DOC_TOKENS.map((t) => [`--${t}`, ` #${t.length.toString(16).padStart(6, '0')} `]));
    const appended: { attr: Record<string, string>; removed: boolean }[] = [];
    const doc = {
      createElement: () => {
        const el = {
          attr: {} as Record<string, string>,
          hidden: false,
          removed: false,
          setAttribute(k: string, v: string) {
            this.attr[k] = v;
          },
          remove() {
            this.removed = true;
          },
        };
        return el;
      },
      body: { appendChild: (el: { attr: Record<string, string>; removed: boolean }) => appended.push(el) },
      defaultView: {
        getComputedStyle: (el: { attr: Record<string, string> }) => ({
          getPropertyValue: (name: string) => (el.attr['data-theme'] === 'direct' ? (values.get(name) ?? '') : ''),
        }),
      },
    } as unknown as Document;
    const palette = paletteFromDocument(doc);
    expect(palette.text).toBe(values.get('--text')?.trim());
    expect(appended).toHaveLength(1);
    expect(appended[0]?.removed, 'the probe element is taken out again').toBe(true);
  });

  it('reads the official logo as its own paths and fills', () => {
    for (const file of ['direct-logo.svg', 'direct-logo-on-dark.svg']) {
      const svg = fs.readFileSync(path.join(V2, 'public/brand', file), 'utf8');
      const logo = parseLogoSvg(svg);
      expect(logo.viewBox).toEqual({ x: 0, y: 0, width: 74, height: 32 });
      expect(logo.paths.length).toBe((svg.match(/<path\b/g) ?? []).length);
      for (const p of logo.paths) expect(svg, 'every fill is the file’s own').toContain(`fill="${p.fill}"`);
    }
  });

  it('refuses a logo it cannot draw faithfully', () => {
    expect(() => parseLogoSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>')).toThrow(/only paths/);
    expect(() => parseLogoSvg('<svg><path d="M0 0" fill="none"/></svg>')).toThrow(/viewBox/);
  });

  it('ships every document font as a WOFF file the proxy serves without a session check', () => {
    // The proxy's matcher (a path-to-regexp pattern) names what it leaves alone; a font it matches would be asked
    // for a session on every download.
    const source = fs.readFileSync(path.join(V2, 'src/proxy.ts'), 'utf8');
    const pattern = /matcher:\s*\['([^']+)'\]/.exec(source)?.[1]?.replace(/\\\\/g, '\\');
    expect(pattern, 'the proxy declares its matcher').toBeTruthy();
    const matched = new RegExp(`^${pattern}$`);
    expect(matched.test('/fonts/doc/any.ttf'), 'the matcher is read right: a TTF would be checked').toBe(true);
    const files = Object.values(DOC_FONT_FILES).flatMap((fs_) => fs_.map((f) => f.file));
    for (const file of files) {
      expect(file, 'WOFF — fontkit cannot subset an Arabic WOFF2').toMatch(/\.woff$/);
      expect(fs.existsSync(path.join(V2, 'public/fonts/doc', file)), `${file} is in public/fonts/doc`).toBe(true);
      expect(matched.test(`${DOC_FONT_BASE}${file}`), `${file} passes the proxy without a session check`).toBe(false);
    }
  });
});
