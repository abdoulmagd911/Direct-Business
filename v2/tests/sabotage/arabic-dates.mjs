// Sabotage for the Arabic date fix: the data font must fall back to the app's own Arabic font, not a system monospace one.
export const sabotages = [
  {
    name: 'the-data-font-has-no-arabic-fallback',
    breaks: ['e2e:tests/e2e/dates-in-arabic-keep-their-letters-joined.alone.spec.ts'],
    expect: 'the Arabic date is drawn in the app’s own fonts, not a system monospace font',
    edits: [
      {
        file: 'src/ui/tokens.css',
        find: "'IBM Plex Mono', var(--font-ui), 'IBM Plex Sans Arabic', ui-monospace",
        replace: "'IBM Plex Mono', ui-monospace",
      },
    ],
  },
];
