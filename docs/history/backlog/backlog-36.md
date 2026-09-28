## 15i · Full Finance audit as QA admin: two real bugs found and fixed — 2026-08-20

Owner asked for a hands-on click-through of every Finance page as the QA admin account
specifically (not the Othman/manager session used for earlier rounds), checking every export
button's actual columns against its label, any corporate/individual filter anywhere in the
app, and duplication. Two genuine bugs found and fixed, both verified live against the real
backend before and after:

1. **Ledger's own "⬇ Excel (CSV)" button was silently exporting the wrong thing.** This file
   (`js/16-finance-ledger.js`) defined `window.finCSV` twice — once for the Ledger's own
   line-level export, again further down for the Report Builder's grouped-summary export.
   The second definition silently replaced the first, so the Ledger's button either did
   nothing (if Report Builder had never been opened that session — `FIN._lastReport` would be
   undefined and the function returns early) or downloaded the Report Builder's last grouped
   report instead of the invoice rows on screen. Fixed by renaming the Ledger's own function
   to `window.finLedgerCSV` and pointing its button at the new name; the Report Builder's
   `finCSV` is untouched. Verified live from a cold session (Report Builder never opened):
   the Ledger button now downloads `direct-finance-YYYY-MM-DD.csv` with the correct
   invoice-level header (`invoice_date,invoice_no,zatca_dpin,client_group,...`), and Report
   Builder's own export still works unchanged.

