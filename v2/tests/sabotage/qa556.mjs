// Sabotage for QA-556 (builder B): the Finance page loses its built flag, so Create, Ctrl K and the + never offer Invoice.
export const sabotages = [
  {
    name: 'finance-page-not-built',
    breaks: ['e2e:tests/e2e/app-settings.alone.spec.ts'],
    expect: 'Full on Finance — the desktop Create menu, Ctrl K and the phone + all offer Invoice',
    edits: [
      {
        file: 'src/modules/finance/module.ts',
        // Landing 8 (#1578 triage): the find named the pre-F179-refusal defaults (member 'own'); Landing 7's
        // F179 overturn made the member default 'view', so the plant never applied. The replace keeps the
        // current defaults and only drops the built flag, as the plant always meant.
        find: "      built: true,\n      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'view', viewer: 'view' },",
        replace: "      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'view', viewer: 'view' },",
      },
    ],
  },
];
