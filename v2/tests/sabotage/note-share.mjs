// Sabotages for G (26 Oct): a note shared with one named colleague, from the note's page.
const E2E = 'e2e:tests/e2e/a-note-shared-with-one-colleague.spec.ts';

export const sabotages = [
  {
    // the page saves "One colleague" without saying which one: the door refuses, nothing is shared
    name: 'a-shared-note-names-no-colleague',
    breaks: [E2E],
    expect: 'the note says it is shared with one',
    edits: [
      {
        file: 'src/modules/my-day/screens/NotePage.tsx',
        find: "shared_with: d.visibility === 'person' ? d.shared_with || null : null,",
        replace: 'shared_with: null,',
      },
    ],
  },
  {
    // the shared note's notice reads as a mention, without the note's title
    name: 'a-shared-note-is-told-as-a-mention',
    breaks: [E2E],
    expect: 'the bell says who shared which note',
    edits: [
      {
        file: 'src/ui/shell/NotificationsPanel.tsx',
        find: "n.label_key === 'notify.note_shared'",
        replace: "n.label_key === 'notify.note_shared_never'",
      },
    ],
  },
];
