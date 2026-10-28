/**
 * The Density help line of My profile (V644): one line saying what Comfortable and Compact do and that on a phone it
 * only tightens the spacing — in Arabic with the same three facts, and the English line as it was.
 * Sabotages: tests/sabotage/settings-in-arabic.mjs "arabic-density-hint-missing".
 */
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

const say = (locale: 'en' | 'ar', messages: object) =>
  createTranslator({ locale, messages: messages as never })('profile.densityHint' as never);

describe('the Density help line', () => {
  it('is in Arabic, naming both settings by their Arabic words and the phone', () => {
    const line = say('ar', ar);
    expect(line, 'the Arabic line exists, not its key').not.toContain('densityHint');
    expect(line).toContain('المريح');
    expect(line).toContain('المضغوط');
    expect(line).toContain('الهاتف');
    expect(line).not.toMatch(/[A-Za-z]/);
  });

  it('keeps the English line unchanged', () => {
    expect(say('en', en)).toBe(
      'Comfortable gives more room; Compact fits more rows on the screen. On a phone it only tightens the spacing.',
    );
  });
});
