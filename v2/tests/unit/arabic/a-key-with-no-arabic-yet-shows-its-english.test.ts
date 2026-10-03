import fs from 'node:fs';
import path from 'node:path';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { withFallback, type Messages } from '@/core/i18n/messages';

/**
 * English beneath Arabic (V410; restored with the catalog check by the oversight, 29 Sep): the catalog check keeps
 * ar.json complete, and if a key slips through anyway the Arabic screen shows its English — never the key itself,
 * never an error — while every key that has its Arabic keeps it.
 * Sabotages: `ar-fallback-shows-the-key`, `plant-missing-ar-key`, `ar-writes-a-dotted-key` (tests/sabotage/arabic.mjs).
 */
const V2 = path.resolve(import.meta.dirname, '../../..');
const read = (lang: string) => JSON.parse(fs.readFileSync(path.join(V2, `messages/${lang}.json`), 'utf8')) as Messages;

describe('the Arabic catalog with English beneath it', () => {
  it('shows the English of a key not yet in Arabic, and the Arabic of every other', () => {
    const en = read('en');
    const ar = read('ar');
    const common = { ...(ar.common as Messages) };
    delete common.saveChanges;
    const partial = { ...ar, common };
    const t = createTranslator({
      locale: 'ar',
      messages: withFallback(partial, en),
      onError: (e) => {
        throw e;
      },
    });
    const shown = (key: string) => {
      try {
        return t(key as never);
      } catch (e) {
        return `(refused: ${(e as Error).message})`;
      }
    };
    expect(shown('common.saveChanges'), 'a key with no Arabic shows its English').toBe('Save changes');
    expect(t('common.save' as never)).toBe('حفظ');
    expect(t('sign_in.sent_to' as never, { email: 'test.am1@example.com' } as never)).toBe(
      'أُرسل إلى test.am1@example.com',
    );
  });

  it('names no key with a dot in it — next-intl splits a key on dots, so a dotted name is never found', () => {
    const dotted: string[] = [];
    const walk = (o: Messages, at: string) => {
      for (const [k, v] of Object.entries(o)) {
        if (k.includes('.')) dotted.push(`${at}${k}`);
        if (typeof v === 'object') walk(v, `${at}${k}.`);
      }
    };
    walk(read('ar'), '');
    expect(dotted, 'a key name with a dot in ar.json').toEqual([]);
  });

  it('merges nested groups key by key', () => {
    expect(withFallback({ a: 'أ', g: { x: 'س' } }, { a: 'A', b: 'B', g: { x: 'X', y: 'Y' } })).toEqual({
      a: 'أ',
      b: 'B',
      g: { x: 'س', y: 'Y' },
    });
  });
});
