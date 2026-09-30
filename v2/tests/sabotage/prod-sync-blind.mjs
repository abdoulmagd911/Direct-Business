// Sabotages for the production check's unit test (V181): each blinds the check to one way production and main can
// differ, and the test of that way must go red.
const target = 'unit:tests/unit/db/production-and-main-hold-the-same-migrations.test.ts';

export const sabotages = [
  {
    name: 'production-misses-a-migration-unseen',
    breaks: [target],
    expect: '> names a migration in main that production has not applied',
    edits: [
      {
        file: 'scripts/db/prod-sync.mjs',
        find: 'notApplied: local.filter((v) => !r.has(v)),',
        replace: 'notApplied: [],',
      },
    ],
  },
  {
    name: 'production-extra-migration-unseen',
    breaks: [target],
    expect: '> names a migration production holds that is not a file in main',
    edits: [
      {
        file: 'scripts/db/prod-sync.mjs',
        find: 'notInMain: remote.filter((v) => !l.has(v)),',
        replace: 'notInMain: [],',
      },
    ],
  },
  {
    name: 'production-read-from-the-local-column',
    breaks: [target],
    expect: '> names a migration in main that production has not applied',
    edits: [
      {
        file: 'scripts/db/prod-sync.mjs',
        find: "(typeof m.remote === 'string' ? m.remote.trim() : '')",
        replace: "(typeof m.local === 'string' ? m.local.trim() : '')",
      },
    ],
  },
];
