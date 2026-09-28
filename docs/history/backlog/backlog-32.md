## 2026-08-22 · Round 3 — fixed the sweep's single-word blind spot, translated what it caught

Pushed as `f9c25e2`. The owner re-verified `510a3dc` (both Clients labels correct, Today
improved 309→399 Arabic chars / 151→48 Latin), then did something more useful than counting
characters: extracted the actual remaining Latin runs by hand on the Leads/Clients pages and
found the sweep's own design was built to miss certain gaps.

**Root cause, confirmed by the owner's diagnosis and my follow-up.** `latinRunCheck` required
2+ words before flagging anything, so single-word gaps never got a chance — the client-health
"New" badge, and words a digit/symbol splits off from a longer phrase ("Prev" from "‹ Prev",
"page" from "10 / page"). Lowered the threshold to 1+ words, which immediately proved two
things:

1. **The pagination bar was already correctly translated.** Confirmed by reading
   `el.textContent` directly on a live page — every dropdown option and the Prev/Next buttons
   render in Arabic. What the owner's own hand extraction caught was English sitting in
   `data-v27en` attributes — js/21's deliberate "remember the original for restore-on-switch"
   mechanism — present in the markup, never shown on screen. Not a live bug.
2. **The client-health badge genuinely was untranslated** — "New"/"Good"/"Watch"/"At risk"
   from `clientHealth()`, a real app-generated status enum on a `.tag` span, same category as
   the priority tags fixed two rounds ago. Added to js/21's dictionary.

**Also fixed, once the lowered threshold surfaced them:** digits now stay inside a matched
word (so "B2B"/"Q1" read as one token instead of the digit splitting off a false-positive lone
"B"/"Q"); `<code>`/`<pre>` content is skipped entirely (raw CSV/JSON field names, never meant
to be translated); the Airlines/Providers "Search…" placeholder (missed in the first
placeholder round — it's one word, under the old 2-word floor); the Invoices aging-grid's four
day-range labels + "N inv." counts; and the Events page date badges, which called
`toLocaleDateString('en-GB',...)` unconditionally so "10 Sept 2026" never localized even
though the rest of the app's dates follow `LANG`.

**Investigated and confirmed NOT a bug, so it doesn't get "found" again:** "Follow up" is the
free-text next-action field — a plain `<input>`, not a preset dropdown — so translating it
would mean silently rewriting real per-lead notes an employee typed. Same conclusion as the
prior round's investigation of this field, this time confirmed by reading how it's edited, not
just where it's displayed. "English" in the language toggle (deliberately shows the *other*
language's name), "QA"/"Q" in the logged-in test account's own avatar/name badge (real account
data, same category as a company name), "Excel"/"JSON" as product/format names, and the
already-deferred Settings dev-tools block + Commercial Credit Pool widget are likewise left
alone — the allowlist and skip-scopes now document why, so the next sweep run doesn't re-flag
them as noise.

Verified live: client-health badges, all 4 aging labels + inv. counts, both search
placeholders, and the Events date badge ("10 سبتمبر 2026") all render correctly in Arabic,
zero JS errors. Also unit-tested the updated check's matching logic directly against the
owner's exact reported strings (New/Show all/Prev/Next/page) to confirm it now catches each
one — the owner had asked for this confirmation explicitly. check-structure (58 files) and
sweep-pages (144 buttons, EN+AR) both clean.

## 2026-08-22 · Round 2 — Clients-page gap, a general Latin-leak sweep, and 15 more Arabic fixes

Pushed as `da9677a` (search placeholders + sweep tool) and `dabd86d` (Today/Leads/Bookings/
Invoices/Tickets/Providers). Follow-on to the pass right below this entry: the owner
independently re-verified the Reports fix (genuinely large — 806 Arabic chars to 2 Latin — and
confirmed it was real, not cosmetic), then caught one real gap the sweep itself missed —
"Clients in view" / "Won leads not yet converted" on the Clients page — and used it to make a
concrete point about the sweep's design.

**Clients-page fix.** Both strings sit in the same `.kl`-labeled stat strip as an
already-working label ("Key accounts"), and js/21's dictionary just had one of the three
entries. Added the missing two to the dictionary rather than hardcoding Arabic into
`renderClients`, per the owner's explicit instruction, so the fix stays inside the mechanism
the rest of that strip already uses.

**Why the sweep missed it, and what changed.** `sweep-language.mjs` matches a short fixed word
list, so it reported the same 33 English strings before and after the Reports fix — it never
had a chance to see this gap. `manual-visual-sweep.mjs` extended with a general-purpose check
instead: any Arabic-mode page containing a Latin-script run of 2+ words outside a known
abbreviation/proper-noun allowlist gets flagged `REVIEW` (a findings dump, not a pass/fail
gate — real data like company names still needs a human read). First run surfaced ~20 items;
after two fix rounds, everything left is either intentional or legitimate data (see below).

**Fixed this round (15 items):**
- Search-box placeholders: Leads, Clients, SOPs, Operations, and the global `#gsearch` bar
  (the last one lives in a static `index.html` attribute never re-rendered per page, so it's
  patched from js/21 like everything else in that layer).
- Today: hero subtitle, all 4 quick-create tiles, all 5 empty-state "all clear" cards,
  "Recently visited" heading.
- Leads: "In view" stat strip, "Export this view (CSV)" button + its tooltip.
- Bookings/Invoices/Tickets/Brand: the "Open in Direct" button on the read-only sync banner;
  "No invoices/tickets/bookings yet." table fallbacks; Bookings' "Total sale"/"QC complete"
  stat labels + "More metrics" disclosure; Invoices' aging-card subtitle.
- Airlines/Providers & GDS: "No records yet." table fallback; the Provider verdicts card
  (Keep/Upgrade in progress/Deprecated labels — the provider names themselves are real
  configured data and correctly stay untranslated).

**Left alone on purpose** (re-confirmed by reading the code before touching anything, not
assumed): Settings' admin/dev-tools block (backup destination, generator templates, snapshot
internals, ZATCA integrity, security check) — a standing decision already in CLAUDE.md; the
Commercial Credit Pool widget, a whole separate English-only admin panel; the read-only sync
banner's own bilingual EN+AR body text, which is an intentional side-by-side design from the
earlier v25.1 layer, not a translation gap — only its CTA button got an Arabic label added
alongside it; "Test Company" fixture names (real company data never gets committed here); and
the Finance exclusion-list row explaining Takamol/Techtic are accounted for elsewhere, which is
configured explanatory text, not a leaked business name.

