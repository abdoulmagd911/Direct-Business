// QA-593: Settings tables on a phone are cards, or say that they scroll; the Access matrix keeps its first column.
const E2E = 'e2e:tests/e2e/settings-tables-on-a-phone.spec.ts';
export const sabotages = [
  {
    name: 'the-scroll-cue-is-never-drawn',
    breaks: [E2E],
    expect: 'a Settings table that scrolls sideways shows a cue',
    edits: [{ file: 'src/ui/ScrollCue.tsx', find: '      {more ? (', replace: '      {false && more ? (' }],
  },
  {
    name: 'the-access-matrix-first-column-scrolls-away',
    breaks: [E2E],
    expect: 'the first column stays in place as the roles scroll',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: '<th scope="row" className="sticky start-0 z-10 bg-raised px-4 py-2 text-start font-medium">',
        replace: '<th scope="row" className="bg-raised px-4 py-2 text-start font-medium">',
      },
    ],
  },
  {
    name: 'the-teams-stay-a-table-on-a-phone',
    breaks: [E2E],
    expect: 'has no table on a phone',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: "const phone = useMediaQuery('(max-width: 639px)');",
        replace: "const phone = useMediaQuery('(max-width: 0px)');",
      },
    ],
  },
];
