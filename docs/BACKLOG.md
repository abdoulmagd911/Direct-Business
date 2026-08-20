# Action items — things deliberately put on hold

## 2026-08-13 · Round 13 — GO-LIVE: the three-level access model

Abdulrahman set the model himself: three super admins (his two addresses plus Abdelrahman
Hasan, and the QA account), one manager (Othman) who may add and remove people but never
grant admin, and everyone else an employee with Leads, Clients and Finance — all editable.
Permanent passwords, handed over by him, so nobody is asked to change one on first sign-in.
All eleven accounts were signed in and out for real against the live backend.

Built: `js/52-v76-access-model.js` (the screen half), edge function `admin-users` v3 (the
server half: `roleAllowedForCaller`, `targetIsAdmin`, managers blocked from admin in five
different ways), and `probe-golive.mjs` — 181 checks across all eleven people.

Three real defects found by rehearsal and fixed:

1. **The employee sidebar hid the wrong buttons.** It mapped buttons to pages by counting
   positions, but the sidebar is built three times over (core → the v25 layer rebuilds it in
   groups → later layers append Finance and Brand). Assem lost Finance and gained Projects.
   Buttons are now named by their own wording, in English and Arabic, from the same `VIEWS`
   list that writes them. **Never count sidebar positions again.**
2. **The manager could not open Settings** — the core login layer hid that button for anyone
   who was not an admin, which contradicted the model he asked for. Now admin or manager.
3. **"Admin" was still offered in the manager's role picker.** The list arrives over the
   network, and the watcher only noticed pickers that were nested inside a newly added
   element, never a picker that WAS the added element. It now watches for any picker it has
   not trimmed yet. (The server had refused it correctly all along — this was cosmetic, but
   the kind of cosmetic that gets someone told "no" after they thought they had said yes.)

Also: the test rig no longer carries the team's passwords. This repository is public and
those are real working logins; `scripts/qa/emp-rig.mjs` now reads them from the environment
(`DB_PW_OTHMAN`, `DB_PW_RAAD`, …) and the list lives only in Abdulrahman's hands.

### Part 2 — found by rehearsing what nothing had covered

Two scenarios had never been tried: someone being switched off while they are working, and
the manager hiring somebody end to end on screen rather than through the server.

4. **Adding a teammate always invented a temporary password and forced a change on arrival.**
   That contradicts how these accounts are handed over. There is now a password box on the
   Add-a-teammate form — type one and it is permanent, leave it blank and the old behaviour
   returns. (`admin-users` v4, `js/31-v48`.)
5. **The Add-a-teammate form had its own role box the manager's restriction never covered.**
   He could pick Admin, fill the whole form in, and only then be refused.
6. **Being switched off relied on the sign-out call coming back.** On a bad connection the
   person sat on the message with the app still behind it. It now reloads either way.
7. **Employees could not write promo codes** — though promo codes are one of Finance's four
   revenue ways and employees may edit Finance. A refused UPDATE returns no error and zero
   rows, so the screen would have looked saved and not been. The policy was widened.
8. **The rehearsal was leaving its own companies in the live data.** 55 "Go-live check" rows
   had piled up on top of the real thirty. Deleted, and `probe-golive.mjs` now cleans up after
   itself. Live data confirmed back to 30 companies (20 leads, 10 clients), 28 invoices,
   5 proposals, 7 requests, 11 active people.

### Part 3 — the double-check

Asked to check it all again before handing over. Two findings.

9. **The Team screen's per-page tick boxes were a lie.** Looking for a sideways escalation —
   grant PAGES instead of a level — found no escalation (level decides on screen and in the
   database, proven), but found that "Save pages" wrote straight to `app_users` from the
   browser, which the database refuses for a manager, returning no error and zero rows. The
   button said "Saved ✓" regardless. Tick boxes and their three buttons removed; each row now
   states in plain words what that level opens.
10. **The rehearsal account is now removed properly.** `probe-handover` can only switch it off
    (there is no delete-a-person action, by design), so it was deleted by hand and the probe
    now says so in its header. Live roster: exactly 11 people, 11 logins, no strays.

Proof for the whole round: 181/181 driving the bytes downloaded from the live site itself,
14/14 on every route a manager might take to admin, 16/16 on the rebuilt Team screen, 11/11 on
the passwords exactly as they were written out.

### Part 4 — what a real browser found (Claude Cowork, on the owner's machine, 2026-08-15)

The one test this environment can never run — the real site, in a real Chrome — was handed to
Claude Cowork on a machine with a browser. It found four things; three were real.

11. **The manager's role dropdown still offered Admin — and three retired roles.** The trimmer
    marked options `hidden`, but Chrome draws dropdowns with the operating system's own menu,
    which shows hidden options anyway. Every headless check here passed; the real browser
    failed. Disallowed options are now **removed from the page** (the person's own level stays,
    disabled). The retired roles (bd / operations / viewer) no longer appear anywhere.
12. **The first seconds after sign-in leaked.** While the role check was still in flight the
    app treated "role unknown" as "no restrictions": a manager's first direct navigation fully
    rendered Reports; an employee's first landing showed the admin sidebar; switching accounts
    in the same tab briefly showed the previous person. It now **fails closed**: until the
    answer arrives everyone is held to the smallest set (Today/Leads/Clients/Finance, read-only
    finance), the previous person's identity is wiped at the start of the check, and — a second
    real bug found while testing this — a *thrown* network failure used to kill the retry loop
    entirely, leaving the person stuck at the floor forever. Both fixed (js/02 + js/52).
13. **The audit log was empty because it had nothing to say — and lied when it spoke.**
    `logAudit` hard-coded every entry to the name 'Abdelrahman', and almost nothing called it.
    New layer `js/53-v77`: sign-ins, lead create/stage/convert/rename/delete (watched from the
    data, so every path is covered), finance saves and team changes are recorded under the real
    person. NOTE the landmine inside it: `DB` is a top-level `let`, NOT on `window` — a guard
    written `window.DB` is always false and sits silent while looking alive.
14. **"Delete looks successful but doesn't delete" — NOT a bug, wrong words.** Proven end to
    end: deletion archives the row (`archived_at`), it vanishes from every employee's list, and
    admins can restore it for 30 days. The tester saw it "still fully live" through an admin
    view that shows archived rows. The confirm message now says what actually happens.

Also from that report: two-tab tests share one login (same browser profile — use a private
window), and its "switch Abdul Aziz back on" step did not actually run — he was found switched
off and restored here. Check the roster after any outside test run.

### Part 5 — the manager's own clicking (2026-08-15)

Two reports from Abdulrahman clicking through as the manager. One was the disease we already
knew; one was a theory the measurements did not support — but the measuring found real waste.

15. **The Proposals identity banner rendered twice.** Root cause: the whole identity layer
    (v46 brand link / v47 offer-to-studio bridge / v48 offers strip) existed TWICE — once as
    the extracted files `js/46-v70 / 47-v71 / 48-v72`, and once as inline `<script>` blocks a
    concurrent session had pasted straight into `index.html`. Both ran on every load: two
    banners, two Branded-offer buttons. The inline blocks are gone (149 lines); the js/ files
    are the only home. **Never paste a layer inline when a file version exists** — this is the
    third collision from that one session (Brand button, banner, offer button).
16. **"save_state_patch fires on every load" — half right, and capturing the payload proved
    the half.** The write cannot touch design (that is code in git, not state) and browsing
    writes nothing. But the on-load patch was carrying `audit` AND the whole shared
    `settings` section — ~23KB — because two layers (js/02 fetchRole and js/43-v67) still
    wrote `DB.settings.currentUser=<name>` in memory, which marked settings as changed. That
    is the "Mine shows the wrong person" leak returning through a side door: every sign-in
    stamped the shared settings with that person's name. Both writes removed; identity lives
    only in `window.__userName/__userRole/__userEmail`. Measured after: the patch carries
    `audit` alone. Rule: **capture the payload before calling a write harmless.** Also:
    `app_users` reads on load trimmed (v43 stands down once the name is known).

17. **The "15-second freeze" on Team & Access — measured, not a hang.** With a frame-beat
    counter running, opening the screen and resetting a password never stalled the main
    thread more than 47ms. The freeze is the native `confirm()` box: it blocks the whole page
    by design, and the reporting tool could not see or answer it — a person in a real Chrome
    gets a visible OK/Cancel. The place it was hit is also gone: a manager's view of an
    ADMIN row no longer offers Reset password / Switch off at all (the server refuses those
    calls, so the buttons were a confirm-box dead end) — it says "Admin accounts are managed
    by an admin" instead. Admin callers still get buttons on every row.

### Still open after this round

- The old database roles `bd`, `operations` and `viewer` still exist but nobody is on them.
  Leave them: they cost nothing, and collapsing the database enum would break history.
- Employees have no Reports page. Under the model as set, reporting is a manager/admin thing.
  Worth revisiting once the team is actually using it.


## 2026-08-13 · Round 12 — the phone pass (five roles, iPhone-sized, live backend)

Most of the team will open this on a phone, and that surface had never been tested for the
non-admin roles. Five people were signed in on a 390×844 screen and put through their day in
both languages. Nothing overflowed — but a SCREENSHOT showed two things a width check can
never catch, plus one of my own tests was measuring the wrong page.

1. **The page title was 18 pixels wide.** The top bar carried the menu button, the title, the
   sync pill, the language button and the profile chip; the tools took 288 of 390 pixels, so
   "Today" rendered as "D..". On phones (≤560px) the sync pill is hidden, the profile chip
   keeps only its avatar, and the subtitle is dropped — the title now gets 176px and reads
   properly. Everything hidden is still one tap away in the chip menu. (js/51-v75)
2. **Cards sat in two 174-pixel columns.** The Today grids use auto-fit at 180px, so a 390px
   phone still produced two columns barely wider than the words inside — "Today · Aug 13,
   2026" wrapped and the tiles looked broken. Below 560px they stack one per row.
3. **My own test bug, worth recording:** the Operations page id is `ops`, not `operations`.
   `current='operations'` silently falls back to Today, so the earlier phone and role probes
   were measuring the Today page and reporting a false pass for Operations. Fixed in both
   probes; the real Operations page renders correctly on a phone (verified).
4. The one remaining "failure" was my probe being impatient: Finance loads 28 invoices plus
   198 promo codes over the network, and the check ran before it arrived. The probe now waits
   for the ledger like a person would. Not an app defect.

