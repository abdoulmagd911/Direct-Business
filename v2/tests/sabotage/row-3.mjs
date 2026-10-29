// Row 3 of the Architect's 26 Oct order: findings 1, 2, 3 and 6. Each sabotage plants the old behaviour back; its test
// must go red.
const E2E = 'e2e:tests/e2e/row-3-capture-and-checklists.spec.ts';
const UNIT1 = 'unit:tests/unit/my-day/a-captured-paragraph-keeps-a-short-title-and-the-rest-as-notes.test.ts';
const UNIT6 = 'unit:tests/unit/shell/the-palette-finds-an-entry-typed-with-its-dot.test.ts';

export const sabotages = [
  {
    // finding 1: the whole first line is the title again, however long
    name: 'a-captured-paragraph-is-all-title',
    breaks: [UNIT1, E2E],
    expect: 'first sentence',
    edits: [
      {
        file: 'src/modules/my-day/quick-capture.ts',
        find: "  if (line.length <= TITLE_CAP) return { title: line, rest: '' };",
        replace: "  if (line.length <= 10_000) return { title: line, rest: '' };",
      },
    ],
  },
  {
    // finding 2: a checklist's page says "Note saved" again
    name: 'a-checklist-is-saved-as-a-note',
    breaks: [E2E],
    expect: 'a checklist is saved as a checklist',
    edits: [
      {
        file: 'src/modules/my-day/screens/NotePage.tsx',
        find: "words(t('pages.myDay.note.saved', { kind: note.kind })),",
        replace: "words(t('pages.myDay.note.saved', { kind: 'sticky' })),",
      },
    ],
  },
  {
    // finding 3: a checklist's rows are ticked on its own page only
    name: 'checklist-rows-tick-only-on-their-page',
    breaks: [E2E],
    expect: "getByRole('checkbox'",
    edits: [
      {
        file: 'src/modules/my-day/screens/NoteBits.tsx',
        find: "{note.kind === 'checklist' && note.mine ? <ChecklistTicks note={note} /> : null}",
        replace:
          "{note.kind === 'checklist' && note.mine && note.id === 'never' ? <ChecklistTicks note={note} /> : null}",
      },
    ],
  },
  {
    // finding 6: the palette matches letter for letter again, and its Create entries without their dot
    name: 'the-palette-reads-the-dot-as-a-letter',
    breaks: [UNIT6, E2E],
    expect: 'Create · Capture',
    edits: [
      {
        file: 'src/ui/shell/palette-match.ts',
        find: "    .replace(/[·•|:,\\-–—/]+/g, ' ')\n    .replace(/\\s+/g, ' ')\n",
        replace: '',
      },
      {
        file: 'src/ui/shell/CommandPalette.tsx',
        find: "matches(`${t('top.create')} · ${t(`create.${a.key}`)}`)",
        replace: "matches(`${t('top.create')} ${t(`create.${a.key}`)}`)",
      },
    ],
  },
];
