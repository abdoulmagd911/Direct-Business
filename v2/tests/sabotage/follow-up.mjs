// Sabotages for Follow up on a record (V632 Stage 2, builder D): each breaks one promise of its spec.
const E2E = 'e2e:tests/e2e/follow-up-on-a-record.spec.ts';

export const sabotages = [
  {
    // QA 2: the record's name never goes into the note's title; the record shows only through `about`
    name: 'follow-up-prefills-the-record-name',
    breaks: [E2E],
    expect: "Follow up is the first entry of a client's ⋯ menu and hands the sheet the client",
    edits: [
      {
        file: 'src/ui/record/follow-up.ts',
        find: "const detail: FollowUpDetail = { kind: 'reminder', about };",
        replace: "const detail = { kind: 'reminder', about, title: about.label } as FollowUpDetail;",
      },
    ],
  },
  {
    name: 'task-follow-up-is-about-the-client',
    breaks: [E2E],
    expect: 'on a task Follow up and Escalate share one ⋯ menu, and the header loses a button',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: "openFollowUp({ entity: 'task', id: task.id,",
        replace: "openFollowUp({ entity: 'partner', id: task.id,",
      },
    ],
  },
  {
    // the brief's gate: Follow up adds no button — Escalate moved into the menu, so the header keeps its count
    name: 'task-escalate-stays-a-header-button',
    breaks: [E2E],
    expect: 'on a task Follow up and Escalate share one ⋯ menu, and the header loses a button',
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
    expect: "Follow up is the first entry of a client's ⋯ menu and hands the sheet the client",
    edits: [
      {
        file: 'src/modules/partners/screens/PartnerRecord.tsx',
        find: "openFollowUp({ entity: 'partner', id: card.id, label: tradeName(card, locale) })}\n            data-follow-up",
        replace:
          "openFollowUp({ entity: 'partner', id: card.id, label: tradeName(card, locale) })}\n            data-follow-up\n            hidden",
      },
    ],
  },
];
