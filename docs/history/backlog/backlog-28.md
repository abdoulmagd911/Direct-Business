## 2026-09-02 (later) · "What else needs to be fixed? Perform immediately" — full audit, fixed same day

Method (bulletproof-audit): run the ENTIRE probe suite (57 files, not the finance battery), a
live contradiction sweep across every table pair, and the Supabase advisors; attack, fix, re-run.

**Broken and fixed — the app.**
1. **The app was blind to 38 people and most activity history (M19).** Cards read contacts and
   history from the JSON inside the business row; the imports and the merge function write to the
   separate `contacts` / `activities` tables, which no screen read. 29 live companies showed "No
   contacts yet" while their people sat in the table. New `js/72-people-bridge.js` shows both,
   deduped; `js/02` never writes table rows back into raw; a contact's "needs confirmation" flag
   is now a visible badge with its reason. Probe + sabotage.
2. **Merges left the embedded people behind.** The three merges made earlier today moved the table
   rows but not the JSON lists the cards read — fixed in the function (carried, tagged, undoable)
   and repaired on all three (+4 people and +12 history rows across the three).
3. **A 22-Aug manual cleanup had archived two duplicate companies with their money still on
   them.** ≈163,550 SAR across two clients of transactions, plus contacts,
   activities and profiles, sat on archived records where no Ledger row could reach them. Both
   absorbed into the live Direct-import records through the audited merge (reversible).
4. **The the IT-services client merge had doubled one person** (three rows for one coordinator). Merges now FLAG a
   moved contact that duplicates one already on the kept company — never silently double, never
   delete; the two the IT-services client copies are flagged for a human, visible on the card.
5. **One half-converted client** (one Direct-Payments-import client): client flag set on the row, unset in raw, no
   converted date. Synced; converted date = its first real invoice date (18 Aug), not a guess.
6. **Binary junk renamed .csv** was shown as "not recognized — Columns found: %PDF…" with a Teach
   button. Now: "this is a binary file, not a text CSV — export as CSV". (Landmine L6.)
7. **Events list trusted the database for date order** — an undated event could sit first. Order
   is decided on screen now: soonest first, undated last.
8. **The confirm pop-up rewrote messages** (earlier today, kept here for the record).
9. **Eight database functions had an unpinned search path** (advisor WARN) — pinned, no
   behaviour change, same fix as the M16 function.

