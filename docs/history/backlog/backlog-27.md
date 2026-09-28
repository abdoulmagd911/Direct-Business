## 2026-09-02 · 12-hour attack-and-sweep loop (owner: "keep sweeping, enhancing, landmining, attacking — don't stop")

Started 08:34 UTC. One round ≈ 25–40 min: attack one area hands-on in English AND Arabic
(screenshots read by eye), fix, guard with a probe, sabotage-verify, commit, push. Log:

- **Round 1 (08:34–08:45, commit 11ec1ad).** Arabic drive of the new Duplicate-companies card
  and a client card with a bridged, flagged contact. Fixed: merge card spoke English for the
  stage word / currency / CR-VAT labels; the "needs confirmation" badge was missing on the
  client-card branch and English under Arabic; 20 client-card header/jump-bar labels were English
  in Arabic (Chain of command, New booking, Create proposal, Log activity, Request, Key facts,
  Corporate account, Activity & workflow…); the HQ/Map line; the people bridge now pages through
  the tables instead of a hard 5,000 cap. Landmine: the alias/exclusion name lookup did not fold
  Arabic letter variants while the linker did — an alias "…ة" missed a row "…ه" (rule added in
  DECISIONS, probe scenario, sabotage-verified). Finance tabs in Arabic: EN/AR numbers identical
  on all 8 tabs.
- **Round 2 (08:45–09:10).** Undo of a merge used to wipe an edit made on the kept company AFTER
  the merge (e.g. new payment terms) — the function now un-fills only what the merge itself
  filled; proven on throwaway rows inside a rolled-back transaction. Arabic Finance overview:
  chart months were "Jan…Jun" → Arabic month names; a negative service fee rendered as "18.0K-"
  (bidi) → sign isolated left-to-right, red when negative. New guard
  `scripts/qa/probe-ar-finance-display.mjs`, sabotage-verified. Live sweep clean (no orphans,
  no flag mismatches, no duplicate pairs, money invariants hold on all 46 invoices). Commit 49ce40d.
- **Round 3 (09:10–09:40).** Phone viewport (390 px) EN+AR: leads list, client card, Ledger,
  Import — no page-level sideways scroll anywhere; wide tables scroll inside their own cards;
  the client-card buttons and jump bar wrap cleanly in Arabic. Landmine found by reasoning
  through the merge: a LEAD absorbing a CLIENT record set only the `is_client` column — the
  mirrored `raw.isClient` flag and the stage stayed as they were, creating exactly the
  half-converted shape the sweeps hunt. Fixed in the function (both flags, stage won, converted
  date carried; undo reverses it), proven with a rolled-back live test; a non-editor no longer
  sees Merge buttons. The rollback tests are now a file: `scripts/qa/live/merge-rollback-tests.sql`.
  Commit 5fae5b1.
