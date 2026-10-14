// Sabotages for Follow up on a record (V632 Stage 2, V282, builder D): each breaks one promise of its spec.
const E2E = 'e2e:tests/e2e/follow-up-on-a-record.spec.ts';
const CLIENT = "Follow up is the first entry of a client's ⋯ menu and saves a private note about the client";
const TASK = 'on a task Follow up and Escalate share one ⋯ menu, and the header loses a button';
const CLIENT_CALL = "openQuickCapture({ about: { entity: 'partner', id: card.id, label: tradeName(card, locale) } })";

export const sabotages = [
  {
    // QA-560: the record's name never goes into the note's title; the record shows only through `about`
    name: 'follow-up-prefills-the-record-name',
    breaks: [E2E],
    expect: CLIENT,
    edits: [
      {
        file: 'src/modules/partners/screens/PartnerRecord.tsx',
        find: CLIENT_CALL,
        replace:
          "openQuickCapture({ about: { entity: 'partner', id: card.id, label: tradeName(card, locale) }, text: tradeName(card, locale) })",
      },
    ],
  },
  {
    name: 'task-follow-up-is-about-the-client',
    breaks: [E2E],
    expect: TASK,
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: "openQuickCapture({ about: { entity: 'task', id: task.id,",
        replace: "openQuickCapture({ about: { entity: 'partner', id: task.id,",
      },
    ],
  },
  {
    // the brief's gate: Follow up adds no button — Escalate moved into the menu, so the header keeps its count
    name: 'task-escalate-stays-a-header-button',
    breaks: [E2E],
    expect: TASK,
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: '      <Menu>\n        <MenuTrigger asChild>\n',
        replace:
          "      <Button onClick={() => setEscalating(true)}>{t('pages.tasks.escalate.open')}</Button>\n      <Menu>\n        <MenuTrigger asChild>\n",
      },
    ],
  },
  {
    name: 'client-follow-up-not-first',
    breaks: [E2E],
    expect: CLIENT,
    edits: [
      {
        file: 'src/modules/partners/screens/PartnerRecord.tsx',
        find: "            data-follow-up\n          >\n            {t('record.followUp')}",
        replace: "            data-follow-up\n            hidden\n          >\n            {t('record.followUp')}",
      },
    ],
  },
];
