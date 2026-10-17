import { Font } from '@react-pdf/renderer';

/**
 * The fonts documents embed (V301). Files live in `public/fonts/doc/` (OFL, self-hosted — no font CDN):
 *
 * - IBM Plex Sans Arabic, Regular / SemiBold / Bold — the **complete** fonts from IBM's own package
 *   (`@ibm/plex-sans-arabic` 1.1.0, `fonts/complete/woff`), which carry Arabic *and* Latin, so a line mixing
 *   "شركة Test Co A" keeps one design and one set of metrics;
 * - Readex Pro SemiBold — Arabic and Latin in one file (Google Fonts' `readexpro/v27`, subsets arabic + latin, the
 *   TTF its CSS API serves, repacked as WOFF with every table unchanged) — headings and key figures (§2.5 Type).
 *   fontsource splits Readex into a Latin and an Arabic file with the same PostScript name, and pdfkit then embeds a
 *   fresh copy at every switch between the two (32 copies in one Arabic report) — one file ends that;
 * - IBM Plex Mono, Regular / Medium — complete, from `@ibm/plex-mono` 2.5.0 — IDs and money (§2.5 Type).
 *
 * WOFF, not WOFF2: fontkit 2.0.4 (react-pdf's font engine) fails to subset a WOFF2 font with composite glyphs —
 * every Arabic one — with "Offset is outside the bounds of the DataView" (measured 29 Sep on the app's own
 * `public/fonts/*.woff2`). The same fonts as WOFF subset and embed correctly. fontsource's Latin subset of Plex Mono
 * fails the same way on its space glyph, hence IBM's complete Plex files. And WOFF, not TTF: the request proxy
 * (`src/proxy.ts`) lets `.woff` files through without a session check, but not `.ttf`.
 */
export const DOC_FONT_FILES = {
  body: [
    { file: 'IBMPlexSansArabic-Regular.woff', weight: 400 },
    { file: 'IBMPlexSansArabic-SemiBold.woff', weight: 600 },
    { file: 'IBMPlexSansArabic-Bold.woff', weight: 700 },
  ],
  heading: [{ file: 'ReadexPro-SemiBold.woff', weight: 600 }],
  mono: [
    { file: 'IBMPlexMono-Regular.woff', weight: 400 },
    { file: 'IBMPlexMono-Medium.woff', weight: 500 },
  ],
} as const;

/** Where the files are served from in the app. */
export const DOC_FONT_BASE = '/fonts/doc/';

const FAMILY = {
  body: 'DocBody',
  heading: 'DocHeading',
  mono: 'DocMono',
} as const;

/**
 * Font stacks for react-pdf styles. react-pdf picks, per character, the first family of the stack that has the glyph,
 * so anything Readex Pro or Plex Mono lacks (Arabic inside an ID column, a rare sign) falls back to Plex Sans Arabic.
 */
export const FONT = {
  body: [FAMILY.body],
  heading: [FAMILY.heading, FAMILY.body],
  mono: [FAMILY.mono, FAMILY.body],
};

/** The family names PowerPoint is told to use (it shapes Arabic itself; the names must be installed or embedded). */
export const PPTX_FONT = {
  body: 'IBM Plex Sans Arabic',
  heading: 'Readex Pro',
  mono: 'IBM Plex Mono',
} as const;

let registeredFrom: string | null = null;

/**
 * Registers the document fonts with react-pdf once per source. `src(file)` gives a URL (browser: `/fonts/doc/…`) or
 * a file path (Node). Words are never hyphenated — neither language breaks words across lines in a report.
 */
export function registerDocFonts(src: (file: string) => string = (f) => DOC_FONT_BASE + f): void {
  const key = src('');
  if (registeredFrom === key) return;
  if (registeredFrom !== null) Font.clear();
  for (const [role, files] of Object.entries(DOC_FONT_FILES)) {
    Font.register({
      family: FAMILY[role as keyof typeof FAMILY],
      fonts: files.map((f) => ({ src: src(f.file), fontWeight: f.weight })),
    });
  }
  Font.registerHyphenationCallback((word) => [word]);
  registeredFrom = key;
}
