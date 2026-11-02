import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import JSZip from 'jszip';
import { paletteFromTokensCss } from '@/core/print/palette';
import type { Lang, ReportDoc } from '@/core/print/report/model';
import { withCurrentNames } from '@/core/print/report/names';
import { reportPptx } from '@/core/print/report/pptx/reportPptx';
import { V2 } from './pdf-tools';
import { sampleNames, sampleReport } from './sample-report';

/** Helpers for the PPTX tests (V301): the deck made as the browser makes it, and its slides' XML in deck order. */

let logo: { png: string; aspect: number } | null = null;
async function logoPng() {
  if (!logo) {
    // The browser draws the official SVG on a canvas; here @napi-rs/canvas does the same.
    const img = await loadImage(fs.readFileSync(path.join(V2, 'public/brand/direct-logo-on-dark.svg')));
    const c = createCanvas(img.width * 8, img.height * 8);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    logo = {
      png: `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`,
      aspect: img.width / img.height,
    };
  }
  return logo;
}

export async function renderReportPptx(lang: Lang, doc: ReportDoc = sampleReport): Promise<Uint8Array> {
  const palette = paletteFromTokensCss(fs.readFileSync(path.join(V2, 'src/ui/tokens.css'), 'utf8'));
  const l = await logoPng();
  const named = withCurrentNames(doc, (_kind, id) => sampleNames[id] ?? null);
  return reportPptx(named, lang, { palette, logoPng: l.png, logoAspect: l.aspect });
}

export interface Deck {
  zip: JSZip;
  /** Each slide's XML, in the order the deck shows them. */
  slides: string[];
}

export async function readDeck(bytes: Uint8Array): Promise<Deck> {
  const zip = await JSZip.loadAsync(bytes);
  const pres = await zip.file('ppt/presentation.xml')!.async('string');
  const rels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
  const target = new Map(
    [...rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
  const slides: string[] = [];
  for (const m of pres.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)) {
    const t = target.get(m[1] as string);
    const f = t ? zip.file(`ppt/${t.replace(/^\.?\//, '')}`) : null;
    if (!f) throw new Error(`the deck lists ${m[1]}, which has no slide file`);
    slides.push(await f.async('string'));
  }
  return { zip, slides };
}

/** The paragraphs of a slide: their `rtl` flag and their text (runs joined). */
export function paragraphs(xml: string): { rtl: boolean; text: string; langs: string[]; fonts: string[] }[] {
  return [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((m) => {
    const body = m[1] ?? '';
    const ppr = /<a:pPr\b[^>]*>/.exec(body)?.[0] ?? '';
    return {
      rtl: /\srtl="1"/.test(ppr),
      text: [...body.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => unescapeXml(t[1] ?? '')).join(''),
      langs: [...body.matchAll(/<a:rPr\b[^>]*\slang="([^"]+)"/g)].map((l) => l[1] as string),
      fonts: [...body.matchAll(/<a:(?:latin|cs) typeface="([^"]+)"/g)].map((f) => f[1] as string),
    };
  });
}

export const ARABIC_LETTER = /[\u{0621}-\u{064A}]/u;

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
