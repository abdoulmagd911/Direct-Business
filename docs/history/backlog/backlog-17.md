## Routine fire #50 (2026-09-15 06:13 UTC) — the view-only SHARE LINK driven live end to end (an outsider with no sign-in — a role never driven this session): data and writes all safe; three screen defects FIXED (js/79) — banner covered the top bar, Finance offered to a link holder, a colleague's name shown as the guest
scratchpad/live-share.mjs, real database. A) as the QA admin: the Share button opens js/77's panel (not a bare
link); the panel listed every existing link (4, all off) with the plain-words note; "Create a new link" asked
first (in-page confirm), then ONE link was minted through the real click path, appeared in the list as ON, and
its address was on the clipboard. B) a FRESH browser with no session on /s/<token>/leads: no login form, banner
on, 108 businesses / 28 clients / 78 lead rows loaded through the share_view RPC, 0 primary/danger/editor
controls, save() neutralised, a direct update through the page's own anon client REFUSED by the database (0
rows), Arabic toggle works (RTL, Arabic nav, Arabic banner line). Every other section typed into `current`
(offers, airlines, vendors, sopsla, ops, reports, events, invoices, bookings, settings, documents, activity)
bounces to Today; no money figures anywhere. C) as the admin: "Switch off" asked first, the row went OFF in the
panel, and the dead token in a fresh browser shows the plain "This share link is not valid any more…" page
(DB.businesses reads 65 there — core-01's built-in demo SEED, fake, never rendered; my first check misread it).
THREE SCREEN DEFECTS, seen on the real shared page and by eye on its screenshot, all fixed in js/79:
1. **The banner covered the top bar.** The fixed 36px banner sat over the sticky top bar (top:0): page title,
   search box, language and export buttons were hidden behind it, and the sticky sidebar started under it too.
   body.paddingTop moves neither. Now `.top{top:36px}` and `.side{top:36px;height:calc(100vh - 36px)}` in a
   shared view only.
2. **Finance was offered to a link holder.** With no session js/52 holds to the employee floor (Today · Leads ·
   Clients · Finance), so the sidebar showed Finance and current='finance' rendered an (empty, 51-char) Finance
   page — against the panel's own promise ("Today, Leads and Clients"). The entry is now hidden in a shared
   view and a landing on it is sent to Today. Verified live: nav = Today/Leads/Clients, finance → today.
3. **The sidebar footer showed the app's placeholder person by name** ("Abdelrahman / Business Development" —
   the static HTML js/20 replaces only for a signed-in person), as if the outsider were signed in as a
   colleague. It now reads "View-only guest · Read-only link · nothing can be changed" / "ضيف · عرض فقط — لا
   تعديل".
Guard: scripts/qa/probe-share-view-tidy.mjs (10 checks against a seeded active token in the mock; SABOTAGE-
VERIFIED: with the js/79 script line removed 6 go FAIL and it exits 1; port 9036; in battery.txt). Live re-run
after the fix: **0 findings** (nav Today/Leads/Clients, banner clear of the top bar, guest footer, all the
data/write guarantees unchanged). Gates: structure OK (72 files), probe-integrity OK, decisions-wired OK.
Housekeeping: the two links this round minted (both switched off through the panel) were deleted by SQL;
share_links is back to exactly its prior state — 4 rows, 0 active, none from today (verified).
Noted, not changed: (a) the top-bar "Not synced yet" badge and the Export menu are still shown to a link holder —
harmless (nothing to sync; export is "look", not "change"), the owner may want Export hidden; (b) the clean-URL
layer rewrites /s/<token>/leads to /leads a moment after boot (an existing, probe-pinned behaviour: the token
never sits in the address bar), so a RELOAD of a shared page lands on the login form — a link holder must use
the link again. Both are design calls, recorded here for the owner.

