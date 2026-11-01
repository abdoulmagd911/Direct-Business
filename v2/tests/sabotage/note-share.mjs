// Sabotages for G (26 Oct) and V524: a note shared with named colleagues, from the note's page.
const E2E = 'e2e:tests/e2e/a-note-shared-with-one-colleague.spec.ts';

export const sabotages = [
  {
    // the page saves "Named colleagues" without saying which: the door refuses, nothing is shared
    name: 'a-shared-note-names-no-colleague',
    breaks: [E2E],
    expect: 'the note says it is shared with named colleagues',
    edits: [
      {
        file: 'src/modules/my-day/screens/NotePage.tsx',
        find: "shared_with: d.visibility === 'person' ? d.shared_with : null,",
        replace: 'shared_with: null,',
      },
    ],
  },
  {
    // QA-594 undone: the colleague reading a note shared with them finds a dash where their own name should be
    name: 'a-shared-note-hides-its-reader',
    breaks: [E2E],
    expect: 'the colleague finds themselves on the list as You',
    edits: [
      {
        file: 'src/modules/my-day/screens/NotePage.tsx',
        find: "id === me ? t('pages.myDay.visibility.you') : (colleagues.find((c) => c.id === id)?.name ?? '—');",
        replace: "colleagues.find((c) => c.id === id)?.name ?? '—';",
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
        find: "'notify.note_shared': 'notifications.kinds.note_shared',",
        replace: "'notify.note_shared_never': 'notifications.kinds.note_shared',",
      },
    ],
  },
];
