import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * next-intl splits a key on dots, so a dotted name in ar.json is never found. The English fallback for a missing line
 * lives in core/i18n/fallback.ts (V360).
 * Sabotage: `ar-writes-a-dotted-key` (tests/sabotage/arabic.mjs).
 */
type Messages = { [key: string]: string | Messages };
const V2 = path.resolve(import.meta.dirname, '../../..');
const read = (lang: string) => JSON.parse(fs.readFileSync(path.join(V2, `messages/${lang}.json`), 'utf8')) as Messages;

describe('the Arabic catalog', () => {
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
});
