/**
 * The colours a document uses — always the Direct theme (V60), whatever theme the person has on screen, because a
 * report is the department's document, not a screen. They are read from the design tokens (`src/ui/tokens.css`,
 * V200), never written here, so the no-hex rule holds and a change of the official palette reaches documents too.
 *
 * react-pdf and PowerPoint need literal colours, so the token values are resolved once, before rendering:
 * - in the browser, from the loaded tokens (`paletteFromDocument`);
 * - in Node (tests, golden files), from the tokens file's text (`paletteFromTokensCss`).
 */

export const DOC_TOKENS = [
  'text',
  'muted',
  'border',
  'border-strong',
  'bg',
  'surface',
  'raised',
  'accent',
  'accent-soft',
  'link',
  'primary',
  'on-primary',
  'success',
  'warning',
  'danger',
  'success-soft',
  'warning-soft',
  'danger-soft',
  'nav-bg',
  'nav-text',
  'nav-muted',
  'nav-mark',
] as const;

export type DocToken = (typeof DOC_TOKENS)[number];
export type DocPalette = Record<DocToken, string>;

/** The theme documents are drawn in (V60: the official palette). */
export const DOC_THEME = 'direct';

/** Reads one theme's tokens from the text of `tokens.css`. Throws when a token documents need is missing. */
export function paletteFromTokensCss(css: string, theme: string = DOC_THEME): DocPalette {
  const head = new RegExp(`\\[data-theme=['"]?${theme}['"]?\\]\\s*\\{`).exec(css);
  if (!head) throw new Error(`tokens.css has no [data-theme='${theme}'] block`);
  const start = head.index + head[0].length;
  const block = css.slice(start, css.indexOf('}', start));
  const values = new Map<string, string>();
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) values.set(m[1] as string, (m[2] as string).trim());
  return pick((t) => values.get(t));
}

/** Reads the Direct theme's tokens from the page's loaded styles (browser only). */
export function paletteFromDocument(doc: Document = document): DocPalette {
  const probe = doc.createElement('div');
  probe.setAttribute('data-theme', DOC_THEME);
  probe.hidden = true;
  doc.body.appendChild(probe);
  try {
    const style = doc.defaultView?.getComputedStyle(probe);
    return pick((t) => style?.getPropertyValue(`--${t}`).trim() || undefined);
  } finally {
    probe.remove();
  }
}

function pick(valueOf: (t: DocToken) => string | undefined): DocPalette {
  const out = {} as DocPalette;
  const missing: string[] = [];
  for (const t of DOC_TOKENS) {
    const v = valueOf(t);
    if (v) out[t] = v;
    else missing.push(`--${t}`);
  }
  if (missing.length) throw new Error(`the document palette is missing ${missing.join(', ')}`);
  return out;
}
