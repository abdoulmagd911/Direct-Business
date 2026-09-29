import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/i18n-catalogs.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/screens.mjs "blind-i18n-catalogs" turns this red.
describe('the catalog check refuses a key in ar.json alone and a hard-coded sentence (V410)', () => {
  it('refuses a key in ar.json only, and JSX text of two or more words in a screen', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify({ a: 'A', b: { c: 'C' }, onlyEnglish: 'Waiting for its Arabic' }),
      'messages/ar.json': JSON.stringify({ a: 'أ', b: { c: 'ج' }, stray: 'ضائع' }),
      'src/modules/x/Screen.tsx': `export const S = () => <p>Two words here</p>;\n`,
    });
    const got = await findings(check, root);
    expect(got.map((f) => f.message)).toEqual([
      'missing "stray"',
      'hard-coded text "Two words here" — use the catalog',
    ]);
  });

  it('allows an English-only key, single words, the Ctrl K label, catalog calls, and the kit gallery', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify({ a: 'A', later: 'Arabic comes with builder C' }),
      'messages/ar.json': JSON.stringify({ a: 'أ' }),
      'src/modules/x/Screen.tsx': `export const S = ({ t }) => <p>{t('a')}<b>Word</b><kbd>Ctrl K</kbd></p>;\n`,
      'src/app/(app)/kit/KitGallery.tsx': `export const K = () => <p>Made-up gallery text</p>;\n`,
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
