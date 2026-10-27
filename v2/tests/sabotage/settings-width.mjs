// Settings tables on a wide screen: the People, Teams, Departments and Access tables use the whole width of the content, and no
// word in them breaks in the middle ("Departme nt").
const E2E = 'e2e:tests/e2e/settings-tables-keep-their-words.spec.ts';
export const sabotages = [
  {
    name: 'settings-tables-are-capped-at-a-reading-width',
    breaks: [E2E],
    expect: 'uses the whole width of the content',
    edits: [
      {
        file: 'src/modules/settings/screens/SettingsShell.tsx',
        find: ' [&>[data-wide]]:max-w-none',
        replace: '',
      },
    ],
  },
  {
    name: 'settings-status-chip-splits-its-words',
    breaks: [E2E],
    expect: 'breaks in the middle',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: "const WRAPS = 'h-auto min-h-6 max-w-full whitespace-normal py-1 [overflow-wrap:break-word]';",
        replace: "const WRAPS = 'h-auto min-h-6 max-w-full whitespace-normal py-1 [overflow-wrap:anywhere]';",
      },
    ],
  },
];