## Routine fire #49 (2026-09-15 04:11 UTC) — clean-URL deep links driven live for the first time: all 17 checks clean; two wording defects seen by eye on the real card FIXED (history "unknown" actor explained; Arabic sync badge no longer says "not saved")
Area never driven live: the address bar (js/03 clean-URL routing + js/66 /documents/<tab> sub-addresses). The
daily path is a colleague pasting /clients/client/<id> into a fresh browser. scratchpad/live-deeplinks.mjs,
real database, read-only, fresh browser context per case (no session → sign in → must land on the address):
- client card, lead card, the OLD shape /leads/lead/<clientId> (rewritten to /clients/client/…), /finance,
  the aliases /providers→vendors and /dashboard→today, /documents/fees (lands in the fees editor — read via the
  app's own __dgTabProbe/__dgHomeProbe hooks), an unknown address (→ Today, no error), and a card link to a
  record that does not exist (→ Leads list, no error) — **9/9 land correctly with the address preserved**.
- reload on a card address keeps the card (both card shapes) — 2/2.
- history: Back #1 closes the card and keeps the Contacted filter; Back #2 undoes the filter and stays on
  Leads; Back #3 returns to Today; Forward ×3 replays Leads → filter → the same card; re-rendering an open
  card adds no history entries — 5/5. Arabic-first boot on a client deep link lands on the card, RTL — 1/1.
  0 JS errors across every context. Routing: 0 defects.
TWO DEFECTS FOUND BY EYE on the EN + AR screenshots of that real card, both fixed in this commit:
1. **"Recent changes" read "unknown — last contact" on two rows** (js/63). Ran it down in the database: 216 of
   274 record_history rows have actor NULL / actor_name 'unknown' — and they are bursts at identical
   timestamps (56 invoice creates at one second, 28 deletes at another, 7+6+12 edits at 05:38:46 exactly) —
   direct SQL / service-role work by sessions and imports, never the app: the businesses write policy needs
   app_role() (a signed-in account), so an app write always carries auth.uid(). (SELF-CORRECTION: my fire-#32
   line "record_history fully attributed" was true only of actor_name being non-null; 79% of rows are the
   literal 'unknown'.) The word "unknown" on a card looks like a ghost edit or an unnamed colleague. It now
   reads "unknown — changed directly in the database, not via the app" / "غير معروف — تغيير مباشر في قاعدة
   البيانات، ليس عبر التطبيق" — the word kept so the two probes pinned to it (audit-names-and-words,
   audit-events-search-attacks) still pass (re-run: both green). Verified live on the real card, EN + AR.
2. **The sync badge's Arabic said "not yet saved on the server" (لم يُحفظ على الخادم بعد) on a fresh browser
   with nothing changed** (js/75), where English says the neutral "Not synced yet" — an EN/AR meaning
   mismatch that reads as unsaved work. Now "لم تتم المزامنة بعد". Verified live at the login screen and after
   sign-in, EN + AR.
Guard: scripts/qa/probe-history-actor-and-sync-words.mjs (5 checks; SABOTAGE-VERIFIED: with the two fixes
stashed, 3 checks FAIL and it exits 1; restored and green; port 9035 — the first pick, 8913, was already
taken by probe-lifecycle5 and the integrity gate caught it). Gates: structure OK, probe-integrity OK,
decisions-wired OK. Noted, not changed: field VALUES on the Arabic card ("Government tender", "No", "Won")
are stored data in English — a bilingual value map would be a feature, not a fix.

## Routine fire #48 (2026-09-15 02:11 UTC) — the Ctrl/⌘+K command palette driven live for the first time: "New lead" was broken, the whole palette was English in Arabic — both FIXED (js/78), guarded, 0 findings on re-run
Area never driven this session: the command palette (core-06 v19, extended by core-08 v25 + core-09 v26) — a
daily path ("Find a client" on Today opens it; the "/", "?", "N", "E" shortcuts live in the same handler).
scratchpad/live-palette.mjs, real database, read-only (a save()/saveDB() counter proved 0 writes across the run;
"New offer" and every "View as <preset>" were skipped on purpose because they DO write). EN desktop, AR desktop,
EN phone (400px). All 28 empty-query rows were run one by one and the landing judged.
TWO REAL DEFECTS, both reproduced live and now fixed:
1. **"New lead" in the palette threw `editLead is not defined`.** core-06 line 492 calls a function that never
   existed anywhere (the real form is `editBusiness()` in core-02). The "N" shortcut on the Leads page checks
   `typeof editLead==='function'` for the same reason — false — so instead of the new-lead form it fell through to
   the palette, whose "New lead" row then threw. Fix: `editLead(id)` is a thin alias of `editBusiness(id)`.
   Verified live after the fix: palette "New lead" → "New business" form, no error; "N" on Leads → the form directly.
