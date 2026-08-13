# Action items — things deliberately put on hold

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
