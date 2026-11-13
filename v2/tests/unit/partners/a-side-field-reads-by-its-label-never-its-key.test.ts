/**
 * A side's custom field on the organisation record (partner.side_field) reads by its label in the reader's language,
 * never by its stored key ("payment_terms"); a select reads by its option's label, a yes/no field as Yes or No, a date
 * the one way — and a value whose definition was retired reads as its key in words, never as a code. Only fields
 * holding a value are listed. (Owner 13 Nov audit: the record printed the raw keys.) Every value is made up.
 */
import { describe, expect, it } from 'vitest';
import { sideFieldLabel, sideFieldRows, sideFieldValue } from '../../../src/modules/partners/side-fields';
import type { SideFieldDef } from '../../../src/modules/partners/types';

const words = { yes: 'Yes', no: 'No' };
const defs: SideFieldDef[] = [
  {
    side: 'client',
    key: 'payment_terms',
    label_en: 'Payment terms',
    label_ar: 'شروط الدفع',
    type: 'number',
    options: null,
  },
  {
    side: 'client',
    key: 'channel',
    label_en: 'Channel',
    label_ar: 'القناة',
    type: 'select',
    options: [
      { key: 'portal', en: 'Portal', ar: 'البوابة' },
      { key: 'email', en: 'Email', ar: 'البريد' },
    ],
  },
  { side: 'client', key: 'vip', label_en: 'VIP desk', label_ar: 'مكتب كبار العملاء', type: 'boolean', options: null },
  { side: 'client', key: 'renewal', label_en: 'Renewal', label_ar: 'التجديد', type: 'date', options: null },
  {
    side: 'supplier_partner',
    key: 'peak',
    label_en: 'Peak allotment',
    label_ar: 'حصة الذروة',
    type: 'number',
    options: null,
  },
];

describe('a side field reads by its label, never its key', () => {
  it('labels a field in the reader’s language', () => {
    expect(sideFieldLabel(defs[0], 'payment_terms', 'en')).toBe('Payment terms');
    expect(sideFieldLabel(defs[0], 'payment_terms', 'ar')).toBe('شروط الدفع');
  });

  it('words a retired field’s key instead of printing it', () => {
    expect(sideFieldLabel(undefined, 'payment_terms', 'en')).toBe('Payment terms');
  });

  it('says a select by its option, a yes/no as Yes or No, a date the one way', () => {
    expect(sideFieldValue(defs[1], 'portal', 'en', words)).toBe('Portal');
    expect(sideFieldValue(defs[1], 'portal', 'ar', words)).toBe('البوابة');
    expect(sideFieldValue(defs[2], true, 'en', words)).toBe('Yes');
    expect(sideFieldValue(defs[2], false, 'en', words)).toBe('No');
    expect(sideFieldValue(defs[3], '2026-11-20', 'en', words)).toBe('20 Nov 2026');
    expect(sideFieldValue(defs[0], 30, 'en', words)).toBe('30');
  });

  it('keeps a stored option that has gone as it was, and an empty value as empty', () => {
    expect(sideFieldValue(defs[1], 'fax', 'en', words)).toBe('fax');
    expect(sideFieldValue(defs[0], null, 'en', words)).toBeNull();
    expect(sideFieldValue(defs[0], '', 'en', words)).toBeNull();
  });

  it('lists only the side’s own fields that hold a value, in the definitions’ order', () => {
    const rows = sideFieldRows(
      'client',
      { vip: true, payment_terms: 30, old_key: 'kept', channel: null },
      defs,
      'en',
      words,
    );
    expect(rows).toEqual([
      { key: 'payment_terms', label: 'Payment terms', value: '30' },
      { key: 'vip', label: 'VIP desk', value: 'Yes' },
      { key: 'old_key', label: 'Old key', value: 'kept' },
    ]);
  });
});