- **Round 4 (09:00–09:15).** Arabic drive of Today, Leads, Events, Operations, Reports, Settings on
  desktop and phone through the REAL language toggle: no sideways scroll, no English labels (the
  only Latin words left are e-mail addresses, people's names and fixture data). Two Arabic
  spellings of one company (ة/ه) now surface as ONE "Possible duplicate" suggestion on Import
  (probe scenario added).
- **Round 5 (09:15–09:35).** Landmine in the people bridge: editing a table-sourced contact
  through the card's edit form kept the edit in memory only — js/02 strips table rows from raw
  on save (correctly), so the edit never reached the contacts table and vanished on reload.
  Fixed with a write-through in `js/72-people-bridge.js`: an edited table contact is updated in
  the TABLE (name/e-mail/phone, row confirmed back); a table contact removed from the form is
  never deleted — it is flagged "needs confirmation" with the reason so a human decides. The mock
  now persists contact updates; probe scenarios (edit reaches the table, removal flags not
  deletes, edit survives a fresh load), sabotage-verified. Commit a825c94.
- **Oversight cycle 1 applied (d047b8d)** — refuse-aware writes in the Finance editors, honest mock
  PATCH, js/65's binary detector de-binarised, probe triage. Applied clean with a three-way merge.
- **Round 6 (09:35–09:55).** The seven writes the oversight session flagged in this lane now
  confirm rows back (M13): retiring superseded transactions and the automatic finance↔client
  link (js/41), archiving removed records on save (js/02 — only rows the database confirms are
  forgotten locally, so a refused archive can never resurrect as "new"), event delete/save and
  the event site-login (js/10) — each says plainly "the database refused it, nothing changed"
  instead of pretending. The mock now updates/deletes/inserts events, signups, links and
  businesses honestly (matched rows back, [] on a miss) so those checks are exercisable here.
  Events 52/52 + 16/16, alias-autolink, people-bridge, dedupe green.
- **Round 7 (10:00–10:25).** The app's own save path (js/02) now applies M13 to the lead
  insert/upsert itself: when the database answers with no error but fewer rows than were sent
  (a silent policy refusal), the save is treated as failed — red "Save issue: Only 0 of 1 records
  were accepted" pill, js/49's "That change was not saved" box, retry with backoff — instead of
  "Saved · 1 lead updated" while the change lived only in the browser. New
  `probe-save-confirms-rows.mjs` drives both paths (the mock refuses every businesses write under
  `MOCK_REFUSE_BUSINESS_WRITES=1`); sabotage-verified (without the guard the refusal read
  "Saved · 1 lead updated"). Lesson recorded in the probe: js/49 reloads the page 4.5 s after a
  refusal, so a witness has to be sampled the moment the save settles — the probe's first run
  sampled after that reload and wrongly blamed the app. Also this round: the Supabase advisor
  search_path warnings on the trigger functions were cleared (`pin_search_path_on_trigger_functions`),
  and the alias probe gained a presentation-forms scenario (Arabic typed as `\uFExx` compatibility
  glyphs still folds to the same company).
- **Round 8 (10:25–11:05) — exports in Arabic.** With the app in Arabic every "Export ▾" file
  (Leads, Clients, Finance, Airlines, Providers, Ops, Offers, Events) had the raw field keys as
  column titles (`nameAr`, `assignedTo`, `invoice_no`) and English stage words / true-false in
  the cells — an Arabic menu producing a file its user could not read. New
  `js/73-export-arabic.js` re-keys the shared exporters in Arabic: titles are Arabic with the
  key kept in brackets ("الاسم (name)") so a person can read it and the importer's teach-once
  mapping can still recognise it; stage words come from the same map the screens use;
  true/false and Yes/No become نعم/لا; nothing else in a cell is touched. The Leads page's own
  "Export this view" file (js/09) got the same treatment. English exports are unchanged.
  **A real defect found on the way (js/16):** arriving at Finance for the first time in a session
  straight on the Ledger tab — a client card's "Open in Finance ledger ↗", a report drill-down —
  left the export rows empty, so Export ▾ said "No rows to export — open the Ledger tab first"
  to a person already on the Ledger tab (only the Overview/Clients tabs filled them). Filled on
  every finance render now. Guard: `probe-export-arabic.mjs` reads the real downloaded files in
  both languages and takes the straight-to-Ledger route; sabotage-verified both ways.
- **Round 9 (11:05–11:25) — Finance's own two export buttons in Arabic.** The Ledger's
  "Excel (CSV)" and the Report Builder's "Export CSV" write their own files and bypassed the
  shared exporter, so in Arabic they still came out English-keyed: raw column keys on the
  Ledger file, and the Report Builder file used the English dimension/metric words and a
  "TOTAL" row while the table on screen was Arabic. Now the Ledger file takes its titles from
  the same Arabic label map (js/73, raw key as fallback) and the Report Builder file uses the
  screen's own bilingual labels and "الإجمالي". English files unchanged; four more scenarios in
  `probe-export-arabic.mjs` (AR + EN for both buttons); sabotage-verified.
- **Oversight cycle 2 applied (0b007cd)** — one malformed row could zero every Overview tile;
  money sanitised at the chokepoint, flagged on screen; `probe-overview-attacks.mjs` green here.
  Of the old-shape writes it listed, `js/35` is done in round 10 below; the Tender-by-text
  `finSectorOf()` note is left for the owner's ruling (profile_type is the proper key).
- **Round 10 (11:25–12:20) — Operations board and Proposals WITH data.** The harness had never
  fed these pages a record: the app reads requests/proposals from the `app_requests` /
  `app_offers` tables (js/35) and the mock served nothing for them — and because an unknown
  table answers `[]`, js/35 took that as "reachable, empty" and replaced the blob copy with
  nothing. Every earlier check of Ops/Proposals ran on an empty page. Now: seven requests (one
  per column, sell/cost set) and three proposals seeded; honest upsert/delete for the v59
  tables with a `MOCK_REFUSE_OPS_WRITES=1` switch. Found with data, fixed:
  · **js/35 (M13):** a section upsert/delete recorded "synced" without looking at the rows back —
    a silent policy refusal kept the request/proposal change in this tab only. Now only confirmed
    rows are snapshotted, the person is told once, and the next save retries.
  · **Phantom writes (js/72 + js/02):** the save pill after a language toggle said "Saved · 20
    leads updated" with no lead touched. The people bridge created an empty contacts/activities
    array on every company whose stored record had none, so the first save of the session saw
    those companies as changed and rewrote their rows with this tab's copy — 29 live companies,
    every session, a stale-overwrite window on rows nobody edited. The bridge now marks the keys
    it created and the save strips them back out; `probe-no-phantom-writes.mjs` asserts a
    no-change save writes nothing and a one-lead edit sends exactly one row.
  · **Arabic request cards (core-03):** "Advance → Booked", "SLA overdue", "resp by",
    "Unassigned", priority were English under Arabic; "800 SAR · △150" scrambled to
    "SAR · △150 800" in the RTL line (amount isolated LTR); service chip uses the catalogue
    label; the "Booked margin" tile wrapped mid-value on desktop and phone — the % is now its
    own small line. "Pipeline value" reads قيمة المسار.
  · **Arabic proposal editor (js/21):** its form labels, section summaries, buttons and the two
    injected action buttons were English — ~60 whole-string entries added, and the label layer
    now also covers `<label>`, `<summary>` and `.ch-sub` (whole-string only; labels wrapping an
    input are skipped). The client-facing preview document is deliberately left as authored.
  Guard: `probe-ops-board.mjs` (board counts, KPI arithmetic from the same records, Advance →
  reaches the table / refusal reported, Arabic headers + labels, phone, proposals list + editor
  EN/AR). Sabotage-verified: js/35 row confirmation → refusal red; bridge marker → phantom red.
- **Round 11 (12:20–12:55) — the last pre-M13 write sites, and an excluded partner in a dialog.**
  The three remaining old-shape writes outside the Finance lane now confirm rows back: the
  Team → Access levels save (`js/15`, never "Saved ✓" for a change that did not land), the manual
  billing-profile insert (`js/27`, no silent reload) and the finance→client link (`js/31`, ⚠ +
  toast). `js/66` was already M13-shaped. The mock gained a generic `MOCK_REFUSE_TABLES=a,b`
  switch (any write to those tables answers no error, no rows) plus honest `app_users` PATCH and
  `client_profiles` INSERT. **Landmine found by the new probe:** the "Link finance to clients"
  dialog listed the EXCLUDED partner (Takamol) as a group to link — it read the raw `FIN.rows`
  instead of js/16's `live()` chokepoint (soft-deletes out, standing exclusion applied, money
  sanitised). `live()` is now shared as `window.finLive`, and the four raw readers that could
  show or act on an excluded row go through it: the link dialog (js/31), the Overview
  income-by-service add-on (js/25), the automatic linker (js/41 — it could have auto-linked the
  excluded group to a company by name) and the client-card finance snapshot (js/38). js/62
  already excluded; js/65's idempotency lookup and js/59's find-by-id are correct on raw rows.
  Left for the Finance lane: `js/45` :103 (expenses) and `js/57` :115 (proof documents), and
  `js/45` :241 reads raw rows for the transaction-ref dropdown (an excluded ref could be picked).
  Guard: `probe-m13-remaining.mjs` (happy + refusal paths through the real dialogs, and "no
  excluded client in the link dialog"); sabotage-verified on js/31 and js/15.
- **Round 12 (12:55–13:35) — Projects WITH records, and a rule-7 scrub.** Today, Reports and
  Projects driven EN/AR, desktop/phone with the seeded requests/proposals: Today and Reports
  clean. Projects had never had a record in the harness (mock served nothing for
  `app_projects`; two seeded now). Found with records: **the "No projects yet — add your first
  project" card showed above two live project cards** — the empty-state layer (core-09)
  injected it as soon as ANY one of the four boards (Active/Proposed/Closed/Archived) was empty;
  now only when none has an item. The board itself was English under Arabic (title, chips,
  search, buttons, section headers, empties, card labels) — bilingual now (core-08), with the
  section title in js/21 and the top-bar title in the v25 titles map; dates/money isolated LTR.
  **Rule 7:** the real client abbreviation from the duplicate case was still in the public repo
  — in an Arabic help string and the Projects empty-state copy (core-09), in two probes'
  comments, in the master brief's project-closeout paragraph and the 2026-08-09 handoff
  (names, Direct IDs, paid amounts), and `docs/B2B_LANDING_PAGE_REVIEW.md` /
  `docs/HANDOVER-B2B-LOGO-WALL.md` carried a ranked table of real clients WITH paid amounts,
  invoice facts and account-owner names. All scrubbed to placeholders / pointers to the Drive
  files and the artifact. **Needs the owner's ruling (not done — destructive):** the same names
  and amounts remain in git history (older versions of those docs, and commit messages such as
  the M18 commit naming the client); removing them means rewriting published history. Other
  docs still name clients without amounts (playbook, blueprint, identity, payments model) — a
  per-mention judgment pass for the doc lane. Guard: `probe-projects-ar.mjs`.
- **Round 13 (13:35–13:55) — write actions as a read-only viewer, with records on the pages.**
  The earlier role probes proved navigation and page access; this one attacked the write
  actions that only appear once pages have data. Found: the Ops board's "Advance →" button,
  the drag-drop between columns, "+ New project", "Promote to project" and "Add billing
  profile" were not in the v73 screen guard — a read-only person could move a request a column
  along and see it move (the database refused it later, so the screen lied until reload). All
  five now refuse on screen with the v73 box (`js/49`), nothing changes in memory, nothing is
  sent; a team member still goes through all of them. Events already had their own gate.
  Guard: `probe-viewer-writes.mjs` (viewer + team_member passes); sabotage-verified.
- **Round 14 (13:55–14:25) — importer premortem #2, the teach-once (mapped) path.** Hostile but
  plausible cells a hand-made spreadsheet brings, each written as "how would Finance be wrong a
  month from now": an amount typed with Arabic-Indic digits ("١٬٢٥٠٫٥٠") became **0 silently**
  (every non-ASCII digit was stripped — the P5 shape); an accounting negative "(500)" lost its
  sign; a European "1.250,50" read as 1.25; "2026/06/15" or "15-06-2026" became no date at all;
  a US "06/15/2026" became month 15 and quarter **"Q5"**; two rows with one reference number in
  the same file became two inserts that hit the database's unique key and failed the WHOLE
  commit with no row named. `js/65`: digits normalised first, parentheses = negative, decimal
  comma recognised, four date shapes with a day/month swap when the month is impossible and a
  null (never a guess) when still invalid; an in-file duplicate keeps the first row and names
  the later one for manual review. The Direct Payments export path (js/41's own parser) was not
  touched — it reads the system's fixed format. Guard: `probe-import-hostile-shapes.mjs`
  (nine shapes through the real ingest → preview → confirm → table); sabotage-verified twice
  (digit normaliser, duplicate check). Premortem #1, preview-density, tab-wiring, tax-capture
  and CSV-injection probes all still green.
- **Round 15 (14:25–15:00) — reference pages in Arabic, and a battery regression run down.**
  Settings, Clients, Airlines, Providers and SOPs driven EN/AR, desktop/phone: clean apart from
  the Providers heading ("Providers & GDS" under Arabic — dictionary entry added) and the
  Clients list's last-activity line showing the raw type word ("note: …") under Arabic — the
  known types read Arabic now. The Direct Payments import path now reads amounts through the
  same normaliser as the teach-once path (js/41 → js/65's), so one cell can never read two ways.
  **Battery regression run down:** `probe-round8` had two red v66 auto-link checks. Bisected to
  round 6 — NOT a defect: js/41 now counts a link only when the database returns its row (M13),
  and the older seed-mock (`mock-seed-live.mjs`, used by round8/mega/landmines/notes/attack
  waves) still answered every write with `201 []` — the exact silent-refusal shape. The
  seed-mock now returns what it wrote (upsert keys year / client_group / id) and the matched
  rows on PATCH; round8 back to 14/14, the other seed-mock probes re-run. **Harness gap noted,
  not changed:** the mock's workspace blob carries no airlines/providers, so those two pages
  render empty in the harness while the live blob has 136 airlines and 23 providers — a
  future drive of those pages needs the blob seeded from the mock's own tables.
- **Oversight cycle 3 applied (3d04fd9)** — Report Builder attacked and held; its probe is green
  on this tree. The oversight session is running leaner cycles from here (plan usage); so is this
  loop — probe-driven rounds, screenshots only where a probe cannot see.
- **Round 16 (15:05–15:40) — the attack-wave battery, re-pointed at what the app does today.**
  `attack-wave2` had six red checks, all drift, none a defect: the topbar "Team"/"Access"
  buttons were folded into Settings → "Open Team & Access" (now driven through `v48Users()`);
  the client-card snapshot's labels are "Invoices / Last invoice / Open in Finance ledger" and
  it renders only for a client with a linked or matched finance group (the check now opens such
  a client, under the leads route where the card lives, after loading finance); the old
  15-column ledger CSV is no longer a recognised source (the check now drives the taught-once
  path, ingest → preview → confirm → the mock table, and proves a re-drop cannot duplicate);
  the promo card was removed from the Overview on purpose (must stay absent). To make the
  end-to-end import check honest, the seed-mock now mirrors the one-call commit function
  (inserts land with ids, updates apply by id). wave2 12/12. **Still red, classified as
  pre-existing drift, not re-pointed (older, larger scripts):** `attack-wave3` (drives a topbar
  "Sign out" button that moved into the user menu) and `attack-day` (waits for a leads table
  row the seed world no longer renders first) — both time out on their first selector;
  `probe-round9` / `probe-lifecycle5` as classified before.
- **Round 17 (15:40–16:05) — two people, two tabs.** The owner's team works in parallel, and
  the app promises that two people editing DIFFERENT things never overwrite each other
  (row-level lead saves in js/02, section-level blob saves in js/19). Never proven with two
  real tabs before. `probe-two-tabs.mjs` drives two browser contexts on one mock: A renames a
  lead, B (holding a stale copy of it) edits another lead — both land, A's rename survives B's
  later save; A changes a setting, B adds a service-level row — both land in the blob. Held.
  The mock now mirrors `save_state_patch` (merge the sections sent) and `save_state`; the
  save-confirms-rows and no-phantom-writes probes still green on it. Sabotage (every row
  rewritten on save) → A's rename lost → red. The one documented limit — the SAME record in
  two tabs is last-write-wins — is not asserted and stays on the known-issues list.
- **Round 18 (16:05–16:30) — a session that lapses mid-use.** The real story behind js/55: a
  lapsed login once let Finance load happily with Revenue 0 / Cost 0 / Profit 0 and nothing on
  screen saying anything was wrong. Never driven for real before. The mock gained a runtime
  switch (`/__lapse?on=1`: role answers null, every read answers empty — an anonymous caller)
  and `probe-session-lapse.mjs` signs in, opens Finance with figures, flips the switch, reloads
  the rows the way a page visit does, and asserts the orange "session has expired" bar within
  seconds (from the Finance zero-shape trigger, not the minute sweep), no token rotation by the
  guard, and the bar gone on the next check once the session is good again. Held: bar in ~300 ms.
  Sabotage (drop the zero-shape trigger) → no bar in 7.5 s → red; restored byte-identical.
- **Round 19 (16:30–17:10) — the Reference pages past the list.** Airlines and Providers & GDS
  had only ever been swept at list level, and the harness workspace carried zero airlines and
  zero providers (live has 136 / 23 in the blob; the separate `airlines` / `providers` tables
  are an unused copy the app never reads), so the drill-downs had never rendered a row in QA.
  The mock now seeds five carriers and four providers with every field the cards show. Driving
  them found three real things: (1) the address `/providers` was accepted by the URL router but
  no such view exists (the page's id is `vendors`), so a bookmark to it quietly showed Today —
  js/03 now maps `/providers` → Providers, `/operations` → Operations, `/dashboard` → Today;
  (2) the provider "servicing capability" flags were being relabeled by the verb map in
  core-06, so the yes/no flag "Refund" read "Request refund → Direct Payment" — a money action
  on a checkbox — the relabel now skips those toggles; (3) the Arabic drill-down chrome (back
  buttons, card titles, fact labels, KPI tiles, table heads, sub-lines, the flags) was English —
  js/21 gained the entries and a `.fact>.k` pass (existing entries win; the NDC matrix `<option>`
  words are deliberately NOT translated because they carry no value attribute and an Arabic word
  would be stored and break the "active" count). `probe-reference-pages.mjs` covers all of it in
  EN+AR, desktop+phone, plus "a flag click persists" and "an NDC status changed in Arabic still
  stores the English keyword". Three sabotages (alias, skip, dictionary entry) → red each.
- **Round 20 (17:10–17:40) — SOP library, Service Levels, Sync page with rows.** Same gap
  class as round 19: live holds 12 SOPs / 14 service levels / 14 sync events in the workspace
  and the harness had none (Bookings / Invoices / Tickets are genuinely empty live too — no gap
  there). The mock now seeds 3 + 2 procedures, 4 service levels and 6 sync events. Findings:
  the Service Levels legend pills ("★ Faster than common" / "✓ Standard target"), the
  "Common practice" / "Stretch goal" column heads and "+ Add SLA" were English in Arabic; the
  Sync page's note paragraph, "Deep links…" sub-line, area names (Corporate clients, Refund
  requests, …) and its two tags were English in Arabic. js/21 gained the entries, a `.bench`
  pass, and a Sync-page-only `td>b` pass (on every other page a bold table cell is a record
  name and stays untouched) plus a whole-element pass for the note. `probe-sopsla-sync.mjs`
  drives it all: rows, SOP search, an inline SLA edit persisting, "+ Add SLA" adding exactly
  one row, Arabic chrome, phone widths. Two sabotages (bench pass, td>b pass) → red each.
  Also: `manual-visual-sweep.mjs` now skips `<style>/<script>` injected inside the view — the
  Documents page was producing thirty false "Latin run" hits from CSS property names.
- **Live sweep (17:00).** 80 leads / 28 clients / 4 archived, 46 live invoices, 0 missing
  cost, 0 bad quarter, 0 VAT-in-profit, 0 orphan finance links, requests 7 / offers 5 /
  projects 1, last data change ~3.5 h earlier. One new signal: a single `businesses` row has
  `is_client=true` with no `raw.isClient` — it is an **archived** row (archived 2026-08-23,
  the duplicate a merge leaves behind), so it never reaches the app. Left as is; future sweeps
  should count that check on non-archived rows only.
- **Round 21 (17:40–18:10) — global search in both languages and on a phone; the Today sync
  strip.** With reference rows finally in the harness, global search was driven for the first
  time across airlines, providers, procedures and leads. It finds everything and the pick opens
  the right record, but the result-type word ("Airline / Provider / SOP / Lead") and the
  "No matches" line stayed English in Arabic — fixed in core-01 (chrome, not data). The bigger
  one: index.html hides the search box under 780 px and nothing replaced it, so a person on a
  phone had no search at all outside the Today page's "Find a client" card. New layer
  `js/74-phone-search.js` (script line added to index.html — connection step, done alone): a
  🔍 button in the top bar at phone widths that reveals the SAME search box as a row under the
  bar and focuses it; closes after a pick or when focus leaves; hidden on desktop; reversible by
  removing the line. Also confirmed the Today alert strip flags the seeded failed sync and its
  pill opens Sync. `probe-search-phone.mjs` covers all of it. Two sabotages → red each.
- **Round 22 (18:10–18:40) — Export ▾ on the Reference pages, summary and "full details".**
  First time these ran with rows. The summary files were fine in both languages. The airlines
  "full details" file (CSV and Excel) wrote the NDC matrix as six "[object Object]" per carrier
  — the shared cell flattener in core-05 only went one level deep. Replaced by one `exportFlat`
  used by both exporters: a list → items joined " | ", an object of objects → "source: status"
  joined " | ", an object of yes/no flags → the flags that are on, anything else → its text
  values. In Arabic, 24 of the 26 full-details columns came out as bare keys, "ksa" was titled
  as the country instead of the BSP flag, and the code-list values (ticketing authority, ADM
  risk, API status) stayed English — js/73 gained the labels and a small code-list map (free
  text and names are still never touched; English files are byte-for-byte unaffected).
  `probe-export-reference.mjs` covers airlines/providers/SOPs, summary+full, CSV+Excel, EN+AR.
  Two sabotages → red each; the Arabic-export, ledger-attacks and finance CSV probes stay green.
- **Round 23 (18:40–19:05) — the shared exporter, second pass (Leads / Operations /
  Proposals / Projects "full details").** Three more real things: (1) a lead's contacts cell
  read "true c9 Contact 9 Manager …" — the people bridge's own bookkeeping marks
  (`_fromTable` / `_tid`) leaked into the spreadsheet; the flattener now skips any key that
  starts with "_"; (2) `createdAt` exported as a 13-digit epoch on Operations and Projects —
  a 13-digit number on a time column (…At / …Date / ts) now reads as "2026-09-02 11:11";
  (3) in Arabic those three pages' full exports carried ~40 bare keys and English code-list
  values (Urgent, Draft, Price offer, Not checked, Not required, Import) — js/73 gained the
  labels and the code-list words (exact matches only; names and free text still untouched).
  `probe-export-records.mjs` covers it EN+AR. Three sabotages → red each; the reference-export,
  Arabic-export and ledger-attacks probes stay green.
- **Round 24 (19:05–19:35) — Reports on a phone and in Arabic.** On a 390 px phone the four
  report tabs ran off the right edge (a scrolling row with no hint, so "Generate Report" sat
  off-screen) and the built report's KPI table pushed the whole page sideways. core-10: the tab
  row wraps under 760 px and the report preview scrolls internally. In Arabic the Generate
  Report tab (title, labels, the type/scope options, the six buttons), the Achievements filters
  and empty state, the Objectives meta line and the built report's section/table heads were
  English — js/21 gained the entries (the selects carry value attributes, so translating the
  option text is safe and the probe proves the English key is stored) and a `.empty` pass; the
  meta line is composed in core-10 with a language check. One more: the built report is
  injected without a render pass, so the Arabic layer never saw it — "Build report" now calls
  the layer once after injecting. `probe-reports-phone-ar.mjs` covers it. Three sabotages
  (tab wrap, build hook, dictionary block) → red each. Left for a later round: the Settings admin cards (generator
  templates, snapshots) still read English in Arabic — dev-facing, low traffic.
- **Live sweep (19:45).** Unchanged and clean: 80 leads / 28 clients / 4 archived, the
  client-flag check now counted on non-archived rows only = 0, 46 live invoices with 0 missing
  cost / bad quarter / VAT-in-profit / orphan links, 3 merges on record, 11 active accounts, no
  data change for ~4 h.
- **Round 25 (19:45–20:15) — a client's card in Arabic; the Events page.** Events holds in
  both languages and on a phone (one stray "Event" legend word, left). On a client card in
  Arabic: the Corporate account card's labels (Entity type, Legal name, CR, Payment terms,
  Contract, Credit limit) and sub-line, the Activity card's sub-line, the "Airline corporate
  deals / fares" sub-head, the timeline's type word and "moved to" phrase, and the date /
  "d ago" stamps were English. Fixed: js/21 gained the entries and a `.sub-h` pass; core-02's
  timeline maps the type word and the phrase; core-01's `fmtDate` / `fmtAgo` now follow the
  app language (Arabic month names on the Gregorian calendar, "قبل n ي/س/د"); core-10's
  hidden "Managed client" strip is bilingual too. Re-checked the two deliberate hides on a
  client card (the loud onboarding button, the managed-client strip): both stay hidden in
  both languages — an earlier scan had read their hidden text and mis-flagged them.
  `probe-client-card-ar.mjs` covers it, desktop + phone. Two sabotages → red each.
- **Round 26 (20:15–20:45) — the dialog forms, a whole class at once.** Scanning the modal
  overlay (which the Arabic sweep had never covered — it scans the page body and top bar,
  and the dialog lives beside them) found EVERY form English in Arabic: Log activity, New
  request, New business / Edit lead, airline and provider edit, New SOP. Fixed at the root:
  js/21 wraps the dialog opener and runs its pass on the dialog, with one deliberate safety
  rule — inside a dialog a dropdown option is translated ONLY when it carries an explicit
  value attribute, because in these forms the option text often IS the stored value
  (activity type, stage, priority, ADM risk), and an Arabic word there would be saved as
  data. The dictionary gained the five forms' titles and labels. `probe-modals-ar.mjs`
  proves both halves: labels Arabic, the type / priority / ADM-risk option words still
  English, a Log activity saved from the Arabic dialog stores type "Call", English dialogs
  unchanged, the dialog fits a phone. Two sabotages → red each. Still English in dialogs:
  placeholders (attribute text, not scanned) — low value, left.
- **Loop close (20:45).** 26 attack rounds and 4 oversight cycles in the 12-hour window, every
  one committed, pushed and confirmed READY on Vercel; three read-only live sweeps, all clean.
  The second half (rounds 18–26) was probe-driven and lean: a lapsed session mid-use; the
  Reference pages, SOPs / service levels / Sync driven WITH rows for the first time (three
  harness gaps closed, two dead addresses, a mislabeled money flag); global search in Arabic
  and a search button for phones; every export path with rows ("[object Object]", bridge
  marks, epochs, Arabic titles); Reports on a phone; the client card; and the whole class
  of dialog forms in Arabic with a data-safety rule. Twelve new probes guard all of it, each
  sabotage-verified. **Left open, for the owner:** real client names / amounts in old commit
  history and messages (rewriting history is destructive — ruling needed); the Settings admin
  cards and dialog placeholders still English in Arabic (dev-facing / attribute text);
  `attack-wave3` / `attack-day` remain red on selector drift (classified above); the same
  record edited in two tabs is still last-write-wins (documented limit).

## 2026-09-02 · Oversight cycle 1 of the 12-hour watch — silent writes, a binary-looking source file, probe triage

Owner: *"continue monitoring and updating the task and keep sweeping and enhancing and landmining
and attacking the features to make sure all is good. dont stop for the next 12 hours."* Hourly
cycles, each: sync → full battery → attack one area → fix in Finance's lane → hand off → log.

**Full battery baseline after the Code session's audit round (60 scripts):** 44 green, 13
skipped as environmental (need staff logins / live systems), 6 red — all six classified, none a
live app defect: `probe-lifecycle5` and `probe-round9` are stale selectors (the Ledger tab no
longer renders a plain invoice table; a form field id moved) — drift, pre-existing on the
untouched tip; `probe-stress` times out its own perf threshold in this sandbox — environmental;
`probe-live2` wants a locally served copy on :8931 — environmental; `sweep-buttons` exceeds the
battery's 4-minute cap — environmental; `sweep-consistency` could not even start from the repo
root (cwd-relative path) and, once it ran, was asserting "Lifetime billed" on client cards — a
figure the 21 Aug "money belongs to Finance only" ruling deliberately removed. Fixed both: path
now relative to the file; the check inverted (money on a client card is the failure).

**Attack: writes the database can refuse without saying so (DECISIONS "code patterns that keep
re-biting", B2).** Found five in Finance's own files that still had the pre-M13 shape — no
`.select()`, no row-count check, "Saved" toast and local state mutated regardless: invoice
origin/proposal-ref editor and the legacy batch insert (`js/16`), the yearly targets upsert
(`js/16`), the revenue-way editor (`js/25`), the client-profile regroup (`js/62`). All five now
ask for the rows back and refuse to touch the screen unless the database confirmed them, with a
plain "Not saved — the database refused the write (permissions). Nothing changed." New
`scripts/qa/probe-silent-write-refusal.mjs` proves each editor on the permitted path AND under a
network-level `200 []` (PostgREST's exact answer when RLS matches nothing): row untouched, user
told, no "Saved" toast. Sabotage-verified (`SABOTAGE=1` restores the old handlers → 8 failures).
**The mock had to be made honest first:** every non-GET on `finance_invoices` was treated as an
insert — an UPDATE from the app silently added a stray row and returned it, so a row-count check
could never fail in the harness and "RLS refused the update" could not be modelled at all. PATCH
now updates in place under the request's eq/is/in filters and returns exactly the matched rows;
`finance_targets` and `client_profiles` writes no longer fall through to the blanket `201 []`.
Still carrying the old shape, NOT Finance's files — for the Code session: `js/41-money-in.js`
:229 (invoice soft-delete) and :423 (client-links upsert), `js/02-…cloud-layer` :438 (business
archive), `js/10-events.js` :130/:168/:597/:685.

**A source file that had turned "binary."** The Code session's new binary-file detector in
`js/65` had the regex character class `[\x00-\x08\x0e-\x1f]` and the ZIP signature `PK\x03\x04`
written with the LITERAL bytes, not the escapes. Works in the browser; but every text tool then
treats the file as binary — `grep` skipped it (so the rule-7 name sweep silently missed it),
diffs render as "Binary files differ", an editor can strip the bytes on save. Replaced with the
escapes (identical regex semantics, verified) and added structure check #8: no raw control bytes
in any `js/` or `scripts/qa/` source, sabotage-verified.

