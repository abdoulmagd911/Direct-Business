// Landing 52 — the three failures of the F1 live re-test of 25 Nov (FIX-11 Recently deleted, FIX-13 the top search,
// FIX-19 the set-password link). Each sabotage takes one of the fixes back, and the test named must go red for it,
// with the words given. The database half of FIX-11 has its own sabotage beside the SQL suite:
// supabase/tests/sabotage/recently-deleted-lists-others-removals-to-a-member.sql (DEL-05).
const SEARCH_UNIT = 'unit:tests/unit/shell/landing-52-the-search-asks-once-and-says-when-it-fails.test.tsx';
const DOOR_UNIT = 'unit:tests/unit/org/landing-52-the-sign-in-page-links-to-set-password.test.tsx';
const E2E = 'e2e:tests/e2e/landing-52-f1-fixes.spec.ts';
const PALETTE = 'src/ui/shell/CommandPalette.tsx';
const DOOR = 'src/modules/org/screens/PasswordDoor.tsx';
const GATE = 'src/core/db/proxy-session.ts';
const PAGE = 'src/app/(auth)/set-password/page.tsx';
const BIN = 'src/app/(app)/recently-deleted/page.tsx';

const everyLetter = { file: PALETTE, find: '    }, SEARCH_PAUSE_MS);', replace: '    }, 0);' };
const failureHidden = { file: PALETTE, find: '{failed ? (', replace: '{failed && term === "" ? (' };
const noLink = {
  file: DOOR,
  find: '<Link href="/set-password" className="door-link" data-door-set-password>',
  replace: '<Link href="/sign-in" className="sr-only" tabIndex={-1} aria-hidden="true">',
};
const gateClosed = {
  file: GATE,
  find: "return path === '/sign-in' || path === '/set-password' || path.startsWith('/auth/');",
  replace: "return path === '/sign-in' || path.startsWith('/auth/');",
};

export const sabotages = [
  // ---- FIX-13, the top search
  {
    // as it was: one request for every letter typed
    name: 'l52-the-search-asks-for-every-letter',
    breaks: [SEARCH_UNIT],
    expect: 'nothing is asked while the letters are still coming',
    edits: [everyLetter],
  },
  {
    // as it was: a search that failed reads "Nothing matches"
    name: 'l52-a-failed-search-reads-nothing-matches',
    breaks: [SEARCH_UNIT],
    expect: 'the failure is said',
    edits: [failureHidden],
  },
  {
    // a request lost on its way is not asked again
    name: 'l52-a-lost-search-is-not-asked-again',
    breaks: [SEARCH_UNIT],
    expect: 'to be called with arguments',
    edits: [
      { file: PALETTE, find: '{ p_q: term, p_limit: 8 }, { retry: true })', replace: '{ p_q: term, p_limit: 8 })' },
    ],
  },
  {
    // the pause grown until the search feels stuck
    name: 'l52-the-search-waits-too-long',
    breaks: [SEARCH_UNIT],
    expect: 'the pause is short',
    edits: [
      {
        file: 'src/ui/shell/search-pause.ts',
        find: 'export const SEARCH_PAUSE_MS = 250;',
        replace: 'export const SEARCH_PAUSE_MS = 2500;',
      },
    ],
  },
  {
    name: 'l52-e2e-the-search-asks-for-every-letter',
    breaks: [E2E],
    expect: 'the search asked the server once for the typed word, not once per letter',
    edits: [everyLetter],
  },
  {
    name: 'l52-e2e-a-failed-search-reads-nothing-matches',
    breaks: [E2E],
    expect: 'a search that fails says so',
    edits: [failureHidden],
  },
  // ---- FIX-19, the set-password link
  {
    // as it was: no link on the sign-in page
    name: 'l52-the-sign-in-page-has-no-set-password-link',
    breaks: [DOOR_UNIT],
    expect: 'the sign-in page has a set-password link',
    edits: [noLink],
  },
  {
    // the link is there, but the gate bounces a signed-out visitor back to the sign-in page
    name: 'l52-set-password-is-closed-to-a-signed-out-visitor',
    breaks: [DOOR_UNIT],
    expect: 'the link leads to a page, not back to sign-in',
    edits: [gateClosed],
  },
  {
    // the first step is worded as an ordinary sign-in
    name: 'l52-the-temporary-step-reads-as-sign-in',
    breaks: [DOOR_UNIT],
    expect: 'Temporary password',
    edits: [
      {
        file: DOOR,
        find: "{temporary ? t('sign_in.password.temporary') : t('sign_in.password.label')}",
        replace: "{t('sign_in.password.label')}",
      },
    ],
  },
  {
    name: 'l52-e2e-the-sign-in-page-has-no-set-password-link',
    breaks: [E2E],
    expect: 'the sign-in page has a set-password link',
    edits: [noLink],
  },
  {
    // as it was: /set-password sends a signed-out visitor back to the sign-in page
    name: 'l52-e2e-set-password-bounces-a-signed-out-visitor',
    breaks: [E2E],
    expect: 'the link leads to the set-password page',
    edits: [
      {
        file: PAGE,
        find: "if (!me) return <SetPasswordStart next={typeof next === 'string' ? next : null} />;",
        replace: "if (!me) redirect(`/sign-in?next=${encodeURIComponent('/set-password')}`);",
      },
    ],
  },
  // ---- FIX-11, Recently deleted on the screen
  {
    // the page asks the database for nothing and draws an empty list: nobody sees even their own removal
    name: 'l52-e2e-recently-deleted-lists-nothing',
    breaks: [E2E],
    expect: 'a member sees what they removed themselves',
    edits: [
      {
        file: BIN,
        find: "readOrFail<DeletedRow[]>('deleted', failed, () => serverRpc('recently_deleted', { p_limit: 200 })),",
        replace: "readOrFail<DeletedRow[]>('deleted', failed, async () => []),",
      },
    ],
  },
];
