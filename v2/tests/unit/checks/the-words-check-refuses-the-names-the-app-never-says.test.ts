import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/forbidden-words.mjs';
import { findings, fixture } from './helpers';

// Sabotage: tests/sabotage/blind-checks.mjs "blind-forbidden-words" turns this red.
describe('the words check refuses the names the app never says (V59)', () => {
  it('refuses each name, however it is spaced or cased, in a catalog and in page text', async () => {
    const root = fixture({
      'messages/en.json': [
        '{',
        '  "a": "Welcome to Direct KSA",',
        '  "b": "directksa portal",',
        '  "c": "Direct-Corporate travel",',
        '  "d": "our B2B desk",',
        '  "e": "MICE events",',
        '  "f": "b 2 b",',
        '  "g": "Sales (GMV) this month",',
        '  "h": "Sign in with Google",',
        '  "i": "Join on Zoom",',
        '  "j": "Keep me signed in"',
        '}',
        '',
      ].join('\n'),
      'src/app/page.tsx': [
        `export const A = () => <h1>Direct Corporate</h1>;`,
        `export const b = 'b2b';`,
        'export const c = `the ${1} mice`;',
        '',
      ].join('\n'),
      'supabase/templates/sign-in-code.html': '<p>Your code</p>\n<p>Keep me signed in</p>\n',
    });
    const got = await findings(check, root);
    const lines = (f: string) =>
      got
        .filter((x) => x.file === f)
        .map((x) => x.line)
        .sort((a, b) => a - b);
    expect(lines('messages/en.json')).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(lines('supabase/templates/sign-in-code.html')).toEqual([2]);
    expect(lines('src/app/page.tsx')).toEqual([1, 2, 3]);
  });

  it('allows the product and department names, the domain, comments and ordinary words', async () => {
    const root = fixture({
      'messages/en.json':
        '{ "app": { "name": "Commercial Workspace", "department": "Commercial", "copy": "© Direct" } }\n',
      'src/app/page.tsx': [
        `// never "Direct KSA" or B2B in the wording (V59) — a comment is not wording`,
        `export const A = () => <p>Direct · Commercial · microphone · mimic · b2c · googly · zoomed · sales</p>;`,
        `export const host = 'www.directksab2b.com';`,
        '',
      ].join('\n'),
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
