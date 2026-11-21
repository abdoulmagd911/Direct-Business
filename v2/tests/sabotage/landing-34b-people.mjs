// Landing 34b (the owner's live test after Landing 34) — the People search and the Arabic switch. Each sabotage takes
// back one piece of the two fixes — the search comparing capitals, wanting the words in order, keeping marks that
// cannot be seen, skipping a field, the list ignoring the box, "No people match" never said; a person who chose no
// language still following the cookie, a chosen English overruled, the screen not loading again after the switch (or
// loading twice), the cookie left behind, My profile flipping the language back, the card silent about what it does,
// the sign-in page following the switch — and the test named must go red for it.
const SEARCH = 'src/modules/org/people-search.ts';
const ORG = 'src/modules/org/screens/OrgAccess.tsx';
const EFFECTIVE = 'src/core/prefs/effective.ts';
const SYNC = 'src/core/prefs/sync.ts';
const PREFS_SYNC = 'src/ui/shell/PrefsSync.tsx';
const PROFILE = 'src/modules/org/screens/MyProfile.tsx';
const CARD = 'src/modules/settings/screens/SettingCard.tsx';
const PEOPLE = 'unit:tests/unit/org/landing-34b-the-people-search-finds-any-part-of-a-person.test.tsx';
const ARABIC = 'unit:tests/unit/settings/landing-34b-arabic-on-is-the-workspaces-language.test.tsx';

