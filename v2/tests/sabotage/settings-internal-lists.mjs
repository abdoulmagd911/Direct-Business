// Sabotage for the V645 Settings data: the module no longer declares the internal counterparts as a list, so Settings
// never shows it.
const E2E = 'e2e:tests/e2e/settings-internal-lists.spec.ts';

export const sabotages = [
  {
    name: 'settings-hides-the-internal-counterparts',
    breaks: [E2E],
    expect: 'the internal counterparts are a list of their own',
    edits: [
      {
        file: 'src/modules/partners/module.ts',
        find: "        ['internal_counterpart', 'partner.internal_counterpart'],\n",
        replace: '',
      },
    ],
  },
];