2. **In Arabic mode every part of the palette was English**: the search hint ("Search anything — …"), 27 of 28
   rows, all 28 kind badges, the ↑↓/↵/Esc footer, "No matches." and the "?" cheat sheet. Fix: when LANG is 'ar'
   the rows are relabelled from a table (English label kept on each row as `en`, so typing "settings" still finds
   the Settings row), record kinds get Arabic badges, and the chrome is rewritten on open / on every language flip.
   Verified live: 28/28 rows Arabic, 28/28 badges Arabic, hint/footer/no-match/cheat-sheet Arabic, RTL clean in
   the screenshot.
Everything else was clean: Ctrl+K opens/toggles/closes; Esc closes; ↑↓ move the selection; a real 6-letter
fragment lists the record and Enter opens it (dropdown closed, card 2,912 chars); "/" focuses the global search;
"?" opens the cheat sheet; the 12 Nav rows all land on a rendered page with a highlighted sidebar entry (including
the four not in the sidebar — Invoices/Bookings/Tickets/Sync — which render via the "More" group); the 7 form
Actions open their modal; 0 JS errors; palette fits the phone screen (384×748 inside 400×850).
Shipped: `js/78-palette-arabic-and-new-lead.js` (+ its script line — a connection step, done alone, structure gate
green: 71 files, no duplicate ids) and `scripts/qa/probe-palette-arabic-and-new-lead.mjs` (13 checks; SABOTAGE-
VERIFIED: with the js/78 line removed 11 go FAIL and it exits 1; registered in battery.txt, port 8912).
Gates: check-structure OK, check-probe-integrity OK, check-decisions-wired OK.
Noted, not changed (owner's call): the palette's Nav list is the 2026-era one — it offers Invoices/Bookings/
Tickets/Sync/Projects (all still render) but has no row for Clients, Finance, Events, Documents, Reports, Ops,
Archive; the global search box covers records, so nothing is unreachable, but "Go to Finance" would be the
natural row to add if the owner wants the palette to match today's sidebar.

## Routine fire #47 (2026-09-15 00:11 UTC) — new-day baseline battery launched; the "Events Hub file" run down: retired by design, docs stale, my fire-#31 note corrected
New day, and the container's kernel changed overnight (fc-v24 → fc-v33) — the very condition that darkened the
battery originally. Checked first: git synced (00bafd0, clean, no oversight commits), and the browser deps
(/tmp/node_modules playwright + supabase UMD, chromium) plus every scratchpad script and both battery logs
SURVIVED. So the new-day full battery was launched as the 09-15 baseline (background, new log
full-battery-day2.txt) — it doubles as the reprovision-resilience test of the fire-#39 conversion.
DAY-2 BASELINE VERDICT (00:12→01:45 UTC, 93 min): **186/186 ran, 0 missing, 185 green, 1 red.** All three probes
fixed on 09-14 (targets-attacks, backup-supabase, people-bridge) green; 09-14's timing flake (leads-dash-tiles)
green; the 56 hardened probes green. The single red is audit-finance-tabs, confirmed by an isolated re-run to be
the ONE known check — "EN expenses: slow tab switch — 823ms (freeze-class regression)" — the mock-harness Expenses
cold open sitting 23ms over the 800ms guard, deterministic and environment-bound, already characterised (fire #40)
and closed with real-data evidence (fire #41: 441ms cold on the real DB). Not a regression; the guard stays
untouched (owner's call, per #41). So: the un-darkened battery SURVIVES a container reprovision, and the
effective day-2 result is 186/186 clean with one documented, borderline guard.
Fresh slice picked: the standalone KSA Events Hub (`events/index.html`, per CLAUDE.md) — never driven this
session. It does not exist in the checkout. Ran that down rather than assuming:
- `git log --diff-filter=D -- events/index.html` → deleted in **47b6c01 "Events move inside the app: v64 layer
  upgrades the Events tab; public page retired; data signed-in only"**. The public hub was RETIRED by design;
  events live only as the in-app Events tab (js/10-events.js, ksa_events, signed-in) — the page the walks already
  verified (#13, #16, #37) with its 80 real events.
- /events still resolves correctly: vercel.json has no /events rewrite, so the catch-all serves the main app,
  and js/03's VALID list includes 'events' → the deep URL lands on the in-app Events tab after sign-in. Not a
  broken URL; not a defect.
- DOCS were stale: CLAUDE.md still named `events/index.html` as a live file (the "consolidated home" line, the
  ksa-events-hub note "Its page is now in events/", and the links table "Events hub"). Corrected in this commit to
  say the page was retired in 47b6c01 and where Events live now. (The `ksa-events-hub` in the edge-function list
  is a real, still-existing function — left alone.)
- SELF-CORRECTION: my fire-#31 entry stated "/events is the KSA Events Hub's own events/index.html (served by
  filesystem precedence, confirmed live in fire #13's walk)". Both halves were wrong — the file had already been
  retired, and fire #13 navigated the IN-APP events page, never the /events URL. I asserted it without checking.
  The line is corrected in place below (fire #31) so the record is not misleading.
**0 app defects; 1 stale-documentation fix; 1 self-correction.** No new oversight commits (HEAD 00bafd0).

## Routine fire #46 (2026-09-14 22:11 UTC) — phone width, deeper: real DETAIL CARDS and all 8 FINANCE TABS at 400px, EN+AR, real DB — all fit, 0 defects
Fire #44 proved every PAGE fits at phone width; this opened what a colleague on a phone actually taps into
(scratchpad/live-phone-deep.mjs, 400×850, isMobile, real database, read-only):
- 6 real lead cards + 6 real client cards (the v33–v36 + people-bridge + client-address injection stack, wide
  tables, long bilingual names) — **12/12 fit in EN and 12/12 in AR**: scrollWidth == clientWidth == 400px on every
  card, 1,686–2,938 chars of real content each, 0 NaN/undefined, no widest-element overflow reported.
- All 8 Finance tabs (overview/clients/ledger/reports/import/expenses/proofs/b2c) — **8/8 fit in EN and 8/8 in
  AR**, 525–1,747 chars each; the KPI tiles, tables and tab bars wrap rather than overflow.
- 0 JS errors across all 40 renders.
Together with #44, the phone experience is now verified end to end on real data: every page, every card, every
finance tab, both languages. **0 defects.** Screenshots stay in the ephemeral scratchpad; nothing real committed
(rule 7). No new oversight commits (HEAD 6fad136).

## Routine fire #45 (2026-09-14 20:11 UTC) — two never-driven daily paths live vs the real DB: ARABIC-FIRST BOOT and GLOBAL SEARCH — both clean
Two paths no drive had ever exercised (scratchpad/live-search-arboot.mjs, read-only, real database):
(A) ARABIC-FIRST BOOT — localStorage.dbLang='ar' set BEFORE the page loads (an Arabic-first colleague, or a browser
    auto-detected as Arabic by core-06's autoDetectLang). Result: the login screen is already LANG=ar, dir=rtl,
    lang=ar — no English flash; after sign-in the first render is Arabic RTL (sidebar in Arabic, 108 businesses
    loaded, view populated). Clean.
(B) GLOBAL SEARCH (#gsearch → runGlobalSearch → #gres, gGo) against real data:
    · a 6-letter fragment of a real company name → 1 result, a Lead whose label contains it;
    · gGo(0) navigated to exactly that record (page=leads, openLead = the searched id, the card shows its name,
      dropdown closed) — the search-to-record path is correct;
    · a nonsense query → 0 results and the Arabic no-match line (the 2026-09-02 "chrome in Arabic" fix holds);
    · a broad query → 277 matches, and the dropdown ends with the Arabic cap hint "يُعرض 14 من 277 — أضف كلمات
      للبحث لتضييق النتائج" — the 2026-09-03 "show the cap, say how many are left" fix holds.
    0 JS errors. **0 findings, 0 defects.**
LESSON, recorded so it is not repeated: my probe first flagged the cap hint as MISSING — twice. First cause: a
guessed wording regex (/أكثر|المزيد|more/) that never included the real "يُعرض … من …"/"showing … of …"; second
cause: a 160-character truncation of the dropdown text that cut off the hint, which is appended AFTER the 14
items. Both were probe bugs, caught by reading the code and then the literal text before believing the flag.
Rule 7 note: the console dropdown tail contained real company names; only the Arabic chrome fragment is quoted
here. No new oversight commits (HEAD 7bcccfe).

## Routine fire #44 (2026-09-14 18:11 UTC) — PHONE WIDTH driven live for the first time (400px, EN+AR, real DB): fits everywhere, v75 title regression absent
An untested AXIS rather than a page: every live drive this session ran at 1440px, yet js/51 (v75 phone-fit) exists
because "most of the team opens this on a phone", and its two past defects (an 18px-wide page title, a crowded top
bar) only ever showed in a screenshot. So: the merged app at 400×850 (isMobile, touch, 2× DPR) against the REAL
database, EN then AR, all 15 pages, read-only (scratchpad/live-phone.mjs).
- **30 of 30 renders fit**: scrollWidth == clientWidth == 400px on every page in both languages — the body never
  scrolls sideways; 0 blank views, 0 NaN/undefined, 0 JS errors. The login form fits too.
- The phone layout is engaged on every page: sidebar off-canvas (0px on screen) behind a menu button.
- The v75 regression closed BY EYE, exactly as that layer's header says it must be: EN Finance at 400px shows the
  menu button, the title "Finance" at full readable width, search, language toggle and avatar — nothing crowded
  or clipped; the 8 finance tabs wrap into rows, KPI tiles stack two-per-row, and the money figures are the same
  as desktop (2.03M / 1.54M / 492.6K / 46 — M1-clean). AR Clients at 400px mirrors correctly for RTL (menu on the
  right, "العملاء" full width, toggle/avatar on the left), stat tiles/chips/filters stack and wrap cleanly, the
  client list renders right-aligned with Arabic names prominent. (My numeric title-width probe used a guessed
  selector that did not match — hence the visual close; recorded so the next person does not repeat it.)
**0 defects.** Screenshots stay in the ephemeral scratchpad; nothing real committed (rule 7). No new oversight
commits (HEAD e6ce555).

## Routine fire #43 (2026-09-14 16:11 UTC) — the MANAGER role driven LIVE for the first time: grants, bounces and the "manager can't touch an admin" rule all hold
Closed the last "every role" gap. Fire #15 drove a team_member live; fire #28 verified the manager's grants at the
data level; no manager session had ever been driven in a browser — and js/31 carries a security-relevant rule for
exactly that role (a manager gets NO buttons on an admin's row, and "Send reset link" is admin-only, per the
2026-08-22 password-recovery hardening). Same reversible pattern as #15: the QA account (id 096eec1a…) was set to
role=manager with the real manager's exact 10-page "editor" grant (fire #28's shape), driven, then restored.
Live, against the REAL database (scratchpad/live-manager.mjs, typing-speed sign-in, REST + edge-function hosts
bridged; read-only — nothing clicked on Team & Access):
- role=manager · matrix loaded · myAllowedPages() = exactly the 10 granted pages · sidebar leaks 0 ungranted pages.
- All 10 granted pages render (today/leads/clients/finance/offers/events/airlines/activity/archive/settings) — no
  blank, no NaN. All 5 ungranted pages (documents/ops/reports/vendors/sopsla) bounce to Today.
- Team & Access as a manager (served by the admin-users edge function): 11 rows (2 admins, 9 others). The js/31
  rule HELD on every row — **0 toggle/reset buttons on any admin row, admin role selects disabled, "Admin accounts
  are managed by an admin" shown; 0 "Send reset link" buttons anywhere ("Sending is admin-only" shown); on/off
  toggles present on non-admin rows.** A manager cannot reach an admin's account or anyone's password reset.
- 0 JS errors. **0 findings.**
QA account RESTORED immediately after, verified by the returned row: role=admin, active, page_access NULL —
identical to before. With #15 (team_member) and the admin sessions throughout, every role in use has now been
driven live. **0 defects.** No new oversight commits (HEAD 6d78242).

## Routine fire #42 (2026-09-14 14:12 UTC) — deploy pipeline CONFIRMED serving the latest commit (20/20 READY); the Today follow-up queue's "0" verified honest
Two checks. (1) The mandate's "confirm directksab2b.com serves it" — skipped all day because the sandbox cannot open
URLs. Done properly this fire via the Vercel deployment record (project prj_LghpWu3B…, team_BMrljqAG…): the latest
PRODUCTION deployment is READY and its GitHub commit SHA is 31d2262… — exactly the latest push (fire #41) on
claude/new-session-9fhlp1. All 20 listed deployments are state READY / target production, one per commit pushed
today, every commit GitHub-"verified" — **20 consecutive auto-deploys, 0 failures**, rollback candidates intact. The
served app bytes are unchanged (the last index.html/js commit is 1b5cdc6, before today — all of today's commits
were docs + tests), which is exactly what should be true. Pipeline healthy and current.
(2) A fresh user-impacting data check: the Today page's "MY QUEUE 0" / "Nothing urgent" — would a silently missed
follow-up hide behind that zero? Real DB: 78 active leads (80 − 2 lost), **0 carry any next-action date** (0 in the
next_action_date column, 0 in raw nextActionDate/nextAction) → 0 overdue, 0 due today, nothing to surface. So the
zero is HONEST — no follow-up is being missed; the app shows 0 rather than inventing urgency (consistent with the
"no manufactured alarms" doctrine, fire #27). The real observation is ADOPTION, not a defect: the next-action field
is unused across the whole active pipeline, so the follow-up queue cannot do its job until the team starts
scheduling next actions on leads. Noted for the owner — a working habit, not an app change.
**0 defects.** Read-only. No new oversight commits (HEAD 31d2262).

## Routine fire #41 (2026-09-14 12:13 UTC) — the Expenses-tab timing flag CLOSED with real-data evidence: cold 441ms / warm 64ms, nothing over the guard
The post-fix battery left one open question: audit-finance-tabs tripped its 800ms freeze guard on the EN Expenses
first open (828ms) — real regression or sandbox noise? I had written "needs a stopwatch on the live site"; in fact
it can be measured in-browser against the REAL database through the live bridge, so this fire did exactly that
(scratchpad/live-fin-timing.mjs — same settle-to-stable method as the probe, elapsed from finGo() to stable
content, all 8 Finance tabs, EN cold → EN warm → AR, read-only). Real data, this container:
- **EN cold Expenses: 441ms** (45% under the guard) · EN warm Expenses: 64ms · AR Expenses: 66ms.
- Cold opens: overview 186, clients 74, ledger 67, reports 70, import 245, expenses 441, proofs 488, b2c 437 ms —
  every warm/AR open 63–124ms. The last three tabs carry a normal one-time first-open cost (js/45 + S5 expense
  rollup initialising), then settle to ~65ms.
- **0 of 24 measurements over the 800ms guard. 0 JS errors.**
VERDICT: the 828ms was NOT the live app. It came from the mock harness's heavier synthetic finance seed plus
shared sandbox CPU, landing at the guard's edge (823–828 both times) — a harness/environment property, not a
js/45 regression. The flag is CLOSED: no app change warranted. audit-finance-tabs is deliberately left UNTOUCHED —
its guard is real (built after genuine tab freezes) and retuning a freeze guard on sandbox mock numbers is the
owner's / Claude Code's call, not mine; the honest note for them: in this sandbox that probe will read ~825ms on
the mock Expenses cold open and stay borderline-red until either the guard is made environment-aware or the mock
seed is lightened. Read-only. No new oversight commits (HEAD af0bdc7).

## POST-FIX BATTERY (2026-09-14, run 10:25→11:56 UTC): 186/186 ran, 184 green — today's 3 fixes confirmed; 2 new reds run down (1 flake, 1 borderline perf guard — flagged)
Re-ran the whole battery AFTER all of today's fixes to get the definitive log (pre-fix log kept separately).
- **186/186 ran, 0 missing, 184 green.** The 3 pre-fix reds (targets-attacks, backup-supabase, people-bridge) are
  now GREEN in a full run — the unroute-identity and no-network-noise fixes are confirmed at battery scale.
- 2 NEW reds, both of which had passed in the pre-fix run. Isolated re-runs settle them:
  · probe-leads-dash-tiles — **passes in isolation (exit 0, 9/9)**. Two passes, one fail: a TIMING FLAKE. The probe
    creates a lead and relies on a hard-coded 22s wait around js/35's "re-asserts table copies for ~20s" window
    before checking "New this month" — a race that can flip on a slow moment. Not an app defect. Recorded as
    known-flaky; NOT altered (the exact race window is the probe author's call, not a blind wait bump).
  · audit-finance-tabs — **fails deterministically on exactly one check**: "EN expenses: slow tab switch — 828ms
    (freeze-class regression)". The guard is `elapsed > 800ms` (line 171), built after real tab-freeze regressions.
    EN Expenses FIRST open measured 823–828ms both times (28ms / 3.5% over); every other tab settles in 130–450ms
    and the SAME Expenses tab's second (Arabic) open is 140ms — i.e. a cold-open cost sitting at the guard's edge
    in this shared sandbox. FLAGGED, deliberately NOT silenced: raising the threshold would weaken a guard that
    exists for a reason, and the live site cannot be profiled from here. For the owner / Claude Code: measure the
    Expenses tab's first open on directksab2b.com; if it is ~0.8s there too, the js/45 + S5 expense-rollup cold
    path has grown and deserves a look; if it is well under, this is sandbox speed and the guard is fine as is.
    Either way it is a 28ms margin, not a freeze.
Net: the app is clean; the battery is lit; one small, honest performance question is open for a human with a
stopwatch on the real site.

## FULL BATTERY — FINAL REPORT (2026-09-14, run 08:52→10:24 UTC): 186/186 ran; effectively 186/186 GREEN after today's fixes
The first complete run of the whole battery in this environment (per the mandate: "if nothing is left to test,
re-run the full battery and report"). Counting by each probe's own exit code (the only honest signal — see the
false-positive note in fire #40):
- **186 of 186 probes ran (0 missing files). 183 green in-run. 3 red in-run.**
- The 3 reds are EXACTLY the pre-fix runs of probe-targets-attacks, probe-backup-supabase and probe-people-bridge
  — the battery executed the OLD files before each fix landed. All three were run down to cause, fixed, and
  individually re-run green: targets-attacks ALL PASS, backup-supabase OK, people-bridge OK (exit 0 each).
- Therefore the effective result after today's work is **186/186 green** — the regression net is, for the first
  time in a reprovisioned container, fully lit and fully passing.
Reading the day honestly: NONE of the reds were app defects. Every one was test-infrastructure — things that had
made the safety net silently blind: dead glob routes (183 probes), the events time-bomb (fixed seed dates), bare
playwright imports (5), the unroute-identity bug my own conversion introduced (3), and no-network noise counted as
script errors (people-bridge + 56 hardened). The app itself stayed clean throughout, consistent with the 38
verification rounds before it.
How to run it here: `env -u HTTPS_PROXY -u HTTP_PROXY node scripts/qa/<probe>.mjs` (chromium otherwise routes
localhost through the egress proxy and hangs); give the Generator attack suite ≥420s. Wall clock for all 186: ~91 min.

## Routine fire #40 (2026-09-14 10:11 UTC) — the FULL 186-probe battery running for the first time here; a 4th hidden defect (my own) found and FIXED: unroute-by-identity
The full battery (launched at the end of fire #39, per the mandate's "re-run the full battery") reached 165/186 during
this fire: **163 green, 2 red** — counting by each probe's OWN exit code. (A first glance showed 13 red; 11 of those
were my counter matching the probes' summary line "FAILS: 0 / 23" — they had passed. Exit code is the truth.)
The 2 genuine reds, run down to cause:
- probe-targets-attacks (6 failures, all cascading from "after confirming, the stored target is …" — a finance-target
  save not persisting) and probe-backup-supabase (4 failures — the local→app_state_bak migration never completes:
  not marked complete, keys not cleared, rows absent).
- ROOT CAUSE — a defect I introduced in fire #39's conversion: both probes register a table-specific route
  (finance_targets / app_state_bak) and later call p.unroute(...) to lift it. Playwright lifts a GLOB by string
  value but a PREDICATE by function identity; my sed produced a fresh arrow function at every site, so the unroute
  never matched, the stub stayed active, the save/migration kept being intercepted, and every downstream check
  cascaded. With the original globs it worked; with inline predicates it silently could not.
- FIX (the correct Playwright idiom): one memoized predicate per host-string, shared by route() and unroute()
  (`const __rtm={}; const __pred=(s)=>(__rtm[s]||(__rtm[s]=(u)=>u.href.includes(s)))`), applied to ALL 3 battery
  probes that unroute — targets-attacks (2 unroutes), backup-supabase (1), and probe-false-success-commit (1),
  which carried the same latent bug without yet having failed. 0 inline predicates remain in those files; syntax
  checked; check-structure + check-probe-integrity OK.
- VERIFIED — all 3 re-runs green, 0 failures, exit 0 each: **probe-targets-attacks ALL PASS** (previously 6
  failures), **probe-backup-supabase OK** ("tag/restore/delete are real Supabase writes, migration never loses
  local data"; previously 4 failures), **probe-false-success-commit OK** (the latent third, confirmed). Both
  battery reds are therefore resolved. NOTE: the running battery executed the OLD versions of these files; its
  final tally must be read with that in mind (its 2 reds are the pre-fix runs).
No app change. Test files only. No new oversight commits (HEAD c41389c).
THIRD BATTERY RED (surfaced at 170/186): probe-people-bridge — "5 unexpected JS/console error(s)" while ALL 12 of
its functional checks passed (the js/72 bridge attaches people from the contacts/activities tables, shows them,
is idempotent, writes through). Ran it down: every one of the 5 is
`console: Failed to load resource: net::ERR_NAME_NOT_RESOLVED` — DNS failures for an EXTERNAL asset this probe
does not stub (the company-logo images; sibling probes abort that host), because chromium in this container has
no external network. Resource-load failures, NOT JavaScript errors, NOT an app defect — the app degrades
gracefully without the logos. The probe's noise filter (`!/TUNNEL_CONNECTION/`) predates the no-network
container and counted them as script errors. FIXED: filter now ignores `net::ERR_*` like probe-fullwalk does;
`pageerror` (real JS exceptions) is still captured in full. **Re-run: people-bridge OK, exit 0.**
So all 3 battery reds are resolved: targets-attacks, backup-supabase (unroute identity) and people-bridge
(no-network noise).
HARDENING of the same latent bug: 56 more battery probes carried the identical narrow filter (they pass today
only because they never load that unstubbed asset — the next one would fail the same way). Applied the one safe
generic change — prepend the single alternation `net::ERR_|` to whichever noise regex already contains
TUNNEL_CONNECTION, leaving every other alternation and variable name intact (the lines were NOT uniform, so no
blind copy). 56 files, 0 syntax breaks (node --check on each), 0 narrow filters remain, gates OK. VERIFIED: the
5-probe diverse sample re-run is **5/5 green, exit 0 each** — no-vat-display (M1 guard), csv-injection,
finance-invariants, leads-counts, client-card-ar. The hardening broke nothing.

