// Sabotage for the database guard (V402): a DROP on the v2 project no longer asks.
export const sabotages = [
  {
    name: 'guard-lets-a-drop-through',
    breaks: ['unit:tests/unit/guard/the-database-guard-asks-only-before-destructive-statements.test.ts'],
    expect: 'a DROP still asks',
    edits: [
      {
        file: '../.claude/hooks/sql-guard.mjs',
        find: "    if (/\\bdrop\\b/.test(st)) return 'a DROP';\n",
        replace: '',
      },
    ],
  },
];
