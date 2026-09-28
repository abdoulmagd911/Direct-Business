import { describe, expect, it } from 'vitest';
import check, { termHash } from '../../../scripts/checks/rule-7.mjs';
import { findings, fixture } from './helpers';

// Every real-looking value here is assembled at run time, so this file never holds one (the scanner reads it too).
const j = (...parts: string[]) => parts.join('');

// Sabotage: tests/sabotage/blind-checks.mjs "rule-7" (the scanner skips its patterns) turns this red.
describe('the rule-7 scanner refuses real-looking data and secrets', () => {
  it('refuses each kind of real-looking value', async () => {
    const lines = [
      j('owner: someone', '@', 'realco.sa'), // 1 e-mail at a real-looking domain
      j('mobile: +966 5', '5 123 4567'), // 2 Saudi mobile, international form
      j('mobile: 05', '51234567'), // 3 Saudi mobile, local form
      j('phone: 011', '4567890'), // 4 Riyadh landline, local form
      j('vat: 3', '1234567890123', '3'), // 5 VAT
      j('cr: 1010', '123456'), // 6 CR
      j('iban: S', 'A03 8000 0000 6080 1016 7519'), // 7 IBAN
      j('tax invoice: DP', 'IN-', '123456'), // 8 ZATCA number
      j('key: sb_', 'secret_', 'abcdefghijklmnop'), // 9 Supabase secret key
      j('jwt: ey', 'JhbGciOiJIUzI1NiJ9.ey', 'JzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijkl'), // 10 JWT
      j('-----BEGIN ', 'PRIVATE KEY-----'), // 11 private key
      j('url: postgres://app:', 'hunter2secret@', 'db.realhost.co'), // 12 database URL with a password
      j('intl: +971 ', '50 123 4567'), // 13 international number
      j('arabic digits: ٠', '٥٥١٢٣٤٥٦٧'), // 14 Saudi mobile in Arabic-Indic digits
    ];
    const root = fixture({ 'fixtures/people.csv': lines.join('\n') + '\n' });
    const got = await findings(check, root);
    const fired = (line: number) =>
      got.filter((f) => f.line === line).map((f) => /\(([a-z0-9-]+)\)/.exec(f.message)?.[1]);
    const expected = [
      'email',
      'phone-sa',
      'phone-sa-local',
      'phone-sa-local',
      'vat-sa',
      'cr-sa',
      'iban-sa',
      'tax-invoice',
      'supabase-key',
      'jwt',
      'private-key',
      'db-url',
      'phone-intl',
      'phone-sa-local',
    ];
    expected.forEach((name, i) => expect(fired(i + 1), `line ${i + 1}`).toContain(name));
    expect(new Set(got.map((f) => f.line)).size).toBe(expected.length);
  });

  it('refuses a deny-listed term, a binary file not on the list, and a deny-listed file name', async () => {
    const term = j('zz', 'qx', 'realname');
    const root = fixture({
      'scripts/checks/rule7-denylist.txt': `${termHash(term)}  # staff surname\n`,
      'fixtures/a.md': j('Evaluator: Mr ', term.toUpperCase(), '\n'),
      'fixtures/report.xlsx': 'PK\u0003\u0004 binary',
      [j('fixtures/', term, '-notes.txt')]: 'nothing here\n',
    });
    const got = await findings(check, root);
    expect(got.map((f) => `${f.file}:${f.line}`).sort()).toEqual(
      [j('fixtures/', term, '-notes.txt:0'), 'fixtures/a.md:1', 'fixtures/report.xlsx:0'].sort(),
    );
  });

  it('allows the made-up forms of V101', async () => {
    const root = fixture({
      'fixtures/world.md': [
        'test.am1@directksa.com, a@test.example, someone@example.com, fake+2@anywhere.co, icon@2x.png',
        '+966 50 000 0012, 0500000012, 011 000 0123, +971 50 000 0012',
        'VAT 300000000000013, CR 1010000012, unified 7000001234',
        'DPIN-T-0001, TTIN-T-0002, INV-T-0001',
        'postgres://postgres:postgres@127.0.0.1:54322/postgres',
        'amounts 11500.00 and 9000, dates 2026-08-14, 20260929000000_core_init.sql',
      ].join('\n'),
    });
    expect(await findings(check, root)).toEqual([]);
  });
});