Proven: 49/49 phone checks across five roles (both languages, sign-in to sign-out), and the
desktop battery still green (mega 49, lifecycle 54, wave2 13, round9 19).

Still open (honest list):
- `bd`, `operations` and `team_member` share one screen tier internally; the database enforces
  the differences, but the screen cannot show a bd person their promo-code powers.
- Expense receipts as photo attachments.
- Tablet widths (560–900px) were not specifically examined — only phone and laptop.
- A person signed in on two devices when switched off: the second clears within 90 seconds.


## 2026-08-13 · Round 11 — access stays live, the world is complete, Arabic names

Asked whether anything was left. It was, and this round did it.

1. **Access is re-checked while you work** (`js/50-v74`). The app used to ask "who is this and
   what may they do?" once, at sign-in, and never again — so switching someone off in Team, or
   changing their role, did nothing until they happened to reload. Now it re-checks every 90
   seconds and whenever the tab comes back to the front: switched off → signed out with a plain
   message; role changed → the new permissions apply immediately and the person is told once.
   Proven live: Mohammed was switched off mid-session and was out within seconds; Assem was
   promoted to manager and finance opened up without a reload, then closed again on demotion.
2. **The training world was incomplete for two of the five roles.** There were ZERO proposals
   (five leads sat at proposal stage with no proposal behind them) and an empty operations desk.
   Added five real proposals — one per proposal-stage lead, owned by the person working it,
   with scope, value, validity and status — and a seven-item operations queue spread across
   New / Quoting / Awaiting client / Booked / Ticketed / Delivered.
3. **Arabic names on Arabic screens.** Owner columns, the assign/account-manager dropdowns and
   the sidebar footer now show each person's Arabic name while still STORING the English one,
   so filters, matching and reports are untouched.
4. **Two identical "الهوية" rows in the sidebar** — two separate layers were each adding a Brand
   entry (`v46BrandBtn` and `v70BrandBtn`). The newer one now stands down when another already
   provides it. (First attempt made them fight each other; the fix is "stand down", not "adopt".)
5. **Refined the permission guard**: it no longer blanket-hides every primary button for
   read-only people (that also hid harmless things like "Show all" and Export). Guarding the
   actions is what stops the write.

Proven: 11/11 round-11 checks, 83/83 role rehearsal, 60/60 database matrix, 214 harness checks.

Still open (honest list):
- `bd`, `operations` and `team_member` share one screen tier internally, so the screen cannot
  show a bd person their promo-code powers; the database does enforce the difference.
- Expense receipts as photo attachments.
- Phone-browser pass for the non-admin roles.
- A person signed in on two devices when switched off: the second device clears on its next
  re-check (≤90s), not instantly.


## 2026-08-13 · Round 10 — five employees actually worked the app; five real defects found

Not a code review: five people with five different roles (manager, business development,
operations, standard rep, read-only) plus an admin **signed in for real against the live
database**, worked their own companies, and tried to do what they must not. Everything below
was found by doing, and every fix was re-proven the same way. See `docs/ROLES_AND_ACCESS.md`
for the verified matrix and the one-command way to re-prove it.

FOUND AND FIXED (all five would have hit the team on day one):
1. **BLOCKER — every employee was trapped in the password screen.** Changing your password on
   first sign-in calls `clear_must_change`, which sat behind the admin-only gate in the
   `admin-users` edge function. The password changed, the flag never cleared, so the same
   screen came back at every sign-in, forever. Proven with Kareem, then fixed: the action is
   now self-service (it only touches the caller's own row). Edge function redeployed (v2).
2. **The app appeared before it knew who you were.** Data loaded, the screen was revealed, and
   only then did the role check run — so a read-only person saw full-power buttons for a
   moment, and someone owing a password change could start working first. The app is now
   revealed by the role check itself, with a 9s failsafe so nobody is ever stuck on the splash.
3. **The signed-in person's name lived in the ONE shared settings row** — whoever signed in
   last overwrote everyone else. This is the actual root cause of the owner's complaint that
   "Mine" showed the wrong person's work: the admin session literally reported itself as
   "Raad Awad". Identity is now per-session (from the signed-in email) and is never written to
   shared storage; `me()`/`meName()` prefer the session identity.
4. **Proposals, requests, bookings, projects, invoices and settings accepted writes from ANY
   signed-in account, including read-only.** Those six tables had one blanket policy
   (`app_role() is not null`). Now scoped per role, matching the rest of the app.
5. **The Settings page was reachable by anyone who forced it** (only the sidebar link was
   hidden) — exposing backup/restore/audit tools to a read-only account. Now refused for
   non-admins with a plain-language explanation (js/46-v70).

BUILT: `js/46-v70-permission-guard.js` — the screen now tells the truth. It knows the same
matrix the database enforces, takes away controls a person may not use (with one clear
sentence naming what they CAN do instead), gates the Settings page, and — most important —
turns the whispered "Save issue" pill into a clear message plus a reload, so **the screen can
never show a change the database refused**. Nothing here grants permission; the database
remains the wall.

PROVEN (all green, against the live backend):
- 60/60 database write attempts across 6 roles × 9 tables land exactly as the matrix says.
- 83/83 on-screen checks: six people signing in, seeing the right pages, editing what they may,
  being refused what they may not, their work surviving a full page reload, signing out cleanly.
- 40/40 first-sign-in checks: temporary password → forced own password (weak and mismatched
  refused) → straight into the app → second sign-in goes straight in.
- 8/8 teamwork checks: handing a lead to a colleague moves it out of one "Mine" and into the
  other; two people saving at the same moment lose nothing.
- 214 harness checks (mega/lifecycle/attack waves/notes/round8/round9) still green after the
  core login changes.

TEST ACCOUNTS: the five employee logins now have QA passwords (in `scripts/qa/emp-rig.mjs`,
never in this file). **Reset each from the Team screen before handing accounts to the real
people.** The QA admin `test@directksa.com` stays as-is for testing.

Parked / open:
- `bd` and `operations` and `team_member` all map to one screen tier internally, so the screen
  cannot yet show a bd person their promo-code powers; the database does enforce it.
- Expense receipts as photo attachments.
- Owner names still display in English on Arabic screens (matching understands Arabic).
- Not yet tested: a person being switched OFF mid-session, and behaviour on a phone browser
  for the non-admin roles.


## 2026-08-13 · Round 9 — real users everywhere, tidy top bar, expenses, and a data-restore incident

⚠️ **DATA WORLD — READ BEFORE TOUCHING THE DATABASE.** The live world is the owner-ordered
**world-2026-08-13** (30 leads / 10 clients / 28 finance rows). During this round an
unidentified concurrent session RESTORED the old 0808/0812 snapshots over it (1,035 old
leads + 1,285 stress invoices came back, including Takamol and wallet rows the owner
ordered removed). It was re-applied from source. **Do NOT restore businesses/finance
snapshots over the live tables.** If it ever happens again, the fix is pure SQL: the
tables `world30_businesses`, `world30_finance_invoices`, `world30_contacts`,
`world30_activities`, `world30_finance_client_links` hold the exact world — wipe and
`insert ... select * from world30_...`. All older worlds remain in `*_snapshot_*` tables.

Owner orders executed:
1. **Every email is now a real user, linked EN + AR.** `app_users` carries full_name,
   name_ar and nickname for all 11 accounts; `business@directksa.com` was created as an
   admin through the same Team-page flow employees will use (temp password handed to the
   owner; the app forces a change on first sign-in). The simple model the owner asked
   for already exists end-to-end: admin adds email + name + role → temp password → done.
2. **Ownership is linked, and "Mine" works.** New layer js/43-v67 builds an alias index
   per user (English name, Arabic name, nickname, email prefix, unique first name,
   Abdel/Abdul spelling variants) and exposes ownerCanon/sameOwner; the Mine filters on
   Leads, Clients and Proposals now match through it (guarded core edits), and identity
   comes from the signed-in EMAIL, not a stale blob value (the fake 'Abdelrahman'
   default is gone). Four world records were assigned to the owner so his Mine view has
   content on first sign-in.
3. **Top bar rearranged** (js/44-v68): Export and Share stay; Team, Access and Sign out
   moved into a profile chip at the END of the bar (initial + name + role → menu with
   who-you-are, Team, Page access, Sign out). The old buttons are hidden, not removed.
4. **Expenses — money out** (js/45-v69 + table finance_expenses): date, description,
   category, amount, paid via bank transfer / credit card / mada / cash / wallet,
   supplier, optional client, receipt ref; totals split by payment method; month filter;
   CSV export; soft delete. Viewing needs finance access; writing is admin/manager.
   Expenses NEVER mix into the revenue screens (asserted by test).
5. Battery: 316 checks green in the harness (incl. new probe-round9, 19 checks) + 16
   real-backend checks after the world re-apply.

Parked / open:
- Owner dropdowns still show English names in the Arabic view (matching understands
  Arabic; display can follow later via ownerLabel()).
- Expense receipts as photo attachments (upload like proposals) — small follow-up.
- If the restoring session's purpose becomes known (owner may have asked another chat
  for the old 1,035 leads), reconcile deliberately instead of ping-ponging.


## 2026-08-13 · Round 8 — Takamol purge, auto-linking, the 30-lead world

Owner orders executed:
1. **Verification services (Takamol) removed from everything.** They are calculated in
   another system and never belong here. The importer now SKIPS them exactly like wallet
   top-ups (with a "verification services skipped" preview line), the legacy CSV import
   flags them out, the seed/report references are gone, and the live ledger holds zero
   such rows. QA guard: probe-round8 asserts Takamol appears on no page.
2. **Service catalog now feeds every dropdown.** The Requests form service list was a
   hardcoded 8-item list — it now offers the full catalog (24 services incl. Insurance,
   Intl driving permit, Translation, eSIM, Umrah, Study abroad…), bilingual. The lead
   form "Services they use" input suggests the same catalog.
3. **Finance↔client linking is AUTOMATIC (js/42-v66).** After every ledger load, any
   unlinked invoice group is matched to a client by normalised name (Arabic + English,
   company words stripped) and the link is saved with confirmed_by='auto-match';
   individuals-only groups auto-mark "Individuals / not a client". Only exact matches
   link (no-cross-company rule); near-misses stay visible for human review. The manual
   "Link finance to clients" button is hidden — the modal survives only as the fallback
   behind the review warning.
