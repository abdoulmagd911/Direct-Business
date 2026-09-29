// Sabotages for the registry's unit test (V123): a page added to a module without syncing, and a capability with no
// wording. Run: node scripts/sabotage.mjs --kind unit
const target = 'unit:tests/unit/registry/the-registry-agrees-with-its-snapshot-and-its-wording.test.ts';

export const sabotages = [
  {
    name: 'registry-page-not-synced',
    breaks: [target],
    expect: '> agrees with supabase/registry.json',
    edits: [
      {
        file: 'src/modules/projects/module.ts',
        find: "  pages: [\n    {\n      key: 'projects',",
        replace:
          "  pages: [\n    { key: 'projects.board', route: '/projects/board', label: 'nav.projects', defaults: {} },\n    {\n      key: 'projects',",
      },
    ],
  },
  {
    name: 'registry-label-without-wording',
    breaks: [target],
    expect: '> gives every page, capability, setting and entity its wording in both catalogs',
    edits: [
      {
        file: 'src/modules/tasks/module.ts',
        find: "label: 'cap.tasks.assign'",
        replace: "label: 'cap.tasks.assign_to_anyone'",
      },
    ],
  },
];
