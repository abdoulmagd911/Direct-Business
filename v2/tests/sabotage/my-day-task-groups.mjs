// Sabotages for the Today block's groups, chips and views (tests/unit/my-day/the-today-block-groups-views-and-chips.test.tsx).
const BOX = 'unit:tests/unit/my-day/the-today-block-groups-views-and-chips.test.tsx';
export const sabotages = [
  {
    name: 'today-block-has-no-helping-group',
    breaks: [BOX],
    expect: 'draws the four boxes in order',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: "{ key: 'helping', rows: helpingTasks(tasks), reminders: [] },",
        replace: "{ key: 'helping', rows: [], reminders: [] },",
      },
    ],
  },
  {
    name: 'a-helped-task-has-a-done-tick',
    breaks: [BOX],
    expect: 'a helped task has a mark and no button',
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
  {
    name: 'today-chips-stay-open-on-a-phone',
    breaks: [BOX],
    expect: 'fold behind one Filter button',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: "<PhoneFilter label={t('common.filter')} count={shown.length}>",
        replace: '<>',
      },
      { file: 'src/modules/my-day/screens/TodayBlock.tsx', find: '</PhoneFilter>', replace: '</>' },
    ],
  },
  {
    name: 'today-block-draws-every-row',
    breaks: [BOX],
    expect: 'draws seven of nine',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: '? capRows(groups, BLOCK_ROWS)',
        replace: '? groups.map((x) => ({ ...x, total: x.rows.length + x.reminders.length }))',
      },
    ],
  },
  {
    name: 'today-box-count-counts-only-the-rows-drawn',
    breaks: [BOX],
    expect: 'keeps the true count on the box heading',
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: '{x.total}',
        replace: '{x.rows.length + x.reminders.length}',
      },
    ],
  },
];