4. **The 30-lead world** (see CLAUDE.md "Data world"): previous data snapshotted to
   *_snapshot_20260813 and wiped (incl. the stale 1,012-row blob copy); 30 scenario
   leads inserted with owners, funnels, activity histories, next actions; 10 clients
   with 28 finance rows across all revenue ways + aging story; all groups linked.
   Three-team lens on live data: 0 unowned, 0 unlinked, 0 orphans, 0 mismatches,
   0 dupes, all client lifetime totals reconcile with their ledger rows.
5. **Importer month/quarter landmine fixed**: it wrote "2026-06"/"2026-Q2" while the
   period filters expect "June"/"Q2" (the DB trigger was silently rescuing old imports).
   Now it writes the names directly.
6. Full battery: 308 checks green (10 mock suites + real-backend probe-live2 updated to
   the new world: 28 rows, AR 216,115, 10 clients, no Unassigned).

Parked / open:
- Proposal-stage leads have no proposal *documents* yet (activities + funnel data tell
  the story; create real proposals from the app when working the leads).
- If Takamol should still appear in tender one-pagers as past work (marketing, not
  finance), say so — it was removed from those lists too and is a one-line revert.


## 2026-08-12 · Round 7 — wallet purge, aging verified, and the triple mega-sweep

Owner orders executed:
1. **Wallet top-ups fully removed** — deleted from the live ledger, the importer now
   SKIPS them entirely (never stored, preview says "skipped"), the Wallet KPI card and
   its footnote are gone. Settlements remain completely absent (asserted by test).
2. **AR aging for the finance team verified on real data** (Clients & collections tab):
   DSO, % overdue, Outstanding, 0-30/31-60/61-90/90+ buckets — live shows 460.4K
   outstanding with 397.6K past 90 days. Known limit: % overdue needs collection due
   dates, which the line-item export doesn't carry; buckets age by invoice date.
3. **probe-mega.mjs — the owner's cross-effect concept as a permanent suite (49 checks)**:
   every finance number recomputed independently from raw rows, then overview KPIs,
   plan-vs-actual, flat service table, monthly chart, aging card, top-clients total,
   ledger label, report-builder total and the client card must all agree; then one
   invoice is mutated and every screen must move by exactly that delta; a new lead must
   ripple into chips/tables and vanish from the pipeline on Won; dev-jargon scanner over
   9 pages in EN+AR; speed gates (page renders measured 5-50ms; login/refresh bounded).
