// Sabotages for the fixture seed's guard: each blinds one refusal, and its promise must go red.
const target = 'unit:tests/unit/fixtures/the-fixture-seed-runs-on-this-machine-only.test.ts';

export const sabotages = [
  {
    name: 'fixtures-seed-the-cloud',
    breaks: [target],
    expect: '> refuses a cloud project, whichever address points at it',
    edits: [
      {
        file: 'scripts/fixtures/guard.mjs',
        find: 'if (!LOCAL_HOSTS.has(host))',
        replace: "if (!LOCAL_HOSTS.has(host) && !host.endsWith('.supabase.co'))",
      },
    ],
  },
  {
    name: 'fixtures-over-real-addresses',
    breaks: [target],
    expect: '> refuses a database that allows an address it did not make up',
    edits: [
      {
        file: 'scripts/fixtures/guard.mjs',
        find: 'const real = emails.filter((e) => !e.toLowerCase().endsWith(`@${FIXTURE_DOMAIN}`));',
        replace: 'const real = emails.filter(() => false);',
      },
    ],
  },
];
