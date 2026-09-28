import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/i18n-catalogs.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/screens.mjs "blind-i18n-catalogs" turns this red.
describe('the catalog check refuses a missing key and a hard-coded sentence', () => {
  it('refuses a key in one catalog only, and JSX text of two or more words in a screen', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify({ nav: { tasks: 'Tasks', extra: 'Only here' } }),
      'messages/ar.json': JSON.stringify({ nav: { tasks: 'المهام', other: 'هنا فقط' } }),
      'src/app/(app)/tasks/page.tsx': `export default function P() { return <main><h1>My open tasks</h1><span>{t('x')}</span></main>; }\n`,
    });
    const got = await findings(check, root);
    expect(got.map((f) => f.message)).toEqual([
      'missing "nav.extra"',
      'missing "nav.other"',
      'hard-coded text "My open tasks" — use the catalog',
    ]);
  });

  it('allows single words, the Ctrl K label, catalog calls, and the kit gallery', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify({ a: 'A' }),
      'messages/ar.json': JSON.stringify({ a: 'أ' }),
      'src/ui/shell/TopBar.tsx': `export const A = () => <span>{t('top.create')}</span>;\nexport const B = () => <kbd>Ctrl K</kbd>;\nexport const C = () => <b>/</b>;\n`,
      'src/app/(app)/kit/KitGallery.tsx': `export const K = () => <h2>Component kit</h2>;\n`,
      'src/ui/Button.tsx': `export const D = () => <span>Not a screen</span>;\n`,
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
