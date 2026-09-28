## Fire #39 (2026-09-14, owner "whats next? are you sure you fixed all?") — FIXED: the dark regression battery — 183 probes converted from glob routes to predicate matchers
Honest answer to the owner: no, nothing had been FIXED by this sweep — 38 rounds verified the app clean and flagged
3 items, all outside my lane. The biggest real gap was the safety net itself: **183 of the 186 battery probes could
not run in this container**, so most "sabotage-verified guards" were not guarding. Root cause (re-established today,
correcting an earlier note that said "14 probes"): chromium here has no external network, so a probe only gets a
login form if it STUBS the supabase-js CDN with a route that actually intercepts — and Playwright glob routes
('**host/**') do NOT intercept in this Playwright, while predicate routes (u=>u.href.includes(host)) do. All 183
browser probes used globs (731 route calls across 4 hosts + a few table paths); 0 used predicates.
What was done (test files only — scripts/qa; the deployed app is untouched; fully reversible in git):
- PROVED first on a temp copy of probe-landmines: identical file, globs→predicates, went from hard TimeoutError to
  **PASS 23/23, 0 page errors**; temp removed.
- Applied the same transform to every battery probe: 731 glob routes → 0 (183 files). The 2 internal-star forms
  (probe-deeplink-boot-race '**/js/66-*.js', probe-generator-attacks '**/brand/*.css') hand-converted to pathname
  regex predicates.
- Gates on the final tree: check-structure OK, check-probe-integrity OK ("every gated probe can still fail").
- Run them with the proxy stripped, as probe-fullwalk's header already documents (chromium otherwise routes
  localhost through the egress proxy and hangs): env -u HTTPS_PROXY -u HTTP_PROXY node scripts/qa/<probe>.mjs
