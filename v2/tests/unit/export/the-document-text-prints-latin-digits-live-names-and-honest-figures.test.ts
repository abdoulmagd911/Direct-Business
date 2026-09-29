import { describe, expect, it } from 'vitest';
import { cellText, change, figureParts, periodLabel } from '@/core/print/report/format';
import type { Column, Figure } from '@/core/print/report/model';
import { withCurrentNames } from '@/core/print/report/names';
import { entityTokens, latinDigits, resolveEntityTokens } from '@/core/print/text';
import { sampleReport } from './sample-report';

/**
 * The words and figures both documents print (V40, V58, M60, V301): Latin digits whatever was typed, today's names
 * for the people and partners a frozen report names by token, "not measured" never drawn as 0, and a change from last
 * year only when it can honestly be said.
 */
describe('document text: Latin digits, live names, honest figures', () => {
  it('turns Arabic-Indic digits and signs into Latin ones', () => {
    // Built at run time: a run of ten digits reads as a phone number to the rule-7 scanner (V101).
    const run = (zero: number) => String.fromCodePoint(...Array.from({ length: 10 }, (_, i) => zero + i));
    const latin = run(0x30);
    expect(latinDigits(run(0x0660)), 'Arabic-Indic').toBe(latin);
    expect(latinDigits(run(0x06f0)), 'extended Arabic-Indic').toBe(latin);
    expect(latinDigits('وفر ١٢٫٥٪ من ١٬٢٠٠')).toBe('وفر 12.5% من 1,200');
    expect(latinDigits('INV-T-0001 · 14/08/2026')).toBe('INV-T-0001 · 14/08/2026');
  });

  it("names an entity token with today's name, and a gap as a dash", () => {
    const text =
      'Renewed {{partner:00000000-0000-4000-8000-000000000001}} with {{person:00000000-0000-4000-8000-00000000000a}}';
    const names: Record<string, string> = { '00000000-0000-4000-8000-000000000001': 'Test Co A (renamed)' };
    expect(resolveEntityTokens(text, (_k, id) => names[id] ?? null)).toBe('Renewed Test Co A (renamed) with —');
    expect(entityTokens(text).map((t) => t.kind)).toEqual(['partner', 'person']);
  });

  it('puts current names into every text of a report, and changes no figure', () => {
    const doc = withCurrentNames(sampleReport, () => 'Test Co A Renamed');
    const flat = JSON.stringify(doc);
    expect(flat).not.toContain('{{partner:');
    expect(flat).toContain('Test Co A Renamed');
    const figures = (d: typeof doc) => JSON.stringify(d.sections.map((s) => (s.kind === 'tiles' ? s.tiles : null)));
    expect(figures(doc)).toBe(figures(sampleReport));
  });

  it('prints "not measured" as a dash, never as 0', () => {
    expect(figureParts({ kind: 'not_measured' }, 'en')).toEqual({ number: '—', unit: null });
    const col: Column = { key: 'k', title: { en: 'K', ar: 'ك' }, kind: 'number', width: 1 };
    expect(cellText(null, col, 'ar')).toBe('—');
    expect(cellText({ figure: { kind: 'not_measured' } }, col, 'en')).toBe('—');
  });

  it('prints money with its unit in each language', () => {
    const sar: Figure = { kind: 'number', value: 606500, unit: 'sar' };
    expect(figureParts(sar, 'en')).toEqual({ number: '606,500', unit: 'SAR' });
    expect(figureParts(sar, 'ar')).toEqual({ number: '606,500', unit: 'ريال' });
    expect(figureParts({ kind: 'number', value: 87.5, unit: 'percent' }, 'ar').number).toBe('87.5%');
  });

  it('says a change from last year only when both years are measured and last year was not 0', () => {
    const n = (value: number): Figure => ({ kind: 'number', value, unit: 'count' });
    expect(change(n(606500), n(512000))?.text).toBe('+18.5%');
    expect(change(n(7), n(12))?.text).toBe('−41.7%');
    expect(change(n(4), n(0))).toBeNull();
    expect(change(n(4), { kind: 'not_measured' })).toBeNull();
    expect(change({ kind: 'not_measured' }, n(4))).toBeNull();
    expect(change(n(4), null)).toBeNull();
  });

  it('names the period in each language with Gregorian months and Latin digits', () => {
    const month = { kind: 'monthly' as const, period: { start: '2026-09-01', end: '2026-09-30' } };
    const quarter = { kind: 'quarterly' as const, period: { start: '2026-07-01', end: '2026-09-30' } };
    expect(periodLabel(month, 'en')).toBe('September 2026');
    expect(periodLabel(month, 'ar')).toBe('سبتمبر 2026');
    expect(periodLabel(quarter, 'en')).toBe('Q3 2026');
    expect(periodLabel(quarter, 'ar')).toBe('الربع الثالث 2026');
  });
});