export const sabotages = [
  // ---- the People search ------------------------------------------------------------------------------------------
  {
    name: 'people-search-compares-capitals',
    breaks: [PEOPLE],
    expect: 'does not mind capitals, and trims what is typed',
    edits: [{ file: SEARCH, find: '    .toLowerCase()\n', replace: '' }],
  },
  {
    name: 'people-search-wants-the-words-in-order',
    breaks: [PEOPLE],
    expect: 'takes several words in any order',
    edits: [
      {
        file: SEARCH,
        find: 'words.every((w) => hay.includes(w));',
        replace: "hay.includes(words.join(' '));",
      },
    ],
  },
  {
    name: 'people-search-keeps-unseen-marks',
    breaks: [PEOPLE],
    expect: 'is not put off by what cannot be seen',
    edits: [{ file: SEARCH, find: "    .replace(UNSEEN, '')\n", replace: '' }],
  },
  {
    name: 'people-search-reads-an-empty-field-as-a-word',
    breaks: [PEOPLE],
    expect: 'a person with only an Arabic name, or only a nickname, is found and never breaks the search',
    edits: [{ file: SEARCH, find: "  return (text ?? '')\n", replace: '  return String(text)\n' }],
  },
  {
    name: 'people-search-skips-the-job-title',
    breaks: [PEOPLE],
    expect: 'reads the Arabic name, the nicknames, the job titles and every e-mail',
    edits: [{ file: SEARCH, find: '    person.job_title_en,\n', replace: '' }],
  },
  {
    name: 'people-search-skips-the-arabic-name',
    breaks: [PEOPLE],
    expect: 'reads the Arabic name, the nicknames, the job titles and every e-mail',
    edits: [{ file: SEARCH, find: '    person.full_name_ar,\n', replace: '' }],
  },
  {
    name: 'people-search-skips-the-nickname',
    breaks: [PEOPLE],
    expect: 'reads the Arabic name, the nicknames, the job titles and every e-mail',
    edits: [{ file: SEARCH, find: '    person.nickname_en,\n', replace: '' }],
  },
  {
    name: 'people-search-skips-the-emails',
    breaks: [PEOPLE],
    expect: 'reads the Arabic name, the nicknames, the job titles and every e-mail',
    edits: [{ file: SEARCH, find: '    ...(person.emails ?? []).map((e) => e?.email),\n', replace: '' }],
  },
  {
    // the screen draws its rows without what was typed
    name: 'people-list-ignores-the-search',
    breaks: [PEOPLE],
    expect: 'typing "Sara" keeps the same people in the wide table and in the phone cards',
    edits: [{ file: ORG, find: '    q,\n    places,\n', replace: "    '',\n    places,\n" }],
  },
  {
    // the screen searches the names alone: the department and the team are not read any more
    name: 'people-list-forgets-the-department-and-team',
    breaks: [PEOPLE],
    expect: 'typing "commercial ahmad" keeps the same people in the wide table and in the phone cards',
    edits: [{ file: ORG, find: '    q,\n    places,\n', replace: '    q,\n' }],
  },
  {
    name: 'people-no-match-is-never-said',
    breaks: [PEOPLE],
    expect: 'says No people match this search only when nobody is kept',
    edits: [{ file: ORG, find: '{rows.length === 0 ? (', replace: '{rows.length < 0 ? (' }],
  },
  {
    // on a phone a TEST user the search found stays folded away under "Test users"
    name: 'test-users-stay-folded-under-a-search',
    breaks: [PEOPLE],
    expect: 'typing "Sara" keeps the same people in the wide table and in the phone cards',
    edits: [
      {
        file: ORG,
        find: 'const testOpen = showTest || searchWords(q).length > 0;',
        replace: 'const testOpen = showTest;',
      },
    ],
  },
  {
    name: 'test-users-are-always-unfolded',
    breaks: [PEOPLE],
    expect: 'without a search the phone keeps the TEST users folded until asked for',
    edits: [
      { file: ORG, find: 'const testOpen = showTest || searchWords(q).length > 0;', replace: 'const testOpen = true;' },
    ],
  },

  // ---- Arabic on is the workspace's language --------------------------------------------------------------------------
  {
    // the old rule's effect: a person who chose nothing is answered in English while Arabic is on
    name: 'arabic-on-still-leaves-the-unchosen-in-english',
    breaks: [ARABIC],
    expect: 'a person who never chose is answered in Arabic, right to left',
    edits: [
      {
        file: EFFECTIVE,
        find: "return profileLocale === 'ar' || profileLocale === 'en' ? profileLocale : 'ar';",
        replace: "return profileLocale === 'ar' || profileLocale === 'en' ? profileLocale : 'en';",
      },
    ],
  },
  {
    name: 'a-chosen-english-is-overruled-by-arabic-on',
    breaks: [ARABIC],
    expect: 'a person who chose keeps their choice, English or Arabic',
    edits: [
      {
        file: EFFECTIVE,
        find: "return profileLocale === 'ar' || profileLocale === 'en' ? profileLocale : 'ar';",
        replace: "return profileLocale === 'ar' ? profileLocale : 'ar';",
      },
    ],
  },
  {
    name: 'arabic-off-keeps-the-unchosen-in-arabic',
    breaks: [ARABIC],
    expect: 'with Arabic off everyone is back in English',
    edits: [{ file: EFFECTIVE, find: "  if (!app.arabic_enabled) return 'en';\n", replace: '' }],
  },
  {
    name: 'the-door-follows-the-switch',
    breaks: [ARABIC],
    expect: 'the sign-in page (nobody signed in) keeps following its own button',
    edits: [{ file: EFFECTIVE, find: 'locale: me ? eff.locale : raw.locale,', replace: 'locale: eff.locale,' }],
  },
  {
    name: 'the-switch-needs-a-second-load',
    breaks: [ARABIC],
    expect: 'the admin turns Arabic on: the cookie is written and the page is loaded once more, in Arabic',
    edits: [{ file: SYNC, find: '  if (loadedIn !== want) io.reload();\n', replace: '' }],
  },
  {
    name: 'a-page-in-the-right-language-is-loaded-twice',
    breaks: [ARABIC],
    expect: 'a page already drawn in the right language is never loaded twice',
    edits: [
      { file: SYNC, find: '  if (loadedIn !== want) io.reload();', replace: '  if (io.cookie !== want) io.reload();' },
    ],
  },
  {
    name: 'the-language-cookie-is-left-behind',
    breaks: [ARABIC],
    expect: 'the admin turns Arabic off: back to English the same way',
    edits: [{ file: SYNC, find: '  if (io.cookie !== want) io.set(want);\n', replace: '' }],
  },
  {
    name: 'the-shell-never-writes-the-language-cookie',
    breaks: [ARABIC],
    expect: 'a new device of a person who reads Arabic gets the Arabic cookie',
    edits: [{ file: PREFS_SYNC, find: "      set: (l) => setPref('locale', l),", replace: '      set: () => {},' }],
  },
  {
    // My profile as it was: "English unless a language is saved", written into the cookie on every visit
    name: 'my-profile-flips-the-language-back-to-english',
    breaks: [ARABIC],
    expect: 'a person who chose no language is not flipped back to English by a visit while Arabic is on',
    edits: [
      {
        file: PROFILE,
        find: "    setPref('locale', personLocale(me.profile?.locale, { arabic_enabled: arabicEnabled }));",
        replace: "    setPref('locale', me.profile?.locale ?? PREF_DEFS.locale.default);",
      },
    ],
  },
  {
    name: 'my-profile-keeps-a-saved-arabic-while-arabic-is-off',
    breaks: [ARABIC],
    expect: 'while Arabic is off the cookie is English, even for a person whose profile says Arabic',
    edits: [
      {
        file: PROFILE,
        find: "    setPref('locale', personLocale(me.profile?.locale, { arabic_enabled: arabicEnabled }));",
        replace: "    setPref('locale', personLocale(me.profile?.locale, { arabic_enabled: true }));",
      },
    ],
  },
  {
    name: 'the-arabic-card-does-not-say-what-it-does',
    breaks: [ARABIC],
    expect: 'in plain English, on and off',
    edits: [
      {
        file: CARD,
        find: '      {def.key === ARABIC_KEY ? (\n        <p className="text-sm text-muted" data-setting-says>',
        replace:
          '      {def.key === ARABIC_KEY && def.value === true ? (\n        <p className="text-sm text-muted" data-setting-says>',
      },
    ],
  },
  {
    name: 'every-setting-carries-the-arabic-words',
    breaks: [ARABIC],
    expect: 'no other setting carries those words',
    edits: [
      {
        file: CARD,
        find: '      {def.key === ARABIC_KEY ? (\n        <p className="text-sm text-muted" data-setting-says>',
        replace: '      {def.key ? (\n        <p className="text-sm text-muted" data-setting-says>',
      },
    ],
  },
];
