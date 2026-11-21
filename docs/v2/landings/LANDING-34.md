# Landing 34 — the test-round fixes (mobile + web rounds of 19 Nov 2026)

Base `4809f6d` (CI #1614 all green) · target `v2/main` · one push.

Before it, one small job: CI run #1613 (Landing 32) was cut off because the job "every check and unit test fails
under its sabotage" hit its 20-minute limit with nothing failed. Its limit is now 45 minutes (`4809f6d`); run #1614
took 22.6 minutes in that job and all 11 jobs are green.

Scope: the 40 items of the brief "Test-round fixes" (BLOCKS USE 1–14, LOOKS WRONG 15–35, BRANDING 36–40).

## In plain words — what changed

### Blocks use

1. **Today's three is on My day for every employee.** Under the banner: three groups of at most three of the
   person's own open tasks — Important (starred), Short (not starred, due within 2 days), Maintenance (the rest of
   their own tasks) — with the line "From your own task lists", the three source lines, and a small streak line.
   Everything not picked stays in the Today block below, grouped as before; nothing is drawn twice. The real Admin
   account still sees the admin notice instead (unchanged). A manager's My team tab lists the team's streaks.
2. **Partners list.** A failed side read (owners, types) no longer takes the list down; the failure is said in
   words with a Try again that really reads again.
3. **Partner records.** The record's one database read no longer works out the organisation's money (that was
   about four fifths of its time: 650 ms → 180 ms on the seeded data here; on live that is the difference between
   passing and being cut off at 8 seconds). The Codes and Finance tabs ask for it when they are opened. A failed
   record says why, with a reference, and its Try again spins and reads again.
4. **Finance.** The ledger no longer waits for ever when the figures read fails; a read with no answer is let go
   after 20 s and says so; coming back to the window no longer restarts every read (that restart is what turned one
   slow load into "three blocks failed after 30 s"). The settings page awaits nothing bare any more.
5. **Members do not see Finance.** The Team member role is at None on Finance and on a partner's Finance tab
   (it was View). See "Item 5" below — this reverses a setting made on 9–10 Nov.
6. **Add task says when it failed.** The refusal's own words show inside the form ("Nothing was saved. What you
   typed is still here."); `/tasks/new` opens its form at once instead of waiting for the list.
7. **In-list search filters, and shows that it is loading** (rows dim, "Loading" beside the chips).
8. **Global search opens its result** on click and on Enter, and shows the move at once.
9. **An organisation's name opens its record on the first click.** The hover card no longer takes the click, never
   opens on "Loading", and never opens on touch.
10. **Navigation clicks.** The focus re-read no longer races the click; every move, including the ones made in
    code, shows the progress bar at once and a "Loading" pill after 0.4 s.
11. **Arabic.** When Arabic is On in Settings → App, each person gets the language choice at once — on that card,
    in the profile menu and in My profile — and choosing العربية saves it to their profile and reloads the whole app
    in Arabic. The first page is now served in the person's language (it used to follow the cookie only).
12. **Settings does not crash after a save.** A failed read on the page is drawn inside Settings with Try again;
    the double re-read after a save is gone.
13. **"Active 0".** See "Item 13" below — nothing was lost; no "Active" status was ever recorded for those partners.
14. **Slowness.** The measured cause is below ("What makes it slow"). This landing removes the biggest avoidable
    load; the rest needs a decision.

### Looks wrong

15. **Missing spaces.** One shared cause: on a phone every plain link became a flex box, and a flex box drops the
    spaces between its children. Fixed at the shared rule, in the shared tabs and the record header counts, and in
    each module's own label + count pairs.
16. / 35. **One Provisional amount.** The headline, the Months total and the month row all read the provisional
    revenue (the Months table was reading a profit field that leaves imported rows out). The Cost and Profit cards
    say "not counting Provisional 4,200 · 3 units" — an amount, never a dash.
17. **Archive / Unarchive shows at once** on the record (chip, banner, menu).
18. **"Income by company"** is the name of the Ledger's by-organisation table, with its own address
    (`/finance#finance-company`) and a link beside Income by service.
