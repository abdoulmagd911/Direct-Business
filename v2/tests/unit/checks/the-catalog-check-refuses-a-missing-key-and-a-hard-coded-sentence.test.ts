import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/i18n-catalogs.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/screens.mjs "blind-i18n-catalogs" turns this red.
describe('the catalog check refuses a key missing from either catalog and a hard-coded sentence (V410)', () => {
  it('refuses a key in ar.json only, a key with no Arabic, and JSX text of two or more words in a screen', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify({ a: 'A', b: { c: 'C' }, onlyEnglish: 'Waiting for its Arabic' }),
      'messages/ar.json': JSON.stringify({ a: 'أ', b: { c: 'ج' }, stray: 'ضائع' }),
      'src/modules/x/Screen.tsx': `export const S = () => <p>Two words here</p>;\n`,
    });
    const got = await findings(check, root);
    expect(got.map((f) => f.message)).toEqual([
      'missing "onlyEnglish"',
      'missing "stray"',
      'hard-coded text "Two words here" — use the catalog',
    ]);
  });

  it('refuses a key written twice in one catalog object, at any depth, and not the same name in two places', async () => {
    const root = fixture({
      'messages/en.json': '{"a":"A","b":{"c":"C","d":{"e":"E"}}}',
      'messages/ar.json':
        '{"a":"أ","b":{"c":"ج","d":{"e":"هـ"}},"errors":{"x":"س"},"errors":{"y":"ص"},"p":{"q":{"r":"ر","r":"ز"}}}',
    });
    const got = (await findings(check, root)).map((f) => f.message);
    expect(got).toContain('"errors" is written twice — the later block hides the earlier one');
    expect(got).toContain('"p.q.r" is written twice — the later block hides the earlier one');
    // Two files that each hold `a`, and two objects that each hold `c`, are not duplicates.
    const clean = fixture({
      'messages/en.json': '{"a":"A","b":{"a":"A"},"c":{"a":"A"}}',
      'messages/ar.json': '{"a":"أ","b":{"a":"أ"},"c":{"a":"أ"}}',
    });
    expect(await findings(check, clean)).toEqual([]);
  });

  it('allows single words, the Ctrl K label, catalog calls, and the kit gallery', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify({ a: 'A' }),
      'messages/ar.json': JSON.stringify({ a: 'أ' }),
      'src/modules/x/Screen.tsx': `export const S = ({ t }) => <p>{t('a')}<b>Word</b><kbd>Ctrl K</kbd></p>;\n`,
      'src/app/(app)/kit/KitGallery.tsx': `export const K = () => <p>Made-up gallery text</p>;\n`,
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
