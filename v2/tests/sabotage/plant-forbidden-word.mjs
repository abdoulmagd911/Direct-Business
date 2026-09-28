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
];
