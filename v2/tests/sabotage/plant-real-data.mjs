// Sabotages for the rule-7 scanner: each plants one kind of real-looking data in a new file. The values are
// assembled when the sabotage runs, so this file never holds one (the scanner reads it on every run).
const j = (...parts) => parts.join('');

export const sabotages = [
  {
    name: 'plant-real-email',
    breaks: ['check:rule-7'],
    expect: 'supabase/fixtures/people.csv:2 [rule-7] an e-mail address (email)',
    writes: [{ file: 'supabase/fixtures/people.csv', content: j('name,email\nA Person,a.person', '@', 'realco.sa\n') }],
  },
  {
    name: 'plant-real-phone',
    breaks: ['check:rule-7'],
    expect: 'tests/e2e/fixtures/contact.json:1 [rule-7] a Saudi phone number',
    writes: [{ file: 'tests/e2e/fixtures/contact.json', content: j('{ "phone": "05', '51234567" }\n') }],
  },
  {
    name: 'plant-real-vat',
    breaks: ['check:rule-7'],
    expect: 'a Saudi VAT number (vat-sa)',
    writes: [
      { file: 'supabase/fixtures/partners.sql', content: j("insert into x values ('3", '1234567890123', "3');\n") },
    ],
  },
  {
    name: 'plant-secret-key',
    breaks: ['check:rule-7'],
    expect: 'src/core/db/keys.ts:1 [rule-7] a Supabase key (supabase-key)',
    writes: [
      { file: 'src/core/db/keys.ts', content: j("export const key = 'sb_", 'secret_', "abcdefghijklmnopqrst';\n") },
    ],
  },
  {
    name: 'plant-binary-export',
    breaks: ['check:rule-7'],
    expect: 'supabase/fixtures/export.xlsx [rule-7] binary file not on',
    writes: [{ file: 'supabase/fixtures/export.xlsx', content: 'PK\u0003\u0004\u0000\u0000 a spreadsheet' }],
  },
  {
    name: 'plant-duplicate-decision',
    breaks: ['check:v2-ids'],
    expect: 'is used twice',
    edits: [
      {
        file: '../docs/v2/DECISIONS.md',
        find: '**V1 — The transaction is the unit of revenue**',
        replace:
          '**V1 — A second decision with the same number** planted.\n\n**V1 — The transaction is the unit of revenue**',
      },
    ],
  },
];
