import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PPTX_FONT } from '@/core/print/fonts';
import { GOLDEN_DIR, UPDATING } from './pdf-tools';
import { ARABIC_LETTER, paragraphs, readDeck, renderReportPptx, type Deck } from './pptx-tools';

/**
 * The PowerPoint deck (plan P3-10, V301). PowerPoint shapes Arabic itself; what the file must carry is each Arabic
 * paragraph's right-to-left flag and language, the three document fonts, Latin digits, page numbers, and tables
 * whose columns run from the right in Arabic (PowerPoint does not mirror a table). The deck's outline — every slide's
 * paragraphs, their text and direction — must equal its golden JSON; the sample decks sit beside it for the PR.
 * Every text box of the Arabic deck is right to left, and each paragraph carries one settings tag (oversight, 29 Sep).
 * Sabotages: `pptx-forgets-right-to-left`, `pptx-keeps-the-table-left-to-right`, `pptx-box-left-to-right`,
 * `pptx-keeps-a-second-settings-tag` (tests/sabotage/export.mjs).
 */
const decks = {} as Record<'ar' | 'en', Deck>;
beforeAll(async () => {
  for (const lang of ['ar', 'en'] as const) {
    const bytes = await renderReportPptx(lang);
    if (UPDATING) fs.writeFileSync(path.join(GOLDEN_DIR, `report-${lang}.pptx`), bytes);
    decks[lang] = await readDeck(bytes);
  }
});

/** One line per paragraph with text — its direction, then its text — under a heading per slide. */
const outline = (deck: Deck) =>
  deck.slides
    .flatMap((xml, i) => [
      `== slide ${i + 1}`,
      ...paragraphs(xml)
        .filter((p) => p.text)
        .map((p) => `${p.rtl ? 'rtl' : 'ltr'} | ${p.text}`),
    ])
    .join('\n') + '\n';

describe('a report PPTX reads right to left in Arabic and matches its golden outline', () => {
  it('flags every Arabic paragraph right to left, in Arabic, and no English one', () => {
    const ar = decks.ar.slides.flatMap(paragraphs).filter((p) => ARABIC_LETTER.test(p.text));
    expect(ar.length).toBeGreaterThan(40);
    for (const p of ar) {
      expect(p.rtl, `"${p.text}" is right to left`).toBe(true);
      expect(
        p.langs.length && p.langs.every((l) => l === 'ar-SA' || l === 'en-GB'),
        `"${p.text}" says its language`,
      ).toBe(true);
      expect(p.langs, `"${p.text}" has an Arabic run`).toContain('ar-SA');
    }
    // In the English copy only a line printed in Arabic — one with no English (V403) — reads right to left.
    expect(
      decks.en.slides
        .flatMap(paragraphs)
        .filter((p) => p.rtl && !ARABIC_LETTER.test(p.text))
        .map((p) => p.text),
      'no English paragraph is right to left',
    ).toEqual([]);
  });

  it('marks every text box and every paragraph of the Arabic deck right to left, and none of the English one', () => {
    for (const lang of ['ar', 'en'] as const) {
      const rtl = lang === 'ar';
      const boxes = decks[lang].slides.flatMap((xml) =>
        [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((m) => m[0]).filter((sp) => /<a:t>[^<]/.test(sp)),
      );
      expect(boxes.length, `${lang}: text boxes`).toBeGreaterThan(60);
      for (const sp of boxes) {
        const text = paragraphs(sp)
          .map((p) => p.text)
          .join(' / ');
        expect(/<a:bodyPr\b[^>]*\srtlCol="1"/.test(sp), `${lang}: the text box "${text}"`).toBe(rtl);
        if (rtl)
          for (const p of paragraphs(sp).filter((x) => x.text))
            expect(p.rtl, `the paragraph "${p.text}" is right to left`).toBe(true);
      }
    }
  });

  it('writes one paragraph settings tag per paragraph, first — the file format allows no other', () => {
    for (const lang of ['ar', 'en'] as const)
      for (const xml of decks[lang].slides)
        for (const [, body] of xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)) {
          const at = [...body!.matchAll(/<a:pPr\b/g)].map((m) => m.index);
          expect(at.length <= 1 && (at[0] ?? 0) === 0, `${lang}: ${body!.slice(0, 120)}`).toBe(true);
        }
  });

  it('uses only the document fonts and prints Latin digits', () => {
    for (const lang of ['ar', 'en'] as const) {
      const ps = decks[lang].slides.flatMap(paragraphs);
      const fonts = new Set(ps.flatMap((p) => p.fonts));
      expect([...fonts].sort()).toEqual([PPTX_FONT.body, PPTX_FONT.heading, PPTX_FONT.mono].sort());
      expect(
        ps.filter((p) => /[\u{0660}-\u{0669}\u{06F0}-\u{06F9}\u{066A}-\u{066C}]/u.test(p.text)).map((p) => p.text),
      ).toEqual([]);
    }
  });

  it('numbers every slide after the cover', () => {
    for (const lang of ['ar', 'en'] as const) {
      const { slides } = decks[lang];
      slides.slice(1).forEach((xml, i) => {
        const label = lang === 'ar' ? `صفحة ${i + 2} من ${slides.length}` : `Page ${i + 2} of ${slides.length}`;
        expect(
          paragraphs(xml).map((p) => p.text),
          `slide ${i + 2}`,
        ).toContain(label);
      });
      expect(
        paragraphs(slides[0] as string).some((p) => /صفحة|Page \d/.test(p.text)),
        'the cover',
      ).toBe(false);
    }
  });

  it('runs table columns from the right in Arabic and from the left in English', () => {
    const firstRow = (deck: Deck) => {
      const xml = deck.slides.find((s) => s.includes('<a:tbl>') && s.includes('K-REV')) ?? '';
      const row = /<a:tr\b[\s\S]*?<\/a:tr>/.exec(xml)?.[0] ?? '';
      return [...row.matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map((c) =>
        [...c[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join(''),
      );
    };
    const ar = firstRow(decks.ar);
    expect(ar[0], 'the Arabic table ends with the status on the left').toBe('الحالة');
    expect(ar.at(-1), 'and starts with the code on the right').toBe('الرمز');
    expect(firstRow(decks.en)[0]).toBe('Code');
  });

  for (const lang of ['ar', 'en'] as const)
    it(`matches its golden outline (${lang})`, () => {
      const file = path.join(GOLDEN_DIR, `report-${lang}.pptx.outline.txt`);
      const now = outline(decks[lang]);
      if (UPDATING) fs.writeFileSync(file, now);
      expect(now, `the deck's outline differs from ${path.basename(file)}`).toBe(fs.readFileSync(file, 'utf8'));
    });
});
