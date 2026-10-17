// Sabotages for search over the person's own notes (V641, builder C): each breaks one promise of
// tests/e2e/search-my-notes.spec.ts. The database half is supabase/tests/sabotage/search-skips-a-checklists-items.sql.
const E2E = 'e2e:tests/e2e/search-my-notes.spec.ts';
const FOUND = 'search finds one saved item of each kind';

export const sabotages = [
  {
    name: 'the-search-box-shows-no-notes',
    breaks: [E2E],
    expect: FOUND,
    edits: [
      {
        file: 'src/ui/shell/CommandPalette.tsx',
        find: '{notes.length ? (',
        replace: '{false && notes.length ? (',
      },
    ],
  },
  {
    name: 'an-idea-is-labelled-a-plain-note',
    breaks: [E2E],
    expect: FOUND,
    edits: [
      {
        file: 'src/ui/shell/CommandPalette.tsx',
        find: "(n.idea ? 'idea' : n.reminder ? 'reminder' : n.kind === 'sticky' ? 'note' : n.kind)",
        replace: "(n.reminder ? 'reminder' : n.kind === 'sticky' ? 'note' : n.kind)",
      },
    ],
  },
];