4. Cleanup: raw status codes humanized on the invoice card (verified_paid → "Paid &
   verified"); export CSV header renamed invoice_total_sar; no dev words on any screen.
5. **The full battery ran THREE times as ordered** — mega, notes-rules, lifecycle,
   landmines(stress), stress, newfeatures, attack-day, wave2, wave3, live real-backend:
   ~276 checks per round, three rounds, zero failures, zero page errors, no slow renders.
## 2026-08-12 · Round 6 — THE IMPORTER + the mirror folded away + ordered re-sweep

Blueprint step 1 SHIPPED. Finance → Import now reads **Direct Payments' own "Invoice
Export" file directly** (Excel or CSV — the Excel reader loads on demand):
- recognises the typed rows (invoice / item / credit note / payment receipt) and applies
  the fee-pair rules: non-taxable = cost, the WHOLE taxable amount = profit, VAT stored
  only, never shown;
- pairs each numbered tax invoice with its unnumbered twin (the source transaction →
  `transaction_ref`); classifies commissions, wallet top-ups, drafts;
- previews counts + totals, writes NOTHING until confirmed, and skips rows already in
  the ledger — dropping the same file twice imports zero duplicates (proven by test);
- verified on a real export: 39 invoices — 29 paid, 15 transactions, 1 commission set,
  1 credit note, 1 wallet top-up, 3 twin pairs, arithmetic consistent to the riyal.

The old MANUAL mirror path is folded away (owner-approved): Today's "New invoice" card
is now "Import invoices" → opens the importer; the "From Direct (read-only)" nav group
is hidden (pages + data intact and reachable — one-line revert if ever wanted).

Owner's login-page worry answered with evidence: the deployed site and the tested copy
are byte-identical (same sha256), and the brand sentences under the logo are present —
the "different look" in test screenshots is only the sandbox's fallback font (the Cairo
webfont can't load offline). A wave-3 check now asserts those sentences on every run.

Ordered re-sweep green: sign-out → sign-in → lead through all phases → Won auto-converts
→ Clients list → importer end-to-end → reports → sign-out. 209 checks / 8 suites / 0 errors.
## 2026-08-12 · Round 5 — the "employee day" attack (owner: click everything, trust nothing)

Two new all-click suites (`scripts/qa/attack-day.mjs`, `attack-wave2.mjs`) drive the app
like a person: sign in by form, walk all 15 pages, click every stage chip, sort every
column twice, search nonsense and recover, create + quick-edit + stage-move a business,
open and close cards, export CSV (real download), work all 5 Finance tabs, flip every
ledger dropdown, open invoice cards, refresh mid-view, browser back/forward, topbar
Export/Team/Access/Share, global search, full CSV import commit (and the double-commit
guard), Arabic pass, mobile pass. 190 checks green across 7 suites, zero page errors.

Fixed what the eye caught (all deployed):
1. Global-search dropdown was as narrow as the squeezed topbar box — result names
   clipped to "N…". Dropdown now widens to fit its results (RTL-safe).
2. Client card kept the sidebar highlight on "Leads" — now highlights "Clients".
3. Import preview correctly REJECTED an inconsistent test row (revenue ≠ total−wallet)
   — verified as protection, not a bug.

Flagged, not changed (owner to decide): the Today quick action "New invoice" and the
read-only FROM DIRECT mirror pages are the old manual mirror path — with the Finance
ledger + the coming importer they are the closest thing we have to duplicated work
against the real Direct system. Suggest folding them away at importer go-live.

## 2026-08-12 · Round 4 — real data world + the four revenue ways (owner's big note)

Shipped, tested twice (mock suites + real-backend E2E 11/11), deployed:

1. **The test data is now REAL.** All three fake batches (stress, lifecycle, assumption)
   were removed from the live database and replaced with **24 actual companies** and
   **58 actual invoices** taken from the Direct Payments exports (batch `real-2026-08-12`):
   real clients with their true invoice histories, the biggest at 4.37M SAR billed, plus
   pending transactions, a never-completed 30,850 SAR draft (warm re-approach), commission
   schools, wallet top-ups, credit notes and 4 individual B2C customers. Nothing deleted:
   `*_snapshot_20260812` tables hold the full prior state. Company identities live in the
   DATABASE only — never in this public repo (QA fixtures stay synthetic).
2. **The four ways revenue arrives** (owner-defined) are now a stored column
   `finance_invoices.revenue_way`: `invoice` / `transaction` (created at confirmation,
   tax invoice later) / `commission` (held or received at a supplier's wallet) /
   `promo_code` (B2B2C totals). Ledger shows a badge for each; the invoice card has a
   "How did this revenue arrive?" selector; commission rows are exempt from the
   "no cost recorded" flag (commissions genuinely have no cost).
3. **Promo-code registry**: new `promo_codes` table loaded with the full export —
   198 codes, 134 used, 27.3M SAR of B2C sales through partner codes, 2.3M discounts.
   A "Promo codes (B2B2C)" card on the Finance overview shows totals + top codes.
   Future: per-code invoice scraping via the importer.
4. **Income by service line is FLAT** — sub-groups cancelled per owner order; every
   service on its own row, sorted by income, count column added.
5. **VAT is never shown anywhere** (owner rule): the "Included VAT" row was removed from
   the invoice card. `vat_sar` stays stored for the future importer, display-only ban.
6. **Screenshot misalignments fixed**: plan-vs-actual shows the TRUE percentage (e.g. 618%)
   with "above plan ✓" instead of a bar stuck at 100%; the monthly chart heading now carries
   the same period label as the cards; the Leads header strip counts the same population as
   the chips; an empty Leads table now says "N records hidden by filters — Show all" with a
   one-tap clear instead of a dead "No businesses match this view".
7. QA: probes updated (S29 asserts NO VAT; live2 re-pointed at the real world with
   data-driven assertions — no client names in the public repo). All suites green twice:
   lifecycle 54/54, landmines 21/21, stress 30/30, newfeatures 19/19, live2 11/11, 0 page errors.

Living list. Every session should read this and update it. Nothing here is forgotten,
it is *parked*, and each item says why and what "done" looks like.

Last reviewed: **2026-08-10**

## 0 · THE GO-LIVE PLAN (owner-directed, 2026-08-10) — read before anything else

Abdulrahman's direction: **the product is four pages — Leads, Clients, Finance,
Settings (Team & Access)** — plus whatever connects them. Rebuild/polish them one
at a time to the corporate-admin product design, keep them connected (a change on
one reflects on the others), bulletproof each, get his screenshot yes/no, THEN move
on. Everything else (Events, Airlines, SOPs, Reference pages) waits. Current data is
assumption/test data for exercising scenarios; it will be reset to zero before real
data goes in. Mix Direct's own way (client-centered: onboarding, policies,
travelers, dedicated advisor — see the B2B Feedback sheet + Enterprise Brief in
Drive) with how the leaders (Egencia/Navan/TravelPerk-class) keep one job per
screen with zero noise.

Order of work (per page: polish visuals → verify EN+AR in the harness → screenshot
for approval → deploy → delete the old layers that page no longer needs):
1. **Leads** — list is healthy after the 08-10 fixes; remaining: real SVG icons,
   priority-score tuning (new leads all read Cold), detail-card layout pass.
2. **Clients** — column decision MADE (owner said "you decide", 2026-08-10):
   kept Next review (drives the review reminders) + Tier; dropped the always-empty
   Area and Channels columns from the list (the fields stay on the edit form).
   Remaining: detail card shares the Leads header work.
3. **Finance** — DONE 08-10: numbers verified, chart on product palette
   (orange/ink), Top-clients counts distinct invoices, rows drill to client.
   SERVICE COVERAGE (owner, 08-10): catalogue extended to Direct's FULL official
   service list (Study abroad, Furnished apartments, Translation, Intl driving
   permit, VIP meet & assist, Event halls, Shipping, Chauffeur — all with Arabic);
   service-fit map gained Study abroad (core) + VIP/Translation/Shipping/Halls;
   proven end-to-end with test invoice DP-2006 (Falcon Events: Packages + Study
   abroad + Transport, 47K, linked). Undo: DELETE FROM finance_invoices WHERE
   invoice_no='DP-2006'. Finance tables are data-driven — any billed service
   appears automatically.
   SERVICE FAMILIES + REPORT STORAGE (owner, 08-10, after the Drive report sweep):
   income-by-service now rolls up into FAMILIES (Air/Stay/Ground/Visas&docs/Religious/
   Packages&tours/Corporate&events/Education/Support&extras — SVC_GROUPS, EN+AR),
   brief by default, each expandable to its exact services; paginator excluded from
   this rollup. finance_invoices gained branch / salesman / project_tag / discount_sar
   (nullable) so the real Payments exports import losslessly. THE STORAGE DOCTRINE
   (from Q1Q2_2026_B2B_Audit + DirectVisa promo report + the owner's card sheet):
   store RAW rows once (one row per transaction/line, paid-status + integrity flags on
   the row), derive every summary live from them, never store report numbers by hand;
   quality/integrity findings get recorded per issue like the audit's Methodology
   sheet. Report Builder + income card already follow this.
   LOST-LEAD LEARNING LOOP (owner, 08-10): moving a record to Lost now PROMPTS for
   the reason (bilingual), stores it in lost_reason + logs a Lost activity, and the
   record card shows "Why we lost it" in red; lost leads stay findable under the
   Lost chip. LIVE TEST DATA now: 11 clients / 7 leads / 15 invoices / 4.59M SAR
   incl. tender-in-proposal (Riyadh Chamber), supplier-partner (Amadeus), lost
   agency with comeback note (Elite Holidays), partial payment with 40K outstanding
   (Benchmark) — undo via source_batch='lifecycle rehearsal' + legacy_id lc_*.
   NOTE: the QA mocks mirror only part of this richer live set — next session may
   re-sync scripts/qa/mock-seed.mjs if screen-accurate counts matter.
   BILLING ACCOUNTS (owner explained, 08-10): one real company can be registered
   in Direct Payments as 2-3 'companies' (Prepaid / Postpaid / Tender) because the
   payment system cannot change an invoice type per account. NOT duplicates. Model:
   ONE card per real company + raw.billingAccounts=[{id,mode}] listed as chips on
   the Linked-to-Direct strip; finance_client_links already rolls all its groups up
   to the one company. MDD resolved live as the first example (IDs 1 Prepaid + 2
   Postpaid, flag cleared with an explanatory activity). When linking finance,
   map EVERY billing account's invoice group to the same company card.
   FINDING (worker-path UI test): a lead created via "+ New business" gets NO
   default owner in the harness (assignedTo empty) — check on live login whether
   meName() resolves at creation time; if not, default owner to creator.
4. **Settings/Team & Access** — DONE 08-10: emoji stripped, legacy free-text
   team editor retired, all top cards anchored below the single page heading.
DONE 08-10: the blob→tables MIGRATION — app_requests/app_offers/app_projects
created + seeded (4/3/1), RLS mirrors app_state; app layer v59 reads the tables
on load and dual-writes row-by-row after each save (blob keeps its copy =
rollback is deleting the layer; backup app_state_backup_20260810_premigration).
Same-section concurrent edits are now safe per RECORD on these three sections.
Still in the deletion round: the DELETION round — remove patch layers
the cleaned pages no longer need (verify each deletion with scripts/qa/
sweep-consistency.mjs + drive screenshots before deploy) — then migrate
requests/offers/projects out of the app_state blob into real tables, then the
full go-live gate sweep (all four pages, EN+AR, every button, all numbers).
Then: **code lightening by deletion** — after each page is rebuilt, delete the
patch layers it made obsolete (never delete first). Finally: move requests/offers/
projects out of the app_state blob into real tables (ends last-write-wins).

### Shipped 2026-08-12 (round 3) — the REAL Direct Payments model, from the owner's own screens
The owner captured live screenshots + URLs from payments.directksa.com. Confirmed chain:
TRANSACTION (receipt ref, products, Need to issue/Issued) → INVOICE (reference + DPIN/TTIN
ZATCA number, Hijri+Gregorian dates, salesman, branch, buyer VAT#) → SERVICE LINES as FEE
PAIRS (provider/3rd-party fee = No VAT cost; Service Fee = 15% VAT = Direct's income) →
PAYMENT RECEIPTS (PR-x, applied until Remaining 0). Proof pair: transaction 1163601785
(507,800.00) became invoice 1163605527/DPIN-284070 whose 6 lines sum exactly.
BUILT: finance_invoices += transaction_ref, direct_uuid, vat_sar (migration
direct_payments_model_columns); invoice card groups lines under Transaction headers with
per-transaction subtotals + "Included VAT (15% on service fees)" row; "Open in Direct ↗"
deep-links to the REAL /en/admin/invoices/view/{uuid} when the uuid is stored (template
pdInvoiceViewUrl), falls back to the admin invoices list. Full map in
docs/DIRECT_PAYMENTS_MODEL.md (their term ↔ our column). Probes S29/S30 green; stress
30/30; finance/allpages/landmines/controls all green.
NEXT (Drive folder Direct-Payments-Capture-2026-08, via Cowork): Excel export column
names → real-data import mapping; promo/discount-code screen → promo-revenue table;
COGS report; credit notes/proformas/settlements; then the DESIGN-TONE phase from the
captured screenshots + CSS.

### Shipped 2026-08-12 (round 2) — the bulletproof pass: core split + volume attack
Owner: "I want the core right so we can build quickly — attack it, fix it, attack again."
1. **The one-file app is GONE.** index.html is a 69KB shell; the base core is 10 ordered
   files in js/core/ (foundation, leads, reference-ops, proposals, records, v18–v29
   modules) and the 37 feature layers are js/*.js — every extraction byte-verified.
   Parallel sessions now work in different files; only shared-core edits stay solo
   (rules in CLAUDE.md).
2. **Volume attack** (docs/LANDMINES.md Part D): 20 stress companies + 1,254 invoice
   lines seeded in the LIVE db (batch stress-2026-08-12, formula-mirrored in
   scripts/qa/stress-data.mjs, SQL-checksum equal). CAUGHT AND FIXED: the finance
   loader silently capped at the API's 1,000-row limit — past 1,000 ledger lines every
   finance total would have been wrong with no error. Loader now pages; the QA mock now
   enforces the cap (+offset paging) so the bug class is dead. probe-stress (20 checks,
   independent expected values) + landmines re-run on stress data + full canonical
   regression: ALL GREEN.
3. Adversarial round 1 earlier the same day (LANDMINES Parts A–C): 7 traps fixed incl.
   full-edit Won half-conversion, un-Won permanent client, empty-stage save, import
   double-click, .exe upload, silent unknown proposal ref, AR-mode English leftovers.
Also: save_state_patch anon grant found re-opened (function re-create resets grants) —
re-locked by migration + standing advisor rule.

### Shipped 2026-08-12 — the three approved ideas + Direct-link structure + aggressive re-sweep
Owner approved the three parked ideas; all built, probed (19/19 targeted + full regression
54/54 lifecycle · 45-control · consistency · nav · all-pages EN/AR · mobile · AR labels, 0
page errors) and deployed:
1. **Proposal file library** — the proposal PDF now uploads INTO the app (Supabase Storage
   bucket `proposals`, 25MB, pdf/png/jpeg/docx/xlsx; anyone signed in can add, only
   admin/manager can replace/delete). The offer editor shows the stored file with 📎 +
   remove; the proposals list marks rows that carry a file. Drive links still work beside it.
2. **Import understands projects** — the invoice CSV accepts two optional last columns
   `origin,proposal_ref`. Rows validate (origin must be booking/project; a project row must
   name its proposal) and land pre-linked. Plus: a real drag-and-drop drop-zone on Import
   (drop the file → checked immediately), and service detection now reads plain words in
   English AND Arabic (flight/hotel/visa/umrah/فندق/طيران/تأشيرة/عمرة…) instead of only
   "Direct Flights"-style product names.
3. **Won → "complete the client"** — every road to Won (stage dropdown, quick edit,
   convert button) now opens the handover step: Direct client ID, legal name, customer type,
   payment mode, billing cycle, CR/VAT, credit limit, agreement status, AM, point of
   contact, contract scope, win reason. Skippable; everything editable later on the card.
   (The modal existed since v40 but only fired on one path nobody used — now it always fires.)
4. **Direct-link structure** — invoices now carry "Open in Direct ↗" (modal button + the
   ZATCA/DPIN cell is a link), and the client strip's "Open in Direct Payments" prefers the
   real Direct client ID. The URL patterns are SETTINGS (`DB.settings.pdInvoiceUrl` /
   `pdClientUrl` with {invoice_no} {dpin} {client_id} placeholders), so the moment the owner
   shows us the real Direct screens/URLs we adjust one setting — no re-coding. The saved
   backend snapshots in Drive ("Direct Websites - Backend": Main Direct / Executive CRM /
   B2B Admin Panel, incl. invoices.html) are the reference for that day.
5. **UI trim** — the 7 finance KPI cards fit one row (no lone wrapped card); the import
   header code wraps instead of overflowing; long explainer sentences shortened on
   log-activity, proposal scope, income-by-service, collections, top-clients, import.
DRIVE SWEEP 2026-08-12 (new since 08-09): **Business Finance** sheet = the corporate-card
cost ledger — every card charge classified (Tender/MDD/Booking API/HR/غرفة الرياض…) and many
tied to an invoice number → ready-made cost-side source for go-live; **call recordings**
folder (mp3 per call, numbers like 905/906 in filenames) → possible attach-to-client capture,
discuss; new **Contacts Submissions** copies (08-09/08-10) for the Phase-8 load.
TO DISCUSS WITH THE OWNER:
1. Attach call recordings (the Drive mp3s) to the company card the same way pasted
   conversations join the story — needs a naming/matching rule.
2. Import the card cost ledger per invoice number so project profit includes card costs.

### Shipped 2026-08-11 — five-lead lifecycle rehearsal (892e4b0): 51/51 by hand
Owner: create five test leads, drive EVERYTHING by hand, screenshots, fix what's broken.
Done as a permanent test (scripts/qa/probe-lifecycle5.mjs, 23 screenshots reviewed):
login (bad+good) · 5 leads via the real modal (funnel+contact each) · funnel tabs/attention/
both exports · card deep-dive (Teams/Email paste-log, comment, contact add+remove, quick
edit, funnel-details Edit dialog) · proposal linked · Won→client · Lost+reason · Direct ID
· billing accounts (907 Prepaid/908 Postpaid) · pasted agreement · AM ≠ owner + Key + review
· CSV invoice import (DPIN + missing-tax flag) · finance link · 220.0K on the client card ·
August rollup 736.0K exact · invoice→proposal option + jump · proposals library 📎 ·
refresh/back/forward/sign-out/sign-in. REAL BUGS CAUGHT & FIXED: (1) Lost via quick edit
never asked the reason (hook was on a dead dialog); (2) quick edit silently CLEARED the
owner when not in the roster — current assignee now always an option; (3) NO UI existed to
assign a funnel — added to both edit dialogs, saving the real funnel key. ADDED (per prior
owner asks): billing-accounts editor on the client strip; invoice booking/project + proposal
ref editor in the invoice card. Mock hardened to real-backend behavior (password enforced,
insert generates ids, PATCH applied, team_directory served).
TO DISCUSS WITH THE OWNER (new ideas, not built):
1. Proposals as a real file library — upload the PDF into the app itself (not a Drive link)
   so the library holds the actual documents. Needs Supabase Storage; medium effort.
2. Import CSV could accept origin/proposal_ref columns so project invoices arrive pre-linked.
3. On Won, offer a small 'complete the client record' step (Direct ID + billing accounts +
   agreement paste) instead of the silent conversion.

### Shipped 2026-08-11 — the buttons round + blob migration COMPLETE (da0842f)
Owner: "all the buttons for filtration and sorting and funnels are messed up — every
single view." ROOT CAUSE OF THE BLIND SPOT: the QA mock ran on poorer data than live,
so sweeps stayed green while live broke. FIXED STRUCTURALLY: mock seeds are now
REGENERATED FROM THE LIVE DATABASE (same 18 businesses / 25 invoice lines / 7 funnels /
contacts / offers), the mock stores POST upserts, and a permanent every-control probe
(45 checks: every stage chip, stage/funnel dropdown, search, every sort header on
Leads+Clients, every Finance ledger filter) runs 0-defect. Real fixes: funnel dropdown
(legacy source list matching nothing → real funnels by key, bilingual), dashboard
funnel card names, clients search as-you-type with focus kept, clients manager filter
(free-text team list with zero matches → actual owners), tier/review test-data variety
(2 Key clients, 4 review dates incl. overdue) so sorts visibly reorder.
RULE FOR EVERY FUTURE SESSION: when live data changes shape, re-sync the mock from
live FIRST — a green sweep on stale seeds proves nothing.
LEADS FINALIZE: leadScore tuned (came-to-us funnels start warmer; next action = intent;
fair base for unknown categories) — new leads no longer all read Cold; leads saved
without an owner get stamped with the signed-in person.
BLOB MIGRATION DONE: app_bookings/app_invoices/app_settings created + seeded, v59
extended to table-read + dual-write ALL SIX blob sections (settings = merged single
document). Same-section concurrent edits are now safe per record everywhere the team
types. Rollback stays: delete the v59 layer; blob still dual-carries.
Owner also said: proposals still get more work later (paused); do NOT bring up the
go-live path for now.

### Shipped 2026-08-11 — tall views split (3c45ea4)
Owner: "DO THAT AND ENHANCE ANY SIMILAR TALL OR COMPLICATED VIEWS."
1. Finance Overview → TWO tabs: **Performance** (period bar · KPIs · income-by-service ·
   plan-vs-actual · monthly chart) and **Clients & collections** (same period bar ·
   client credit held · Collections & AR aging · Top clients). Period bar factored into
   finPeriodBar(), shared. AR tab labels: الأداء / العملاء والتحصيل.
2. Proposal editor (the app's longest form): Fare options / Deal & workflow / Fare rules
   now native collapsible sections, closed by default, open-state survives re-renders
   (window.__ofO). Form opens ~4× shorter.
3. v60 layer: long lead/client record cards get a "jump to section" chip bar under the
   header (built live from the card's own sections; only when ≥4 sections; removed
   elsewhere; labels stripped of trailing Edit buttons). Display-only.
All harness-verified (probe-split.mjs) + consistency 8/8 + nav sweep + 0 errors.
Surveyed & left alone deliberately: Today (already decluttered), Leads/Clients lists
(tables, fine), Operations kanban (board metaphor is the split), Settings (tiled 08-10).

### Shipped 2026-08-11 — Finance round 2 (10b25ac): plan-vs-actual · credit · items · CSV · numbers-first
Owner feedback on round 1 (phone screenshots): main views must show ACTUAL NUMBERS —
cost, profit, total revenue — not percentages, and no invoice-count column; the
percentages belong INSIDE each client. Nothing thrown away, view changed. Done: Top
clients = Client/Revenue/Cost/Profit; income-by-service dropped Margin%+Inv; client
card strip gained Cost/Profit/Margin%/Credit held. Rule to keep: MAIN VIEW = numbers,
DETAIL VIEW = percentages & counts.
Coverage check of the exec dashboard's OTHER tabs (Finance 26 / B2B / Tenders,
screenshots taken): Remaining Credit → built (finance_client_links.credit_balance_sar,
KPI card 'Client credit (held)', test: Qassim Foods 250K + MDD 60K = 310K); uncollected
money → already covered (Outstanding KPI + Collections & AR aging); plan-vs-actual
(متوقع/مؤكد/فعلي) → built (finance_targets table seeded with the REAL 2026 plan:
13.2M expected / 11.3M confirmed; strip with attainment bar; pro-rated for part
periods with label; admin Set-targets button); B2B deals list & Tenders table → the
app's Leads/funnels + proposals ARE the upgrade of those (not duplicated); Excel →
CSV export of the filtered ledger (UTF-8 BOM for Arabic).
Invoice items (owner: each invoice has different items): finance_invoices.items jsonb
({d,q,u} per item under a service line), shown in the invoice card; DP-2006 seeded.
Mobile: monthly chart wrapped in its own scroll — page no longer scrolls sideways
(verified at 390px).
All harness-verified (probe-finance.mjs covers periods math, plan strip, credit card,
clean tables, CSV rows, items, proposal jump, client-card percentages); sweeps green.

### Shipped 2026-08-11 — Finance: periods, invoice origin, executive-dashboard design (193a3a3)
Owner: finance is stored/read monthly, quarterly, half-yearly, annually; the Finance page
is an UPGRADE of his real "Direct-B2B-Executive-Dashboard.html" (Drive, lead-files folder
— orange header, KPI cards with status chips فعلي/مؤكد/متوقع + colored top borders,
orange section accents, dark-slate tables with % pills, quarter chips, Excel export);
each invoice is either a normal BOOKING or part of a full PROJECT with a real proposal —
strategic & quality teams request the proposal behind an invoice.
Shipped: (1) period bar on Finance Overview (year · All/Q1–Q4/H1/H2 · month) driving
KPIs, income-by-service, collections, monthly chart, top clients — all derived live,
hand-verified (All 3.12M / Q1 2.23M / Q3 886.0K / H1=Q1 2.23M / Aug 516.0K exact);
(2) finance_invoices.origin + proposal_ref (migration invoice_origin_and_proposal_ref),
ledger origin filter + project/ref chips, invoice modal shows Origin/Proposal with an
Open-proposal jump to the Proposals page; test data tagged (Rawabi→DB-500101 project,
Falcon DP-2006→DB-500102 project, Bright→booking w/ price-offer DB-500103);
(3) design pass to the executive-dashboard language (finh accent headings + period
sublabels, KPI top borders, dark table headers, margin pills, dark totals row).
Landmine hit & fixed: injected code called the _lh helper before its var line → ledger
rendered blank (silent catch in the v42 wrapper) — moved helper to top of rLedger.
Mocks updated (scratchpad + scripts/qa) with origin/proposal_ref.
LATER (recorded, not done): the exec dashboard's B2B/Tenders deal-tracking tabs and
plan-vs-actual (متوقع/مؤكد targets vs actuals) are NOT in the app yet — candidate next
phase: a "targets" table (year, service, target_sar) to light up expected-vs-actual on
the same period bar; Excel export per period from the Report Builder.

### Shipped 2026-08-11 — proposals learned from the real thing (live, commit 7b618ba)
Read Direct's actual tender offer from Drive ("techincal offer final 1.pdf", the
Human Rights Commission agreement, folder 1pG4Sgp8Jo7zUqNz5DuMFDkW6X18XBcqR). Its real
skeleton: About Direct → work plan → numbered scope of services (each with process
steps) → 4-phase timeline → past work (Ma'aden 2M / Al-Hilal 1.5M / SFDA 500K /
Riyadh Club 1M) → team → quantities table without prices; the separate
FINANCIAL offer prices the same table and defines every payment as
**contracted service fee + cost of the requested service** (رسوم الخدمة التعاقدية +
تكلفة الخدمة المطلوبة) on a monthly schedule.
Applied to the app, kept SIMPLE per the owner:
- Generate-branded-proposal now renders the Scope box as the signature numbered
  services table (# / Service · الخدمة, brand-orange #F87020 header) — one line in
  the Scope box = one row. Single-paragraph scopes still render as prose.
- New "How we start · كيف نبدأ" 4-step strip from the real work plan (sign → needs
  analysis + dedicated advisor 1–2 days → free digital platform 1–3 weeks → ongoing
  24/7 service).
- The money note now states the real fee model verbatim, EN+AR.
- Verified in the harness by capturing the print popup: 6 rows, 4 steps, EN+AR fee
  model, 0 page errors; consistency sweep 8/8.
OWNER FEEDBACK (08-11): the first version looked like a summary card, not the real
proposal — "our proposals have a front page, a last page, the proposal in between,
and a logo"; also: don't confuse PROFILE (who Direct is — brochure, no client) with
PROPOSAL (for one client: cover → contents → about → plan → scope → commercial →
closing) with PRICE OFFER (the small quotation — the app's quote print covers that).
REBUILT same day (commit 57eef58): the generated proposal is now a true paged A4
document — gradient cover with the WHITE logo (derived from the app's real logo
asset via CSS filter; aspect-stretch flex bug found and fixed), contents page
(يشمل هذا العرض الآتي), about page with stat band (numbers verified against
"Direct Profile En"), signature services table page (# / Service · الخدمة /
Fee · الرسوم — "Service | 25" syntax fills the fee; technical proposals point to
the separate financial offer), work-plan + commercial page, gradient closing page
with contacts. RTL in Arabic. Print = exactly 6 A4 pages (verified headlessly).
Brand orange in the document corrected to #F06820 per the direct-brand skill.
STILL OPEN in this phase: owner screenshot yes/no on the paged document; optional
past-work page (Ma'aden 2M / Al-Hilal 1.5M / SFDA 500K / Riyadh Club
1M) as an opt-in for tender-type proposals; embed licensed brand fonts is NOT
possible in the public repo — document uses font-family references with fallbacks.

### Shipped 2026-08-10 (continued) — declutter round
- Nav: 16 flat items → 8 working pages + collapsed **Reference** group (auto-opens
  on its pages) + the existing From-Direct group. EN+AR.
- **Offer Builder → Proposals** everywhere users see it (nav, title, Team & Access).
- Today hero de-jargoned (Tickets due soon / Being chased / Low-profit offers /
  'Nothing urgent right now'); AR keys updated. ⌘K and ? chips hidden.
- Emoji stripped from the four pages' chrome at SOURCE (record-header CTAs, HQ/Map
  line, Finance strip heading, Link-finance button, Chain of command, all Settings
  tiles, Team & Access heading). 'Create offer' button now reads **Create proposal**.
- Settings: legacy free-text "Team (lead owners)" editor retired — owners come from
  real users via Team & Access (v56).


### Shipped 2026-08-10 — four screenshot-verified defects fixed (live)
- **Finance "Income by service line" told a false story** — it showed the service fee as
  the *entire* gross billed and 100% margin on every row, contradicting the Profit tile
  above it. Fee now = revenue − cost (Flights 43.0K / 7%, all-services 68.5K = the Profit
  tile exactly).
- **The record detail header painted buttons over the company name.** Injected button
  groups (Create offer / New booking, HQ / Maps) crushed the flexible name column to 0px.
  The row now wraps and the name column keeps a real minimum width (`v58` style block).
- **The Operations kanban collapsed into 150px columns with cards spilling across them.**
  Cause: the v26 "KPI grid" heuristic (any div with 4+ numbers becomes a stat grid) was
  stamping the board, its columns and its cards. The board, tables and timelines are now
  excluded — and the same guard stops the v26.3 Insights drawer from hiding the Leads
  table as an "aggregate block".
- **The Leads list ignored its own data** — every row showed "—" for Last activity and
  Next action. `rowToApp` now derives `lastContact` from the newest logged activity and
  maps `created_at`/`converted_date`; the Next-action cell falls back to the follow-up
  date; the conversion rate is now won ÷ all leads (was won ÷ decided = a meaningless
  100%). Strip verified: 10 new this month · 4 in pipeline · 60% · 9 days.

### Shipped 2026-08-09 (live)
- **Declutter of Leads / Clients / Finance** — removed the dead "Open in Direct" columns,
  scoped the "Has app" filter to Leads, removed the empty "Active" client chip, fixed the
  "At risk" client chip (was matching nothing), and fixed the Export dropdown so its items
  return to English when the app is switched back from Arabic.
- **Client health** badge (Good / Watch / At risk / New), **lead Priority** column
  (Hot/Warm/Cool/Cold, sortable), and a **leads Conversion strip** (new this month, in
  pipeline, conversion %, avg time to win).
- **Leads stage chips now actually filter** the table (they used to highlight but do nothing),
  with truthful leads-only counts. This closes the "next thing to fix" that was in the
  known-issues list.

---

## 1 · Data consolidation across Google Drive — **biggest open job**

The work was done across multiple devices and multiple assistant sessions, so the same
entity appears in several sheets with different details, and dozens of working files were
created that nobody has reconciled.

**Goal:** one record per real entity, carrying every detail found anywhere, with a note of
which files each detail came from.

Known sources, all confirmed present in Drive:

| File | Folder | Size |
|---|---|---|
| `TravelAgencies_MASTER.xlsx` | `1cj5eHEHKZbRPWwV6_1kCPZBYikZDhOw6` | 693 KB |
| `Contacts Submissions` (live Google Sheet) | My Drive | 42 KB |
| `B2B` (Google Sheet, actively edited) | My Drive | 70 KB |
| `CONTACT-FORM-B2B-STAGING.csv` | `1G2JAtDs9z-m3M4rJncrnKy_NClDvgUou` | 81 KB |
| `CONTACT-FORM-CLASSIFIED.csv` | same | 33 KB |
| `CONTACT-FORM-MERGE-PLAN.csv` | same | 13 KB |
| `VENDORS-FROM-CONTACT-FORM.csv` | same | 4 KB |
| `CALL-SHEET-WEBSITE-FORM-LEADS.xlsx` | same | 32 KB |
| `CALLING-LIST-TOP50.csv` | same | 9 KB |
| ~18 invoice exports `5466…5507.xlsx` | `1F24YUsinyAAz9ntvNaSgJbTfd-8W3P20` | 5–23 KB each |

**Matching rule (locked, from the master brief):** join records by CR number first, then
verified root domain, then exact normalised name, then phone country prefix. Never merge on
a personal email. Where two records disagree, keep both values and flag rather than pick.

**Method that works:** read files one at a time and write findings to a scratch table as you
go, rather than trying to hold them all at once. A single session cannot read every file in
one pass.

---

## 2 · Travel agencies project — scattered, needs collecting

Travel agencies are a different kind of lead from a contact-form enquiry. They are
**competitors as well as customers**, so each one needs its own offer and its own service
list — you cannot sell the same bundle to all of them.

What matters per agency: online or offline, whether they have their own app, whether they
resell or need white-label, which services they lack and would buy from Direct, which they
compete on.

`TravelAgencies_MASTER.xlsx` (693 KB) is the anchor file. The Travel Trade funnel already
holds **522 leads** with fields for MoT licence, licence status, IATA, city/branches,
competitor-or-partner and partnership angle — so the structure exists; the data is scattered.

The brief also records a pending restructure: split Travel Trade into subcategories —
TMC, OTA, Retail, Wholesale, Religious, MICE, Inbound, Land tour operator,
Government/Tender — and add a BNPL / Fintech merchant funnel.

---

## 3 · Clients — reset done, re-verification pending

**Done 2026-08-08:** all 32 client records reset to leads. Company names are real; invoice
and detail data was four months stale. Every one is flagged `needs_manual_confirmation`
with the reason on the record.

**Nothing was deleted.** Full copies live in `businesses_snapshot_20260808` (1,035 rows) and
`contacts_snapshot_20260808` (335 rows). To restore one:

```sql
update public.businesses b
   set is_client = s.is_client, converted_date = s.converted_date, stage = s.stage
  from public.businesses_snapshot_20260808 s
 where s.id = b.id and s.legacy_id = '<legacy_id>';
```

**Still to do:** re-check each company against current invoices and promote back to client
only when the data is current.

---

## 4 · Individuals — park, do not delete

Some invoices are for private people, not companies (e.g. invoice file `5468`, a personal
Gmail). They are not B2B leads and should not sit in the pipeline.

But they are not rubbish either: Direct made those bookings as a B2B team, so they belong in
the **finance reporting as "individual bookings"**, not in Leads or Clients.

**Decision needed:** where individual bookings surface on the Finance page and how they are
counted. Until then, do not load them as leads.

---

## 5 · Roles and permissions — on hold by request

Full picture in `docs/ROLES_AND_ACCESS.md`. The one that matters:

> **Switching a user off does not cut their access.** Five tables (`master_db_companies`,
> `app_state_bak`, `generated_documents`, `ksa_events`, `share_links`) are written as "any
> signed-in user" and never check the role, so a deactivated account keeps full access to
> the company registry, the workspace backups, and share-link creation.

Also open: whether `viewer` should see finance; whether `operations` should be able to edit
contacts; enforcing `allowed_pages` in the database or dropping it.

## 6 · Users and logins — on hold by request

- `business@directksa.com` is allow-listed as **admin** with no login yet.
- `aboelmagd@directksa.com` and `a.hassan@directksa.net` have **blank names**, so the app
  shows "aboelmagd" / "a.hassan" in the sidebar and greeting.
- `test@directksa.com` (admin) is the standing QA account — keep.

## 7 · Ownership — blocked on the users work

`assigned_to` and `account_manager` are free text, not links to real users. **0 of 1,015
leads have an owner.** Until this is fixed there is no "my leads", no per-person view, and
no owner-based permissions.

---

## 8 · Arabic — on hold by request

- **135 pieces of UI text** stay English when the app is switched to Arabic (list produced
  by `scripts/qa/sweep-language.mjs`).
- `applyLang()` hardcodes `document.documentElement.dir='ltr'`, so Arabic never lays out
  right-to-left — **and the brand guide says Arabic is always RTL**, so the app is off-brand
  here, not merely inconsistent. Flipping it on a 1.2 MB file needs care.

## 9 · Two people editing the same section

Saves are per-section since 2026-08-08, so different sections are safe. Two people editing
*the same* section at the same moment is still last-write-wins. Real fix: move bookings,
invoices, offers and requests out of the single JSON row into proper tables.

## 10 · Corporate website leads — waiting on launch

`corporate.directksa.com` has not launched. When it does: its form feeds the same funnels,
default Inbound / stage `new`, with a source stamp. Decide whether website-onboarded leads
need an onboarding phase of their own.

## 11 · Stage wording — deferred deliberately

Screen words (`Prospect`, `Qualified`) differ from the locked database words (`new`,
`in_discussion`). Filters and badges now agree, so nothing is broken. Renaming the display
words means touching `LEAD_STAGES`, `LSTAGE_COLOR`, `STAGE_PROB`, `STATUS_TO_STAGE`, `C2S`,
`S2C` and two seed importers together — a miss leaves a stage with no colour. Own pass.

---

## 11b · Two words for one stage — normalise when convenient

Live data carries **740 leads reading "New"** and **202 reading "Prospect"**. Both are
database stage `new`. `stageToApp` keeps a record's original wording when it maps to the
same database stage, so both survive. Both now have a chip, so nothing is hidden — but two
chips meaning the same thing is confusing.

Fix when convenient: set `raw->>'stage'` to one word across those 942 records, then drop the
spare chip. Reversible via `businesses_snapshot_20260808`. Low risk, cosmetic, not urgent.

## 11c · A company can arrive through more than one door

`funnel_id` holds a single funnel, but Bayswater was reached by outreach **and** has invoice
history. On 2026-08-08 the invoice record was merged into the outreach record and the
duplicate archived — the invoice fields now sit in the same `funnel_details`, but the record
shows only one funnel.

Before loading the remaining invoice companies, decide: does a lead need a **list** of
sources rather than one funnel? This affects the whole consolidation job.

## 1b · ⚠️ The invoice-mining work has been started twice, and duplicated itself

Found 2026-08-08 by a full-database duplicate sweep. **Eleven records carry
`source = 'Invoice history'`, in two clusters that overlap:**

| Earlier attempt (Outreach & Network funnel) | Later attempt (Past Invoices funnel) |
|---|---|
| `b_bta` Booking & Ticket Agency | `inv_aug06_bta` Booking and Ticket Agency |
| `b_maaden` Maaden — Saudi Arabian Mining | `inv_aug06_maaden` Ma'aden — Saudi Arabian Mining Co. |
| `b_qahtani` Abdel Hadi Al-Qahtani & Sons | `inv_aug06_qahtani` + `inv_5504` |
| `b_kayan`, `b_maaal`, `b_takamol`, `b_ultimates` | |

A session on **2026-08-06** loaded invoice leads without checking what was already there, and
on **2026-08-08** this session did the same again. Bayswater duplicated the same way and has
been merged.

**Do not load the remaining 14 invoice files until a matching step exists.** Loading them
blind would produce a third layer of duplicates.

**And do not merge on name similarity.** `b_imp_95` "Al Qahtanitravelbureau" and `b_wf_47`
"Al-Qahtani Pipe Coating Industries" share a family name and are **different companies**.
The locked rule stands: CR number, then verified root domain, then exact normalised name,
then phone prefix. All duplicate candidates are flagged with
`needs_manual_confirmation` and a reason naming the other records, so they surface on the
Needs Attention list rather than being merged silently.

Other flagged pairs: `b_imp_133`/`b_imp_60` (Alnoorwings / Al Noor Wings) and
`b_imp_244`/`b_imp_245` (Elite Holidays / Eliteholidays).

**Database integrity is otherwise clean** — 0 orphaned contacts, 0 orphaned activities,
0 broken funnel links, 0 duplicate ids, 0 nameless records.

## 11d · Page-by-page content audit — **DONE 2026-08-08 → `docs/CONTENT_AUDIT.md`**

The full audit is written up in **`docs/CONTENT_AUDIT.md`**. All 15 pages were driven with
`scripts/qa/` in English **and** Arabic, signed in as the QA admin, and every heading, column,
button and helper sentence was captured from the live screen with a keep / reword / remove
call. Nothing was changed — it is a review list for Abdulrahman, because most items are
business-wording calls (per the "do not delete copy unilaterally" rule).

Confirmed live, with root causes found:

- **The Tickets filter tabs are objectively broken** — `Push to sourced`,
  `Mark for void in sourceed`, `Request refund → Direct Paymented`. They should be
  `Issued / Voided / Refunded` (Arabic already shows these correctly). Cause: two run-time
  relabelers (`v21RelabelVerbs` + a second "plain-English" pass) find-and-replace button text
  on **fragments** after every render, so `Issued`→`Push to source`+`d`, etc. This is the
  `CLAUDE.md` "layered find-replace" pattern, and it re-mangles any wording fix unless the
  relabelers are made whole-word / retired. **This is the #1 fix.**
- `Open in Direct` column is a dash on every row on Leads **and** Clients (dead column).
- `Has app` is a filter ("show only companies with an app"), mislabelled and over-injected —
  it even appears on SOPs and Operations where it means nothing.
- `▸ From Direct (read-only)` is a **working** collapsible nav group (Bookings/Invoices/
  Tickets live inside it) — it just looks like a dead label.
- Finance "Top 10 clients" really does show 11 rows; the "Saved to cloud" toast sits on the pager.
- Doubled/garbled headings: `AR aging — AR aging buckets` (Invoices),
  `Objective progress avg of each objective's KPI progress` (Reports); empty `Today · <date>` card.
- **Arabic** is a half-translation with a left-to-right layout (page headings, most column
  headers, and the whole Events + Finance pages stay English; `dir` is hard-coded `ltr`).
  This is backlog item 8 and the audit's Part C expands it.

Audit ends with a suggested order of work: bug-fixes first (§20 relabeler, dead columns,
broken headings — all safe to do on Abdulrahman's OK), then the de-jargon / consolidation
items that need his wording calls, then the Arabic pass.

## 12 · Small things

- Delete leftover test edge functions **`hi`** and **`gstest`**.
- App orange is `#F47A1F`; the brand is `#F06820`. The events page uses the brand value.
- **Escape does not close modals.**
- "▸ From Direct (read-only)" is a section heading that behaves like a clickable button.
- Finance "Top 10 clients" lists 11 rows; its pager hides behind the "Saved to cloud" toast.
- Confirm point-in-time recovery is on for the Supabase plan — the app is versioned in git,
  the database is not.
- `manual-confirm` runs with no login and can edit any lead or contact. Fine while it is
  unknown, worth an auth check before it is shared around.

## 13 · Brand identity system — DONE 2026-08-12 (this unlocks branded output work)

Built in the "Company brand identity" session from every real source (official profile
PDFs, logo masters, `brand-assets` Drive kit, the three live Direct systems, this app, the
events page, earlier sessions' designs). Result — one brand, **three identities**:
**A · Classic** (client-facing documents), **B · Editorial** (internal reports/readouts,
with dark mode), **C · Product** (app/dashboards/tools). The three oranges are documented
as deliberate: `#F06820` documents · `#FF6C00` logo mark · `#F47A1F` app.

- Files: `brand/IDENTITY.md` (full brief + provenance + Drive asset IDs),
  `brand/tokens.css` (all three identities as CSS variables), `brand/identity.html`
  (visual showcase, EN+AR), plus the logo files (vector SVG, white PNG, slate PNG).
- Showcase artifact: https://claude.ai/code/artifact/4d5c57f1-45ed-4b67-8f40-6b94600b8546
- Next users of this: branded proposals, the report/offer generators, and the Arabic/RTL
  pass (backlog item 8 — the brand says Arabic is always RTL).

**Extended 2026-08-12 (same session), phases built and verified in the harness:**
- **Brand Hub** `brand/index.html` — employees download HD transparent logos, copy color
  codes (HEX + RGB for PowerPoint), font guidance, do/don't. Served at `/brand/`
  (vercel.json rewrites added ABOVE the `/(.*)` catch-all — that catch-all would
  otherwise swallow the path).
- **Proposal Studio** `brand/proposal.html` — bilingual (EN + real RTL AR) price-offer
  generator matching the house pattern (orange cover → pill-header table + computed
  VAT 15% totals + terms → orange thank-you page with the real contacts). Pure
  client-side, drafts in localStorage, print = PDF. Structure verified against
  `Price offer Directksa.pdf`, the Arabic quote PPTXs, and `offer-proposal.html`.
- **App nav** — `v46` layer in `index.html` adds a "Brand/الهوية" button (v44b injection
  pattern, survives re-renders, 0 JS errors in the harness with the test login).
- **WENT LIVE 2026-08-12:** PR #15 merged to `main`, then `main` merged into the
  production branch (conflict with the events session's vercel.json resolved: /events
  rewrites stay removed, /brand rewrites kept; v46+v47+v64 layers verified coexisting
  in the harness — 0 JS errors, bridge working, Arabic label الهوية correct). Production
  deployment READY; live files verified byte-identical to the tested repo files
  (sha256 on 7 files including fonts). Still recommended: point the Vercel production
  branch at `main` (Settings → Git) to end the two-branch dance.
- **Enhancement round 2026-08-13 (post-go-live):** the app had been SPLIT into `js/NN-*.js`
  by the parallel session while the brand layers were still inline in `index.html` — and
  they were numbered v46/v47/v48, which **collide with the app's own real v46/v47/v48**.
  Extracted and renumbered to `js/43-v67-brand-hub-nav-link.js`,
  `js/44-v68-offer-to-branded-studio.js`, `js/45-v69-app-identity-shell.js` (house
  new-file pattern; index.html keeps only the three script lines + the favicon links).
  This also removes the repeated index.html merge conflicts.
  Studio gains: **amount in words** EN + AR with real counted-noun grammar (the رقم/كتابة
  convention from the HRC financial offer), **multiple saved offers** in the browser
  (save / open / delete / new), **Copy for WhatsApp / Email**, line **move up/down +
  duplicate**, and **sequential offer numbers** (OFR-YYYY-001…) instead of random ones
  that could collide. Hub gains **live font specimens** rendered in the actual hosted
  files. The built-in unbranded export is now labelled "Plain copy (internal)" from the
  v68 layer, so it can't be mistaken for the client document.
- **Pre-launch attack round 2026-08-13 (16 scenarios, an employee's day):** found and fixed
  **a data-loss bug** — an offer arriving from the app's "Branded offer" button inherited the
  saved-record id of whatever offer was open, so pressing Save overwrote that saved offer
  (reproduced: two offers saved, one survived). A handoff is now always a NEW record. Also
  fixed: a negative line (a discount row) printed "Zero" in the amount-in-words instead of
  the negative figure; and the new buttons had no keyboard focus ring. Verified safe:
  60 large saved offers fit in storage, private/blocked storage does not brick the page,
  corrupt storage recovers, cancelling New/Reset keeps the draft, Delete with no selection
  is a no-op, six rapid Saves make one record, two tabs stay independent, long custom terms
  flow onto extra sheets, Arabic print is RTL with correct grammar, and print hides the form.
- **Heavy testing round 2026-08-13:** five full example offers produced as real PDFs
  (EN corporate, AR discount, VAT-inclusive decimals, 20-line stress, extreme-length
  Arabic names) — found and fixed a real clipping bug: the printed content page was a
  fixed height, so offers beyond ~14 lines lost their last rows, totals and terms; long
  offers now flow onto extra sheets with rows kept whole. Studio placeholders switched
  from a real prospect's name to fictional examples. All hub links verified against
  existing files. Main↔production divergence ended by syncing main to the production tip
  (the retired events page and its rewrites finally leave main too).
- **Post-go-live attack round (same day):** XSS attempts via client/service/terms fields
  all render as text (nothing executes); empty state clean; drafts persist; found and
  fixed a 1-halala display-rounding mismatch (figures are now rounded at computation so
  printed Subtotal + VAT always equals printed Total). Open item from the May v0 brand
  notes: confirm palette against the official email signature (needs a screenshot).
- **DONE same session — v47 bridge:** the Offer Builder detail now has a
  "Branded offer (PDF)" button. It hands the offer (ref, client, pax, ticket/partner/
  service fees, validity, remarks) to the Studio via localStorage (same origin, nothing
  in the URL) and opens it pre-filled. Verified end-to-end in the harness: offer
  DB-418335 → studio showed the client, the ref in the title, and exact totals
  (3,245.00 + 486.75 VAT = 3,731.75), 0 JS errors. The cycle is now:
  lead → offer (linkedLeadId) → **branded document** → booking (offerId) → invoice →
  finance. Still open: write the "sent/accepted" status back from Studio to DB.offers,
  and an "Accepted → create booking" shortcut.
- The Brand Hub now lists font sources (Drive internal copies + official foundries +
  free substitutes with direct Google Fonts links) and extra assets (QR to directksa.com,
  Drive links to logo masters and both official profiles).
- Still to open on Drive (session expired mid-survey): `techincal offer final 1.pdf`,
  `TECHNICAL PROPOSAL- SGC`, `Business Proposal Direct 02 2025.pdf`, `offer-B2B-110991.pdf`,
  `technical-profile.html`, `company-profile.html`, `Logo Direct .pdf` (transparent vector
  extraction), core font files for the hub.

## 14 · Payment proofs — audit document register — DONE 2026-08-19 (refines the Round 7 wallet purge)

Round 7 (2026-08-12) purged wallet top-ups from Finance because they are not Direct's
revenue — deleted from the ledger, importer skips them, the Wallet KPI card removed.
**That stands, confirmed again by the owner on 2026-08-19: wallet top-up numbers/details
must NEVER return to Finance reports, dashboards or KPIs.** What Round 7 didn't cover: the
owner still needs the bank-transfer proof FILES kept somewhere findable for an audit or
strategy-team hand-off. Direct Payments itself has no upload field on its own wallet-top-up
form, and its Payment Receipts ledger (B2C-scale, 500k+ rows) is a separate system from the
per-client wallet flow — the same fragmentation problem, one level up.

Built: `proof_documents` table (Supabase) + `payment-proofs` storage bucket, gated behind
the same `can_see_page('finance')`/`can_edit_page('finance')` RLS as `finance_expenses` —
finance-adjacent audit material, but the table carries **no revenue/cost/profit columns**
and is read by nothing else in the app. A row tags one uploaded file with: type
(`payment_proof` / `wallet_top_up` / `other`), client, invoice/tax-invoice number,
wallet-top-up number (optional — present for tagging and filename only), amount, date.
UI lives as a new "Payment proofs" tab on the Finance page (`js/57-payment-proofs.js`),
next to Expenses — upload, preview, single/bulk (select-then-download) download, and a CSV
manifest export, following the S5 Expenses pattern exactly.

**Naming scheme** (the concrete recommendation asked for, applied here and matching the
existing Expenses names): `{TYPE}_{Client}_{Ref}_{Amount}SAR_{Date}_{last4ofID}.{ext}` —
`TYPE` is `PAY`/`WTU`/`DOC`, `Ref` is the invoice number and/or wallet-top-up number
(dash-joined when a row carries both), Latin-only (same reason as Expenses: locked-down
Windows machines).

Verified hands-on against the real backend (`scripts/qa/diag-proofs.mjs`, real Supabase,
QA admin account): a wallet-top-up proof saves with its file, the generated name is exactly
right, preview/single-download/select-then-bulk-download/CSV export all work and use the
generated name, and — the point of the whole exercise — every money figure on Overview,
Ledger, Clients and Reports is byte-identical before and after, and the wallet-top-up
reference appears nowhere in `FIN.rows`. Probe cleans up its own test row.

Separately fixed in passing: `docs/BLUEPRINT.md` said "Ahmed's review" in two places — the
decision-maker is Abdulrahman Hasan Abu Al Majid, not a person named Ahmed (a persistent
misnaming, corrected by the owner directly on 2026-08-19; also noted years earlier in
`DIRECT_MASTER_BRIEF.md`: "he is Abdulrahman, not Ahmed"). Fixed where caught in passing,
not chased as its own task.

**Next up (not built yet, deliberately sequenced after this):** the Aug-16 Decision 2 work
— revenue recorded as individual records across the five real patterns (invoice / pending
transaction / commission / promo code / B2C manual) with a `cash_state` field, and
transactions stored as real DB records from creation rather than only at invoice time. That
touches the core ledger and deserves its own money-fingerprinted sitting, same discipline as
every other Finance change in this project — not folded into this one.

## 15 · S3 (part 1) — the fifth revenue pattern, schema-complete — DONE 2026-08-19/20

Owner went green on S3–S5, 2026-08-20. Started with a money fingerprint of every Finance
headline figure (Revenue 917,040 / Cost 730,750 / Profit 186,290 / Received 708,975 /
Outstanding 216,115 / 28 invoices, `deleted_at is null`, excluding `excluded` rows).

`revenue_way` widened to allow a fifth value, `b2c_manual` — the one pattern that is
inherently manual by definition (an individual/personal booking Direct made as a team, with
no corporate-client Direct Payments export to import it from, unlike the other four).
**No existing row changed** — pure widen, migration `s3_complete_five_revenue_patterns`.
Fingerprint re-checked identical after. Also settled, not built: **`cash_state` from the
Aug-16 conversation is NOT a new column** — `integrity_status` (verified_paid / pending /
excluded / credit_note) already is that field, already wired into every Received/Outstanding
number. Adding a second column with the same meaning would have been the exact "raw JSONB vs
real column" split-field trap this project has been bitten by twice before (`is_client`,
`assigned_to`); documented on the columns instead via `comment on column`.

**Flagged rather than built:** a data-entry UI that lets someone create a `b2c_manual` row.
2026-08-08's own history explicitly folded away the general "New invoice" manual-entry card
because it duplicated real Direct Payments data — "the closest thing we have to duplicated
work against the real Direct system." Individual/personal bookings may ALSO already exist in
Direct Payments' own B2C-scale Payment Receipts ledger (500k+ rows, per the Aug-12 capture) —
so a naive manual form here risks reopening exactly the duplication trap that was closed
before, just for B2C instead of B2B. **Needs an owner decision before any UI gets built**:
does Direct Payments' B2C Payment Receipts export become an importer source (same shape as
the corporate importer), or is a lightweight manual form genuinely the only way these ever
get recorded? Schema is ready either way — `record_type='b2c'` and `revenue_way='b2c_manual'`
already both exist and were probe-tested (insert → correct auto-derived revenue/profit →
rolled back, zero rows left behind). Confirmed while probing: `finance_invoices.client_group`
is NOT NULL, so any future manual form needs a client/individual name field, not a blank.

**Methodology correction, caught by the owner's own independent check:** the fingerprint
above (917,040 / 28 invoices) came from a plain "every non-excluded row" SQL query, but the
Performance tab the owner actually looks at only counts `integrity_status='verified_paid'`
rows for Revenue/Cost/Profit/Received (709,475 / 566,650 / 142,325 / 708,975 at the time,
19 invoices), with Outstanding computed separately over ALL live invoices, not just verified
ones. Same underlying data, different filter — the SQL fingerprint wasn't wrong, it just
didn't match what's on screen. Fixed for every fingerprint from here on: read the figures the
same way the Overview tab itself computes them (`live()`/`verified()` + `finInPeriod`), not
an independent re-derivation of the same logic.

## 15b · S3 (part 2) — individual bookings, the manual form — DONE 2026-08-20

Owner's call: build the manual form now (his words: "Finalize it and have it live and I will
add them manually or share them with you to add them once I collect them") rather than wait
on a Direct Payments B2C-export importer.

Built `js/58-b2c-manual.js` — "Individual bookings" tab on Finance, gated the same as every
other Finance-editing action (`canFinEdit`). Writes a real `finance_invoices` row
(`revenue_way='b2c_manual'`, `record_type='b2c'`) through the same `finance_derive_fields`
trigger every other pattern already uses — no second computation of revenue/profit anywhere
in this file. Not the same door as the folded-away "New invoice" card: `record_type` is
fixed to `'b2c'`, not a free choice, so this can't become a side entrance for a corporate
invoice.

Two real bugs found by the hands-on diagnostic (`scripts/qa/diag-b2c.mjs`) before this
shipped, both fixed:
1. **`year` is a GENERATED column**, derived from `invoice_date` — the very first live save
   attempt failed outright ("cannot insert a non-DEFAULT value into column 'year'") because
   the form set it explicitly. Removed; the column derives itself, same as the importer
   already relies on.
2. **A blank reference number would have silently undercounted Overview's "Invoices" tile**
   — that tile counts DISTINCT `invoice_no` among verified rows, and multiple null references
   collapse into a single entry instead of one each. A reference (`B2C-YYYYMMDD-xxxx`) is now
   always generated when the field is left blank.

Verified hands-on against the real backend, reading the figures the same way the Overview
tab itself computes them (the 15a methodology fix, applied): a Paid individual booking of
500 SAR / 100 cost moved Revenue +500, Cost +100, Profit +400, Received +500, Outstanding
+0, Invoices +1 — exactly and only those numbers — and removing it through the real ✕ button
(in-page confirm, not `window.confirm()`) returned every figure to the exact baseline
(708,975 / 566,650 / 142,325 / 708,975 / 216,115 / 19), matching the owner's own live check.

One self-inflicted near-miss caught and fixed: the diagnostic's own first draft matched its
probe row by a fixed name, so a leftover from an earlier interrupted debug run got confused
for the fresh insert — the test deleted the OLD row and left the NEW one live in the real
ledger for a few minutes before it was caught and hard-removed. Fixed by giving every probe
run a unique, timestamped marker so it can never collide with a leftover again. Lesson for
every future money-fingerprint probe in this project: match your own test's row by the id
the insert actually returned, never by a name that could repeat.

**Next:** S4 (transactions as real DB records, transaction-created-first / invoice-issued-
later), then S5 (expense roll-up into invoice cost — record-only/audit-trail, never altering
invoice cost/profit).
