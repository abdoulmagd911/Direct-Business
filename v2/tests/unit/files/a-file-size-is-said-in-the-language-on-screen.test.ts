/**
 * A file's size on a record's files and in its stream (ui/record/FilesSection.tsx): the units were the English letters
 * B / KB / MB in Arabic too (the 13 Nov sweep). They come from the catalog now, with Latin digits as every figure.
 */
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { formatFileSize } from '../../../src/ui/record/FilesSection';

type Say = (key: string, values: Record<string, string>) => string;
const say = (locale: 'en' | 'ar') => {
  const t = createTranslator({ locale, messages: locale === 'en' ? en : ar }) as unknown as Say;
  return (bytes: number) => formatFileSize(bytes, t, locale);
};

describe('a file size is said in the language on screen', () => {
  it('says bytes, kilobytes and megabytes in English', () => {
    const size = say('en');
    expect(size(512)).toBe('512 B');
    expect(size(12_640)).toBe('12.3 KB');
    expect(size(1_310_720)).toBe('1.3 MB');
  });
  it('says them in Arabic words, with Latin digits', () => {
    const size = say('ar');
    expect(size(512)).toBe('512 بايت');
    expect(size(12_640)).toBe('12.3 كيلوبايت');
    expect(size(1_310_720)).toBe('1.3 ميغابايت');
  });
});