19. **The Payments date is honest.** Older than two days it reads "Payments · not refreshed since 8 Nov 2026" in
    the warning tone, with the newest file's day beside it; the same on a partner's Finance tab.
20. / 23. **Record section bars are one row on a phone** (partner and task records), scrolling inside themselves.
21. **Watch** is pressable at once; where it is disabled (a Viewer) it says why.
22. **Note titles** wrap; a long captured line is cut between words, never inside one.
24. **Settings cards show "Applies from <date>" only** — the stored reason stays in Activity.
25. **Every Partners row has an Actions button** (Open; Archive / Unarchive for Full).
26. / 34. **Names wrap** — owners and long organisation names, table and phone.
27. **Table top row.** Rows are measured as drawn and each header cell is sticky with its own ground.
28. **The stray "Loading"** was the hover card's; it no longer opens on loading.
29. **Test users switch directly**: the yellow bar has "Switch test user", and People / a TEST person's page offer
    "Switch to this test user". Who may start a switch is still decided by the database on every start.
30. **Status filter has Archived**; an archived row offers Unarchive.
31. **The list is fresh after an add** (and after any change on a record).
32. **A saved note shows at once** on the record.
33. **Sign-in card sits under the header on a phone** (the quarter-screen gap is gone).

### Branding

36. / 38. **Direct Corporate.** Tab titles "<Page> · Direct Corporate" («… · دايركت للشركات»), sign-in
    "Sign in · Direct Corporate Workspace", the heading "Direct Corporate" + the Workspace pill, footer
    "© 2026 Direct Corporate", and the word "Corporate" as text beside the untouched Direct wordmark (the two
    wordmark files are pinned by checksum in a test).
37. **The phone top bar starts with the logo** + "Corporate", a 44 px link to My day.
39. / 40. No change (favicon and sign-in page verified fine by the round).

## Item 5 — Members and Finance (a reversal; please confirm)

