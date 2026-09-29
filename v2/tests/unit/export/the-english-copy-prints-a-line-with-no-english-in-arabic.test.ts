import { describe, expect, it } from 'vitest';
import { readPdf, renderReportPdf } from './pdf-tools';
import { ARABIC_LETTER, paragraphs, readDeck, renderReportPptx } from './pptx-tools';

/**
 * Reports print in Arabic; the English copy is made on request from each line's English text, and a line typed only
 * in Arabic prints its Arabic there, reading right to left (V403; plan P6-2c: "the English copy of a snapshot with one
 * Arabic-only line prints that line in Arabic"). The sample's challenge "…(المرجع T-0042)" has no English.
 * Sabotage: `english-copy-drops-arabic-only-lines` (tests/sabotage/export.mjs).
 */
describe('the English copy prints a line with no English in Arabic', () => {
  it('in the PDF', async () => {
    const pages = await readPdf(await renderReportPdf('en'));
    const line = pages.flatMap((p) => p.items).find((i) => i.str.includes('T-0042'));
    expect(line?.str, 'the Arabic-only line is on the English copy').toMatch(ARABIC_LETTER);
    expect(
      pages.flatMap((p) => p.items).some((i) => i.str.includes('Fake University')),
      'English lines stay English',
    ).toBe(true);
  });

  it('in the PPTX, as a right-to-left Arabic paragraph', async () => {
    const deck = await readDeck(await renderReportPptx('en'));
    const p = deck.slides.flatMap(paragraphs).find((x) => x.text.includes('T-0042'));
    expect(p?.text, 'the Arabic-only line is on the English deck').toMatch(ARABIC_LETTER);
    expect(p?.rtl, 'and reads right to left').toBe(true);
    expect(p?.langs).toContain('ar-SA');
  });
});
