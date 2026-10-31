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
];