There was no code error. On 9–10 Nov the level was deliberately made a setting and Members and Viewers were started
at **View** (Landing 7, the owner decision recorded as "everyone can see what they have access to, and it can be
edited in the Settings"; migration `20261109000044`). The test round of 19 Nov says "Members must NOT see Finance".
This landing follows the newer instruction:

- the Team member role goes to **None** on `finance` and on `partner_finance` (a partner's Finance tab) —
  migration `20261120110000`, and the registry defaults for a database built from zero;
- it is **still a setting**: an admin can raise a role or one person in Settings › People & access › Access;
- the **Viewer** role is not named in the round and keeps View; **Codes** stays at View for members (the round
  does not name it). Say if either should follow.

Consequence to know: a member who is an account manager is no longer told "invoice unpaid" alerts, and the Quiet
card on Partners shows "—" for them, because both are Finance facts (the existing rule FAL-02).

## Item 13 — "the 11 Active partners lost their status" (nothing was lost)

Checked on live, read-only, in the change history (`audit.change`), which records every insert, change and removal:

- before the seed of 20 Nov, **no partner ever had the status "Active" recorded**: the only status rows ever
  written were 10 × Prospect (7, 8 and 12 Nov). None was changed or removed since.
- of the 52 non-seed partners, 36 client sides and 3 supplier sides have **no status recorded at all** — they show
  "—", correctly — and 10 are Prospect.
- the cards' rule since Landing 31 is "Active = status Active". So "Active 0" was true on 19 Nov; today it reads 24
  (the seed's 24 active partners).

So there is nothing to restore, and writing "Active" onto 36 organisations would be inventing data. The "11 Active /
4 Not yet active" of 16 Nov cannot have come from these status rows; it was most likely the Overview's own count
(clients with a paid invoice). **Decision for the owner:** either set the real status on those partners in the
browser (bulk select → status), or tell me the rule that should make a partner Active without a typed status.

## What makes it slow (item 14) — measured, not guessed

- Live allows **8 seconds per database call**. Live is about 4× slower than this machine; planning one money query
  alone takes ~190 ms there.
- Every money figure is worked out per invoice at read time by one central view (`finance.money_row`): ~0.35–0.55 s
  per pass on live with 148 invoices, and it grows with every invoice.
- Pages ran that pass several times: a partner record 4 times (now 0 on first paint), Finance 12–14 times across 8
  reads, the Partners list once for the Quiet card.
- Simple reads (`me`, `org`) that take 10 ms here averaged 0.6–0.9 s on live while those passes were running: the
  database was saturated, and anything that crossed 8 s was cut off — the "could not load" boxes.
- The L27/L29 findings both held: the focus re-read (L29 §1a) was restarting loads in flight — fixed here for
  Finance and for navigation; JIT is already off on live.

**Not done here, and needed before real volume:** the money view must be restructured to work set-by-set instead of
invoice-by-invoice (a landing of its own, with the 364 database tests as its net), or the database moved to a
larger size. Recommendation: do both — the size first (one setting in Supabase, immediate), the restructure next.

## Database — forward-only

| Migration | What |
|---|---|
| `20261120090000_partner_page_summary_deferred` | `api.partner_page` answers `summary: null, summary_deferred: true` |
| `20261120100000_work_streaks` | `work.streak_of`, `api.my_streak()`, `api.team_streaks()` — nothing stored |
| `20261120105626_core_registry_sync` | generated: Team member starts at none on Finance / partner Finance |
| `20261120110000_member_finance_levels_none` | moves the existing role rows |

`grants.expected` gains the four streak grants; `database.types.ts` is the generator's output (2 lines).

## Decisions taken (please confirm or overrule)

1. **Today's three is read from the tasks, nothing new is stored.** Important = starred; Short = not starred and due
   within 2 days; Maintenance = the rest of the person's own open tasks. "Maintenance" had no written definition.
2. **A streak day = a working day with at least three of your own tasks finished.** Friday and Saturday are stepped
   over; today does not break a streak while it is short of three. (The brief says "Today's three done"; which three
   were shown on a past day is not stored, so "three finished" is the readable rule.)
3. **Item 5** as above (Viewer and Codes unchanged).
4. **"Direct Corporate" is allowed on screens and still refused in data** (V59 reversed in part: the words check no
   longer refuses it in the catalogs and pages; `core.banned_word` is unchanged, so an organisation cannot be named
   so by mistake). Arabic workspace name: «دايركت للشركات».
5. **"Income by company"** uses the word "company", which the screen-words check bans; the check now allows that
   one label only.
6. **Cost and Profit cards say "not counting Provisional"** — "of which" would claim a cost that does not exist.
7. **The drawer keeps the department line "Commercial"** under the logo.
8. **No loading frame was added to routes** — two standing rulings forbid it (a frame above a record turns a real
   404 into a 200; a route's own frame strands a non-painting browser). The bar + pill does the job.
9. **The direct test-user switch is two logged steps** (end, then start); the database's rule against a switch
   inside a switch is untouched.

## Could not be reproduced from the code (said plainly)

- **12** — no client render crash was found; the server-side cause above is fixed. If it happens again, the page
  now says which read failed.
- **20** — why a second row sat under the bottom bar (with one row there is none).
- **27, 28** — two real defects fixed for 27, one for 28; neither could be confirmed as the one seen.

## Verification

See the end of this note ("Verification — this landing's head"), written after the last run.

## Tests added

- **Database:** `STR-01` (the streak rule, with the clock fixed), `PRT-02` and `FIX03-02` rewritten for the new
  behaviour, four finance tests given an explicit View for their member; 6 new SQL sabotages.
- **Unit:** 197 new tests (1,405 → 1,602) in 20 new files, with 115 new plants in six `landing-34-*.mjs` files.
- **Browser:** `landing-34-test-round.spec.ts` (8 tests, with volume: 40 organisations, 25 tasks, app + imported
  finance rows), `landing-34-arabic.alone.spec.ts` (the real switch, the language choice, the figures equal digit
  for digit in Arabic, Settings does not crash), 22 browser plants. 21 older browser tests were updated to the new
  truth (members and Finance, Today's three, the brand), none loosened.

## Verification — this landing's head

| Check | Result |
|---|---|
| `tsc` · `eslint` · `prettier` | 0 · 0 · 0 |
| `node scripts/checks/run.mjs` | 19 green |
| `gen-types --check` (CLI 2.118.0) | matches the migrations |
| `vitest` | 1,602 passed |
| DB suite, fresh `v2_test` | 364 passed, 0 failed |
| `pnpm build` | exit 0 |
| Browser, chromium (whole suite) | 497 passed, 10 skipped |
| Browser, alone (whole suite, Arabic) | 34 passed (33 + the Landing 32 member sweep, re-run after it was taught that a member has no Finance) |
| Sabotage — the 22 new browser plants | each red, as it must be |
| Sabotage — every SQL, unit, check and lint plant (1,205) | each red, as it must be |

**With the seeded data (volume):** the seed of 20 Nov was loaded into the local copy at this schema; the slow reads
were measured on it (partner record 650 → 180 ms; the money view's cost per pass) and on live read-only. The browser
round uses its own volume as listed above.

**Live verification in a browser is not done from here:** this session cannot open `www.directksab2b.com` (the
network policy answers 403) and holds no sign-in. What was checked on live is database-side and read-only: the
timings, the access levels and the status history above. After the push, the first thing to look at as TEST Admin,
in English and Arabic: Today's three for each role; Partners and a record on the first try; Finance on the first
try; a Member and TEST Commercial see no Finance; Arabic On → the language choice → the whole app in Arabic with
the same figures; Provisional the same in the three places; search filters and opens; Settings after saving
Arabic Off.

Counts for this round (local, both languages): screens checked 9 / screens with issues 0 · lifecycle steps
completed 12 / blocked 0 (add partner → view → edit note → archive → restore; add task (and a refused add) → view;
Arabic On → choose → Off; switch test user → switch again → back).

## Seen, not changed (say if you want them)

- A new organisation starts with **no status** (not Prospect), so the Prospects card counts only those set by hand.
- On a phone the Partners list paints the desktop table for a moment before the cards (older than this landing).
- `StatusChip` drops `data-*` given to it (one test hook was moved to a wrapper; the contract chip's hook is
  dropped the same way and nothing reads it).
- The record's one read still fetches history, comments, notes and files whatever tab is open (cheap today).
- `finance_payments_as_of` has no "latest record typed here" date; the stamp speaks of files only.

## For the owner — after it is live

1. Confirm or overrule the nine decisions above — first **Item 5** (Viewer and Codes left as they are) and the
   **streak rule**.
2. **Item 13:** set the real status on the partners that have none, or tell me the rule for "Active".
3. **Speed:** raise the database size in Supabase (one setting), and say go for the money-view landing.

---

# Landing 34b — the follow-up after the owner's live check (20–21 Nov 2026)

Base `b505561` (Landing 34) · target `v2/main` · one push.

## In plain words — what changed

1. **Finance is for everyone; only view-only roles cannot edit (the owner, 21 Nov).** This overrules Landing 34's
   item 5. The Team member role is now at **Full** on Finance and on a partner's Finance tab — the same as Heads,
   Managers and Admins. The **Viewer** role stays at View: it sees Finance and cannot add or edit. It is still a
   setting (Settings › People & access › Access), so an admin can lower or raise one role or one person. The
   earlier database file that set members to None is not edited (files only go forward); a new one moves the level.
2. **Today's three is stable and follows its definition.** The database now picks it, from **all** of the person's
   own open tasks (never one they only help on): Important = starred; Short = not starred, due today or within the
   next two days; Maintenance = the rest (overdue, due later, or with no due day). Nothing whose status means done
   or cancelled shows as current — in Today's three or in the Today block. Each group is in one fixed order (due
   day, undated last, then task number), holds at most three, and says "N more in Tasks" when there are more. The
   same person loading My day twice gets the same answer.
   What was wrong: the screen picked from the short Today list (tasks due within a week, plus starred), so an
   undated task was nowhere; "Short" swept in tasks overdue since 2025; a cancelled task with no closed stamp
   counted as open.
3. **Finance "What needs attention" always settles.** Cause: coming back to the window restarted every Finance
   read (a marker was cleared before the shell's own re-read ran 0.4 s later), so the strip kept returning to
   "Loading". Now a window return is recognised for 2 s and restarts nothing; a refusal hides the strip instead of
   saying "could not be loaded"; Try again always asks again.
4. **People & access search** matches any part of a person — names in both languages, nicknames, job titles,
   e-mail, department, team — several words in any order, ignoring case and accents. Note: on live, no staff
   member has "Sara", "Ahmad" or "Alotaibi" in any field (18 people checked); those names belong to partners'
   contacts, so "No people match" was the right answer for the staff list.
5. **The organisation's Arabic setting switches the app.** Arabic On = Arabic for every signed-in person who has
   not chosen a language themselves; a person's own saved choice wins; Arabic Off = English for everyone. (On live
   four people have English saved; they stay in English until they change "Your language".)
6. **The eight sabotage checks that did not bite in CI run 1615** (end-to-end parts 2/3 and 3/3) are repaired and
   each proven red: `finance-read-is-never-asked-again`, `arabic-never-switched-on`,
   `header-add-follows-the-spent-address`, `e2e-tasks-my-work-shows-the-whole-team`,
   `finance-new-button-for-everyone`, `arabic-cookie-wins-while-off`, `clients-none-reads-as-a-list`,
   `a-row-link-centres-its-words`.

## Database — forward-only

- `20261121090000_my_day_todays_three` — `my.my_three(person)`; `my.my_tasks` and `my.my_day` copied forward
  (status rule; the key `three`). No grant change.
- `20261121090100_core_registry_sync` — starting levels for a database built from zero (member Full on Finance).
- `20261121090200_member_finance_levels_full` — the Team member role's row on `finance` and `partner_finance`
  goes to Full where it reads None or View. Person and team overrides are left alone.

## Seen, not changed

- **A question for the owner.** Three Finance switches are separate from the page level and were NOT changed: importing
  a Payments file (`finance.import`), changing a credit limit (`finance.credit`) and credit control
  (`finance.credit_control`). Team members do not hold them, so a member at Full adds and edits invoices and closes a
  month but cannot import a file or change a credit limit. Say the word and they are switched on for members too.
- The Team list reads at most 200 tasks; a department with more than 200 open tasks would not see them all.
- `finance.health` is the heaviest Finance read and can still come close to the 8-second limit on live; the
  lasting fix is the money-view restructuring already recommended, plus a larger database size.
- `effectiveLocale` (src/core/prefs/effective.ts) is no longer used by any screen.

## Live check that could not be done from here

The build session cannot open the live site or sign in. "Load My day twice as TEST Admin" was done against the
live database, read-only, with the new rule: both readings gave Important 0, Short 0, Maintenance 7 — showing
TSK-2025-0001, TSK-2025-0013, TSK-2025-0007 and "4 more in Tasks" — identical both times.

## Verified before the push (final code, 21 Nov)

- Typecheck, lint, format, the 19 structure checks, registry in step, database types in step: all green.
- Unit tests: 234 files, 1,669 passed. Database tests on a fresh database: 365 passed. Grants unchanged.
- Browser tests, whole suite once on a fresh database: 579 passed, 0 failed, 10 skipped.
- Planted faults, every one caught: database 540, unit 686, checks 33, lint 2, and the 83 browser plants that name
  a changed spec (7 of them new, for "member Full, viewer View"). No stale plant.
- One note: the 3-second Finance speed gate missed once (5.2 s) on a loaded machine and passed on the re-run and
  in the whole-suite run.
