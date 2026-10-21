/**
 * QA-574: the Density help line on My profile drew `profile.densityHint` in Arabic. The app never draws a raw key: a
 * line with no Arabic yet reads in English, and a key found in no catalog draws nothing. Every value is made up.
 * Sabotage: tests/sabotage/never-a-raw-key.mjs.
 */
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { noRawKey, withEnglishFallback } from '../../../src/core/i18n/fallback';

type Catalog = { [key: string]: string | Catalog };
const flat = (o: Catalog, p = ''): Record<string, string> =>
  Object.entries(o).reduce(
    (r, [k, v]) => Object.assign(r, typeof v === 'string' ? { [p + k]: v } : flat(v, `${p}${k}.`)),
    {} as Record<string, string>,
  );

/** Draws one key the way the app does: English underneath, the same fallback, the same error handling. */
const draw = (
  locale: 'en' | 'ar',
  own: Catalog,
  key: string,
  values?: Record<string, string | number>,
  english: Catalog = en as Catalog,
) =>
  createTranslator({
    locale,
    messages: (locale === 'en' ? own : withEnglishFallback(english, own)) as never,
    getMessageFallback: noRawKey,
    onError: () => undefined,
  })(key as never, values as never) as string;

/** Values that satisfy a message's own placeholders: a number for a plural, a word for the rest. */
function valuesFor(text: string): Record<string, string | number> {
  const v: Record<string, string | number> = {};
  for (const m of text.matchAll(/\{(\w+)(?:,\s*(\w+))?/g))
    v[m[1]!] = m[2] === 'plural' || m[2] === 'selectordinal' ? 2 : 'x';
  return v;
}

describe('a line with no Arabic yet', () => {
  it('reads in English, not as its key', () => {
    const english = { made: { up: { greeting: 'Hello, {name}' } } } as Catalog;
    expect(draw('ar', {} as Catalog, 'made.up.greeting', { name: 'Test' }, english)).toBe('Hello, Test');
  });

  it('keeps the Arabic where there is some, and English only for the gap', () => {
    const base = { a: { one: 'One', two: 'Two' } } as Catalog;
    const over = { a: { one: 'واحد' } } as Catalog;
    expect(flat(withEnglishFallback(base, over))).toEqual({ 'a.one': 'واحد', 'a.two': 'Two' });
  });

  it('is true of every real line: no key of the English catalog draws as itself in Arabic', () => {
    const english = flat(en as Catalog);
    for (const [key, text] of Object.entries(english)) {
      const values = valuesFor(text);
      const drawn = draw('ar', ar as Catalog, key, values);
      expect(drawn, `${key} draws as its key`).not.toBe(key);
      // a line English itself cannot draw with these made-up values (a date or number format) is not this test's concern
      if (draw('en', en as Catalog, key, values) !== '') expect(drawn, `${key} draws nothing in Arabic`).not.toBe('');
    }
  });

  it('has an Arabic word for the Density help line (QA-574)', () => {
    const line = draw('ar', ar as Catalog, 'profile.densityHint');
    expect(line).toBe((ar as unknown as { profile: { densityHint: string } }).profile.densityHint);
    expect(line, 'not the English').not.toBe(
      (en as unknown as { profile: { densityHint: string } }).profile.densityHint,
    );
    expect(line).toMatch(/[؀-ۿ]/);
  });
});

describe('a key found in no catalog', () => {
  it('draws nothing, in English and in Arabic, never the key', () => {
    for (const locale of ['en', 'ar'] as const) {
      const drawn = draw(locale, (locale === 'en' ? en : ar) as Catalog, 'profile.noSuchLineAnywhere');
      expect(drawn).toBe('');
      expect(drawn).not.toContain('profile');
      expect(drawn).not.toContain('noSuchLineAnywhere');
    }
  });

  it('draws nothing for a missing block, too', () => {
    expect(draw('ar', ar as Catalog, 'noSuchBlock.noSuchLine')).toBe('');
  });
});
