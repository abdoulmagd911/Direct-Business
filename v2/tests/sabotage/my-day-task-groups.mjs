// Sabotages for the Today block's groups, chips and views (tests/unit/my-day/the-today-block-groups-views-and-chips.test.tsx).
const BOX = 'unit:tests/unit/my-day/the-today-block-groups-views-and-chips.test.tsx';
export const sabotages = [
  {
    name: 'today-block-has-no-helping-group',
    breaks: [BOX],
    expect: 'draws all four groups, Helping last',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: "{ key: 'helping', rows: helpingTasks(tasks), reminders: [] as TodayReminder[] },",
        replace: "{ key: 'helping', rows: [] as typeof tasks, reminders: [] as TodayReminder[] },",
      },
    ],
  },
  {
    name: 'a-helped-task-has-a-done-tick',
    breaks: [BOX],
    expect: 'no done tick on a task I only help on',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: '{helping ? null : <DoneTick',
        replace: '{false ? null : <DoneTick',
      },
    ],
  },
  {
    name: 'today-chips-do-nothing',
    breaks: [BOX],
    expect: 'a chip shows only the groups pressed',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: 'const groups = all.filter((x) => !shown.length || shown.includes(x.key));',
        replace: 'const groups = [...all];',
      },
    ],
  },
  {
    name: 'saved-default-view-is-not-opened',
    breaks: [BOX],
    expect: 'opens on the saved view this person set as their default',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: 'onDefault={open}\n',
        replace: '',
      },
    ],
  },
  {
    name: 'today-views-repeat-helping',
    breaks: [BOX],
    expect: 'has one view of its own, All',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: "fixed={[{ key: 'all', label: t('pages.myDay.today.views.all') }]}",
        replace:
          "fixed={[{ key: 'all', label: t('pages.myDay.today.views.all') }, { key: 'helping', label: t('pages.myDay.today.helping') }]}",
      },
    ],
  },
  {
    name: 'save-view-has-no-icon',
    breaks: [BOX],
    expect: 'says the chips filter',
    edits: [
      {
        file: 'src/ui/SavedViewsBar.tsx',
        find: '<Bookmark className="size-4" aria-hidden="true" />',
        replace: '',
      },
    ],
  },
  {
    name: 'today-chips-say-nothing-about-being-a-filter',
    breaks: [BOX],
    expect: 'says the chips filter',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: 'data-today-filter-label',
        replace: 'data-today-no-label',
      },
    ],
  },
];
