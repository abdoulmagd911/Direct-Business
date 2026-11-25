# Landing 52 — the three failures of the F1 live re-test: Recently deleted, the top search, the set-password link

25 Nov 2026 · base `aad4352` (Landing 51) · target `v2/main` · by pull request, one push.

## Why

The F1 live test batch re-tested the 77 blocks-work fixes on the live workspace, signed in as the Workspace Admin.
Three failed. This landing fixes those three and nothing else.

## What was found, and what changed

### 1. FIX-11 — a Team member read almost everything in Recently deleted (access, high)

**Found.** As the Admin the page showed 200 removals; as the TEST Member it showed 187 — the Admin's, the Head's, the
Manager's and the Commercial tester's removals, with their names and reasons, many with Restore. The page asked one
question about each removal: "could this person read the record while it was live?". A member can read most of the
team's tasks, so a member read most of the team's removals.

**The rule now.** A member sees only what they removed themselves. It is built on a page level, not on a role's name
(roles are renamed, and their levels changed, in the browser):

- **What other people removed is listed only to those who may open Activity** (Activity · View or above): the
  Admin, a Head of department and a Manager as the roles are seeded, or anyone an admin gives that page to.
- **Everyone else — a Team member, a Viewer as seeded — is listed only what they removed themselves.** That holds
  even for a record that was their own (their task, removed by an admin) and for one they could open while it was
  live.
