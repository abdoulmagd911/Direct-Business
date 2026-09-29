// Sabotage for the shell guard (QA on #110, 29 Sep): a forcing flag after the branch name no longer asks.
export const sabotages = [
  {
    name: 'shell-guard-lets-a-late-force-through',
    breaks: ['unit:tests/unit/guard/the-shell-guard-refuses-force-and-production.test.ts'],
    expect: 'refuses: git push -f origin v2/b-x',
    edits: [
      {
        file: '../.claude/hooks/bash-guard.mjs',
        find: '        if (/\\s(--force|--force-with-lease|--force-if-includes)\\b/.test(s) || /\\s-[a-zA-Z]*f[a-zA-Z]*(\\s|$)/.test(s))\n',
        replace: '        if (false)\n',
      },
    ],
  },
  {
    name: 'shell-guard-lets-a-linked-reset-through',
    breaks: ['unit:tests/unit/guard/the-shell-guard-refuses-force-and-production.test.ts'],
    expect: 'denies: supabase db reset --linked',
    edits: [
      {
        file: '../.claude/hooks/bash-guard.mjs',
        find: "      if (/\\bdb\\s+reset\\b[^]*--linked/.test(s)) return deny('supabase db reset --linked wipes the hosted database');\n",
        replace: '',
      },
    ],
  },
];
