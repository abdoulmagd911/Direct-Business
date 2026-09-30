// Sabotages for how the production job reaches the database (V181): each breaks one promise, and its test must go red.
const target = 'unit:tests/unit/db/production-is-reached-with-the-password-alone.test.ts';

export const sabotages = [
  {
    name: 'production-password-sent-unencoded',
    breaks: [target],
    expect: "> tries the region's newer pooler first, in session mode, with the password encoded",
    edits: [
      {
        file: 'scripts/db/prod-url.mjs',
        find: 'const secret = encodeURIComponent(password);',
        replace: 'const secret = password;',
      },
    ],
  },
  {
    name: 'production-only-the-first-pooler',
    breaks: [target],
    expect: '> keeps the first pooler that knows the project, and names each refusal when none does',
    edits: [
      {
        file: 'scripts/db/prod-url.mjs',
        find: 'if (r.ok) return { found: c, refusals };',
        replace: 'if (r.ok) return { found: c, refusals };\n    break;',
      },
    ],
  },
  {
    name: 'production-refusal-said-as-a-greeting',
    breaks: [target],
    expect: "> says why a pooler refused: the CLI's own message, not its greeting",
    edits: [{ file: 'scripts/db/prod-url.mjs', find: "if (!l.startsWith('{')) continue;", replace: 'return l;' }],
  },
  {
    name: 'production-password-printed-encoded',
    breaks: [target],
    expect: '> never prints the password, as typed or as encoded',
    edits: [
      {
        file: 'scripts/db/prod-url.mjs',
        find: "return text.split(encodeURIComponent(password)).join('***').split(password).join('***');",
        replace: "return text.split(password).join('***');",
      },
    ],
  },
];
