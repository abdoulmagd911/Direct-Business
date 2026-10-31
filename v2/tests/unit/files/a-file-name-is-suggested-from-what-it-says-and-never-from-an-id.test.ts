import { describe, expect, it } from 'vitest';
import { firstDate, kindOf, suggestName, titleOf, type NameKind } from '@/core/files/suggest-name';

const kinds: NameKind[] = [
  { key: 'contract', keywordsEn: ['contract', 'agreement'], keywordsAr: ['عقد'], neverRead: false },
  { key: 'invoice', keywordsEn: ['invoice'], keywordsAr: ['فاتورة'], neverRead: false },
  { key: 'identity', keywordsEn: ['identity'], keywordsAr: ['هوية'], neverRead: true },
];

describe('a file name is suggested from what the file says (V655 B)', () => {
  it('finds the kind from English or Arabic words, the most named one wins, a tie names none', () => {
    expect(kindOf('Service Agreement\nThis contract is made between', kinds)).toBe('contract');
    expect(kindOf('فاتورة ضريبية رقم 12', kinds)).toBe('invoice');
    expect(kindOf('contract and invoice', kinds)).toBeNull();
  });
  it('reads the first real day in the text, in any of three shapes, with Arabic digits too', () => {
    expect(firstDate('Dated 2026-09-28.')).toBe('2026-09-28');
    expect(firstDate('on 28/09/2026')).toBe('2026-09-28');
    expect(firstDate('بتاريخ ٢٨-٠٩-٢٠٢٦')).toBe('2026-09-28');
    expect(firstDate('on 31/02/2026 and then 01/03/2026')).toBe('2026-03-01');
    expect(firstDate('no day here')).toBeNull();
  });
  it('takes the first heading-like line as the title, not a sentence or a number', () => {
    expect(titleOf('\n 12345 \nSupply Agreement for Hotel Rooms\nThis agreement is made.')).toBe(
      'Supply Agreement for Hotel Rooms',
    );
    expect(titleOf('Dear sir, we write to you.\n')).toBeNull();
  });
  it("puts it together, with the record's day when the text has none", () => {
    expect(
      suggestName({ text: 'Invoice\nTotal due', mime: 'application/pdf', kinds, recordDate: '2026-10-01' }),
    ).toEqual({ skipped: null, kind: 'invoice', date: '2026-10-01', title: 'Invoice' });
  });
});

describe('a file that holds an identity is never suggested from (V655 B privacy)', () => {
  it('a kind marked never-read is not read at all', () => {
    expect(suggestName({ text: 'Contract', mime: 'application/pdf', kinds, chosenKind: 'identity' })).toEqual({
      skipped: 'never_read',
    });
  });
  it('an image or a scan with no text gets the pattern name only', () => {
    expect(suggestName({ text: 'Contract', mime: 'image/png', kinds })).toEqual({ skipped: 'image' });
    expect(suggestName({ text: '  \n', mime: 'application/pdf', kinds })).toEqual({ skipped: 'image' });
  });
  it.each([
    ['an IBAN', 'Contract\nIBAN GB82 WEST 1234 5698 7654 32'],
    ['a card number', 'Invoice\nCard 4111 1111 1111 1111'],
    ['a national ID', 'Contract\nID 1098765432'],
    ['a passport', 'Contract\nPassport No: A12345678'],
  ])('%s anywhere in the text suggests nothing at all', (_n, text) => {
    expect(suggestName({ text, mime: 'application/pdf', kinds })).toEqual({ skipped: 'sensitive' });
  });
});