- Everything beneath is unchanged and still applies to every row: only what the person could read while it was
  live (so a head still never reads a removal they could not have opened, and a private note stays its author's),
  the 30-day window, the system's own removals never listed, the names, the reasons, whether Restore is offered,
  newest first.

**The change.** One migration, `20261125100000_core_recently_deleted_own_removals_without_activity.sql`:
`core.recently_deleted` as `20261113180000` left it, word for word, plus one condition in its first step.
The page and its filters are not touched. The level is the person's own page level, so a sign-in switched to a test
user is answered as that test user. Who may *restore* a record is decided where it was (`core.restore_ticketed`) and
is not changed here.

**One consequence, stated plainly:** a member whose own task was removed by an admin or a manager no longer sees it
in their Recently deleted, so cannot restore it from there. The remover, a manager, a head or an admin can.

### 2. FIX-13 — the top search: "Nothing matches" for SAPTCO, and results after 30–60 seconds (high)

**Found — two different things.**

- **"SAPTCO".** The live workspace's database holds no organisation named SAPTCO, and never has: not among the 87
  organisations (live, archived or in the bin), and not once in the change log, which records every name ever
  written. "TEST Beta", the control, is there (DK-P-0010). So for SAPTCO, "0 results" is the correct answer on this
  database; where the tester's Partners page showed that name could not be reproduced from here and needs a
  screenshot. Nothing was changed for it.
- **The slowness is real, and so was a false "Nothing matches".** The live request log of the test minute shows
  the cause: the search sent **one request for every letter typed** — seven within one second for one word. Alone,
  one search answers in 0.05–0.25 s on live (measured, read-only). Seven at once took **6.0–8.6 s each**, and one was
  cut off at the server's 8-second limit. And a request that failed or was cut off was shown as "Nothing matches" —
  which is not true: the search had not answered.

**The change** (`src/ui/shell/CommandPalette.tsx`, no database change):

- The search waits for a short pause in the typing (a quarter of a second, `search-pause.ts`) and asks **once**, for
  the words as they stand. "Searching…" shows meanwhile, as before.
- A request lost on its way is asked once more by itself (the app's existing retry for reads).
- A search that still fails says **"Search did not answer." with Try again** — in English and Arabic. "Nothing
  matches" is now said only when the server has answered and found nothing.

### 3. FIX-19 — the sign-in page had no set-password link (medium)

**Found.** Under the password box: "Forgot your password? Ask your admin." as plain text, and nothing to press.

**The change.**

- The sign-in page keeps that line and gains one real link under it: **"Have a temporary password? Set your
  password"** → `/set-password`.
- `/set-password` used to send a visitor who is not signed in straight back to the sign-in page, so a link to it
  would have led nowhere. It is now a page such a visitor can use: **"Set your password"** — the work email and the
  **temporary password** from their admin, **Continue**, and **Back to sign in**. It is the sign-in door's own form
  and its own server check (the same refusals in words, the same count of wrong tries). A person whose password
  must change then lands on the existing "Choose a new password" step, and from there in the app; anyone else is
  simply signed in.
- **No e-mail is sent by either page** (the owner's rule of 29 Sep stands), and nobody can set a password without
  the temporary one an admin generated in Settings → People. The gate now lets a signed-out visitor reach exactly
  one more address, `/set-password`.
- The language button was not touched; the new link and page are in English and Arabic.

## Not in this landing

- Nothing else: no other page, no Finance change, no "Own clients only".
- The search's database function is not changed: alone it answers in a fraction of a second; the waste was in how
  often the browser asked.
- Other reads on live were also slow in the same minute (many requests at once from the test batch). That is not
  this landing's subject; the per-letter search was the search's own share of it.

## Tests

- **Database** (new `DEL-05`): a member is listed only their own removal — not their own task an admin removed, not
  a colleague's; a viewer nothing of other people's; a manager and the admin the team's; a member given Activity ·
  View the team's. `DEL-01`, `DEL-03` and `DEL-04` pinned the rule beneath ("only what each could read while live")
  with members and viewers as readers; those readers are now given Activity · View so the tests still pin that
  rule. Sabotage: `recently-deleted-lists-others-removals-to-a-member.sql`.
- **Unit** (new, 9): a word typed letter by letter is one request for the whole word, and its organisation is
  listed; the pause is short; a failed search says so with Try again, never "Nothing matches"; "Nothing matches"
  only after an answer; the sign-in page carries the link (English and Arabic) with the old line kept; the gate
  opens `/set-password` and nothing else; the page asks for the temporary password and goes back to sign in;
  Continue goes to the door's own server check. Three older search tests now wait for the pause.
- **Browser** (new, 3): a member, a colleague, a manager and the admin on Recently deleted; the search typed letter
  by letter (one request, the organisation found within five seconds, a cut-off request said as such, Try again);
  the link on the sign-in page, the language button, a wrong and a right temporary password, "Choose a new
  password", into the app.
- **Sabotage** (new, 13): 1 database, 7 unit, 5 browser — each takes one fix back and its test goes red with its
  own words.

## Verification (local, clean build, database built from zero)

- Types, lint, format and the house checks: green. Registry in step; generated types match the migrations.
- Unit: 1,912 passed (1,903 + 9 new). Database, built from zero: 393 passed, 0 failed (392 + `DEL-05`).
- Browser, on a clean build and the local stack: the three new tests 3 of 3; the full suite 617 passed, 10 skipped
  (the same ten as before), and one unsteady check that is not this landing's — the colour-contrast reading of the
  bell panel (and once the conflict dialog) while it is still fading in, the one Landing 47 wrote down. Repeated
  three times it passed twice each; neither screen is touched here.
- Sabotage: the 13 new ones red, each with its own words (1 database, 7 unit, 5 browser), and the six older
  Recently deleted database sabotages still red against the edited tests. The whole sweep runs in CI on the push.
- Live, read-only, before the push: one search alone answers in 0.05–0.25 s; on live every Team member (12) and the
  Viewer hold Activity · None, and the admins, heads and the manager hold View or above — so the rule lands as
  written: members and the viewer, their own removals only.

## Live check after deploy

1. **Recently deleted.** As the Admin: `/recently-deleted` still lists everyone's removals. Settings → People &
   access → TEST Member → Sign in as test user → `/recently-deleted`: only rows whose "Who" is TEST Member — none of
   the Admin's, TEST Head's, TEST Manager's or TEST Commercial's. The same as TEST Viewer.
2. **Search.** Ctrl K, type "TEST Beta" at an ordinary pace: "TEST Beta DK-P-0010" within a second or two.
   Type a word nothing carries: "Nothing matches".
3. **Sign-in page**, signed out: the link "Have a temporary password? Set your password" under the password box;
   it opens "Set your password"; "Back to sign in" returns; العربية still switches the whole page.
