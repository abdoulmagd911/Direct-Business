/**
 * The import review shows why a row is held or waits, in the person's language (13 Nov sweep: it printed the engine's
 * English sentences inside the Arabic screen). Every reason the engine gives is a code with its values, worded from the
 * catalogs; the English sentence it stands for is still what the database stores, and a stored sentence — a past
 * import's held row, or one the database wrote itself — is read back into its code, so it is worded too.
 */
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { buildPreview, normaliseFile, WHY, whyOf, whyText, type Why, type WhyCode } from '@/modules/imports';

const codes = Object.keys(WHY) as WhyCode[];
const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('every import reason is worded in both languages', () => {
  it('has an English and an Arabic line naming the same values as its sentence', () => {
    const enWhy = en.import.why as Record<string, string>;
    const arWhy = ar.import.why as Record<string, string>;
    for (const code of codes) {
      expect(enWhy[code], `import.why.${code} in en.json`).toBeTypeOf('string');
      expect(arWhy[code], `import.why.${code} in ar.json`).toBeTypeOf('string');
      expect(names(arWhy[code]!), `import.why.${code}: the Arabic names the same values`).toEqual(names(WHY[code]));
      expect(names(enWhy[code]!), `import.why.${code}: the English names the same values`).toEqual(names(WHY[code]));
      expect(arWhy[code], `import.why.${code} is Arabic`).toMatch(/[؀-ۿ]/);
    }
    expect(Object.keys(enWhy).sort()).toEqual([...codes].sort());
    expect(Object.keys(arWhy).sort()).toEqual([...codes].sort());
  });

  it('reads every sentence it writes back into the same reason', () => {
    const samples: Why[] = [
      { code: 'row_type', values: { type: 'refund' } },
      { code: 'not_paid', values: { status: 'Draft' } },
      { code: 'not_paid', values: { status: '' } },
      { code: 'expense_not_approved', values: { status: 'Pending' } },
      { code: 'status_unknown', values: { status: 'Mystery Status' } },
      { code: 'group_fill', values: { count: '3' } },
      { code: 'total_differs', values: { total: '1500', stored: '1400' } },
      { code: 'shared_invoice', values: { invoice: '9990000001', count: '2' } },
      { code: 'invoice_elsewhere', values: { invoice: '9990000001' } },
      { code: 'changed', fields: ['transaction number', 'service'] },
      { code: 'changed_incomplete', fields: ['cost'] },
      ...codes.filter((c) => !/\{/.test(WHY[c])).map((code): Why => ({ code })),
    ];
    for (const why of samples) expect(whyOf(whyText(why)), whyText(why)).toEqual(why);
    expect(whyText({ code: 'not_paid', values: { status: '' } })).toBe('Not fully paid (no status): not counted');
  });

  it('knows the sentences the database writes for its own clashes', () => {
    for (const stored of [
      'Invoice total differs from the stored transaction amount: transaction amount kept, held for a person',
      'Invoice number is already on another row: held for a person, nothing merged by guess',
      'Invoice number covers several transactions, so no single row owns this code link: held for a person',
      'Already linked to another discount code, kept as it was',
    ])
      expect(whyOf(stored), stored).not.toBeNull();
    expect(whyOf('Something nobody wrote')).toBeNull();
  });

  it('gives every held row and every preview reason its code, without changing what is held', () => {
    const header = [
      'Type',
      'Invoice Reference #',
      'Customer Name',
      'Item Is Taxable',
      'Invoice Status',
      'Invoice Total',
    ];
    const { records, held } = normaliseFile('invoice_export', header, [
      ['invoice', '9990000001', 'Made Up Co', 'Yes', 'Draft', '100'],
      ['refund', '9990000002', 'Made Up Co', 'Yes', 'Fully Paid', '100'],
      ['invoice', '', 'Made Up Co', 'Yes', 'Fully Paid', '100'],
    ]);
    expect(records).toHaveLength(0);
    expect(held.map((h) => h.why?.code)).toEqual(['row_type', 'no_invoice_ref', 'no_date']);
    for (const h of held) expect(h.reason).toBe(whyText(h.why!));
    const preview = buildPreview([], records, held);
    for (const r of preview.rows) {
      expect(r.whys).toHaveLength(r.reasons.length);
      r.whys.forEach((w, i) => expect(whyText(w)).toBe(r.reasons[i]));
    }
  });
});
