// Landing 31 — the My day look (16 Nov): the banner counts My work, the very count of the Tasks screen's My work tab,
// and says what it counts; the day is written as the boards write it; Capture sits on the banner from 640 px up; the
// chips in Capture have a named × that is 44 px on a phone. Each sabotage takes one of those back, and the test named
// must go red for it.
const BANNER = 'unit:tests/unit/my-day/the-banner-counts-my-work-as-the-tasks-screen-does.test.tsx';
const ROUND = 'unit:tests/unit/pages/a-list-page-asks-for-its-data-in-one-round.test.ts';
const MY_WORK = 'src/modules/my-day/my-work.ts';
const PAGE = 'src/app/(app)/my-day/page.tsx';

export const sabotages = [
  {
    name: 'banner-counts-what-i-own-instead-of-my-work',
    breaks: [BANNER],
    expect: 'asks the Tasks door with the very filter the Tasks page sends for My work',
    edits: [
      {
        file: MY_WORK,
        find: 'listFilter(parseFilters({}));',
        replace: "listFilter(parseFilters({ view: 'owned' }));",
      },
    ],
  },
  {
    name: 'banner-count-is-a-second-count-of-its-own',
    breaks: [BANNER],
    expect: 'asks the Tasks door with the very filter the Tasks page sends for My work',
    edits: [
      {
        file: 'src/modules/my-day/server.ts',
        find: 'return count ? count.open : null;',
        replace: 'return count ? count.owned : null;',
      },
    ],
  },
  {
    name: 'banner-count-never-reaches-my-day',
    breaks: [BANNER],
    expect: 'gives My day that count',
    edits: [
      {
        file: PAGE,
        find: 'const myWork = await myWorkAsked;',
        replace: 'const myWork = null;',
      },
    ],
  },
  {
    name: 'banner-count-is-asked-of-someone-without-tasks',
    breaks: [BANNER],
    expect: 'asks nothing and says no number for someone who may not open Tasks',
    edits: [
      {
        file: PAGE,
        find: "const myWorkAsked = (me.levels.tasks ?? 'none') === 'none' ? Promise.resolve(null) : myWorkCount(me);",
        replace: 'const myWorkAsked = myWorkCount(me);',
      },
    ],
  },
  {
    name: 'banner-count-is-read-after-the-page',
    breaks: [ROUND],
    expect: 'My day:',
    edits: [
      {
        file: PAGE,
        find: "const myWorkAsked = (me.levels.tasks ?? 'none') === 'none' ? Promise.resolve(null) : myWorkCount(me);",
        replace: 'const myWorkAsked = Promise.resolve(null);',
      },
    ],
  },
  {
    name: 'a-missing-total-reads-as-zero',
    breaks: [BANNER],
    expect: 'never makes a number out of a read that failed',
    edits: [
      {
        file: 'src/modules/my-day/server.ts',
        find: 'return count ? count.open : null;',
        replace: 'return count ? count.open : 0;',
      },
    ],
  },
  {
    name: 'banner-shows-a-bare-number',
    breaks: [BANNER],
    expect: 'names My work beside the number',
    edits: [
      {
        file: 'src/modules/my-day/screens/DayBanner.tsx',
        find: "{t('myWork', { count: myWork })}",
        replace: '{myWork}',
      },
    ],
  },
  {
    name: 'banner-draws-zero-when-the-count-was-not-read',
    breaks: [BANNER],
    expect: 'draws no number when the count was not read',
    edits: [
      {
        file: 'src/modules/my-day/screens/DayBanner.tsx',
        find: ") : typeof myWork === 'number' ? (",
        replace: ') : true ? (',
      },
    ],
  },
  {
    name: 'banner-loses-its-gradient',
    breaks: [BANNER],
    expect: 'is the one gradient of the look',
    edits: [
      {
        file: 'src/modules/my-day/screens/DayBanner.tsx',
        find: 'className="banner-fill flex',
        replace: 'className="bg-raised flex',
      },
    ],
  },
  {
    name: 'day-heading-keeps-the-comma',
    breaks: [BANNER],
    expect: 'writes the day as the boards do',
    // Landing 53: the day is written in full, "Sunday, 15 November 2026" — here it loses its comma
    edits: [
      {
        file: MY_WORK,
        find: 'return `${weekday}, ${day} ${month} ${year}`;',
        replace: 'return `${weekday} ${day} ${month} ${year}`;',
      },
    ],
  },
  {
    name: 'capture-button-shows-on-a-phone-banner',
    breaks: [BANNER],
    expect: 'Capture from 640 px up',
    edits: [
      {
        file: 'src/modules/my-day/screens/MyDay.tsx',
        find: 'className="ring-2 ring-raised/75 max-sm:hidden"',
        replace: 'className="ring-2 ring-raised/75"',
      },
    ],
  },
  {
    name: 'banner-buttons-squeeze-onto-the-words',
    breaks: [BANNER],
    expect: 'keeps its buttons off the words',
    edits: [
      {
        file: 'src/modules/my-day/screens/DayBanner.tsx',
        find: 'className="flex shrink-0 flex-wrap items-center gap-2" data-banner-actions',
        replace: 'className="flex flex-wrap items-center gap-2" data-banner-actions',
      },
    ],
  },
  {
    name: 'date-chip-remove-is-small-on-a-phone',
    breaks: [BANNER],
    expect: 'the date read from the words',
    edits: [
      {
        file: 'src/modules/my-day/screens/TitleDateChip.tsx',
        find: 'className="grid size-11 shrink-0',
        replace: 'className="grid size-6 shrink-0',
      },
    ],
  },
  {
    name: 'picked-organisation-remove-loses-its-name',
    breaks: [BANNER],
    expect: 'the picked organisation, named in the button',
    edits: [
      {
        file: 'src/modules/my-day/screens/PartnerPicker.tsx',
        find: "label={t('pages.myDay.turn.removeOrg', { name: nameOf(value, locale) })}",
        replace: "label={t('common.remove')}",
      },
    ],
  },
];
