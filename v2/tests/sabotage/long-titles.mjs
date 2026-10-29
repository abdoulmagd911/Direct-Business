// The owner's phone screenshots (22 Oct): a long title in a card is never cut off. The shared rule lets what a link holds shrink.
export const sabotages = [
  {
    name: 'a-link-keeps-its-long-title-at-full-width',
    breaks: ['e2e:tests/e2e/long-titles-fit-the-phone.spec.ts'],
    expect: 'no long title is cut off or pushes the page sideways',
    edits: [
      { file: 'src/ui/globals.css', find: '      overflow-wrap: anywhere !important;\n', replace: '' },
      {
        file: 'src/ui/globals.css',
        find: '[data-inline-link] a) > :not(svg, img) {\n      min-width: 0;\n    }\n',
        replace: '[data-inline-link] a) > :not(svg, img) {\n      min-width: auto;\n    }\n',
      },
    ],
  },
  {
    name: 'a-link-breaks-no-long-word',
    breaks: ['e2e:tests/e2e/long-titles-fit-the-phone.spec.ts'],
    expect: 'no long title is cut off or pushes the page sideways',
    edits: [
      {
        file: 'src/ui/globals.css',
        find: '      overflow-wrap: anywhere !important;\n',
        replace: '',
      },
    ],
  },
];