**Probes corrected (not deleted).** Five probes asserted wording from before deliberate changes;
each now guards the decision that replaced it (promo card ABSENT by rule; Ledger reads
transactions and must NOT move with an invoice edit; "Collections & ageing" heading; the
importer's five-count wording; the optional-columns filler that was dropped on purpose); one
seed carries no transactions so its export check accepts the plain "No rows to export".

**Suite result after fixes.** Every runnable probe green: landmines 21/21, mega 49/49, notes
17/17, round8 14/14, events-scale 16/16, plus the finance/importer battery, dedupe, alias,
people-bridge, structure and decisions-wired checks. 18 files could not run here: 12 need the
staff's real logins or the live database (emp-rig), 6 are older live-only scripts — environmental,
listed, not claimed green.

**Live after the repairs (read-only sweep).** Zero orphan transactions, zero contacts on archived
companies, zero flag mismatches, zero open-profile collisions, zero duplicate pairs by any
signal, money invariants hold on all 46 invoices; 80 leads / 28 clients / 4 archived; 3 live
merges, each undoable from the Import card.

**For the owner — decisions only a human can make (nothing changed).**
- **One trading-company client (converted 20 Aug)** is marked a client (converted 20 Aug) AND stage "Lost". Which is it? If
  lost, it should stop being a client; if a client, its stage is wrong.
- **20 clients have no owner** (all from the corporate import + one Direct-Payments-import client). Owners are
  people; I do not invent them. Assigning them is a 10-minute pass on the Clients page.
- **6 clients have no money in the app at all** (names in the database — `businesses` where `is_client` and no finance link): no invoice, no transaction, one profile each.
  Real, or imported by mistake?
- **The two flagged the IT-services client contact copies** are on the IT-services client card with a "needs confirmation" badge
  — keep one, remove the others, when convenient.
- Advisor items deliberately left: functions the app calls before sign-in are callable without
  signing in (by design for the share link and role lookup), leaked-password protection is off in
  Supabase Auth (one dashboard toggle, your call), and the many "multiple permissive policies"
  notices are performance, not safety.

## 2026-09-02 · M18 — duplicate companies fixed for good, the IT-services client merged live, second sweep clean

Owner's ruling on the 2026-08-29 finding: both records of the IT-services client are the same company; "find the fix
for the future … whether on the merge or combined clients or anything, and go ahead." Also ruled:
the repo stays public (recorded under CLAUDE.md rule 7 — do not raise it again).

**Built (rule M18 in `docs/DECISIONS.md`).** (1) The automatic finance↔client linker now lets a
declared alias sibling WIN over a plain name match — the exact mechanism that split that client.
(2) A "Duplicate companies" section on Finance › Import (admin/manager) finds likely pairs by
alias-split links, Direct client ID, CR/VAT, normalised name (EN/AR/legal) and website, states
the reason, previews both records with their invoice counts, and offers Merge » / Not a
duplicate. (3) Merging is ONE audited database call that moves every child row (contacts,
activities, requests, offers, billing profiles, invoice links, transactions, documents…) to the
kept record, fills only its empty profile fields, archives the other (never deletes), and is
undoable from the same card. Three probes guard it (`probe-company-dedupe.mjs` end-to-end incl.
undo; `probe-alias-autolink.mjs` precedence scenario), all sabotage-verified.

**Caught along the way, fixed.** (a) The browser confirm wrapper in `js/core/core-09-v26.js`
rewrote ANY prompt containing "archive" into "Delete this lead? … Yes, delete" and any prompt
containing "reset" (the Users page's password-reset link) into "Clear all test data? … Yes,
clear", throwing the caller's real words away. Templates now apply only to short prompts that
start with the intent word; anything longer is shown as written. (b) The first live merge was
refused by the database — both records of the IT-services client held an open postpaid billing profile and only one
open profile of a type may exist per company. The refusal was atomic (nothing changed). The
merge function now closes the colliding profile as it moves, with a note saying why, and undo
reopens it with its original note; the mock and probe cover the same shape. (c) The website
signal treated placeholder/shared domains as evidence (every QA fixture shares `example.com`);
placeholders are ignored and a domain shared by 3+ records is not a signal. (d) Detector now
also skips records soft-deleted with the older `_archived` flag.

**Applied live (owner-authorized, reversible).** The IT-services client merged: the older record → the Direct-import record (the
record carrying the Direct client ID, VAT number and payment terms). Moved: 2 contacts, 5
activities, 2 billing profiles (both closed on arrival — the survivor already had open prepaid
and postpaid ones; the notes say so), 1 finance link, 5 transactions. Verified after: the
survivor holds all three of its finance links (both Latin spellings + the Arabic one), 4 contacts,
5 activities, 5 transactions, 4 profiles of which 2 open; the dropped record is archived with
`merged-into:<survivor>`; one live audit row; zero finance links point at any archived company.
Undo = the Undo button on the same card, or `fn_unmerge_businesses` with the merge id.

**Second sweep (live, read-only, after the merge).** Live: 80 leads / 28 clients / 4 archived.
Duplicate signals across all non-archived companies — same Direct client ID, same CR/VAT, same
normalised name, same website, alias groups linked to two records: **none** — the IT-services client was the only
pair. Money invariants over all 46 invoices: cost never exceeds total, revenue = total − wallet
and profit = revenue − cost on every row, zero Takamol rows, zero duplicate invoice numbers, all
46 `verified_paid`; every B2B group is linked; 3 alias groups active. Structure check,
decisions-wired check (33 rules, every citation resolves) and the 8-probe finance/importer
battery all green.

**For the owner — one honest note, no action taken.** The 19 invoices "with no cost" are stored
as cost **0**, not empty, unchanged since 2026-08-22; the on-screen flag is what keeps that
honest, and their profit therefore reads as the full revenue. Turning those zeros into "unknown"
would be the stricter reading of "never fill a gap" but touches the derive trigger and Finance
display together — left as is, on purpose, until the real costs arrive through expense capture.

## 2026-08-29 · Full sweep — every owner instruction and note re-verified against live state, not against my own summaries

Owner-ordered. Method: take each instruction from the briefs and each standing note, and check
the live database, the live repo/deploy, and the code — not the BACKLOG entries that said it was
done. What held, what didn't, and what changed:

**Held (verified live, not assumed).** All three owner-decided alias merges exist and are
active — the owner created them himself on 2026-08-26 (Client M, Client Q, Client R); Public
Security and Client RC are single groups, no action needed, as decided. The M15 capture
tables are in real use (223 expense lines / 155 gate rows across 75 transactions). The oversight
session's single-invoice test (1163605511) that was the M16 blocker now carries a real cost,
written after M16 deployed — the real-data confirmation this project was waiting on has
actually happened. Live money invariants over all 46 invoices: cost never exceeds total,
revenue = total − wallet and profit = revenue − cost on every row, zero Takamol rows, zero
duplicate invoice numbers, zero generated-year mismatches; 19 invoices still carry no cost —
an honest gap, flagged on screen, never filled. RLS is on with policies on every finance table
including the two M15 capture tables. Production is on the latest commit and READY. The
current tree holds no real PII (the only phone-shaped strings are the fictional
`9665000000xx` placeholders); the `window.live` fallback bug class from M17 has no other
instance in the codebase.

**Fixed in this sweep.** (1) M14's instruction was only half-met: the alias map was consulted
at display time, not on the import/linking path — the automatic linker matched by business
name alone, so a fresh alias spelling that isn't a business name stayed "needs linking", and
`finSectorOf()` reads the link by raw group, so it would mis-sector. The linker now falls back
to the alias map (`auto-match-alias` provenance); new `probe-alias-autolink.mjs`, sabotage-
verified. (2) `fn_commit_finance_import` had a mutable search_path (Supabase advisor WARN) —
pinned, behaviour unchanged. (3) CLAUDE.md's "quick current state" still claimed the app held
assumption/test data with 4 leads / 6 clients — it holds real data, 80 leads / 32 clients;
corrected so rule 7 is read against reality.

**For the owner — data, his call, not touched (D1).** The two Client M spellings are linked to TWO
different company records: "Client M" and "Client M — Smart Madad IT" — a duplicate business, which is
why the Arabic spelling auto-matched to the second one. Display merges them (alias map), the
client card and sector do not. Also, the alias group's canonical name is "Client M", not the
"Client M - Smart Madad IT" the owner decided on 2026-08-25 — possibly deliberate; one Undo + Add
fixes it if not. Both need a human decision about which record is the real Client M.

**Still open, unchanged.** The repository is still PUBLIC (checked directly), so the real
customer PII removed from the code on 2026-08-27 remains readable in git history; making it
private is a one-click owner action that has not happened. The M12 recurrence report (waiting
on the oversight session's console dump). The P4-addendum ownership question for `js/45`,
`js/57`, `js/58`.

**Probe battery, all 57 scripts, honestly classified.** 37 green. 14 red for environmental
reasons only — they need staff passwords from the environment or the live Supabase project
and its login rigs, neither of which this sandbox has (by design, rule: passwords never in the
repo). 5 red for real: `probe-events-scale` (two Events-page assertions) and four older
rigs on the `mock-seed-live` harness (`probe-round9`, `probe-newfeatures`, `probe-lifecycle5`,
`probe-stress`) — all five re-run at the pre-session commit `2d5deef` in a clean worktree and
red there too, so they predate this session's work; Events is not a Finance-track file (P4),
left for its owner; the four stale rigs are worth either fixing or retiring by whoever next
touches that harness, so the battery stops carrying known-red scripts.
## 2026-08-29 · Real client names and invoice numbers scrubbed from this file (rule 7)

Owner ruled the repo stays public, so the fix for real client data in the docs is scrubbing,
not visibility. Throughout this file, real clients now appear as consistent placeholders
(`Client M`, `Client Q`, `Client RC`, `Client PS`, `Client B` …) and invoice/transaction
numbers as `<ref>` / `DPIN-<no>`. The mapping is not written anywhere in this repo — the real
names live in the database (`businesses`, `finance_invoices.client_group`,
`DB.settings.financeGroupMap`). Amounts were kept: they're Direct's own figures. Test-world
rows that happen to use real company names were replaced the same way for simplicity.
`CLAUDE.md` and `docs/DECISIONS.md` were scrubbed in the same commit.

**Same sweep, code side (Finance-owned files only):** the QA fixtures (`scripts/qa/mock-seed.mjs`,
`mock-seed-live.mjs`) carried eight real company names, two real company email domains and one
real government email address inside the otherwise-synthetic 30-lead training world — replaced
with fictional equivalents, consistently, and the two probes that looked those names up
(`probe-landmines`, `probe-newfeatures`) updated to match. `probe-client-group-map.mjs` had the
real EN/AR client name pair hard-coded as its fixture — now a fictional pair of the same shape
(short English name vs. full Arabic legal name); passes unchanged. `js/62`'s alias-form
placeholder example and `js/16`/`js/25` comments no longer name a real client. Re-run after:
structure OK · client-group-map OK · finance-invariants OK · report-presets OK.

**Three pre-existing probe failures surfaced by that re-run, NOT caused by it (confirmed by
running the same probes on the untouched tip first):** `probe-landmines` L6 (binary-junk CSV —
expects a "clear header error" wording the importer no longer uses since the M12 rewording)
and L14 (Arabic import page — the optional-columns label isn't Arabic); `probe-newfeatures`
times out looking for a "Proposals" primary-nav button that commit `e572cd3` deliberately
removed — the same stale-probe class fixed in `probe-role-nav`/`audit-ui-golive` on 26 Aug,
missed then because this probe wasn't in the run set. All three are probe drift, not app
defects; L14 may be a real Arabic gap worth a look. Left for the next QA pass.
*Reconciled 2026-09-02 (the audit round above): L6 turned out to be a REAL defect, not drift —
a binary file renamed .csv was shown as "not recognized — Columns found: %PDF…" with a Teach
button; fixed in `js/65-universal-importer.js`, probe green. L14 was drift: the
"two optional columns" line was dropped on purpose in the 2026-08-25 density pass; the probe now
checks the Arabic surfaces that exist and that no English leaked. `probe-newfeatures` imports
`emp-rig` (the staff's real logins) and cannot run from a sandbox — environmental, listed as
such, not green.*

**Outside Finance's files, same names appear in:** `js/core/core-06/08/09`, `js/57`, `js/70`
(comments and in-app copy like "Client M-style multi-trip engagements"), `brand/*` +
`docs/HANDOVER-B2B-LOGO-WALL.md` + `docs/B2B_LANDING_PAGE_REVIEW.md` (the public client logo
wall — public marketing, arguably fine), and `docs/DIRECT_MASTER_BRIEF.md`,
`docs/HANDOFF_2026-08-09.md`, `docs/DIRECT_SYSTEMS_PLAYBOOK.md`. Inventory handed to the Code
session; its call per file.

## 2026-08-29 · Five enhancement ideas from Direct's own product changelog — parked, not started

Source: the 20 weekly "Product Updates" pages on Direct's internal Info Center (Direct's own
product/dev org shipping to Hotels, Payments, the corporate B2B portal, Marketing). Read end
to end 2026-08-29; write-up in the Cowork project (`Direct Info Center — 20 weekly Product
Updates reviewed (Aug 29)` and `ENHANCEMENT IDEAS — from Direct's own changelog (Aug 29)`).
These are *patterns their team already validated on real users*, mapped onto this app's pages.
None is started; each needs the owner's nod and, for the finance ones, a slot that doesn't
collide with the open period-filter question above. Ordered by recommendation:

1. **Report captions naming the invoice statuses behind each metric** (Finance → Report
   Builder; `js/16`, Finance/oversight-owned). Their Marketing team labels every metric on
   screen with exactly which statuses feed it ("Total Sales = fully paid only"). Our Quick-view
   presets already do this correctly underneath — nothing on screen says so. Smallest, safest,
   directly serves M1/"only confirmed fully-paid counts" by making the rule visible at the
   point of reading. **Recommend first.** → **BUILT 2026-08-29** (owner: "act on what you
   recommend"): a one-line "What this report counts" caption under the Report Builder
   controls, computed from the same `rb` state and the same base row set the table is built
   from — never a second copy of the rule — stating scope (verified fully-paid only vs. all
   live incl. unpaid), period, the standing exclusions, the row count, and, honestly, that the
   period bar above does not apply to this report (the 2026-08-27 gap, now disclosed on screen
   rather than silent; the design question itself stays open). `probe-report-presets.mjs`
   extended: caption scope must match the preset, its count must equal an independent recount
   from raw rows AND the rows behind the rendered table, and it must say all this in words;
   fixture now carries one unpaid row so the two scopes differ (16 vs 17) and the count check
   can actually fail. Sabotage-verified (`SABOTAGE=2` inverts the caption's scope → 3
   failures). `sweep-language` and `audit-finance-tabs` unchanged before/after.
2. **"Uninvoiced work" vs "invoiced outstanding" as two lines, never one** (Finance Overview;
   `js/16`). Their Payments team split "Outstanding Balance" into "Invoiced Outstanding" and a
   new "Uninvoiced Transactions" line. Ours already keeps a Ready-vs-Pending split by rule
   (DECISIONS → "Only confirmed, fully-paid tax invoices count as revenue") — worth one probe
   confirming no card or export ever adds the two together, then a label pass. Verification
   first, feature second. → **VERIFIED + LABELLED 2026-08-29.** New
   `scripts/qa/probe-outstanding-split.mjs` proves, from raw rows recomputed independently:
   Overview "Outstanding" equals money still owed on live *invoices* only; the Ledger's
   "Confirmed revenue" is ready + invoiced transactions only, pending estimates shown
   separately; and no Overview tile carries the ready-but-uninvoiced transaction amount or a
   blend of the two. Sabotage-verified by hand (Overview made to add ready-transaction money
   into Outstanding → 3 failures; `js/16` restored byte-identical, md5 checked). Label pass:
   the Overview tile now reads **"Outstanding (invoiced)"** / «المتبقي (مفوتر)» so it says
   which outstanding it is; `diag-ledger` regex widened for the parenthetical. **Still open,
   the owner's call:** whether Overview should ALSO show a separate "Ready to invoice (not yet
   invoiced)" line the way Direct's Payments team does — it would mean Overview reading the
   transactions dataset (two tiles, never one number, so the rule holds), and deciding how the
   period bar applies to transactions (`created_at_source`). Not done unprompted.
3. **Invoice timeline card** (Finance ledger, per invoice; `js/16`). Their Hotels team added an
   "Order Timeline" — created → invoiced → paid → confirmed as one strip. Ours holds the same
   facts as separate fields (created, verified, paid, closed). Nice, not urgent; render-time
   only, no schema change (the M14 way).
4. **Proof-of-payment shown on the invoice itself** (Finance ledger ↔ Payment Proofs tab;
   touches `js/57-payment-proofs.js`, which P4 lists under NEITHER task). Their Payments team
   moved the proof viewer into the invoice screen. Blocked on the same ownership question as
   the injected-tabs period-bar item (DECISIONS P4-addendum) — decide both together.
5. **"Needs my action" queues with SLA timers on Leads** (Leads page; Code-session files).
   Their Hotels Leads queue split into Offer Needed / Confirmation Needed / All, with live
   timers and breach alerts. Not Finance's file — handed to the Code session as a finding.

Also noted, not for this app: their "Customer 360" is the same problem our client-grouping
(M14) solves at a bigger scale — confirms the direction, nothing to copy. And their corporate
platform's "Supply Date" auto-flowing into generated invoices/tax paperwork is a Generator
idea (dates typed by hand into tender/contract documents) — handed to the Generator task via
its own build log, not tracked here.

## 2026-08-27 · Report Builder is scoped independently of the Overview/Clients period bar

Found while self-auditing the day's Report Builder and Compare-to work (asked "what else did
you miss"). `FIN.rb.quarter` (Report Builder's own period filter) is a completely separate
piece of state from `FIN.p` (the period bar Overview and Clients & collections share) — it
only offers `all | Q1..Q4` with no year axis (so "Q1" spans every year in the data, not one),
no H1/H2/month granularity, and critically **no sector filter at all**. Concretely: pick
Sector = Tenders on the period bar, then go to Report Builder and click any Quick view — the
report is NOT scoped to Tenders, it silently includes every sector, with nothing on screen
saying so. This predates today's work (the two fields have always been separate) but the new
Quick views presets inherit it unexamined, since they only set `rb.g1/g2/quarter/verifiedOnly/
metrics`, the same fields Report Builder already had.

Not fixed now — this is a real design decision (does Report Builder become a fifth consumer
of `FIN.p`, or does it stay deliberately independent because grouped reports and the period
bar's headline KPIs are different jobs?), not a one-line patch, and it touches the same file
(`js/16-finance-ledger.js`) two different features already changed today. Belongs in the same
conversation as the `docs/DECISIONS.md` P4-addendum finding about Expenses/Payment
Proofs/B2C's own separate period filters — Finance now has at least three independent
period-filtering mechanisms (`FIN.p`, `FIN.rb.quarter`, the two `EXP.month`/`PRX.month`
dropdowns) plus one tab with none at all (B2C manual). Worth deciding as one thing, not
patching one at a time.

## 2026-08-27 · Re-checked two items left open in the M13 round; one closes, one stays open

Prompted by a routine status check, not a new report — went back to the two loose ends
logged on 2026-08-24 (in the M13 entry below) rather than let them sit unverified.

**Closes: the `finance_cogs_expenses_archive_20260822` RLS advisory.** Flagged then as "RLS
disabled — anyone with the anon key can read/write it," left for the owner to decide since
enabling RLS with no policy blocks all access. Re-ran `get_advisors` (security) just now: the
table now shows "RLS enabled, no policies" — someone already fixed it (no BACKLOG entry
recorded when), and deny-by-default is the correct end state here, not a half-fix — confirmed
by grepping `js/` and `scripts/` for any reference to this table: there is none, so nothing in
the app ever needs API access to a dated archive snapshot. Nothing left to do.

**Stays open: the M12 (import-tab wiring race) recurrence report.** The 2026-08-24 note left
this open pending a console-state dump from the oversight session, having found no second
code path that skips the wrapped `render()`/`finGo()` on inspection at the time. Worth
re-checking now because six new files landed in this repo since then — `js/66-71`
(document/price-offer/service-fees/company-profile/contract/tender tabs) and edits to
`js/core/core-08-v25.js` — any one of which could plausibly have reintroduced exactly this
shape by reassigning `window.render` or `window.finGo` without chaining the previous handler.
Checked every `window.render=` and `window.finGo=` assignment in the codebase (not just the
new files): all of them capture the prior function first and call it via `.apply()` before
doing their own work — none clobber the chain. Also checked for a duplicate `#finFile`/
`#finDrop` id that a new tab could have introduced (would let `document.getElementById` return
the wrong element depending on DOM order) — none exists; only `js/16-finance-ledger.js`
defines those ids. The hypothesis that newer files caused the recurrence is ruled out by this
check. The item is genuinely still open, for the same reason it was on 2026-08-24: nothing
found on inspection, still waiting on the diagnostic data already requested.

## 2026-08-26 (round 2) · Bulletproof/landmine premortem pass — six attacks written to land; five survived, one found a real gap

Owner-ordered follow-up to the hands-on round below: assume it is a month from now and the
importer has corrupted Finance data or silently lost facts, write the stories of HOW as
attacks designed to FAIL, run them, fix what lands, keep the attacks. All six are now a
permanent probe, `scripts/qa/probe-premortem-attacks.mjs`:

- **A — intra-drop summing**: two real expense rows for one transaction in one file must SUM
  (900+600=1,500), proving the M17 replace-per-drop fix did not break genuine multi-line
  expenses. Survived.
- **B — same-session update after commit**: an updated lines file dropped in the SAME
  session, after a commit, must REPLACE (400, not 1,900) — and the capture table must hold
  exactly the one new row. Survived.
- **C — the sharpest one**: a 6,000-row lines file through the REAL input, crossing the
  5,000-row streaming batch boundary, WITH the duplicate trigger (change event + Check
  click) fired while the first run is still streaming — 6,000 × 0.25 must land as exactly
  1,500, and exactly 6,000 capture rows. Survived — the generation guard holds under the
  race, not just in the tidy case.
- **D — torn merge**: two tax files in one drop disagreeing about the same invoice must end
  as the LAST file's consistent dpin/total pair, never an interleaved mix. Survived.
- **E — exclusion on the import path**: a tax file targeting the excluded Takamol invoice
  must not touch it. Survived.
- **H — LANDED (the premortem catch)**: a capture-only drop — the transaction-status (gate)
  file alone, exactly the "gate today, lines next week" incremental flow — offered NO commit
  button at all (`writeCount` gated it), so the captured facts silently died with the tab
  and the lines file dropped after a reload could never resolve (cost stayed at the stale
  fixture value; the owner would have concluded the feature is broken and re-supplied
  everything). Fixed: when nothing needs writing to invoices but pending captures exist,
  the preview offers "Save captured expense facts — N row(s)" through the same atomic RPC,
  with an explanatory line, and the Done message reports the database's own capture counts
  instead of a misleading "Imported 0 new, updated 0." Sabotage-verified both ways and
  re-run: all six attacks now survive.

## 2026-08-26 · Owner: "test the app yourself" — hands-on drive found four real bugs the whole green battery missed (M17)

The owner asked for the app to be tested by hand, and the standing rule ("verify UI work by
actually driving the app, not by reading the code") earned its keep again: a full
screenshot-everything walkthrough in the QA harness — login, Today, Finance tabs, a REAL
multi-select file drop on the REAL `#finFile` input, Confirm, the alias admin card, undo, and
an Arabic pass — found four genuine defects that every probe and the entire pre-commit battery
had just passed green over. The common thread, now the M17 rule in `docs/DECISIONS.md`: every
importer probe drove `v65IngestText()` (the scriptable text path), so the real input path —
the one the owner actually uses — had never been exercised by QA at all.

**Bug 1 — the natural flow processed every file twice.** Selecting files fires the input's
change event, which auto-processes; clicking the orange "Check file" button right next to it
(which any real user does) processes the same selection AGAIN. `GENERATION` guarded the
preview but not the session-level expense accumulators: a 900 SAR expense committed as a
1,800 SAR cost, and `finance_expense_lines_capture` got two identical rows. Fixed by making
the accumulators drop-generation-aware: a duplicate or deliberately re-dropped file REPLACES
a transaction's lines and pending capture (matching the owner's incremental-update model even
within one sitting), and a superseded drop's late streaming batches are discarded — the
generation is threaded into the stream's closure at start, so the race where the first run's
chunks land after the second run began is closed too, not just the tidy case.

**Bug 2 — two files updating the same invoice silently reverted each other.** In one drop,
the tax capture set dpin/total on invoice A while the expense join set cost on the same
invoice; each payload spreads the same stale base row, so the later payload's stale copies of
the earlier one's fields won — the invoice ended the commit with dpin null and the old total,
and nothing said so. Fixed by `mergeUpdatesByInvoice()` in `v65Commit()`: fields differing
from the shared base row are that payload's intentional changes, layered in file order onto
one payload per invoice (the database's own derive trigger runs on UPDATE too — verified
live — so derived money fields stay consistent server-side). New probe
`scripts/qa/probe-multi-file-single-drop.mjs` drives the real input (Playwright setInputFiles
→ change → auto-process, plus the redundant Check click) and judges by direct database reads;
both fixes sabotage-verified independently (1,800 + doubled capture row; reverted dpin/total),
restored byte-identical.

**Bug 3 — the M14 alias picker offered EXCLUDED clients.** Takamol appeared as a merge
candidate with its invoice count and total, because `groupCandidates()` leaned on
`window.live` — and js/16's `live()` is IIFE-scoped, so it never reaches window and the
fallback path skipped the exclusion filter entirely (in production too, not just the mock).
No money ever leaked into Finance numbers — row-level exclusion filters on the raw name
before any renaming — but an excluded client's name and total showing up as groupable
violates the standing Takamol rule. Fixed: the candidates apply `finExclusionCheck()`
directly, no window.live dependency at all.

**Bug 4 — the whole guardrails/alias card was missing on the common first paint of Import.**
v62 hooked only `window.render()`; clicking the Import sub-tab paints via `finGo()` →
`renderFinance()` directly — the M12 lesson repeating verbatim, two files down from where it
was first learned. Fixed: v62 wraps `finGo()` too. Both v62 fixes guarded in
`probe-client-group-map.mjs` — a picker-scoped Takamol-absence assertion, and a first-paint
assertion that only became honest after adding a settle wait: the probe's own seeding leaves
a pending debounced render that fires moments after finGo and injects the card
coincidentally, which is exactly why this probe had been passing over the missing card all
along. Measured both ways before trusting it (sabotaged build: card absent at +0.4s, +1.5s,
+5s in the user-shaped flow; probe red — fixed build: green).

Also verified while driving, for the record: the Workstream-1 density pass reads clean on
screen (one-line safety promise, no stale banner, no header dump); the combined multi-file
preview, the confirm dialog's merge summary (real counts and totals), Undo/Redo, and the
full Arabic RTL pass all behave; undo's confirm() dialog is why the drive script's
unhandled-dialog click didn't apply it — the probe, which answers the dialog, proves undo
end-to-end. One cosmetic note, deliberately not chased: the persisted "Done. Imported…"
result line replays in the language it was committed in, since it's a stored snapshot string.

