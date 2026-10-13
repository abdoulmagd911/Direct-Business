// Sabotage for QA-556 (builder B): the Finance page loses its built flag, so Create, Ctrl K and the + never offer Invoice.
export const sabotages = [
  {
    name: 'finance-page-not-built',
    breaks: ['e2e:tests/e2e/app-settings.alone.spec.ts'],
    expect: 'Full on Finance — the desktop Create menu, Ctrl K and the phone + all offer Invoice',
    edits: [
      {
        file: 'src/modules/finance/module.ts',
        find: "      built: true,\n      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },",
        replace: "      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },",
      },
    ],
  },
];
