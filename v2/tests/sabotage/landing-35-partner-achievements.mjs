// Landing 35 (the owner's check of 21 Nov: "add an achievement and confirm it shows on the client") · the Related tab
// of an organisation's record lists the achievements logged with it (record/PartnerAchievements.tsx, read from
// api.partner_achievements). Each sabotage takes one part of that back, and the test named must go red for it.
const SECTION = 'src/modules/partners/screens/record/PartnerAchievements.tsx';
const T = 'unit:tests/unit/partners/landing-35-the-related-tab-lists-the-organisations-achievements.test.tsx';

export const sabotages = [
  {
    // the list is asked for on every tab: the record's first paint waits on it again
    name: 'l35-partner-achievements-are-read-on-every-tab',
    breaks: [T],
    expect: '> the other tabs ask for nothing and draw nothing of it',
    edits: [{ file: SECTION, find: "const wanted = tab === 'related';", replace: 'const wanted = true;' }],
  },
  {
    // the read names no organisation
    name: 'l35-partner-achievements-ask-for-no-organisation',
    breaks: [T],
    expect: '> opening Related asks once for this organisation’s achievements and says it is loading',
    edits: [
      {
        file: SECTION,
        find: "rpc('partner_achievements', { p_partner: partnerId }, { retry: true })",
        replace: "rpc('partner_achievements', { p_partner: '' }, { retry: true })",
      },
    ],
  },
  {
    // the oldest is drawn first, whatever order the database answered
    name: 'l35-partner-achievements-are-drawn-oldest-first',
    breaks: [T],
    expect: '> each achievement is a row with its number, title, category, day and who logged it — newest first',
    edits: [{ file: SECTION, find: '{answer.rows.map((a) => {', replace: '{[...answer.rows].reverse().map((a) => {' }],
  },
  {
    // every title leads to the Achievements list, not to its own record
    name: 'l35-partner-achievement-links-nowhere-of-its-own',
    breaks: [T],
    expect: '> the title opens the achievement’s own record',
    edits: [{ file: SECTION, find: 'href={`/kpis/achievements/${a.id}`}', replace: 'href="/kpis/achievements"' }],
  },
  {
    // an amount is drawn beside the title, as if it were the organisation's money
    name: 'l35-partner-achievement-shows-an-amount',
    breaks: [T],
    expect: '> no amount is drawn beside an achievement: its value is not revenue',
    edits: [
      {
        file: SECTION,
        find: '<span className="font-data text-xs text-muted">{a.number}</span>',
        replace:
          '<span className="font-data text-xs text-muted">{a.number} {String((a as unknown as { deal_value?: number }).deal_value ?? "")}</span>',
      },
    ],
  },
  {
    // an organisation with none gets the kit's general line, which does not say what there is none of
    name: 'l35-partner-achievements-none-says-nothing-of-achievements',
    breaks: [T],
    expect: '> an organisation with none says so in one line',
    edits: [
      {
        file: SECTION,
        find: "message={t('partners.related.achievementsNone')}",
        replace: "message={t('state.empty')}",
      },
    ],
  },
  {
    // Try again is a button that does nothing
    name: 'l35-partner-achievements-try-again-reads-nothing',
    breaks: [T],
    expect: '> a list that does not load says why, and Try again reads again',
    edits: [{ file: SECTION, find: 'onClick={() => setAttempt((n) => n + 1)}', replace: 'onClick={() => undefined}' }],
  },
  {
    // every return to the tab reads the list again
    name: 'l35-partner-achievements-are-read-on-every-return',
    breaks: [T],
    expect: '> what was read is kept: away and back asks nothing again',
    edits: [{ file: SECTION, find: 'answered.current = key;', replace: 'answered.current = null;' }],
  },
  {
    // a change on the record never reaches the list
    name: 'l35-partner-achievements-miss-a-change-on-the-record',
    breaks: [T],
    expect: '> after a change on the record the list is read again, the old one staying until it lands',
    edits: [
      {
        file: SECTION,
        find: 'const key = `${partnerId}:${stamp}:${attempt}`;',
        replace: 'const key = `${partnerId}:${attempt}`;',
      },
    ],
  },
  {
    // the list read for one organisation stays up on the next one opened
    name: 'l35-partner-achievements-of-another-organisation-stay-up',
    breaks: [T],
    expect: '> another organisation’s list is never shown on this one',
    edits: [
      {
        file: SECTION,
        find: 'const answer = got?.id === partnerId ? got.answer : null;',
        replace: 'const answer = got ? got.answer : null;',
      },
    ],
  },
  {
    // the "showing the newest N of M" line is drawn on a list that is whole
    name: 'l35-partner-achievements-whole-list-says-it-is-cut',
    breaks: [T],
    expect: '> a list longer than the page says how many are shown',
    edits: [{ file: SECTION, find: '{answer.more ? (', replace: '{answer.total > 0 ? (' }],
  },
  {
    // the category keeps its English name in Arabic
    name: 'l35-partner-achievement-category-stays-english',
    breaks: [T],
    expect: '> in Arabic the heading, the category and who logged it are Arabic',
    edits: [{ file: SECTION, find: "{locale === 'ar' ? a.category_ar : a.category_en}", replace: '{a.category_en}' }],
  },
];
