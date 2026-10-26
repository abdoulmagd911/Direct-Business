// Sabotages for K (26 Oct): a note turned into a task on a phone keeps the note page on the screen.
const E2E = 'e2e:tests/e2e/a-note-turned-into-a-task-stays-on-a-phone-screen.spec.ts';

export const sabotages = [
  {
    // the note page's column has no limit again and the chip keeps its words on one line: a long title widens the page
    name: 'a-turned-into-chip-widens-the-note-page',
    breaks: [E2E],
    expect: 'after: the note page, its fields and Save stay on the screen',
    edits: [
      {
        file: 'src/modules/my-day/screens/NotePage.tsx',
        find: '<div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">',
        replace: '<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">',
      },
      {
        file: 'src/modules/my-day/screens/NoteBits.tsx',
        find: "const cls = cn(chipClass, 'max-w-full border-accent/40 text-text');",
        replace: "const cls = cn(chipClass, 'border-accent/40 text-text');",
      },
      {
        file: 'src/modules/my-day/screens/NoteBits.tsx',
        find: 'const words = <span className="min-w-0 truncate">{label}</span>;',
        replace: 'const words = label;',
      },
    ],
  },
];