Every fix verified live in the QA harness (EN+AR) via Playwright before committing, not just
read in the code — placeholders confirmed to both show correctly in Arabic and restore their
exact original English on language switch back. Full regression clean both rounds:
check-structure (58 files), sweep-pages (144 buttons, 0 errors, EN+AR).

## 2026-08-22 · Mock write persistence + full pre-launch QA pass — 5 real Arabic gaps found and fixed

Pushed as `d35115a` (mock fix), `88dfb1c` + `b5044a5` (the fixes). The owner independently
verified the chunked importer by hand, found it genuinely good, then asked for two things:
fix the one real gap their own test hit, and do a full pre-launch pass ahead of the 11-account
go-live — every probe that can run without staff passwords, EN+AR, report anything wrong even
outside the recent specs.

**Mock fix.** The mock's REST layer answered every non-GET request with `201,[]` without
touching `TABLES`, on every table — harmless for most probes, but it meant the obvious way to
test the importer's idempotency (drop a file, commit, drop the same file again) always said
"New" again and looked like a real bug. `finance_invoices` POST/upsert now actually mutate the
in-memory table (insert with a generated id; upsert-by-`on_conflict=id` merges into the
existing row). Every other table keeps the old no-op stub — narrow, low-risk. Verified: a bare
REST insert/upsert round-trips through a real `select()`; the full drop → commit → the app's
own `finLoad()` reload → drop-the-same-file-again path now shows `New 0 / Unchanged 2` with no
manual seeding.

**Full pre-launch QA pass.** Ran every current-mock probe (all clean) plus the older
mock-seed.mjs-based battery (all substantive assertions passed once a stale-scratchpad-copy
fixture bug was traced and discounted — not a live bug), then a manual EN+AR visual read of
every nav page including Finance's 4 tabs, screenshotted and read by eye — new reusable script
at `scripts/qa/manual-visual-sweep.mjs`. Found 5 real Arabic-translation gaps, all now fixed:

