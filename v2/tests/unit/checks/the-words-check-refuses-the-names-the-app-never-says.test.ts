import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import check, { FORBIDDEN, SEEDS_FROM } from '../../../scripts/checks/forbidden-words.mjs';
import { findings, fixture } from './helpers';

// Sabotages: tests/sabotage/blind-checks.mjs "blind-forbidden-words" and "blind-seed-words", and
// "words-lists-drift" (the database's copy of the list), turn this red.
describe('the words check refuses the names the app never says (V59, V73, V74, V404)', () => {
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
        '  "g": "Continue with Google",',
        '  "h": "Sign in with Zoom",',
        '  "i": "Keep me  signed in on this device",',
        '  "j": "Sales (GMV)"',
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
        `export const A = () => <p>Direct · Commercial · microphone · mimic · b2c · zooming · googly · signed in · sales</p>;`,
        `export const host = 'www.directksab2b.com';`,
        '',
      ].join('\n'),
    });
    expect(await findings(check, root)).toEqual([]);
  });

  it('refuses them in the seeds of a migration from V404 on — not in its comments, nor in the history before', async () => {
    const root = fixture({
      [`supabase/migrations/${SEEDS_FROM}_seeds.sql`]: [
        '-- a comment may say B2G: comments are not wording',
        "insert into partner.side_type (key, name_en) values ('government', 'Government (B2G)');",
        "comment on table partner.side_type is 'Made up: a b-2-b desk';",
        '-- check-allow: forbidden-words — a line waived with its reason',
        "select 'Direct KSA';",
        "select 'Government', 'it''s fine';",
        '',
      ].join('\n'),
      'supabase/migrations/20260929010000_history.sql': "insert into t (name) values ('Government (B2G)');\n",
      'messages/en.json': '{ "a": "a b 2 g desk" }\n',
    });
    const got = (await findings(check, root)).map(
      (f) => `${path.basename(f.file)}:${f.line} ${f.message.split(' — ')[0]}`,
    );
    expect(got.sort()).toEqual([
      `${SEEDS_FROM}_seeds.sql:2 "B2G"`,
      `${SEEDS_FROM}_seeds.sql:3 "b-2-b"`,
      'en.json:1 "b 2 g"',
    ]);
  });

  it('holds the same list as the database (core.banned_word)', () => {
    const dir = path.join(__dirname, '../../../supabase/migrations');
    const latest = fs
      .readdirSync(dir)
      .filter(
        (f) => f.endsWith('.sql') && fs.readFileSync(path.join(dir, f), 'utf8').includes('function core.banned_word('),
      )
      .sort()
      .pop();
    expect(latest).toBeDefined();
    const sql = fs.readFileSync(path.join(dir, latest as string), 'utf8');
    const body = sql.slice(
      sql.indexOf('function core.banned_word('),
      sql.indexOf('$$;', sql.indexOf('function core.banned_word(')),
    );
    const labels = [...body.matchAll(/\(\d+, '(?:[^']|'')*', '([^']*)'\)/g)].map((m) => m[1]);
    expect(labels).toEqual(FORBIDDEN.map(([, word]) => word));
  });
});
