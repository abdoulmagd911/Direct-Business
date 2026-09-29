// Sabotage for the words check (V59): puts one of the names the app never says into the English catalog. The name is
// assembled when the sabotage runs, so this file reads as data, not wording.
const j = (...parts) => parts.join('');

export const sabotages = [
  {
    name: 'plant-forbidden-word',
    breaks: ['check:forbidden-words'],
    expect: j('messages/en.json:3 [forbidden-words] "Direct', ' KSA"'),
    edits: [
      {
        file: 'messages/en.json',
        find: '"name": "Commercial Workspace"',
        replace: j('"name": "Direct', ' KSA Commercial Workspace"'),
      },
    ],
  },
  {
    name: 'plant-forbidden-gmv',
    breaks: ['check:forbidden-words'],
    expect: j('messages/en.json:3 [forbidden-words] "Sales', ' (GMV)"'),
    edits: [
      { file: 'messages/en.json', find: '"name": "Commercial Workspace"', replace: j('"name": "Sales', ' (GMV)"') },
    ],
  },
  {
    name: 'plant-forbidden-google',
    breaks: ['check:forbidden-words'],
    expect: j('messages/en.json:3 [forbidden-words] "Goo', 'gle"'),
    edits: [
      {
        file: 'messages/en.json',
        find: '"name": "Commercial Workspace"',
        replace: j('"name": "Sign in with Goo', 'gle"'),
      },
    ],
  },
  {
    name: 'plant-forbidden-zoom',
    breaks: ['check:forbidden-words'],
    expect: j('messages/en.json:3 [forbidden-words] "Zo', 'om"'),
    edits: [
      { file: 'messages/en.json', find: '"name": "Commercial Workspace"', replace: j('"name": "Meet on Zo', 'om"') },
    ],
  },
  {
    name: 'plant-forbidden-keep-signed-in',
    breaks: ['check:forbidden-words'],
    expect: j('[forbidden-words] "Keep me', ' signed in"'),
    edits: [
      {
        file: 'supabase/templates/sign-in-code.html',
        find: '<p>Your sign-in code:</p>',
        replace: j('<p>Your sign-in code:</p><p>Keep me', ' signed in</p>'),
      },
    ],
  },
];