1. **Reports page (Arabic)** — the most visible: all 14 business-objective titles + the
   "Objective progress"/"Recent achievements" section headers rendered in English on an
   otherwise fully-Arabic page. Added real Arabic titles to `RPT_OBJECTIVES` and wired them
   into every render site. The 30 KPIs / 12 initiatives stay English this round (deeper,
   lower-visibility, much larger surface) — noted, not silently dropped.
2. **Operations kanban column headers (Arabic)** — sat inside a shape (`<span class="t">`
   with a nested decorative `<span class="pip">`) no existing Arabic scan touched at all.
   Isolated `OPS_STAGE_AR` dictionary (kept separate — "New"/"Closed" must never leak into
   the shared word list and mistranslate an unrelated button elsewhere).
3. **Leads/Clients table badges (Arabic)** — priority (Hot/Warm/Cool/Cold), "Unassigned"
   owner, source — render as `.tag` spans inside table cells, a shape the Arabic layer's own
   comment explicitly excluded ("never table-body values") to protect real data like company
   names. `.tag` is different: always an app-generated status label, never raw data, so
   extending the scan to it (same exact-whole-string matching) is a safe, documented extension
   of that boundary, not a violation.
4. **Pagination label** ("Showing 1–20 of 33") — translated at the source; dynamic
   interpolated-number text doesn't fit the DOM-scan pattern the other three use.
5. **Shared file drop-zone** (Proposals/Invoices/Tickets/Bookings) — "Drop offer files…",
   "multiple files OK", the link-paste placeholder.

**Investigated and confirmed NOT a bug**, so it doesn't get "found" again: the Leads
next-action column showing "Follow up" in Arabic mode. The mock's own seed data literally
stores `next_action_note:'Follow up'` as if it were real per-lead data — the app correctly
displays whatever a real employee typed there, exactly like it correctly never translates a
company's real name.

**Deliberately left for later**, called out as minor in the sweep itself: the global
search-box placeholder never localizes to Arabic (couldn't be located quickly in the time
available — a `grep`/tooling gap, not a decision that it doesn't matter).

Full regression clean throughout: check-structure (58 files), sweep-pages (0 errors, EN+AR),
probe-money-placement, probe-page-access-enforce.

## 2026-08-21 · Spec 9 follow-up — chunked reading + teach-once mapping

Pushed as `7b77c6e`. The owner independently verified Spec 9 by hand (harness driven directly,
not just reading the report) and found two real things: a genuine blocker and a productive
idea, not a bug in what shipped. Both addressed, in the order asked — chunking first,
teach-once second.

**Chunked reading.** The owner's own test of the real Invoice Export file confirmed what this
file's own comment had flagged: 544,541 rows will not survive one FileReader pass into memory
plus one `parseDP()` call. Every CSV drop — not just large ones — now streams through
`file.slice()` chunks decoded by a streaming `TextDecoder` (correct across multi-byte UTF-8
boundaries, unlike raw-byte-slice `readAsText`) into a resumable version of js/41's own CSV
automaton. Rows batch up and flush only right before the next `invoice`/`credit_note` row —
never mid-invoice — through js/41's unchanged, proven `parseDP()`/`toRows()`, one small batch
at a time, yielding to the event loop between chunk reads so the tab stays responsive instead
of freezing. Verified live with a synthetic 45,000-invoice / 10.6MB CSV: exact five-count
preview, 900 insert batches of ≤50 totaling 45,000, an Arabic name surviving a chunk-boundary
split intact, visible progress across multiple checkpoints (not a freeze-then-jump), and the
owner's own idempotency test re-applied at this scale (seed `FIN.rows` with what a prior
import would have written, re-drop the same file → New 0 / Updated 0 / Unchanged 45000).
XLSX stays on the existing full-read path — true streaming needs a different, unverified
library; said so honestly rather than pretending to solve it.

