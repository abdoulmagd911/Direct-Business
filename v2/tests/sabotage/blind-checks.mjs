// Sabotages for the checks' own unit tests (tests/unit/checks/): each makes one check blind to what it must refuse,
// and the unit test of that check must go red, failing on the named case. Run: node scripts/sabotage.mjs --kind unit
const unit = (file) => `unit:tests/unit/checks/${file}.test.ts`;
const SQL_RULES = 'the-sql-rules-refuse-vat-columns-unlisted-json-and-a-folding-change-without-rebuild';

export const sabotages = [
  {
    name: 'blind-one-client',
    breaks: [unit('the-one-client-check-refuses-a-client-made-outside-core-db')],
    expect: '> refuses createClient, createBrowserClient and createServerClient',
    edits: [{ file: 'scripts/checks/one-client.mjs', find: 'if (FACTORIES.has(name))', replace: 'if (false)' }],
  },
  {
    name: 'blind-no-table-writes',
    breaks: [unit('the-table-writes-check-refuses-a-write-on-a-table')],
    expect: '> refuses each write method on a .from() chain',
    edits: [
      {
        file: 'scripts/checks/no-table-writes.mjs',
        find: 'if (WRITES.has(method) && chainHasTableFrom(callee.expression))',
        replace: 'if (WRITES.has(method) && false)',
      },
    ],
  },
  {
    name: 'blind-no-physical-css',
    breaks: [unit('the-physical-css-check-refuses-left-and-right')],
    expect: '> refuses physical utilities, inline styles and CSS declarations',
    edits: [{ file: 'scripts/checks/no-physical-css.mjs', find: 'PHYSICAL_CLASSES.find(', replace: '[].find(' }],
  },
  {
    name: 'blind-no-hex',
    breaks: [unit('the-hex-check-refuses-a-colour-outside-the-tokens-file')],
    expect: '> refuses hex, functional and named colours and Tailwind palette colours',
    edits: [{ file: 'scripts/checks/no-hex.mjs', find: 'if (PALETTE.test(tok))', replace: 'if (false)' }],
  },
  {
    name: 'blind-one-copy',
    breaks: [unit('the-one-copy-check-refuses-a-folding-table-in-app-code')],
    expect: '> refuses alef-form tables, harakat and tatweel',
    edits: [{ file: 'scripts/checks/one-copy.mjs', find: 'alefs.size >= 2 ||', replace: 'false ||' }],
  },
  {
    name: 'blind-rule-7',
    breaks: [unit('the-rule-7-scanner-refuses-real-looking-data-and-secrets')],
    expect: '> refuses each kind of real-looking value',
    edits: [{ file: 'scripts/checks/rule-7.mjs', find: 'if (p.madeUp(m)) continue;', replace: 'continue;' }],
  },
  {
    name: 'blind-forward-only-migrations',
    breaks: [unit('the-migrations-check-refuses-editing-history-or-running-out-of-order')],
    expect: '> refuses editing or deleting a migration the base has',
    edits: [
      {
        file: 'scripts/checks/forward-only-migrations.mjs',
        find: "if (status === 'M' || status === 'D' || status === 'T')",
        replace: 'if (false)',
      },
    ],
  },
  {
    name: 'blind-no-vat-columns',
    breaks: [unit(SQL_RULES)],
    expect: '> refuses a column or alias named for a VAT or tax amount',
    edits: [
      {
        file: 'scripts/checks/no-vat-columns.mjs',
        find: 'if (parts.some((p) => /^vats?\\d*$/.test(p))) return true;',
        replace: 'if (false) return true;',
      },
    ],
  },
  {
    name: 'blind-no-blob-tables',
    breaks: [unit(SQL_RULES)],
    expect: '> refuses a json/jsonb column that is not listed with a reason',
    edits: [
      {
        file: 'scripts/checks/no-blob-tables.mjs',
        find: 'if (reason === undefined || reason.length < 10)',
        replace: 'if (reason === undefined)',
      },
    ],
  },
  {
    name: 'blind-norm-rebuild-called',
    breaks: [unit(SQL_RULES)],
    expect: '> refuses a norm.* change without norm.rebuild() after it',
    edits: [
      {
        file: 'scripts/checks/norm-rebuild-called.mjs',
        find: 'const after = calls.some((c) => (c.index ?? 0) > (last.index ?? 0));',
        replace: 'const after = calls.length > 0;',
      },
    ],
  },
  {
    name: 'blind-v2-ids',
    breaks: [unit('the-ids-check-refuses-a-duplicate-decision-or-a-foreign-port')],
    expect: '> refuses them',
    edits: [{ file: 'scripts/checks/v2-ids.mjs', find: 'if (seen.has(id))', replace: 'if (false)' }],
  },
  {
    name: 'blind-allow-comment',
    breaks: [unit('an-allow-comment-with-a-reason-waives-one-finding')],
    expect: '> waives the line it sits on or the next line, needs a reason',
    edits: [{ file: 'scripts/checks/lib.mjs', find: '\\s*(.{10,})/;', replace: '\\s*(.{1,})/;' }],
  },
  {
    name: 'blind-forbidden-words',
    breaks: [unit('the-words-check-refuses-the-names-the-app-never-says')],
    expect: '> refuses each name, however it is spaced or cased, in a catalog and in page text',
    edits: [
      {
        file: 'scripts/checks/forbidden-words.mjs',
        find: "[/\\bb[\\s\\-_.]*2[\\s\\-_.]*b\\b/gi, 'B2B'],",
        replace: "[/\\bb2b\\b/g, 'B2B'],",
      },
    ],
  },
  {
    name: 'blind-seed-words',
    breaks: [unit('the-words-check-refuses-the-names-the-app-never-says')],
    expect: '> refuses the data words in the seeds of a migration from V404 on',
    edits: [
      {
        file: 'scripts/checks/forbidden-words.mjs',
        find: "if ((file.split('/').pop() ?? '').slice(0, 14) < SEEDS_FROM) continue;",
        replace: 'continue;',
      },
    ],
  },
  {
    name: 'words-lists-drift',
    breaks: [unit('the-words-check-refuses-the-names-the-app-never-says')],
    expect: '> holds the same data list as the database',
    edits: [
      {
        file: 'scripts/checks/forbidden-words.mjs',
        find: "  [/\\bb[\\s\\-_.]*2[\\s\\-_.]*g\\b/gi, 'B2G'],\n",
        replace: '',
      },
    ],
  },
  {
    // QA-67: Google, Zoom and GMV are words for the chrome; a seed may name a meeting channel after its tool.
    name: 'seeds-scanned-for-chrome-words',
    breaks: [unit('the-words-check-refuses-the-names-the-app-never-says')],
    expect: '> refuses the data words in the seeds of a migration from V404 on',
    edits: [
      {
        file: 'scripts/checks/forbidden-words.mjs',
        find: 'forbiddenIn(lit.text, FORBIDDEN_IN_DATA)',
        replace: 'forbiddenIn(lit.text)',
      },
    ],
  },
];