SAMPLE VERDICT (landed after the commit above): **9 of 11 pass outright** — probe-landmines, probe-no-vat-display
(the M1 money guard: "no live cost/profit/revenue figure is VAT-contaminated, every page + all 8 Finance tabs
render"), probe-clients-attacks, probe-crm-attacks (63/63), probe-ageing-attacks, probe-dialog-arabic-attacks,
probe-csv-injection, probe-deeplink-boot-race (hand-fixed file), sweep-nav. The 2 others, both of which DID get
past the login/CDN blocker (so the conversion worked for them):
- probe-events — FAILED on count assertions ("7 still ahead, got 4"; "4 we-take-part, got 2"). Root cause: a
  TIME-BOMB in the mock seed, not the app and not the conversion. mock-supabase.mjs seeded ksa_events with FIXED
  start dates 2026-09-10…17 (+1 deliberately ended); the probe hardcodes "7 of 8 still ahead", true when written,
  false once the calendar passed 09-10/11/12 (7−3 = the 4 it got, exactly). The dark battery had hidden this for
  weeks. FIXED: the seed now dates the 7 live events at today+(i+1) days and the ended one at today−30 — same
  ids/flags/shape, stable on any day. **probe-events re-run: exit 0, 0 fails.** The 4 sibling probes that read
  ksa_events (share-and-settings, forms-single-instance, no-native-dialogs, audit-events-search) were re-run in the
  same job to guard against regression from the seed change. FINAL: **all 3 that could load passed**
  (forms-single-instance OK, no-native-dialogs OK, audit-events-search 47/47) — no regression from the relative
  dates. The 4th, probe-share-and-settings-attacks, was NOT a seed regression and NOT a timeout: re-run at 300s it
  died identically at MODULE LOAD, before a single check — `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'`.
  Root cause: it imports playwright by BARE name (`from 'playwright'`); this container has playwright only at
  /tmp/node_modules, and the repo has no node_modules/playwright, so the bare import cannot resolve — while the other
  177 battery probes import the absolute `/tmp/node_modules/playwright/index.mjs` and load fine. Same class of
  container-portability defect as the globs, hidden the same way. Sized it: exactly **5** battery probes used the
  bare import (probe-events-scale, probe-share-and-settings-attacks, sweep-language, sweep-pages,
  probe-today-no-money). FIXED all 5 to the absolute path the rest already use (mechanical, reversible); 0 bare
  imports remain; check-structure + check-probe-integrity OK. RE-RUN VERDICT: **all 5 load and pass, 0 load errors,
  0 failed checks** — probe-share-and-settings-attacks (the crasher) 74/74, probe-today-no-money PASS / no JS errors,
  sweep-language 0 errors, sweep-pages 0 distinct errors, probe-events-scale 0 page errors.
FINAL TALLY for this fire: the diverse sample is **11 of 11 green** (10 outright + share-and-settings once its import
was fixed), including the M1 money guard and the 114-check Generator attack suite. Three real, previously-hidden
test-infrastructure defects were found and FIXED today (globs ×183 files, the events time-bomb, bare imports ×5) —
none of them app defects, all of them things that had made the safety net silently blind. The battery can now run in
this container: `env -u HTTPS_PROXY -u HTTP_PROXY node scripts/qa/<probe>.mjs`, with a per-probe timeout of ≥420s
for the long Generator suite.
- probe-generator-attacks — exit 124 = my own 170s per-probe timeout, NOT a hang. Re-run with a 420s cap:
  **114 passed, 0 failed, exit 0.** It simply needs longer than the other probes (it drives every Generator editor
  through many attack rounds). So the sample stands at 10 of 11 passing outright; the 11th is the bare-import crash
  above, fixed and re-running.

## Fire #38 (2026-09-14, owner "Continue") — Settings → Team & Access driven LIVE: the admin-users EDGE FUNCTION reconciled row-for-row to app_users
Inspected the Settings hub (renders clean: Team & Access, Admin & history, printables, daily-use tiles, view
presets; the "CR, VAT, IBAN, Wakeel" tile is the company's VAT REGISTRATION number — an identifier, M1-legal).
Then drove the admin-critical part live (scratchpad/live-team.mjs, same bridge, both the REST host AND
vkxoeeoauexyfpzqufqd.functions.supabase.co bridged): signed in as the QA admin, opened window.v48Users(), and
read what the team list actually rendered. That list is served by the DEPLOYED `admin-users` edge function
(js/31 load() → __callAdmin({action:'list'}) → POST /functions/v1/admin-users), a separate deployment that could
silently drift from the table — so this is the first live test of it this session.
- Edge function returned 11 rows: admin:3, manager:1, team_member:7 · 11 active, 0 inactive, 0 temp-password ·
  0 JS errors · role selects enabled (admin caller) · 0 findings.
- app_users table: 11 users, 11 active, admin:3 / manager:1 / team_member:7.
- **Row-for-row identity confirmed**: the sorted sha256-8 hashes of the 11 emails from the browser and from the
  table are the IDENTICAL set (0dc18484…c80344d5 ×11; hashes only — rule 7, no emails in the repo).
So the admin manages exactly the real team — no phantom or missing person, no role drift between the edge function
and the DB. The 2026-08-22 password-recovery hardening (admin-only "Send reset link") rendered as designed.
**0 defects.** Read-only (no toggle/reset/role change performed). No new oversight commits (HEAD 8aa427a).

## Routine fire #37 (2026-09-14 08:11 UTC) — FRESH live end-to-end browser drive against the REAL DB (first since #13/09-10): clean
After ~15 SQL/screenshot rounds, did the thing the mandate most emphasises: drove the merged app in a real browser
against the REAL Supabase again (scratchpad/live-fullwalk.mjs — proxy:direct:// + predicate matchers + Node bridge),
EN and AR, to catch any regression across the many container reprovisions since the 09-10 walk. Result:
- EN: bridged=65 real-DB requests, slow=0, bridgeErr=0, **pageErr=0**. AR: bridged=49, slow=0, bridgeErr=0, pageErr=0.
- role=admin, DB.businesses=108 (= 80 leads + 28 live clients, matching every SQL round; archived excluded),
  per-person matrix loaded, 9 nicknames — access + naming layers healthy live.
- All 18 pages + 8 Finance tabs rendered substantial real-data content in both languages (Activity shows the live
  269-row audit trail; Clients "28 من 108"; Finance AR overview 1328 chars, etc.). No NaN/undefined/blank.
- The ONLY finding — "en finance: 27 chars" — is the known async load-race (the "Loading the finance ledger…"
  placeholder caught before the bridged fetch returned); the AR finance pass immediately after rendered fully
  (overview 1328, all tabs 500–1670 chars), same artifact confirmed in #13/#15. Not an app defect.
So the whole app is re-confirmed rendering clean against the live database today, EN+AR, every page — no regression.
**0 real defects.** Read-only. No new oversight commits (HEAD 132eac1).

## Routine fire #36 (2026-09-14 06:13 UTC) — reference data (airlines + providers) integrity on real DB: CLEAN
Checked the reference data that feeds the Airlines page and the offer/booking airline picker.
- airlines table: 139 rows, **0 missing IATA code, 0 missing name, 0 duplicate codes, 0 malformed** (every code
  matches ^[A-Z0-9]{2}$, the valid IATA airline-code format). Clean.
- providers (GDS): 23 rows, 0 missing name, 0 duplicate names. Clean.
Minor architecture observation (NOT a defect): the app displays airlines from DB.airlines = app_state.airlines
(136), augmented at load by a hardcoded AIR_ADD supplement (js/core-01:414-430), NOT from the richer `airlines`
TABLE (139, which additionally carries contacts/adm_policy/deeplinks). So a ~3-row drift between the two stores
exists, but it is reference-only and not user-impacting (bookings/offers are empty, and the displayed list is the
comprehensive 136+supplements). Both stores are internally clean. Left as-is (syncing the two is oversight/owner
territory, and reference data has no live transaction depending on the 3 rows).
**0 defects.** Read-only. No new oversight commits (HEAD 779f2cc).

## Routine fire #35 (2026-09-14 04:11 UTC) — Generator document backbone (numbering + seeds) verified on real DB: race-safe, 0 defects
Checked the client-facing Document Generator (js/66–71: Price Offer, Service-Fee Proposal, Company Profile,
Contract, Tender). Its VAT usage is M1-LEGAL by design (these are client-facing documents where VAT 15% is legally
expected — DECISIONS M1). Verified the data/numbering foundation on the real DB:
- **next_document_number() is genuinely atomic**: access-gated (raises 'not allowed' if app_role() is null) and
  uses INSERT INTO document_counters (family, year) ... ON CONFLICT (family,year) DO UPDATE SET last_n=last_n+1
  RETURNING — Postgres serializes concurrent callers on the counter row, so two issued documents can NEVER collide
  on a number (format FAMILY-YEAR-NNN, resets yearly). This is the correct race-safe pattern, not a read-max-plus-1.
- generated_documents: 0 rows — the Generator is wired and ready but not yet used in production; hence 0 duplicate
  numbers and 0 issued-without-number (trivially, and structurally impossible given the atomic minter).
- service_fee_scenarios: 3 seeded selectable decks (matches the "3 seed scenarios" design / app_state
  serviceFeePricing:3).
**0 defects** — the document-generation backbone is correct and duplicate-proof. Read-only. No new oversight
commits (HEAD a2f82d6).

## Routine fire #34 (2026-09-14 02:11 UTC) — finance→client linking (finance_client_links) verified on real DB: fully sound, no orphan/dangling/archived
Verified the finance→client attribution layer that lets a client's detail card surface its revenue (CLAUDE.md:
"every finance group is linked to its client, confirmed_by='auto-match', automatic never manual"). Real DB:
- 26 links, ALL confirmed_by 'auto-match' (matches the "automatic, never manual" doctrine). 18 distinct live
  client_groups across the 46 live invoices.
- **0 live client_groups unlinked** — every finance group resolves to a business.
- **0 links with a null business_id, 0 dangling** (every business_id points to a real businesses row).
- **0 links point to an ARCHIVED business** — the auto-match binds each group to the surviving PRIMARY record, never
  a merged-away/archived duplicate (ties fire #26 together: revenue never attributes to a hidden record).
So the attribution chain is closed and clean: 46 invoices → 18 client_groups → 18 valid live businesses, all
auto-matched, no orphaned revenue. **0 defects.** Read-only. No new oversight commits (HEAD 5d5ea10).

## Routine fire #33 (2026-09-14 00:11 UTC) — B2C / individual-bookings separation on real DB: CLEAN, no leak into the B2B pipeline
Tested the "individuals are not leads — private people belong in finance as individual bookings, not the pipeline"
rule (CLAUDE.md) against the real DB:
- **0 businesses flagged b2c** — no individual is sitting in the leads/clients table; 0 leaking as an active lead,
  0 marked as a client. The B2B pipeline holds only real companies.
- Live finance_invoices carry only record_type b2b + government — **no individual/B2C rows mixed into the B2B
  revenue** (the 46 live invoices, whose totals were reconciled in #17, are all company/government).
- B2C has its own dedicated store, `app_bookings` (cols id/data/updated_at/updated_by) — well-formed, currently 0
  rows (matches the finance B2C tab's clean empty render in fire #13). Kept entirely separate from businesses.
So the individuals-vs-companies boundary is enforced in the data: nothing crosses it. **0 defects.** Read-only.
No new oversight commits (HEAD 9f083e7).

## Routine fire #32 (2026-09-13 22:11 UTC) — the audit/history trail (record_history) verified on real DB: sound and fully attributed
Checked the undo + accountability backbone (record_history_write trigger; M13/M16; js/53 + js/63). record_history
holds 269 entries (2026-08-22→09-10, all within 30 days) across 6 tables (businesses, contacts, finance_invoices,
finance_transactions, client_profiles, access), with a real action vocab (create/edit/delete/archive/denied/
reset_link_sent) and before_row/after_row snapshots.
Investigated an 80% null-actor rate (216/269) — and it is NOT an attribution gap: **null_actor_and_name = 0 for
EVERY action**, i.e. every entry that lacks an actor UUID still carries an actor_name label. So each change is
attributed either to a signed-in user (actor UUID) or to a system/import/migration label (actor_name) — the null
UUIDs are exactly the bulk import/cleanup/soft-delete operations run outside an auth session (e.g. the 72 deletes,
the Aug import creates), correctly labelled by name.
- All 20 `denied` access-enforcement events carry a REAL actor UUID — the security audit (js/64) attributes who was
  denied what, fully.
- 0 edit/delete/create rows with neither actor nor name; 0 UPDATEs missing a before/after snapshot (undo intact);
  0 rows undone (nothing needed reverting).
**0 defects** — the audit trail records who/what/when for every change and keeps reversible snapshots. Read-only.
No new oversight commits (HEAD 38f8827).

## Routine fire #31 (2026-09-13 20:11 UTC) — deep-link / deep-reload robustness (the "relative src breaks /leads" landmine): CLEAN
Verified the documented landmine that a single RELATIVE <script src> breaks the app on a deep-address reload
(e.g. bookmarking /leads and refreshing), plus the deploy config that makes deep URLs resolve:
- All 71 <script src> in index.html are ABSOLUTE: 10 /js/core/* + the supabase CDN (https) + 60 /js/NN-*.js
  numbered layers. **0 relative srcs** — so a reload at any deep path still loads every layer. (Matches
  check-structure's "70 script files"; load order is core → supabase → ascending layers.)
- vercel.json closes the other half: domain redirects canonicalize the *.vercel.app hosts →
  www.directksab2b.com; rewrites send /brand, /brand/proposal, /brand/identity to their static pages, then the
  SPA catch-all /(.*) → /index.html serves the app for every other deep path. So /leads reload → Vercel returns
  index.html → absolute scripts load → js/03 clean-url routing renders the right view. End-to-end sound.
- /events: CORRECTED in fire #47 — this line originally claimed "/events is the KSA Events Hub's own
  events/index.html (served by filesystem precedence, confirmed live in fire #13's walk)". That was wrong on both
  counts: the public hub file was retired in commit 47b6c01 (Events moved inside the app), and fire #13 drove the
  IN-APP events page, never the /events URL. The true behaviour: /events falls to the catch-all → /index.html,
  and js/03's VALID list includes 'events', so the deep URL lands on the in-app Events tab after sign-in. Correct
  by design; the earlier wording was an unchecked assertion.
**0 defects.** Read-only. No new oversight commits (HEAD a6f0462).

## Routine fire #30 (2026-09-13 18:11 UTC) — FLAGGED (enhancement, not a defect): the Direct Payments deep-link ignores direct_client_id, name-searches for 18/28 clients
Checked the "Direct Payments ↗" deep-link — a daily action (jump from a client to their invoices in the real
money system). pdLink() (js/core-01:457, overridden js/core-10:504) and the client-card directHref (js/38:97,
which just calls pdLink) build
  https://payments.directksa.com/en/admin/invoices?customer_identifier=<phone → else email → else NAME>.
So the link ALWAYS builds — never empty/broken. Real-data precision on the 28 live clients:
- 10 resolve via a contact PHONE (precise), 0 email-only, **18 fall back to the company NAME** (a fuzzy search on
  Direct Payments, potentially ambiguous for similar names).
- BUT **20 of 28 clients carry a `direct_client_id`** — the documented cross-system LINK KEY (DIRECT_SYSTEMS_MAP:
  "the link key: Direct client ID") — which pdLink never uses. Many name-fallback clients have a precise id sitting
  unused.
This is an ENHANCEMENT, not a functional defect: the link works today via name search. I did NOT change it, for two
reasons that make it owner/Claude-Code work, not mine: (1) pdLink is money-adjacent core, and (2) the sandbox cannot
reach payments.directksa.com to verify what its `customer_identifier` param actually accepts — swapping to an
unverified direct_client_id format could land users on NOTHING, worse than a name search. RECOMMENDATION: confirm
what customer_identifier accepts, then prefer direct_client_id when present (fall back to phone→email→name), for a
precise landing on the 20 clients that have the key. Low priority — nothing is broken today.
**0 functional defects; 1 flagged precision enhancement.** Read-only. No new oversight commits (HEAD c6eacd5).

## Routine fire #29 (2026-09-13 16:11 UTC) — Operations (Projects board) verified EN+AR — the last unverified primary nav page
Examined the Operations page (walked but never inspected). It is the request/projects kanban: tiles Open requests
/ SLA overdue / Awaiting client / Needs a cost recorded / Delivered-closed, and 7 columns NEW→QUOTING→AWAITING
CLIENT→BOOKED→TICKETED→DELIVERED→CLOSED. All 0 — a correct EMPTY state, matching app_state.requests being empty
(fire #24); the board is wired to real data, not broken. Correctly carries NO money margin tiles (the 2026-08-21
"money belongs to Finance" ruling — probe-money-off-ops-and-cards holds it). AR render clean: full RTL, every tile
and all 7 columns translated (طلبات مفتوحة/تأخّر مستوى الخدمة/بانتظار العميل/بلا تكلفة مسجّلة/مُسلّم-مغلق; جديد→مغلق).
No NaN/blank in either language. With this, every PRIMARY nav page (Today, Leads, Clients, Generator/offers,
Operations, Reports, Finance, Settings) has been verified this session. **0 defects.** Read-only. No new oversight
commits (HEAD 203f1bc).

## Routine fire #28 (2026-09-13 14:11 UTC) — per-user page-access matrix audited for EVERY role on real DB: correct, no mis-grant, no lockout
Closed the "every role" dimension at the data level (fire #15 tested team_member behaviourally; fire #25 the
users/auth mapping). Read my_page_access() on the real DB: admins get NULL (⇒ all pages); every other user gets
their own app_users.page_access object — so access is PER-USER, not per-role-default. Audited all 8 non-admin
users (avoiding a false alarm: the values are access LEVELS like "editor", not booleans):
- manager (1): exactly 10 pages (today/leads/clients/finance/offers/events/airlines/activity/archive/settings),
  all "editor" — appropriate managerial breadth, correctly the only non-admin holding settings/archive.
- team_member (7): ALL exactly the 4-page employee floor (today/leads/clients/finance), all "editor" — matches
  fire #15's LIVE behavioural result (those 4 granted, all else bounced). **0 team_members over-granted settings.**
- 0 users locked out (min pages = 4), 0 malformed/odd access levels (only "editor" present), 0 null page_access.
So the access grants are correct and consistent for every role, at the data level as well as behaviourally.
**0 defects.** Read-only. No new oversight commits (HEAD 6f64d93).

## Routine fire #27 (2026-09-13 12:11 UTC) — clientHealth() attention signal reconciled against real data: correct, "no manufactured alarms" rule holds
Verified the Clients-page health/attention tag (New/Good/Watch/At risk/Lost) — the daily "which accounts need me"
signal — computes correctly against the real 28 live clients. Logic (js/core-02:208): Lost stage outranks all →
review-overdue → no-activity="New" → 90d stale="At risk" → 45d="Watch" → else "Good".
Reconciled the health INPUTS on the real DB for the 28 live (non-archived) clients:
- 1 lost → "Lost"; 2 with an overdue nextReview → "At risk" (a real overdue review is a legitimate red, per the
  function's own comment — not a manufactured alarm); 17 with zero activity AND no lastContact AND no overdue
  review → "New" (NOT "At risk"); the remaining ~8 carry real activity and fall into Good/Watch/stale by recency.
- The rule that matters (js/core-02:207 "a client with no logged history yet is New, not At risk — we don't
  manufacture alarms from empty data") HOLDS: all 17 empty-data clients resolve to New, none is falsely flagged
  At risk. Distribution matches the fire-13 screenshot (mostly New, a couple with activity Good/Watch, 1 Lost).
**0 defects** — the attention signal is honest: red is reserved for a real overdue review or genuinely stale
contact, never for absence of data. Read-only. No new oversight commits (HEAD 1f1192e).

## Routine fire #26 (2026-09-13 10:11 UTC) — chased a Clients-count discrepancy (32 in DB vs 28 shown): traced to the reversible archive/merge, NOT data loss
Noticed the Clients page reads "CLIENTS IN VIEW 28" while the DB has 32 is_client=true rows (fire #23). A
4-client gap looked like it could be real clients silently dropped from the list — so I ran it down:
- Ruled out a stale screenshot: 0 clients were created/converted/updated after the 09-10 screenshot date, so
  there were 32 on that date too. The gap is real, not timing.
- Ruled out the finance alias-merge (js/62 Part 1.5): that collapses finance_invoices.client_group TEXT for
  the Finance rollups (why Finance shows 15 client-groups), not the Clients page, which reads DB.businesses.
- Found the actual cause: businesses has an `archived_at` column and the main loader DELIBERATELY never fetches
  archived rows (js/76 header), so DB.businesses — and renderClients' `filter(b=>b.isClient)` — exclude them.
- Confirmed on the real DB EXACTLY: 32 is_client rows = 28 archived_at NULL (shown) + **4 archived**. Of the 4,
  3 were archived by a MERGE (archived_by 'merged-into:<id>', reasons "cleanup-2026-08-22-duplicate-of-direct-
  import" ×2 + one more) and 1 by "owner-ruling-2026-08-23". 32 − 4 = 28, matching the tile precisely.
Verdict: the 28 is CORRECT. The 4 are reversibly archived duplicate/merged records (M18, non-destructive —
restorable from the Archive page, js/76), not lost clients. **0 defects** — a real-looking discrepancy fully
run down to intended, reversible behaviour. Read-only. No new oversight commits (HEAD 95fc45a).

## Routine fire #25 (2026-09-13 08:11 UTC, after a ~14h idle — 20 mandate fires queued during container churn, drained; one consolidated round) — users & access DATA foundation on real DB: CLEAN
Audited the users/roles/auth layer that underpins the whole access model (verified behaviourally in #15, never
at the data level). Live DB:
- 11 app_users, all active. Roles: admin:3, manager:1, team_member:7 — 0 invalid roles, 0 missing emails, 0
  duplicate emails. (bd/operations/viewer exist in the enum but are unused — fine.)
- **Perfect 1:1 between auth.users (11) and app_users (11)** — 0 app_users without an auth identity, 0 auth users
  without a profile. So every person who can sign in has exactly one role, and no profile grants phantom access.
- access_allowlist has 10 rows (auto-approve on signup).
- Both functions the access model depends on exist: app_role() (every RLS rule calls it) and my_page_access()
  (the per-person matrix RPC js/56 loads — proven returning a working matrix live in #15).
So the access foundation is sound in data as well as behaviour. **0 defects.** Read-only. No new oversight
commits (HEAD 91b1aff). NOTE for the record: the auto-continue Routine queued 20 identical fires while the
session was idle across container reprovisions on 09-11→09-13; drained them and ran one consolidated round
rather than 20 (they carry one standing instruction, not 20 distinct tasks).

## Routine fire #24 (2026-09-11 16:12 UTC) — the app_state blob audited on real DB: structurally clean, M1-clean
Audited the single app_state JSON row — the last big untested data store (still holds settings + reference data
+ the offer/booking/etc. arrays). Findings:
- 1 row, valid JSON, every top-level key well-typed. The entity arrays that MOVED to real tables are correctly
  empty here: businesses(0), bookings(0), invoices(0), projects(0), requests(0), refundRequests(0),
  travelerProfiles(0), syncEvents(0) — no stale duplicates fighting the real tables.
- Live sub-data: offers(1), audit(800), airlines(136), vendors(23), slas(14), sops(12), sopsWhale(10),
  ndcProviders(6), ksaEvents(80), serviceFeePricing(3), bundleTemplates(3), recents(8), plus settings/agency/
  integrations/templateLibrary objects. The reference sets render clean (fire #13 page walk).
- The one live offer is a valid EMPTY Draft: status Draft, no client, linkedLeadId "" (no-link, NOT dangling),
  and every money field (total/value/ttl/cost/serviceFees) empty — 0 non-numeric values, so no NaN risk on the
  offers page. Its `vat` field is M1-LEGAL: an offer/proposal is a client-facing document where VAT is legally
  expected (DECISIONS M1 explicitly permits this).
- M1 on the internal service-fee table: serviceFeePricing fields are {id,name,currency,perItem} — NO vat field,
  0 rows containing "vat". The internal revenue/fee figure is not VAT-computed. Clean.
**0 defects.** No code/data changed (read-only). No new oversight commits (HEAD 120dd5d).

## Routine fire #23 (2026-09-11 14:13 UTC) — half-conversion landmine probed on real DB: precondition present on 1 record, mitigation confirmed working (benign)
Probed the documented lead/client half-conversion landmine (the app reads is_client from BOTH the column AND
raw->>'isClient'; changing one without the other half-converts a record). Live DB (112 businesses = 80 leads +
32 clients):
- 32 clients by column; 31 carry raw->>'isClient'='true'; **1 record has is_client=true (column) but raw = NULL**
  entirely (so no raw->>'isClient'). 0 records mismatch the other way. That 1 record (id 51bf44fe…, stage won,
  created 2026-08-23, untouched since) also has converted_date NULL and no funnel_id.
- Verdict: NOT a defect. rowToApp (js/02:117) derives o.isClient = (r.is_client===true) || base.isClient===true —
  it reads the COLUMN as a fallback, which is precisely the dual-read that neutralises this landmine. base
  defaults to {} when raw is NULL (js/02:107), so nothing crashes / goes NaN. The record renders consistently as
  a client everywhere (all downstream code uses the mapped o.isClient, never raw->>'isClient' directly), so it is
  never half-shown. Only cosmetic: converted "since" date prints '—', no funnel section, no contacts — because it
  was created OUTSIDE the app (a direct insert/import wrote the column and left raw empty — the exact pattern the
  js/02:132-140 comment already describes).
- So the landmine's precondition exists on exactly 1 live record and the app's mitigation demonstrably absorbs it.
MINOR HYGIENE NOTE for the owner (NOT actioned — real-data mutation is his call, and it's cosmetic only): that
one client could be tidied by backfilling raw->>'isClient'='true' + converted_date so its "since" date shows and
it stops being the lone column/raw divergence. No functional impact today.
**0 functional defects.** No code/data changed (read-only). No new oversight commits (HEAD 04a8a2f).

## Routine fire #22 (2026-09-11 12:13 UTC) — funnel data integrity (funnel_id + template + answer alignment) on real DB: CLEAN
Verified the lead-funnel data end to end against the REAL DB — the layer that feeds the funnel section on every
lead detail card:
- 7 funnels (inbound/outreach/travel_trade/partners_tenders/website_form_b2b/website_form_entity/past_invoices),
  each field_template a well-formed array of bilingual fields {key,type,label_en,label_ar} — 0 malformed
  templates, 0 missing English or Arabic labels.
- All 80 leads carry a valid funnel_id (FK into funnels) — 0 orphans — and all 80 have non-empty funnel_details.
  (Assignment is via the funnel_id column + funnel_details, not raw->>'funnelKey', which is empty on every lead;
  the app maps funnel_id→funnelKey. source is "Contact Submission" on all 80.)
- Alignment (the check that decides whether the card's funnel section renders): every lead's funnel_details keys
  intersect its funnel's template keys — 0 leads with zero overlap (so no funnel section renders empty despite
  holding data) — and 0 leads carry an answer key outside its funnel's template (so nothing is silently dropped).
So the funnel feature is sound both in data (aligned, bilingual) and — with fire #14's in-browser detail-card
pass — in rendering. **0 defects.** No code/data changed (read-only). No new oversight commits (HEAD 9b9fb5b).

## Routine fire #21 (2026-09-11 10:12 UTC) — FLAGGED: latent M1 hazard in the finance_derive_fields trigger (NOT a live violation; needs owner/Claude-Code, not my lane)
First substantive finding of the sweep. Verified the write-path guardrails on the REAL DB: the businesses
triggers (trg_lead_won→lead_won_to_client, log_stage_change, record_history, touch_updated_at), the
finance_invoices triggers (trg_fin_inv_derive→finance_derive_fields, touch, record_history), and the stage
CHECK constraint (exactly new/contacted/in_discussion/proposal/won/lost/on_hold) are all present and correct.
lead_won_to_client correctly sets is_client + converted_date on the won transition.
THE FINDING — a latent (not live) M1 risk in finance_derive_fields:
- The trigger computes `revenue := round(total_incl_vat_sar - wallet_portion_sar, 2)` and then
  `profit := round(revenue - cost_sar, 2)`. It NEVER subtracts vat_sar. It also OVERRIDES whatever the
  importer wrote (it recomputes whenever the stored revenue disagrees by >0.01 — js/65:488 already notes
  "the trigger silently corrected it on disk").
- So for any row where vat_sar>0 the trigger bakes VAT INTO revenue and therefore profit — an M1 violation
  ("none of Revenue/Cost/Profit may be VAT-inclusive or VAT-computed", DECISIONS M1).
- Evidence on the real DB: of 91 total finance_invoices rows, 28 carry vat_sar<>0 (max 2,608.70); on ALL 28,
  revenue == total_incl_vat − wallet (VAT included), on 0 does revenue exclude VAT.
- WHY IT IS NOT A LIVE VIOLATION: all 28 VAT-bearing rows are SOFT-DELETED synthetic training data
  (source_batch world-2026-08-13). Every one of the 46 LIVE rows has vat_sar=0, so live revenue/cost/profit
  are clean (matches fire #17). The reason live data is clean is that the live importer FORCES vat_sar=0
  (js/65:506 "recorded as unknown (0), never guessed at 15%") — i.e. the M1 guarantee rests on an importer
  CONVENTION, not on the trigger. A different write path (manual insert, a future import variant, or a data
  restore) that sets vat_sar>0 would silently violate M1 with no guard catching it.
RECOMMENDED FIX (owner / Claude Code — this is a PRODUCTION money-trigger migration + money doctrine, so I did
NOT change it myself; rule 9 carve-out + "money → DECISIONS first"):
  (A) make the derive doctrine-self-enforcing: revenue := round(total_incl_vat_sar - coalesce(vat_sar,0) -
      wallet_portion_sar, 2) — then even a VAT-carrying row yields clean revenue; confirm first that
      total_incl_vat_sar is semantically VAT-INCLUSIVE in the live import before applying, and/or
  (B) add an enforced invariant (CHECK or a live-data probe) that no non-deleted finance_invoices row may have
      vat_sar<>0, encoding today's convention so a regression is caught rather than merely currently-true.
No code/data changed this fire (read-only). No new oversight commits (HEAD 9dfe43a).

## Routine fire #20 (2026-09-11 08:11 UTC) — runnable regression net re-run (all green) + Reports surface verified EN+AR
Two parts. (1) Re-ran every probe that CAN run in this reprovisioned container:
- check-structure ✓ · check-probe-integrity ✓ · check-decisions-wired ✓ (38 ACTIVE rules, 134 code
  citations all resolve) · probe-battery-retry-honesty ✓ · probe-fullwalk ✓ (ALL PASS 56, full page +
  Finance-tab walk EN+AR against the mock).
- Of the 186-line battery, only these + the 3 pure-Node checks run here. The rest are correctly either
  credential-gated (sign in as real staff; emp-rig reads DB_PW_* which are never in this repo) or browser
  probes still blocked by the known Playwright route-GLOB issue in reprovisioned containers — that fix is
  100+ shared files needing in-browser verification, i.e. Claude Code's lane, not this session's. So the
  net that CAN run is fully green; the blocked part is a known infra item, not a new defect.
(2) New surface — the Reports page (primary nav, walked in #13 but never reconciled). Overview renders a
  correct EMPTY state: 14 strategic objectives all at 0%, "0/30 KPIs with data", 0 achievements, 0% avg to
  2026 targets, "No achievements yet" — an unpopulated in-app KPI/objectives module reading THIS app's own
  DB (vkxoeeoauexyfpzqufqd), NOT the out-of-scope directksa-performance project (rule 8 — not touched).
  Verified in BOTH languages: AR is clean RTL with all 14 objectives + all tiles + the empty-state fully
  translated. **0 defects.** No new oversight commits this fire (HEAD 6ccdf17).

## Routine fire #19 (2026-09-11 06:13 UTC) — the money surface in ARABIC: RTL + translation + numbers spotless (extends #17)
Took fire #17's EN money verification into the AR dimension the mandate demands. Reviewed the Arabic
Performance + Clients & collections renders (live-DB screenshots). Everything the EN pass guaranteed holds
in Arabic:
- Full RTL layout, clean — nav/logo right, content flows right-to-left, no broken wrapping.
- Every UI label translated: المالية · الأداء · العملاء والتحصيل · السجل · منشئ التقارير · المصروفات ·
  مستندات الدفع · الحجوزات الفردية · استيراد; key indicators الإيرادات/التكلفة/الربح/المحصّل/المتبقي/عدد الفواتير.
- Numbers identical to EN and to SQL: revenue 2,030,764 · cost 1,538,142 · profit 492,623 · 46 invoices; the
  monthly chart and Plan-vs-actual (13.50M/11.45M/2.03M) match.
- The M8 honest-gap treatment is translated, not just present: the rounding-reconciliation note reads in exact
  Arabic; the period warning "⚠ 19 من 46 فاتورة … بلا تكلفة مسجلة — قد يظهر الهامش أعلى من الحقيقة"; a
  no-cost client prints cost "غير مسجّلة" / profit "غير معروف" (js/16 _cCell/_pCell AR branch) instead of full
  revenue; the clients footer "⚠ 7 من العملاء … إجمالي الربح أعلاه حدّ أقصى وليس رقمًا نهائيًا."
- No VAT in any money figure (AR side too).
So the highest-stakes surface is spotless in BOTH languages — numbers exact, RTL clean, doctrine warnings
fully localized. **0 defects.** No new oversight commits this fire (HEAD 2f121e5).

## Routine fire #18 (2026-09-11 04:11 UTC) — cross-company data-smuggling audit on real contacts: CLEAN
Tested the locked "no cross-company data smuggling" decision (every email/phone/domain on a record must
attach to the SAME company by a stable key; mismatches flagged, never silently merged) directly in SQL
against the real DB. The app renders contacts embedded in businesses.raw->contacts (15 contacts across 13
records; a separate 45-row `contacts` table exists but is not the rendered source).
Findings, all clean:
- 15 embedded contacts, all with corporate-domain emails — 0 personal webmail (gmail/hotmail/…), 0 carrying
  needsConfirm (nothing needs confirming, so no ⚠ badge — correct).
- 4 email + 4 phone values appear on more than one business record. Inspected every collision: each is the
  SAME company held under a duplicate spelling (a "Name" vs "Name — full legal name" pair, etc.), and the
  shared contact's email domain matches that company's own domain. That is NOT smuggling (one company's data
  on a DIFFERENT company) — it is the already-documented duplicate-spelling situation. No collision crossed a
  real company boundary.
So the no-smuggling invariant holds on the live data. The 3 duplicate company records this surfaced are the
kind CLAUDE.md already flags as the owner's to merge; merging real records is his call, so noted, not touched
(rule 2/7 — no unasked real-data mutation). **0 defects.** No new oversight commits this fire (HEAD 65739cf).