2. **The "Who can open what" access-matrix panel (`js/56-access-matrix.js`) was leaking onto
   Finance › Performance.** Its `paint()` only meant to render on the Settings page, gated by
   a regex (`/team|access|الصلاحيات/i`) scanning the *entire rendered page text* for those
   words — a guess at "is this the Team & Access page," not an actual check. Finance ›
   Performance has an unrelated flag sentence that happens to contain the word "team" ("...
   revenue belongs to the commercial team"), which was enough to trigger it: the full
   employee permissions grid, with live database-writing "Save access" buttons, was rendering
   at the bottom of the revenue dashboard for any admin. Fixed by gating on `current==='settings'`
   instead — the same page-identity variable every other view branch in the app already
   checks. Verified live: gone from Finance › Performance (screenshot confirms a clean page
   ending at the Monthly revenue & profit chart), still renders correctly on Settings, and a
   sweep of every other Finance sub-page (Clients & collections, Expenses, Payment proofs,
   Individual bookings, Report Builder, Import) confirms it was never leaking anywhere else.

Also confirmed, not a bug to fix: there is **no "corporate expenses" filter anywhere in the
app** — checked the Expenses page directly (only "All months" plus the two export buttons)
and swept every Finance page and the Clients page for any corporate/individual control. The
closest thing is Report Builder's "Record type" group-by option (B2B/B2C totals), which is a
reporting axis, not a filter, and isn't on the Expenses page. Owner is relaying this to
Abdulrahman directly in case he's remembering an older build. Also flagged, not built:
Individual bookings has no export button at all, unlike every other Finance sub-page — real
money, no way to pull it into a spreadsheet. Owner is taking this to Abdulrahman as a
recommendation rather than treating it as a fix (it's a new feature, not broken behavior).

Regression script added: `scripts/qa/verify-audit-fixes.mjs` — checks the Ledger export both
cold and after visiting Report Builder, checks the access panel is absent from Finance and
every Finance sub-page while still present on Settings, and re-confirms Report Builder's own
export still works. Green.

## 15j · CRM audit round 2 (Today/Leads/Clients/Proposals) as QA admin — 2026-08-20

Same method, extended past Finance: click through as QA admin, compare against the
Othman/manager session, verify everything live. Admin and manager see identical controls on
Today/Leads/Clients/Proposals (the admin-only surface is Settings and Finance, not the CRM
pages). Two real, owner-approved fixes shipped; two more flagged but deliberately left alone
(owner's call — judgment questions for Abdulrahman, not unilateral fixes):

1. **Today's top-bar Export menu had the exact same bug Finance had before its own fix** —
   all four options ("CSV - summary", "CSV - full details", "Excel - summary", "Excel - full
   details") silently downloaded the whole-database JSON backup, because `exportCurrent()`'s
   per-page column map has no `'today'` entry. Owner's call: there's genuinely nothing
   tabular on Today to export, so the fix is to hide the menu on that one page rather than
   invent a CSV for it. New file `js/60-today-export-hide.js` toggles `.exp-wrap`'s
   visibility on every render, keyed off `current==='today'` — the menu lives in the
   persistent top bar outside `#view`, so nothing rebuilds it on a normal page render; it has
   to be toggled explicitly, same pattern `js/56`'s access panel already uses. Verified live:
   gone on Today, present and working on Leads/Clients/Proposals/Finance, toggles cleanly
   both directions on repeat navigation.

2. **Proposals had two client-picker dropdowns doing half the same job.** The header "Client"
   field (`o_setClient`) correctly links a proposal to the client's own record
   (`linkedLeadId`) as well as setting the display name. A second dropdown lower on the same
   form — "Load a corporate client's negotiated deal & pricing" (`o_loadClient`, in
   `js/core/core-05-records.js`) — only ever set the display name. Picking a client through
   that one alone made the proposal *look* linked but it wasn't: it would never show up on
   that client's own page (`offersFor()` filters by `linkedLeadId`). Owner's call: fix the
   real bug (make it link the same way), leave the "should it warn about overwriting an
   existing link" question for later. `o_loadClient` now sets `o.linkedLeadId=id` alongside
   the existing name + pricing/deals note. Verified live end-to-end: picked a client through
   *only* the pricing dropdown, confirmed `linkedLeadId` was set, then confirmed the new
   proposal actually appears in `offersFor(client.id)` — the exact list the client's own
   detail page reads from — not just a display-name match.

Flagged, not touched (owner is taking both to Abdulrahman directly, not bugs to squash
unilaterally): Leads has a third export button (funnel-aware, respects the active filter tab)
on top of the two top-bar options — genuinely useful but no cue which of the three to use,
and two look identical on screen. And Today's "🔴 2 failed syncs / 🔌 2 integrations need
attention" alert strip is entirely synthetic demo data (hardcoded so two integrations always
show failed, unrelated to anything real) — reads exactly like a live operational problem with
no way to tell it's fake from the screen.

Regression script: `scripts/qa/verify-audit-round2-fixes.mjs` — confirms Today's Export menu
hidden (and stays hidden on repeat visits) while every other page's stays working, and proves
the Proposals fix with the real client-page link check, not just the field value. Green.

## 15k · Blanket bug-fix authorization: Leads export relabel + fake sync alert hidden — 2026-08-20

Owner's standing update: audits no longer need a sign-off round per finding — genuine bugs,
broken exports, misleading/fake elements and confusing duplicate UI found this way get fixed
on sight, verified live, and reported after. Subjective product/design calls still get
flagged first; this round had none. Closed the two items held back from round 2:

1. **Leads' third export button, relabelled instead of removed** (owner's own earlier
   preference, since it's genuinely more useful for its one job — funnel-aware, respects the
   active filter tab, carries funnel answers/next action/contact info the top-bar export
   doesn't). It used to say the same bare "Export CSV" as the top-bar menu next to it, so the
   two read as duplicates. `js/09-funnels.js`'s button now reads "↓ Export this view (CSV)"
   with a tooltip explaining the difference and pointing at the top-bar menu for an unfiltered
   export. Nothing about what either button actually does changed — text and a tooltip only.
   Verified live: new label + tooltip present, the button still exports the funnel/filter it's
   scoped to, and the top-bar menu on the same page is unaffected.

2. **The fake "🔴 N failed syncs / 🔌 N integrations need attention" alert on Today, hidden.**
   Confirmed the whole strip — not just the two visible counts — is backed entirely by
   `migrateV20`'s one-time seed (hardcoded so Kiwi always shows "down" and ZATCA always shows
   "token expired") plus a few "simulate this action" demo helpers; nothing real ever writes
   to it. Owner's call, given the choice between hiding it and labeling it "demo": hide it —
   a labeled-but-still-red alert would keep drawing attention it doesn't deserve, and it isn't
   actionable either way. New file `js/61-hide-fake-sync-alert.js` hides `.v20-alert-strip`
   wherever it appears, via a MutationObserver rather than a timing guess (the strip is itself
   injected by another script's own `setTimeout` after render, so racing a fixed delay against
   it would be fragile). Deliberately scoped to just the homepage strip — the per-record sync
   log and conflict-resolution tools on an individual invoice or booking are untouched, in
   case that mock system becomes a real integration later. Verified live: strip present in the
   DOM but `display:none` on first load and on a second, separate visit to Today; the
   untouched per-record functions (`openSyncLog`, `openConflict`) still exist.

Regression script: `scripts/qa/verify-audit-round3-fixes.mjs`. Green.

## Arabic sweep result — 2 real gaps fixed, rest triaged — 2026-08-21

An independent Arabic-coverage sweep (35 raw untranslated-string hits across 9 pages) broke
down as: ~two-thirds industry acronyms that correctly stay Latin (NDC, API, ZATCA, EMD — not
bugs); two genuine daily-use gaps, fixed same day; and one deliberately-deferred block. Fixed:

1. **Today page hero date** — rendered "Today · Aug 21, 2026" in English regardless of app
   language. Root cause: it built the date via the shared `fmtDate()`, whose
   `toLocaleDateString(undefined, ...)` is locale-agnostic (not tied to the app's `LANG`
   toggle), inside a compound `<h2>` (dynamic date text + a nested Hijri `<span>`) that the
   Arabic post-translate pass (`js/21-v27-...`) can't structurally match against a static
   dictionary key. Fixed locally in `renderToday()` — "Today"/"اليوم" and the Gregorian date
   now format directly against `LANG`, scoped to this one hero. `fmtDate()` itself untouched
   (used elsewhere; changing it globally was out of scope of the reported gap).
2. **Clients page "Health" column header** — every other header in that row (Client, Account
   manager, Tier, Client since, Next review) was already in the v27 Arabic header dictionary;
   `Health` alone had no entry, so it fell through untranslated. Added `'Health':'الصحة'`.

Verified in the QA harness, EN+AR, zero console/JS errors. Commit `be6a22b`.

**Deferred on purpose, not a launch blocker:** the 14-item developer/admin list under
Settings (Generator templates, Re-learn from templates folder, Show learned tokens, Tag
current state, Performance, Security & integrity, View hash report, Wipe local data,
Accessibility audit, Internationalization, Toggle English, Developer / test harness, Run a
day, Wipe test records) renders as literal English in Arabic. Diagnosis already done, so this
is a ten-minute fix whenever `js/core/core-06-v18-v21.js` is next touched, not a rediscovery:
Arabic already exists for most of it in that file's own dictionary (`'Performance':'الأداء'`,
`'Security':'الأمان'`, `'Run a day':'تشغيل يوم اختبار'`, `'Wipe local data':'محو البيانات
المحلية'`, …) but sits unused for two reasons, both needed together: (1) the Security card
template (~line 1023) emits the English strings literally with no lookup wrapping them at
all; (2) even wrapped, the rendered strings wouldn't match the dictionary keys as written —
the heading reads "Security & integrity" against key `'Security'`, and the button reads
"🗑 Wipe local data" (emoji prefix) against key `'Wipe local data'` — so a naive exact-key
lookup would still miss. Whoever fixes it needs to normalise the emoji/suffix or align the
keys, not just add a lookup call. Not fixed now because it's admin/developer tooling, not a
screen any employee hits day to day.

## S3–S5, the full series — done, 2026-08-20

Started from the wallet-top-up scope conversation, ran through a real live bug the owner
caught within hours of shipping (wallet top-up reachable as a Finance service label — closed
everywhere the shared catalog feeds), a genuine cross-import double-counting gap in the real
importer (S4), and closed with a display-only audit view (S5) — six real, hands-on-verified
fixes total across this arc: payment proofs (audit document register), individual bookings
(the fifth revenue pattern), the wallet-label close, the Finance export-button fix, the
Ledger delete z-index fix, the transaction/invoice twin resolution, and the expense roll-up
display. Every one fingerprinted before, diffed after, and proven against the real backend —
not the mock — with the money always landing back on the exact same baseline once each
probe's test data was removed. Next open item, not urgent: the export-freeze report (§15e)
that couldn't be reproduced despite a real stress test.

## Watch cycle 41 — a write must refuse while the exclusion list is unknown

**Landed.** `finExclusionsReady()` and `finExclusionGate()` in js/62; `v65Commit` in js/65 now
refuses and says why when the list has not loaded. Guarded by
`scripts/qa/probe-exclusion-not-loaded.mjs` (port 8720, added to `battery.txt`). Sabotage —
removing the gate call — reddens 2 of its 4 checks with the excluded client's invoice written.

**Open, and the reason cycle 42 exists — the gate is on the wrong side of the decision.**
`probe-importer-attacks` went red under six-way battery load this cycle (green standalone, green
in cycles 39 and 40, green standalone again with this cycle's diff in the tree — so this is the
defect surfacing, not a regression). What it caught:

    ✗ Excluded by rule count not 3   (preview named 2 — only the two bad-date rows)
    ✗ exclusion not named in preview
    ✗ excluded partner row was written

The excluded partner **was written** — so `finExclusionGate()` did not fire, so `DB.settings` was
non-empty at commit time. The exclusion decisions had already been made in the **preview**, before
the blob landed. The gate asks "is the list loaded *now*"; the rows being written were sorted
under a list that was not loaded *then*. A stale preview passes a gate that only looks at the
present.

The fix is the chokepoint principle, not a bigger predicate: re-run the exclusion check at commit
over the pending rows, so the decision that gets written is the decision made against the loaded
list. Stamping readiness at preview time and comparing at commit is the weaker alternative — it
refuses correctly but re-checking is what makes the preview and the write agree.

**Also still open:** js/41 shares the same `finExclusionCheck()` fail-open and is outside this
lane. Six call sites across four files (js/16, js/31, js/41, js/62, js/65) read the same null as
"safe to proceed".

**Closed this cycle:** `probe-premortem-attacks` check H, which timed out in cycles 38, 39 and 40,
passed here at the 90s budget set in cycle 39 — including under six-way load. The flow does make
progress; it was genuinely slow, not stuck. No further budget increase, and the item is done.

## Watch cycle 42 — cycle 41's guard could not fire, and the battery proved it

**Cycle 41's gate was inert in the running app.** It discriminated on
`Object.keys(DB.settings).length`, treating an empty object as "the app_settings blob has not
landed". Measured directly this cycle, with the `app_settings` response held back 25 seconds:

    DB.settings keys        ["lang","currency","funnels","funnelSubs"]
    finExclusionsReady()    true
    finExclusionCheck(...)  false

js/09's `ensureFunnel()` writes `funnels`/`funnelSubs` unconditionally at load and the app sets
`lang`/`currency` for itself, so `DB.settings` is never empty by the time anyone can press a
button. **The guard read "loaded" at exactly the moment the list was absent.** Cycle 41's probe
passed only because it forced `DB.settings = {}` by hand — a state the app is never in. A guard
verified against a world constructed to suit it is the failure this whole arc has been removing,
and it happened here.

What forced it out: `probe-importer-scale-attacks` red under six-way load with *"an
excluded-client invoice was written"* — the gate had not fired, so `DB.settings` was already
non-empty at commit.

**Fixed by asking the server instead of inferring.** `finExclusionGateRows(rows, cb)` in js/62
reads `app_settings` and checks the rows about to be written against the server's own list;
`v65Commit` routes through it and refuses the batch **whole** on a match, on a read error, on no
settings row, and on a read that never answers (its own 20 s timeout). Fail-closed. No page state
is trusted to answer the question, and the check now sits at the last point before the database
rather than at the top of the function, so a preview made blind cannot be committed later.

`probe-stale-preview-exclusion` (8718) holds the stale-preview case; `probe-exclusion-not-loaded`
(8720) was **rewritten** around the real guarantee. Both sabotage-verified, restored byte-identical.

**Two of my own probe checks passed for the wrong reason and were hardened:**
- the hang check waited 4 s after Confirm, but the gate gives the read 20 s — it read "nothing
  written" from a commit that had not got there yet, and passed while the guard was disabled. It
  outlasts the timeout now, and the sabotage reddens it.
- a flat 2500 ms wait for the login form: twice the control failed with `preview="dropped"`
  because the 68 blocking scripts had not finished. Waits on conditions now, 90 s.

### Open for cycle 43

**`probe-premortem-attacks` check H — cycle 41 closed this too early, on one green run.** It is
red again under six-way load (green standalone). More importantly the failure was mischaracterised
for four cycles: *"cost is 12605, expected 750"* is a **wrong value arriving, not a late one**, so
raising the poll budget was never going to be the fix and must not be tried a fourth time. Find
where 12605 comes from — the invoice carries it from an earlier attack in the same run, so the
question is whether session 2's lines-only drop fails to apply or whether the read is stale.

**`probe-client-group-map` — a new surface with the same fail-open.** Red in this cycle's first
battery: *"EXCLUSION LEAK: the alias picker offers excluded client(s) as merge candidates —
`groupCandidates()` is not applying finExclusionCheck"*. It is a display surface, so the standing
rule says it may degrade to "not checked yet" rather than refuse — but it must not silently offer
an excluded client for merging. Green in the verification battery, so it is load-dependent, which
is the tell for this whole family.

**Still outside the lane:** js/41's `finExclusionCheck()` fail-open. Note that the write path is
now covered regardless — the invoice-export signature is parsed by js/41 and committed by js/65,
and the commit-time re-check catches anything js/41's preview let through.

## Watch cycle 43 — the display half, and a predicate that can actually be false

**One wrong idea had been holding up two guards.** Cycle 42 found that
`Object.keys(DB.settings).length` is never 0 in the running app (js/09's `ensureFunnel()` fills
`DB.settings` at load) and fixed the importer by asking the server at commit time. It left the
same dead predicate behind `settingsLanded()` in js/62 — so **cycle 40's merge-dialog refusal had
never fired either**. Measured with the `app_settings` response held back from boot:

    DB.settings keys        ["lang","currency","funnels","funnelSubs"]
    finExclusionCheck(...)  null        ← the list is genuinely absent
    settingsLanded()        true        ← the guard says it has landed

**Landed.** js/62 gains `finExclusionsKnown()`, answered two independent ways because neither
alone covers both cases: `DB.settings.financeExclusions` being an **array** (the blob landed
carrying the key — instant, free, true for any workspace that has configured an exclusion), or a
one-shot read of `app_settings` at startup (the only thing that separates *no exclusions
configured* from *not loaded yet* in a workspace that has none). `settingsLanded()` now rests on
it, and `finExclusionCheck()` also consults the authoritative copy, so it answers correctly in
the window before js/35 merges the blob.

Two surfaces caught red under load in cycle 42, both fixed and both verified against a real slow
boot rather than a hand-built state:
- **The alias picker** (`groupCandidates`, js/62) returns nothing while the list is unknown, and
  `v62OpenAddGrouping` says why. An entry in that list is an **offer to merge two company
  records**, and merging is a write — so it sits on the write side of the standing rule, not the
  display side. Listing everything would offer a standing-excluded partner on the screen that
  decides which record survives.
- **The Clients tab** (`rFinClients`, js/16) renders a "not checked yet" card instead of the
  table. It is money grouped *by client*; built before the list lands it showed the excluded
  partner as an ordinary client with its money counted. js/62's own load re-renders the page the
  moment the list arrives, so the degraded state clears itself.

`probe-exclusion-display-attacks` (8714) holds all of it, including a control proving the guard
lets go once the blob lands. Sabotage — `finExclusionsKnown()` returning true unconditionally —
reddens three checks. Restored byte-identical.

**My own cycle-42 probe stopped setting itself up, which was the app getting better.**
`probe-stale-preview-exclusion` blinded the preview by emptying `DB.settings`; with js/62 holding
its own copy that no longer blinds anything. Reshaped to hold the `app_settings` response back
from boot so **neither** copy exists — and then a second trap: a fresh *page* in the same browser
context starts life already knowing the list, so the attack needs its own **context**. Two
mechanisms that each made the attack silently stop being an attack.

Its fixture-marker boot guard also produced a false red twice on runs where the list had
demonstrably arrived (the control below it passed both times, and cannot pass without one). It
waits on the fact the probe actually depends on now, and the control carries the assertion.

### Open for cycle 44

**`probe-premortem-attacks` check H — diagnosed, not yet fixed.** 12605 is invoice 116361012's
own seeded cost, and 116361012 appears nowhere else in that probe. So the value is not
contamination from an earlier attack: **session 2's lines-only drop simply never applies**, and
the invoice keeps what it started with. Three cycles of budget increases were treating a write
that does not happen as a read that is late. It is an existing `probe-*-attacks` file outside
this lane, so this is a write-up: the question is whether the gate row from session 1 is found
after the reload, or whether the commit is refused.

**Watch: cycle 42's gate refuses on a slow `app_settings` read.** It allows 20 s and then writes
nothing. That is the intended fail-closed trade, but it means a genuinely slow morning turns a
legitimate import into a refusal the person must retry. If that is ever seen in the wild the
answer is a longer wait, not a fall-through.

**Load-only flake to watch:** `probe-crm-attacks` went red in this cycle's first battery on four
Arabic checks (an Arabic switch that did not complete under contention); green standalone, green
in three prior batteries.

## Watch cycle 44 — the dropdown that decides membership of a page it knows nothing about

**A new area, and a real defect on the first attack.** "How did this revenue arrive?" (js/25) is
the only write in that file and nothing had ever attacked it. It is careful about everything this
session has taught it — guards the function and not just the button, chains `.select()` and
refuses to claim a save the database did not confirm, never offers a value the row does not hold.
Nothing had asked what the value *means* once written.

js/58's own header says it: *"`revenue_way='b2c_manual'` and `record_type='b2c'` are the only
things that mark it as this pattern"* — and js/58 then lists the hand-entered B2C bookings with
`.eq('revenue_way','b2c_manual')` **alone**. So the dropdown decides membership of that page, in
both directions, and nothing made the two fields agree. Measured:

- a hand-entered booking moved to any other way **vanishes from the only page that lists it**.
  The row is still there, still counted in every total, and unreachable from the screen built to
  manage it. One dropdown, no warning, and nothing on screen afterwards to say where it went.
- an ordinary b2b invoice moved **to** `b2c_manual` appears among the hand-entered bookings while
  `record_type` still says `b2b` — a row on that page nobody entered there.

**Fixed** in js/25: both transitions are refused, naming the B2C page, what would have happened,
and — for the away direction — that a real conversion needs the record type to change too, which
this editor does not do. `probe-revenue-way-attacks` (8715) holds it, testing js/58's **own
query** rather than its rendering, so what is measured is the page's definition of its contents.
Sabotage reddens all three checks; restored byte-identical.

**A restore that quietly undid the fix.** The sabotage baseline was taken *before* the fix, so
`cp` put the pre-fix file back and `md5sum -c` cheerfully confirmed it. Caught by checking the
file for the fix's own comment rather than trusting the checksum — the checksum was right about
the wrong question. Baseline the file **after** the fix, not before.

### Open for cycle 45

**`probe-stale-preview-exclusion`'s setup loses its race under battery load** — it fails once,
honestly, with the diagnosis (cycle 43's reshaping doing its job), but it is still a red every
few runs. The evidence says `app_settings` reached the page while the route was holding it:
`DB.settings` already carried `__mockSettingsLanded` and `financeExclusions` at the moment the
file was sorted. The probe now counts app_settings requests **held versus let through** while the
hold is on, and prints both in the failure. A non-zero "through" means the response arrives by a
route the probe is not intercepting — find that route.

**js/58's query is the other half of cycle 44's defect, and it is out of lane.** It selects on
`revenue_way` alone while its own header names two fields. Adding `.eq('record_type','b2c')`
would make the page match its documentation and make the guard belt-and-braces rather than the
only thing standing between a booking and disappearing.

**Load-only flakes:** `probe-merge-dialog-money` (its own settings-race guard — cycle 37 family,
green standalone and in cycle 43's batteries). `probe-premortem-attacks` check H passed here.

## Watch cycle 45 — the harness was answering 201 to writes it never made

**Three cycles of red traced to a probe trick, and the trick was the wrong idea from the start.**
`probe-stale-preview-exclusion` needed a preview sorted without the exclusion list. Cycle 42
emptied `DB.settings` by hand; cycle 43 gave js/62 its own copy, so that stopped blinding
anything. Cycle 43 then held the `app_settings` response back from boot; measured under CPU load
this cycle, **2 requests held and the page knew the exclusion anyway**. Both were ways to
manufacture a state the app does not normally reach.

The guarantee does not need one. **The owner adds an exclusion between the preview and the
Confirm** — a file is previewed, someone rules a partner out, the file is confirmed. Same stale
preview, nothing held back, no timing to lose, and it is an ordinary Tuesday rather than a
laboratory. Cycle 42's server-read gate holds against it.

**And building that found a defect in the harness itself.** Writing the exclusion into
`app_settings` returned **201** and changed nothing — so the probe went on to report a defect in
the importer that did not exist. `mock-supabase`'s honest PATCH was gated behind an **allow-list
of seven tables** added on 2026-09-02; every other table fell through to a blanket `201 []`, an
insert-shaped no-op that reads like success. The comment above that code already named the
hazard — *"a .select()+row-count check could never fail here"* — and it had been left standing
for every table nobody had happened to need yet.

**The allow-list was the problem, not the implementation.** Honest UPDATE is the default now for
any table the mock holds, and a PATCH to a table it does not hold answers **501 by name** rather
than pretending. A harness may be incomplete; it may not be encouraging.

The probe now **reads its setup back** before drawing any conclusion. A setup step is a claim
like any other, and this one was false while looking true.

**Battery: 84 / 84 — every probe that can fail, green.** The first clean run across this arc.

### Open for cycle 46

**The new attack area cycle 45 was asked for, deferred on purpose.** The PATCH change touches
every probe in the battery, so shipping it on a fully green run is a safer unit of work than
bundling an app fix underneath it. Still untouched since cycle 36: notifications/reminders, phone
and tablet layout beyond width (numbers readable, tap targets opening the right row), the
Operations board end to end.

**Worth a look now that PATCH is honest:** any probe that PATCHed a table outside the old
allow-list was previously writing nothing and being told 201. Nothing reddened, which means
either those paths were not exercised or they were checked loosely. `probe-integrity` cannot see
this. A grep for PATCH-driven assertions would say which.

**Still out of lane:** js/58 selects the B2C page on `revenue_way` alone while its own header
names two fields; js/41 shares the `finExclusionCheck` fail-open. `sweep-buttons` crashed again
(a report — it reports nothing when it does not finish, and the runner says so on its own line).

## Watch cycle 46 — Restore was not the inverse of Delete

**The unique key is (invoice_no, line_no)**, verified against the live schema, so one invoice
number legitimately holds several rows. The invoice card's two buttons both key on the number,
and only one of them was careful about it:

    finDelInv(invNo)      .eq('invoice_no',invNo).is('deleted_at',null)      ← only live rows
    finRestoreInv(invNo)  .eq('invoice_no',invNo).not('deleted_at','is',null) ← every deleted row

So a duplicate line deleted deliberately in August came back the moment somebody deleted the
invoice in September and pressed Restore to undo it. Measured: **the round trip put 100,000 SAR
back that nobody asked for**, into every total, with nothing on screen saying three rows had been
restored where two were removed.

**Fixed** in js/16: restore the LAST deletion, not all of them. `finDelInv` stamps one timestamp
across the batch it takes, so rows sharing the newest `deleted_at` are exactly the action being
undone; anything older was a separate decision, stays made, and is **named on screen** so "why is
that line still gone?" has an answer. `probe-restore-scope-attacks` (8716) holds it — control,
the August line surviving, the money agreeing, and the message. Sabotage reddens three checks;
restored from a **post-fix** baseline and verified by hash *and* by grepping the fix's own
comment (cycle 44's lesson, applied).

**And the harness lied again, in the same shape as cycle 45 — one day later.** The fix relies on
reading the deleted rows first, and `mock-supabase` honoured `is.null` / `not.is.null` on a GET
for **`archived_at` only**; every other column's null filter was silently ignored, so the read
came back with all rows, deleted or not. The scoping was deliberate — its own comment says "every
other is.null GET keeps the old unfiltered behaviour it was written against" — which is exactly
the cycle-45 pattern: **a narrow scope chosen to avoid disturbing anyone, which then answers the
wrong thing confidently for everyone else.** Generalised to any column.

Two things that only came out by running the battery rather than the probe:
- `probe-concurrency-attacks` caught it, not `probe-restore-scope-attacks`. A *different* probe
  is what noticed that my new read was being answered loosely.
- widening the branch then broke `probe-events`: the json-path keys (`funnel_details->>event_name`)
  are not plain columns, so the generic filter read `undefined` on every row and dropped the whole
  table. Excluded and left to the loop that handles them.

js/16 now filters client-side **as well as** in the query — the server filter is what production
relies on; the local one makes the function correct even where a caller or a harness answers the
filter loosely.

**Cycle 45's other question, answered:** nothing in the battery was relying on PATCH being
dishonest. Every battery probe that PATCHes targets a table already on the old allow-list
(`businesses`, `app_users`, `finance_targets`, `finance_invoices`). The only off-list PATCH was
`probe-rls-matrix`, which runs against the live database and is excluded as credential-gated.

### Open for cycle 47

**A third harness gap of the same family is likely.** Two have now been found one day apart — PATCH
answering 201 without writing, GET ignoring a null filter — both scoped narrowly on purpose, both
found only when something happened to depend on them. Worth one deliberate pass over
`mock-supabase`'s query handling asking, for each filter operator PostgREST supports, whether this
mock honours it or silently ignores it, and making the ignored ones say so.

**Still out of lane:** js/58 selects the B2C page on `revenue_way` alone while its own header names
two fields; js/41 shares the `finExclusionCheck` fail-open.

