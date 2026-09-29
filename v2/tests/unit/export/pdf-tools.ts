import fs from 'node:fs';
import path from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { registerDocFonts } from '@/core/print/fonts';
import { parseLogoSvg } from '@/core/print/logo';
import { paletteFromTokensCss } from '@/core/print/palette';
import type { Lang, ReportDoc } from '@/core/print/report/model';
import { withCurrentNames } from '@/core/print/report/names';
import { reportPdfElement } from '@/core/print/report/pdf/ReportPdf';
import { sampleNames, sampleReport } from './sample-report';

/**
 * Helpers for the report PDF's tests (V301). The PDF is made exactly as the browser makes it — react-pdf from the
 * report model, the fonts from `public/fonts/doc`, the palette from `src/ui/tokens.css`, the logo from
 * `public/brand` — and read back with pdf.js: its pages drawn to pixels, its text with positions.
 */

export const V2 = path.resolve(import.meta.dirname, '../../..');
export const GOLDEN_DIR = path.join(V2, 'tests/unit/export/golden');
const RESULTS_DIR = path.join(V2, 'test-results/export');

/** `UPDATE_GOLDEN=1 pnpm test` rewrites the golden files — on purpose only, and the PR says why. */
export const UPDATING = process.env.UPDATE_GOLDEN === '1';

export async function renderReportPdf(lang: Lang, doc: ReportDoc = sampleReport): Promise<Buffer> {
  registerDocFonts((f) => path.join(V2, 'public/fonts/doc', f));
  const palette = paletteFromTokensCss(fs.readFileSync(path.join(V2, 'src/ui/tokens.css'), 'utf8'));
  const logo = parseLogoSvg(fs.readFileSync(path.join(V2, 'public/brand/direct-logo-on-dark.svg'), 'utf8'));
  const named = withCurrentNames(doc, (_kind, id) => sampleNames[id] ?? null);
  return renderToBuffer(reportPdfElement({ doc: named, lang, palette, logo }));
}

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  font: string;
}

export interface PdfPage {
  width: number;
  height: number;
  items: TextItem[];
  /** The page drawn at 1 px per point, RGBA. */
  rgba: Uint8ClampedArray;
  png: Buffer;
}

export async function readPdf(bytes: Uint8Array): Promise<PdfPage[]> {
  const pdf = await getDocument({ data: new Uint8Array(bytes), disableFontFace: true, verbosity: 0 }).promise;
  const pages: PdfPage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: ctx as never, viewport })
      .promise;
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of content.items)
      if ('str' in it && it.str.trim())
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, font: it.fontName });
    pages.push({
      width: canvas.width,
      height: canvas.height,
      items,
      rgba: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      png: canvas.toBuffer('image/png'),
    });
  }
  return pages;
}

/**
 * Compares a page with its golden PNG. A pixel differs when a channel moves by more than 64 of 255 — anti-aliasing
 * noise between machines stays below that — and a page matches when at most 0.02 % of its pixels differ (about 100 of
 * the 518,400 on a 960 × 540 page: a single wrongly joined Arabic word already changes several hundred).
 */
export async function compareWithGolden(
  page: PdfPage,
  name: string,
): Promise<{ differing: number; budget: number; golden: string }> {
  const golden = path.join(GOLDEN_DIR, `${name}.png`);
  if (UPDATING) {
    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    fs.writeFileSync(golden, page.png);
  }
  const budget = Math.floor(page.width * page.height * 0.0002);
  if (!fs.existsSync(golden)) return { differing: Number.POSITIVE_INFINITY, budget, golden };
  const img = await loadImage(fs.readFileSync(golden));
  if (img.width !== page.width || img.height !== page.height)
    return { differing: Number.POSITIVE_INFINITY, budget, golden };
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const want = ctx.getImageData(0, 0, img.width, img.height).data;
  const diff = ctx.createImageData(img.width, img.height);
  let differing = 0;
  for (let i = 0; i < want.length; i += 4) {
    const d = Math.max(
      Math.abs((want[i] ?? 0) - (page.rgba[i] ?? 0)),
      Math.abs((want[i + 1] ?? 0) - (page.rgba[i + 1] ?? 0)),
      Math.abs((want[i + 2] ?? 0) - (page.rgba[i + 2] ?? 0)),
    );
    const hit = d > 64;
    if (hit) differing++;
    diff.data[i] = hit ? 255 : 230;
    diff.data[i + 1] = hit ? 0 : 230;
    diff.data[i + 2] = hit ? 0 : 230;
    diff.data[i + 3] = 255;
  }
  if (differing > budget) {
    // Leave the evidence where a person can open it: the page as drawn now, and the pixels that moved.
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESULTS_DIR, `${name}.actual.png`), page.png);
    ctx.putImageData(diff, 0, 0);
    fs.writeFileSync(path.join(RESULTS_DIR, `${name}.diff.png`), canvas.toBuffer('image/png'));
  }
  return { differing, budget, golden };
}

/** Text items on one baseline (±2 pt) that contain `needle`. */
export function find(page: PdfPage, needle: string): TextItem[] {
  return page.items.filter((i) => i.str.includes(needle));
}

/** The first item holding `needle`, or a failure naming what the page holds. */
export function one(page: PdfPage, needle: string): TextItem {
  const hit = find(page, needle)[0];
  if (!hit) throw new Error(`"${needle}" is not on the page; it holds: ${page.items.map((i) => i.str).join(' | ')}`);
  return hit;
}

/** The x of `needle` itself inside its item (items of an LTR run hold several tokens in reading order). */
export function xOf(page: PdfPage, needle: string): number {
  const item = one(page, needle);
  const at = item.str.indexOf(needle);
  return item.x + (item.width * at) / Math.max(item.str.length, 1);
}
