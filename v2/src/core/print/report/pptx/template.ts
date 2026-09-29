import type JSZip from 'jszip';
import { docText } from '../../text';
import { openPptx, writePptx } from './zip';

/**
 * The template path (V34, V301): when the owner supplies the department's own PowerPoint, the deck is that file with
 * its placeholders filled — `{{key}}` anywhere in a slide's text — and its repeating slides copied once per item
 * (`{{item.key}}` on the slide named in `repeat`). Everything the template's author set — layout, fonts, colours,
 * each paragraph's right-to-left setting — is kept as it is; only text changes. pptxgenjs cannot open an existing
 * file (spec §1), hence this: JSZip, the XML, and nothing else.
 *
 * A placeholder PowerPoint split across runs (it does, after a spell check or a language switch) is joined into its
 * paragraph's first run before filling; a placeholder left without a value refuses the whole fill, so "{{x}}" never
 * reaches a document.
 */
export interface TemplateFill {
  values: Record<string, string>;
  /** 1-based position of a template slide, and the items it is filled with — one copy each, in order. */
  repeat?: { slide: number; items: Record<string, string>[] }[];
}

const REL_SLIDE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
const SLIDE_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

export async function fillPptxTemplate(template: Uint8Array, fill: TemplateFill, stamp: Date): Promise<Uint8Array> {
  const zip = await openPptx(template);
  const pres = await read(zip, 'ppt/presentation.xml');
  const presRels = await read(zip, 'ppt/_rels/presentation.xml.rels');
  let types = await read(zip, '[Content_Types].xml');

  // The template's slides in order: sldId → rId → file.
  const target = new Map<string, string>();
  for (const m of presRels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], 'Id');
    const t = attr(m[0], 'Target');
    if (id && t && attr(m[0], 'Type') === REL_SLIDE) target.set(id, `ppt/${t.replace(/^\.?\//, '')}`);
  }
  const order = [...pres.matchAll(/<p:sldId\b[^>]*\/>/g)].map((m) => ({
    tag: m[0],
    file: target.get(attr(m[0], 'r:id') ?? '') ?? '',
  }));
  if (order.some((o) => !o.file)) throw new Error('pptx template: a slide in the list has no file');

  let nextSlide =
    Math.max(0, ...[...Object.keys(zip.files)].map((n) => Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(n)?.[1] ?? 0))) +
    1;
  let nextRid = Math.max(0, ...[...presRels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]))) + 1;
  let nextSldId = Math.max(255, ...order.map((o) => Number(attr(o.tag, 'id') ?? 0))) + 1;
  const repeats = new Map((fill.repeat ?? []).map((r) => [r.slide, r.items]));
  for (const n of repeats.keys())
    if (n < 1 || n > order.length) throw new Error(`pptx template: there is no slide ${n} to repeat`);

  const newList: string[] = [];
  let rels = presRels;
  for (const [i, slide] of order.entries()) {
    const items = repeats.get(i + 1);
    const xml = joinSplitPlaceholders(await read(zip, slide.file));
    if (!items) {
      zip.file(slide.file, fillText(xml, fill.values, slide.file));
      newList.push(slide.tag);
      continue;
    }
    // A repeating slide: one copy per item, then the template slide itself leaves the deck.
    const relsFile = slide.file.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
    const slideRels = zip.file(relsFile) ? await read(zip, relsFile) : null;
    for (const item of items) {
      const file = `ppt/slides/slide${nextSlide}.xml`;
      const values = { ...fill.values, ...Object.fromEntries(Object.entries(item).map(([k, v]) => [`item.${k}`, v])) };
      zip.file(file, fillText(xml, values, `${slide.file} (copy for item ${newList.length + 1})`));
      if (slideRels)
        // A copy never shares the template slide's notes page: PowerPoint repairs a deck where two slides do.
        zip.file(
          `ppt/slides/_rels/slide${nextSlide}.xml.rels`,
          slideRels.replace(/<Relationship\b[^>]*notesSlide[^>]*\/>/g, ''),
        );
      types = types.replace('</Types>', `<Override PartName="/${file}" ContentType="${SLIDE_TYPE}"/></Types>`);
      const rid = `rId${nextRid++}`;
      rels = rels.replace(
        '</Relationships>',
        `<Relationship Id="${rid}" Type="${REL_SLIDE}" Target="slides/slide${nextSlide}.xml"/></Relationships>`,
      );
      newList.push(`<p:sldId id="${nextSldId++}" r:id="${rid}"/>`);
      nextSlide++;
    }
    const oldRid = attr(slide.tag, 'r:id') as string;
    rels = rels.replace(new RegExp(`<Relationship\\b[^>]*Id="${oldRid}"[^>]*/>`), '');
    types = types.replace(new RegExp(`<Override PartName="/${slide.file.replace(/[.]/g, '\\.')}"[^>]*/>`), '');
    zip.remove(slide.file);
    zip.remove(relsFile);
  }
  zip.file(
    'ppt/presentation.xml',
    pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${newList.join('')}</p:sldIdLst>`),
  );
  zip.file('ppt/_rels/presentation.xml.rels', rels);
  zip.file('[Content_Types].xml', types);
  const app = zip.file('docProps/app.xml');
  if (app)
    zip.file(
      'docProps/app.xml',
      (await app.async('string')).replace(/<Slides>\d+<\/Slides>/, `<Slides>${newList.length}</Slides>`),
    );
  return writePptx(zip, stamp);
}

async function read(zip: JSZip, name: string): Promise<string> {
  const f = zip.file(name);
  if (!f) throw new Error(`pptx template: ${name} is missing`);
  return f.async('string');
}

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name.replace(':', '\\:')}="([^"]*)"`).exec(tag)?.[1];
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Replaces every placeholder inside `<a:t>` text; refuses one without a value. */
function fillText(xml: string, values: Record<string, string>, where: string): string {
  const missing = new Set<string>();
  const out = xml.replace(/(<a:t(?:\s[^>]*)?>)([^<]*)(<\/a:t>)/g, (_all, open: string, body: string, close: string) => {
    const filled = body.replace(PLACEHOLDER, (m, key: string) => {
      const v = values[key];
      if (v === undefined) {
        missing.add(key);
        return m;
      }
      return escapeXml(docText(v));
    });
    return open + filled + close;
  });
  if (missing.size)
    throw new Error(`pptx template: ${where} has no value for ${[...missing].map((k) => `{{${k}}}`).join(', ')}`);
  return out;
}

/**
 * In each paragraph whose text holds a placeholder that no single run holds whole, the runs are joined into the
 * first one (keeping its formatting), so the placeholder can be filled.
 */
function joinSplitPlaceholders(xml: string): string {
  return xml.replace(/<a:p>([\s\S]*?)<\/a:p>|<a:p\s[^>]*>([\s\S]*?)<\/a:p>/g, (para) => {
    const texts = [...para.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map((m) => m[1] ?? '');
    const whole = texts.join('');
    const all = [...whole.matchAll(PLACEHOLDER)].map((m) => m[0]);
    if (all.every((ph) => texts.some((t) => t.includes(ph)))) return para;
    const runs = [...para.matchAll(/<a:r>[\s\S]*?<\/a:r>/g)];
    if (runs.length < 2) return para;
    const first = runs[0]?.[0] as string;
    const merged = first.replace(/(<a:t(?:\s[^>]*)?>)[^<]*(<\/a:t>)/, (_m, o: string, c: string) => o + whole + c);
    let out = para.replace(first, merged);
    for (const r of runs.slice(1)) out = out.replace(r[0], '');
    return out;
  });
}