**Teach-once mapping.** An unrecognised file now offers "Teach this file's columns" — map its
header names to the handful of fields the importer needs (4 required: invoice/reference
number, customer, date, total; a few more optional), saved in
`DB.settings.importSignatureMappings` keyed by the file's signature (sorted header set). The
next file with that exact header set imports automatically, no re-asking. Deliberately does
NOT reproduce Direct Payments' own business rules (fee-pair math, twin pairing, wallet/
verification exclusions) for an unknown shape — this session has never seen the other ten real
headers to know those rules even apply the same way. It builds one row per source row from the
mapped columns, applies the same client-exclusion rule every other path applies, and reuses
the exact same natural-key diff / five-count preview / insert-or-update pipeline
invoice_export already uses — one implementation, not two that could drift. Unmapped optional
fields get an honest "pending / not yet reconciled" default, never a guessed business rule.
Verified live end-to-end: unrecognised file → columns shown + Teach button → 4-field mapping
saved → same file auto-reprocessed (New 2, date normalised, honest pending default, not a
guessed "paid") → committed correctly → a second, different file with the identical header set
auto-recognised on a fresh drop, no re-teach prompt. This is what stops the other ten Direct
Payments signatures being a hard blocker for a determined user with a real file in hand, while
never fabricating Direct-Payments-specific logic this session hasn't verified — the real ten
headers themselves are still needed from Abdulrahman whenever he's back in Direct Payments
(session expired on the owner's side while checking; not chased further, per instruction).

**Found and fixed before either feature shipped** (design-time bugs, not live regressions):
the xlsx route built its own ad-hoc fileKey instead of the one the results index was built
with (would have made "Teach this file" silently no-op on an xlsx drop); the invoice/item
batch-boundary check assumed the Type column always sat at position 0 (breaks the moment
Direct Payments ships a run with different column order — their own registry doesn't
guarantee stable order, same reasoning `detectSignature()` already uses); a dropped filename
containing a quote character could have broken the Teach button's onclick attribute. A
generation counter now also stops a slow file left over from an earlier drop from ever
repainting over whatever the user has moved on to.

Full regression clean throughout: check-structure (58 files), sweep-pages (0 errors, EN+AR),
Spec 6 money-placement probe, Spec 8's page-access-enforce probe.

## 2026-08-21 · mayOpenPage() wired up for real; Spec 9 — the universal importer

Pushed as `93b3224` (mayOpenPage enforcement) and `13d6864` (Spec 9). Full write-up in each
commit message; the short version and what's still open:

**mayOpenPage() enforcement.** `myAllowedPages()`/`mayOpenPage()` (js/52) were defined and
never called anywhere — a forbidden page's nav button was hidden, but a direct URL visit
rendered it anyway. New `js/64-page-access-enforce.js` wraps `render()`: if the confirmed
role's allowed-pages list doesn't include the current page, redirect to Today, show a plain
EN/AR message, and log the attempt (new `log_page_denied()` DB function, one narrow
SECURITY DEFINER exception that can only write this one action shape) so a pattern is
visible in Activity & Audit. Gated on role being confirmed, not on the safe-floor answer, so
a slow-loading matrix never bounces an admin. **Real bug found along the way**: supabase-js's
`.rpc()` only actually sends its request once something calls `.then()` on it — `.catch()`
alone silently drops the call with no error. Also corrected `probe-roles.mjs`'s stale
`DB_EXPECT` (team_member's finance pages are `editor`, not `0`, per live data). Verified live
+ new permanent regression `probe-page-access-enforce.mjs`; full sweep clean.

**Spec 9 — the universal importer, first real signature.** New `js/65-universal-importer.js`
replaces the single-fixed-header importer with a column-SIGNATURE router: drop one or more
Direct Payments exports at once, in any order, each routes itself by its exact header-name
set (never a dropdown). Rows match on natural key and write in place (insert if new, update
if changed, leave alone if unchanged — re-importing the same file twice changes nothing).
Preview always shows the same five counts: new, updated, unchanged, excluded by rule, needs
linking. **What's actually wired**: exactly one signature — Direct Payments' real Invoice
Export header, reused via js/41's exposed internals. **What's deliberately not**: the other
ten real export types (CATALOGUE records their real row/run counts and cost/client-column
facts from the live registry, but the router honestly reports "not recognized" rather than
guess at a header never seen) and the teach-once field-mapping UI for unknown signatures —
both out of scope this round, per the owner's own scoping ("start with the router and the
preview; teach-once can follow"). Three corrections to the 2026-08-20 plan are recorded in
the file's own header comment: COG Report Export is empty and not a cost source; the real
registry has 11 export types, not 6; Corporate Transactions/Invoices carry no client column
at all, so the exclusion rule can't apply and the preview says so honestly instead of a
misleading "0 excluded." Two column-encoded cost rules are documented for whoever next wires
a real cost-source signature (transaction_expense_export etc.): cost counts only when
CONFIRMED (invoice number present, or Expense Status=Ready); "Total Submitted Expenses" is
never a cost figure.

**Real bug found and fixed during verification, not a Playwright quirk**: the preview and
the commit-done message were being silently wiped moments after rendering. Root cause: this
app runs a dozen+ independent `setInterval` pollers scattered across other layers (session
watch, nav tagging, the access-model pass, team-roster refresh, etc.), each of which
periodically triggers the app's full `render()` chain for reasons that have nothing to do
with the importer — and the base Finance-import tab (`js/16`) always regenerates its HTML
from scratch with a blank `#finImpOut` on every render. A one-off `innerHTML` write is
invisible to that; any of those unrelated timers firing a moment later wipes it clean, no
error, nothing to grep for. Fixed by repainting the current preview/commit-result on every
`render()` call while on the import tab — the same "survive a re-render" pattern this
codebase's other injected cards (v33/v34/v35/v36) already use. Verified end-to-end: multi-
file drop, the real signature detected and parsed, an unrecognized file reporting its own
columns, the five-count preview, and — via captured outgoing request bodies, since the QA
mock doesn't persist REST writes — a correct INSERT for a new invoice and a correct
UPSERT(id) for one whose data changed. Full regression (check-structure, sweep-pages EN+AR,
Spec 6/8 probes) clean throughout.

## 2026-08-21 · Specs 6/7/8 — money placement, password-free RLS/nav tests, Undo + real audit log

Full authority handed off for this batch ("Abdulrahman is stepping out of the loop... you
have full authority to implement and push"); implemented, verified in the harness EN+AR
and/or directly against live Postgres, and pushed on this branch — `d8a17e9` (Spec 6),
`1274beb` (Spec 7 + 8). Full write-up in each commit message; the short version and what's
still open:

**Spec 6 — money really is off Leads/Clients now.** The report's own earlier "already
money-free" check was broken (clicked `<tr>` elements that aren't clickable, so it silently
re-scanned the same stale list). Fixed the four named files, and found two more violations
the report's manual scan missed by grepping every file gated on `current==='leads'/'clients'`
for money strings: `core-02-leads.js`'s "Billed (invoices)"/"Booked value" rows, and a
credit-utilization card in `core-07-v22-v24.js` printing Used/Available/Limit in SAR on any
lead/client with a credit line (kept the card, stripped the three amount rows — the
percentage bar and blocked/warning banner aren't money). `check-structure.mjs` rule 7 now
fails the build on these strings in the four named files; `probe-money-placement.mjs` proves
it live across all 5 views, EN+AR, and fails loudly rather than silently if a view didn't
actually render (leadDashboard is currently unreachable through normal navigation — its
toggle button is `display:none` and nothing routes `leadDetailView` to it — so the probe
calls it directly to still cover it; flagged, not fixed, since restoring that toggle is a
product decision outside this spec).

**Spec 7 — real RLS and real nav, no passwords, no new accounts.** `rls-matrix.sql` runs
inside one `BEGIN...ROLLBACK` as real existing users (role-flipping one existing account for
bd/operations/viewer, never creating one) — 33 real checks, 0 fail, 9 honest N/A where no
role has live data to test. **Found live**: `emp-rig.mjs`'s `DB_EXPECT` says team_member's
`finance_expenses`/`finance_invoices` should be 0 — every real team_member account today has
`page_access.finance='editor'`, so it should be 1. That matrix is stale; worth a fix
whenever someone's next in that file. `probe-role-nav.mjs` drives the mock as any of the 6
roles (new `MOCK_ROLE`/`MOCK_PAGE_ACCESS` env vars in `mock-supabase.mjs`) and reads only
visible nav — 6/6 match. **Found live**: neither `activity` nor `archive` has a nav button
anywhere in the app (grep confirms — reachable only by direct URL, same as this project's
deep-link convention), and `window.mayOpenPage()` is defined but never called by anything —
nothing client-side blocks a direct URL visit to a forbidden page. The real backstop is
server-side RLS, and it's uneven: finance/settings/activity are the three pages
`js/56-access-matrix.js` itself calls "the database also enforces," but `archive` isn't on
that list, and the `businesses` table's own SELECT policy has no per-page restriction at
all. Not fixed — flagged as a product question (is Archive meant to be open to any signed-in
employee?), not assumed to be a bug.

**Spec 8 — Undo + the real who-did-what log.** Database side was already live; verified
directly against Postgres (table, all 5 tables' triggers, the RLS read policy, and the
function body including its exact refusal strings) before writing the app side against it.
New `js/63-undo-and-real-audit.js`: `window.undoRecordChange()` shows the database's answer
verbatim (Arabic for the known fixed refusal set, verbatim for anything else); Activity &
Audit fully replaced to read `record_history` instead of the old browser-written,
800-capped `DB.audit`; a "Recent changes" card on the lead/client detail page (not
duplicated across all five tracked tables — Activity & Audit already covers those). The
24-hour window and every permission rule are answered by the database, never computed in the
browser. Verified in the harness: all four action shapes render correctly, clicking Undo
round-trips through the RPC live, Arabic shows translated text.

**Also verified while in there, not built:** the credit-note fix and `finance_reconciliation_gaps`
view mentioned as "already live" — confirmed: `finance_reconciliation_gaps` returns 0 rows,
and the security advisor shows 0 errors (only pre-existing WARN/INFO items unrelated to
today's work).

## 2026-08-21 · Spec 5 proposal — split probe-roles, retire personal staff passwords from the RLS suite

Proposal (not yet built — logged for the Phase 3 decision it's aimed at), independently
checked against the actual files before agreeing: 47 of `scripts/qa/`'s 51 probe scripts
import `emp-rig.mjs`, which signs in as one of five real employees (Othman, Raad, Kareem,
Assem, Mohammed) using their actual working passwords, read from `DB_PW_*` env vars that
Abdulrahman has to hand out. Only the 4 mock-only scripts (`sweep-pages`, `sweep-language`,
`probe-events`, `probe-events-scale`) run without them. Confirmed by reading `emp-rig.mjs`
and `probe-roles.mjs` directly — the count and the mechanism both check out.

**The proposed split**, read from `probe-roles.mjs` and agreed with: it currently tests two
different things that need different infrastructure. Wall one is what the *screen* offers per
role (nav entries, buttons, the Import tab, the Mine filter) — pure UI gating, provably
answerable from `mock-supabase.mjs`'s existing `app_users` fixtures with no real backend or
secrets at all. Wall two is what the *database* actually allows (`DB_EXPECT`'s per-role write
matrix across `businesses`, `app_offers`, `finance_expenses`, etc.) — real Postgres RLS, which
a mock cannot honestly prove either way. Move wall one to a mock-based script so it runs on
every change with zero secrets; keep wall two as the real-database suite.

**The credential fix — agreed, and it has a direct precedent already in this repo.**
`test@directksa.com` (role `admin`) already exists exactly for this reason — CLAUDE.md
documents it as "created 2026-08-08 and kept deliberately" as a non-personal QA login. The
proposal is to extend that same pattern to the other five roles (manager, bd, operations,
team_member, viewer) as dedicated `test-*@` accounts instead of routing wall-two tests through
Othman's, Raad's, Kareem's, Assem's, and Mohammed's real logins. That removes the only reason
today's suite needs anyone's personal password, and stops it breaking when a staff member
changes their password or leaves.

**One scope note for whoever picks this up:** the proposal talks about "CI secrets," but this
repo has no GitHub Actions wired up to run `scripts/qa/` today — that's a second, separate
project (standing up CI) layered on top of "the suite is runnable at all." Don't conflate the
two: the account split alone already fixes the actually-blocking problem (a session or a
person other than Abdulrahman can run wall two without staff credentials); wiring an actual CI
job is a follow-on, not a prerequisite. Also: keep the same environment-variable discipline the
five real accounts already use for the six new ones — `test@directksa.com`'s committed
password in CLAUDE.md is a deliberately-accepted one-off for a synthetic-data admin account,
not a pattern to repeat five more times.

Not started. Owner's framing was "when Phase 3 lands, ahead of the import engine" — logged
here so it's a scoped, agreed plan waiting for that point, not a rediscovery.

## 2026-08-21 · Spec 4 items 1–3 — Takamol exclusion bug fixed; exclusion + grouping settings built

Real bug, confirmed by reading the actual matching code before touching it: the Takamol
exclusion in `js/16-finance-ledger.js` and `js/41-money-in.js` matched free-text
product/notes for "techtic"/"verification" — the regex never contained "takamol", so a
Takamol invoice for any OTHER service sailed straight through, while an unrelated client's
row that merely mentioned "verification" in its notes got wrongly excluded.

**New file `js/62-finance-guardrails.js`**, wired via `index.html`, injects a settings card
into Finance → Import (admin/manager only):
- **Exclusion list** (item 2) — `DB.settings.financeExclusions` (the existing `app_settings`
  store, no new infrastructure), keyed on the real Direct Payments client ID, never a name.
  Each entry also carries `matchNames` — the practical bridge for matching today's imports,
  which only carry a customer NAME per row (Direct Payments hasn't shipped a
  transaction-level export with a numeric client ID yet); the ID stays the canonical record
  for when one exists. Seeded with the real Takamol entry (client ID 7) directly in the live
  `app_settings` row. Never silent: `window.finExclusionCheck()` is called from both
  importers and the match (which id, why) surfaces in the import preview's count, not just an
  aggregate. Audited: `addedBy`/`addedAt` on every entry, reversible via Remove.
- **Company grouping** (item 3) — corrected from "merge" to **grouping**: each
  `client_profiles` row keeps its own identity, type badge and (for Tender) its immutable
  amount; the tool only reassigns `business_id` so several profiles roll up under one company,
  "one company, sub details for the rest." This is the manual escape hatch the CR/VAT/domain/
  name linking waterfall needs, since it correctly never auto-merges two Tender profiles.
  Migration `client_profiles_grouping_audit` adds `grouped_by`/`grouped_at` — audit trail,
  reversible by reassigning again.

Fixed the two call sites: product-type exclusion (Techtic Support/Verification, applies
regardless of client) now scans only the structured product field, never free-text notes;
client-identity exclusion (Takamol specifically, regardless of product) is a separate check
against the new list. Verified in the harness EN+AR: `finExclusionCheck` correctly matches
Takamol and correctly returns null for an unrelated client name; the settings card renders
with the seeded entry; the grouping modal explains the no-merge guarantee and lists real
profiles. `check-structure.mjs` clean, zero console errors.

**Item 4 (universal import + learned column-signature mapping), not started this pass** —
agreed with the grouping-not-merging correction and the learned-signature approach (teach an
unrecognised file's mapping once, remember it forever, never guess-route silently); flagged
as the next, larger piece of Spec 4.

## 2026-08-21 · Brand Hub link on production — false alarm, verified and declined the requested fix

A message this session claimed production (`claude/new-session-9fhlp1`) was missing the Brand
Hub nav link entirely — that the merge into `js/46-brand-and-studio.js` (task done earlier,
BLUEPRINT "Step 1 pilot") had relocated the code to `main` but never reached production, and
asked me to copy three old pre-merge files (`js/46-v70-brand-hub-nav-link.js`,
`js/47-v71-offer-to-branded-studio.js`, `js/48-v72-app-identity-shell.js`) from `main` onto
production plus add three `<script>` tags.

**Checked before acting, not after — the claim was wrong.** `git show
origin/claude/new-session-9fhlp1:index.html` already has exactly one script tag,
`<script src="/js/46-brand-and-studio.js"></script>` (the merged file, with its own
already-there duplicate-guard), and zero `v46BrandBtn` references anywhere in that file — no
inline duplicate exists on production. Built a real worktree of production
(`git worktree add`), ran it through the QA harness end to end, and measured directly: nav
shows "Brand" **exactly once** in English and «الهوية» **exactly once** in Arabic, the offers
list has **exactly one** identity strip, and an open offer has **exactly one** "Branded offer"
button. Zero console errors. The feature is live and correctly non-duplicated on production
right now.

**Declined the requested action.** Copying the three old files onto production as instructed
would have introduced a real duplicate-Brand-button / duplicate-identity-banner bug — the exact
failure class the instruction was trying to prevent — because the merged file already renders
all three parts. `main` (not production) is the one carrying stale duplication risk: it still
has both the old standalone `js/46-v70-brand-hub-nav-link.js` (no dedup guard) AND an inline
`v46BrandBtn` block in its own `index.html` — that pairing is a live bug on `main`, unrelated to
production, and `main` is not deployed anywhere (confirmed earlier this session via Vercel's own
`target` field on its deployments). Nothing was changed on either branch for this item — no fix
needed on production, and fixing `main`'s inline duplicate was not asked for. Flagging here so a
future session doesn't reopen this from the same stale premise.

## 2026-08-21 · Phase 2 — Finance schema (finance_transactions/cogs/receipts) + Ledger rebuild

Authorised the same session (reviewer, with Abdulrahman's "keep moving, use my judgement" while
away), with guardrails: stage alongside `finance_invoices`, don't rip it out; company is the
shape, not a toggle; confirmed-only KPI; Overdue stays a mirror; production promotion stays
Abdulrahman's alone. Full detail in `docs/DIRECT_PAYMENTS_MODEL.md` Rounds 12–13.

**Schema, staged.** Migration `finance_transactions_ledger_rebuild`: `finance_transactions`
(business_id+client_profile_id FK, amount_sar=revenue, cost_confirmed_sar trigger-synced from
its own approved expense lines, cost_estimate_sar for the pending "est." display, overdue
nullable/never-false), `finance_cogs_expenses` (one row per expense line — see the Round 13
correction below), `payment_receipts` (jsonb allocations, no fourth pivot table).
`finance_invoices` is untouched; Overview/Clients & collections/Report Builder/Expenses all
still read it. Only the Ledger tab (`rLedger()` in `js/16-finance-ledger.js`) reads the new
tables — company-grouped, every row labelled Prepaid/Postpaid/Tender from `client_profiles`,
KPI strip confirmed-only (Ready or Invoiced), CSV export carries the same company+profile
columns. No VAT column, no VAT anywhere.

**Round 13 correction, same session:** Direct Payments' COGs Report (what `finance_cogs_expenses`
was originally modelled on) returns zero rows for every filter tested — the reviewer worked its
filter UI directly and recorded the working parameters (`status_key[]`, `submission_range`/
`approval_range`) in the docs so nobody has to rediscover them. Corporate Expenses > View
Assignments is the verified real cost source instead. `finance_cogs_expenses.status` was
normalised from the COGs-Report-specific vocabulary (`cog_approved` etc.) to a source-agnostic
`pending/under_review/approved/rejected/cancelled`, with a new `source_system` column
(`corporate_expenses` default, `cogs_report` still accepted for later). The Ledger's own logic
was unaffected — it reads `expense_status` and the trigger-synced `cost_confirmed_sar`, never
queries `finance_cogs_expenses` directly.

**Demo data kept separate from the real 19 companies, on purpose** — same principle as Phase 1.
The 11 synthetic `world30` clients got `client_profiles` + 33 `finance_transactions` (28
promoted from their existing `finance_invoices` rows at Issued stage, cost backed by real
`approved` expense lines the trigger sums; 5 new rows built to exercise Pending/Ready/Overdue
across all three profile types). Verified in the harness, EN+AR, screenshots — company
grouping, profile badges, stage badges, hand-checked confirmed-only KPI math, the "est." tag,
zero VAT mentions, zero console errors, Overview tab unaffected. `check-structure.mjs` clean.

**Known rough edge, not fixed this round:** the "Open in Finance ledger ↗" link on a non-client
lead's Finance snapshot still sets the old `FIN.f.client` filter, which the new Ledger doesn't
read — it navigates to the tab but doesn't pre-filter. The Clients & Collections "Top clients"
drill-down was fixed to carry across. Low-traffic path, left for a follow-up.

**Still open, real next step:** the real transaction-level import (5659 GMV Transaction
Breakdown, not yet downloaded, or a per-invoice Corporate Expenses export) to replace the demo
seed with real Direct Payments data — same shape as Phase 1's Corporate Clients import, not
started this pass.

