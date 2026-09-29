import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { beforeAll, describe, expect, it } from 'vitest';
import { fillPptxTemplate } from '@/core/print/report/pptx/template';
import { paragraphs, readDeck, type Deck } from './pptx-tools';

/**
 * The template path (V34, V301): a department's PowerPoint with `{{placeholders}}` is filled as it stands — its
 * right-to-left settings untouched — a repeating slide is copied once per item, in order, and the template slide
 * leaves the deck; a value is escaped and printed with Latin digits; a placeholder with no value refuses the fill.
 * The template here is made up and built in the test (no real file is ever committed — rule 7).
 * Sabotages: `template-leaves-placeholders`, `template-loses-a-copy` (tests/sabotage/export.mjs).
 */
const AR = { rtlMode: true, lang: 'ar-SA', align: 'right' as const, fontFace: 'IBM Plex Sans Arabic' };
let template: Uint8Array;
let deck: Deck;
const stamp = new Date('2026-10-05T12:00:00Z');
const items = [
  { text: 'توقيع اتفاقية مع Test Co A', amount: '11,500' },
  { text: 'تجديد عقد DK-P-0001', amount: '٢٦٬٢٣١' },
  { text: 'حل مشكلة <تأخر> & غيرها', amount: '42,000' },
];

beforeAll(async () => {
  const t = new PptxGenJS();
  t.layout = 'LAYOUT_WIDE';
  let s = t.addSlide();
  s.addText('{{title}}', { x: 0.5, y: 1, w: 12, h: 1, fontSize: 40, ...AR });
  s.addText('{{period}}', { x: 0.5, y: 2.2, w: 12, h: 0.8, fontSize: 24, ...AR });
  s = t.addSlide();
  s.addText('{{item.text}}', { x: 0.5, y: 1, w: 12, h: 1, fontSize: 20, ...AR });
  s.addText('{{item.amount}} ريال', { x: 0.5, y: 2.2, w: 12, h: 0.8, fontSize: 20, ...AR });
  s.addNotes('template notes');
  s = t.addSlide();
  // A placeholder split across two runs, as PowerPoint leaves one after a spell check.
  s.addText(
    [
      { text: '{{num', options: { ...AR, bold: true } },
      { text: 'ber}}', options: AR },
    ],
    { x: 0.5, y: 1, w: 12, h: 1 },
  );
  template = (await t.write({ outputType: 'uint8array' })) as Uint8Array;
  deck = await readDeck(
    await fillPptxTemplate(
      template,
      {
        values: { title: 'التقرير الشهري', period: 'سبتمبر ٢٠٢٦', number: 'COM-M-2026-09' },
        repeat: [{ slide: 2, items }],
      },
      stamp,
    ),
  );
});

describe('a filled PPTX template keeps its settings and repeats its slides', () => {
  it('copies the repeating slide once per item, in order, between the slides around it', () => {
    const texts = deck.slides.map((x) =>
      paragraphs(x)
        .map((p) => p.text)
        .filter(Boolean),
    );
    expect(texts).toEqual([
      ['التقرير الشهري', 'سبتمبر 2026'],
      ['توقيع اتفاقية مع Test Co A', '11,500 ريال'],
      ['تجديد عقد DK-P-0001', '26,231 ريال'],
      ['حل مشكلة <تأخر> & غيرها', '42,000 ريال'],
      ['COM-M-2026-09'],
    ]);
  });

  it("keeps each paragraph's right-to-left setting and language", () => {
    for (const p of deck.slides.flatMap(paragraphs).filter((x) => x.text)) {
      expect(p.rtl, p.text).toBe(true);
      expect(p.langs).toContain('ar-SA');
    }
  });

  it('leaves a well-formed deck: every listed slide has its file, its type and no shared notes', async () => {
    const types = await deck.zip.file('[Content_Types].xml')!.async('string');
    const slideFiles = Object.keys(deck.zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    expect(slideFiles).toHaveLength(5);
    for (const f of slideFiles) expect(types, f).toContain(`PartName="/${f}"`);
    const notesTargets: string[] = [];
    for (const n of Object.keys(deck.zip.files).filter((x) => /^ppt\/slides\/_rels\/.+\.rels$/.test(x)))
      for (const m of (await deck.zip.file(n)!.async('string')).matchAll(/Target="([^"]*notesSlide[^"]*)"/g))
        notesTargets.push(m[1] as string);
    expect(new Set(notesTargets).size, 'no two slides share a notes page').toBe(notesTargets.length);
    expect(await deck.zip.file('docProps/app.xml')!.async('string')).toContain('<Slides>5</Slides>');
  });

  it('refuses a placeholder that has no value, naming it', async () => {
    await expect(
      fillPptxTemplate(template, { values: { title: 'x', number: 'y' }, repeat: [{ slide: 2, items }] }, stamp),
    ).rejects.toThrow(/\{\{period\}\}/);
  });

  it('fills the same template the same way twice', async () => {
    const fill = { values: { title: 't', period: 'p', number: 'n' }, repeat: [{ slide: 2, items }] };
    const a = await fillPptxTemplate(template, fill, stamp);
    const b = await fillPptxTemplate(template, fill, stamp);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(Object.keys((await JSZip.loadAsync(a)).files)[0]).toBe('[Content_Types].xml');
  });
});
