**M17 — the importer is only proven on the input path the user actually uses; every QA drive
of it must include one real multi-select on the real `#finFile` input.** Found by hands-on
driving (owner-ordered, 2026-08-26), not by any probe: every prior importer probe drove
`v65IngestText()` (the pre-parsed text path built for the oversight session), so two bugs in
the real file-input flow were unreachable by the whole green battery. (1) The input's own
change event auto-processes a selection AND the "Check file" button processes it again — the
natural flow (pick files, then click the button) ran everything twice; `GENERATION` guarded
the preview repaint but not the session-level expense accumulators, so a 900 SAR expense
committed as a 1,800 SAR cost and the capture table got two identical rows. Fixed by making
the accumulators drop-generation-aware (`processExpenseLinesBatch()` /
`processExpenseGateBatch()`, `js/65-universal-importer.js`): a duplicate or re-dropped file
REPLACES a transaction's lines and pending capture instead of appending — which is also
exactly the owner's incremental-update model within one sitting — and a superseded drop's
late streaming batches are discarded outright. (2) Two files in ONE drop can both update the
SAME invoice (tax capture → dpin/total; expense join → cost); each payload spreads the same
stale base row, so the later payload's stale copies silently reverted the earlier one's
fields inside the same commit. Fixed by `mergeUpdatesByInvoice()` in `v65Commit()`: fields
differing from the shared base row are that payload's intentional changes, layered in file
order onto one payload per invoice; derived money fields stay consistent because
`trg_fin_inv_derive` (a Postgres trigger) runs BEFORE INSERT OR UPDATE. Guarded by
`scripts/qa/probe-multi-file-single-drop.mjs`, which drives the REAL input (Playwright
setInputFiles → change event → auto-process, plus the redundant Check click) and judges by
direct database reads; both fixes sabotage-verified independently (reverting the generation
tracking reproduced 1,800 + the double capture row; removing the merge reproduced the
reverted dpin/total), restored and diffed byte-identical. The same drive also caught two
defects in the M14 admin card — the alias picker offered EXCLUDED clients (Takamol, with its
totals) because js/16's `live()` is IIFE-scoped and the `window.live` fallback skipped the
exclusion filter (fixed: `js/62-finance-guardrails.js` applies `finExclusionCheck()` to the
candidates directly), and the whole guardrails card was missing on the common first paint of
the Import tab because v62 hooked only `window.render()` — the M12 shape repeating verbatim
(fixed: v62 wraps `finGo()` too). Both guarded in `scripts/qa/probe-client-group-map.mjs`
(picker-scoped Takamol-absence assertion; a first-paint assertion made honest by settling
pending renders before navigating), both sabotage-verified. The rule, so it binds future
work: any new importer or Finance-admin probe must include at least one assertion driven
through the real input/tab-switch path, not only the scriptable shortcut.
Premortem addendum (same day): a deliberate attack pass over this surface —
`scripts/qa/probe-premortem-attacks.mjs`, six failure stories written to LAND, kept as a
permanent probe — confirmed intra-drop summing, same-session update-replace, a 6,000-row file
across the streaming batch boundary under the duplicate-trigger race, torn-merge resistance,
and import-path exclusion all hold, and caught one more real gap: a CAPTURE-ONLY drop (the
gate file alone — "gate today, lines next week") offered no commit button at all, so the
captured facts silently died with the tab and the counterpart file could never resolve in a
later session. Fixed in `renderCombinedPreview()`: when there is nothing to write to invoices
but pending captures exist, a "Save captured expense facts" action commits just the facts
through the same atomic RPC, and the result message reports the database's own capture
counts. Sabotage-verified (reverting the button reproduced both failures), restored
byte-identical.
*Date: 2026-08-26. Status: ACTIVE.*

**M18 — one company, one record: duplicates are detected automatically and merged through
one reversible, audited path — never by hand-editing rows, never by deleting.** Born from the
the IT-services client case: the 2026-08-21 corporate-clients import created "the IT-services client" beside the older "the IT-services client — Smart
Madad IT". The alias map (M14) merged the DISPLAY, but contacts, activities, billing
profiles, invoice links and transactions stayed split across two records, and the automatic
linker made it worse — it matched the Arabic spelling by NAME to the second record even though
the owner had already declared, in the alias map, that both spellings are one company. Owner
ruling 2026-08-29/09-02: same company; "find the fix for the future … whether on the merge or
combined clients or anything, and go ahead." Three parts, each guarded:
(1) **Linker precedence** — in `js/41-money-in.js`, a declared alias sibling that is already
linked WINS over a plain name match. A name index can only say "a record with this name
exists"; the alias map says "this IS that company". Guarded by the PRECEDENCE scenario in
`scripts/qa/probe-alias-autolink.mjs` (decoy same-name record must lose), sabotage-verified.
(2) **Detection** — `dupCandidates()` in `js/62-finance-guardrails.js` surfaces pairs with the
reason stated, strongest first: alias siblings linked to two records; same Direct client ID;
same CR/VAT number; same normalised name (EN/AR/legal, Arabic letter-forms folded, corporate
stop-words dropped); same website root domain — with two honesty rules learned on the first
run: placeholder domains are never a signal, and a domain shared by more than two records is a
portal or group site, not a duplicate (every QA fixture shares `example.com`; that must not
paint every pair as a duplicate). Dismissing a pair ("Not a duplicate") is remembered, and
reversible.
(3) **Merge = one RPC, previewed, audited, undoable.** `fn_merge_businesses` repoints every
child row (contacts, activities, requests, offers, projects, billing profiles, finance links,
transactions, documents) from the dropped record to the survivor, fills the survivor's EMPTY
profile fields from the dropped one (never overwrites a filled one), archives the dropped
record (never deletes), and writes a `business_merges` audit row listing exactly what moved;
`fn_unmerge_businesses` puts every moved row back and un-archives. The confirm names both
records, the invoice count and total moving, and the undo promise. Admin/manager only.
Guarded end-to-end (detect → merge → database → reload → undo → database) by
`scripts/qa/probe-company-dedupe.mjs`, judged by the writes that went out and the mock
database after, sabotage-verified (dropping the same-name signal reproduced the miss).
That probe also caught a live landmine outside this feature: the browser confirm wrapper in
`js/core/core-09-v26.js` rewrote any prompt containing "archive" into "Delete this lead? …
Yes, delete" and any prompt containing "reset" (a password reset link!) into "Clear all test
data? … Yes, clear", discarding the caller's real words. Fixed: a template applies only to a
short prompt that starts with the intent word; anything longer is shown verbatim. The rule:
a duplicate is fixed by merging records, not by adding another alias; a merge is one audited
call, not a series of row edits; and nothing on this path deletes.
Audit addendum (same day, owner: "what else needs to be fixed? perform immediately"): three
lessons from the first three live merges, all now in `fn_merge_businesses` and mirrored in the
mock and `scripts/qa/probe-company-dedupe.mjs`. (a) The database refused the first the IT-services client merge —
both records held an OPEN postpaid billing profile and only one open profile of a type may exist
per company. The refusal was atomic; the merge now closes the colliding profile as it moves, with
a note saying why, and undo reopens it with its original note. (b) The the IT-services client merge silently doubled
one person (three contact rows for one travel coordinator). A moved contact that duplicates one
already on the kept company (same e-mail or phone) is now FLAGGED `needs_manual_confirmation`
with a reason naming the other record — never silently doubled, never deleted; undo restores the
prior flag. (c) The 2026-08-22 manual cleanup had archived two duplicate records ("Client RC", "the conferences client") but left 80,750 + 82,800 SAR of transactions, their
contacts, activities and profiles behind on the archived rows — the same defect as the IT-services client in an
older form, and exactly why a merge must be ONE audited call. Repaired through the function
(`p_allow_archived`, which the UI never passes); undo now restores the dropped record's exact
prior archive state instead of assuming it was live. Rule sharpened: **archiving a duplicate is
not a merge** — anything that archives a company because another record is the real one goes
through `fn_merge_businesses`, so its children move and the action is undoable.
Attack-loop addenda (same day, rounds 2–3): (d) Undo un-fills only the fields the merge itself
filled — an edit made on the kept company after the merge survives Undo. (e) A lead absorbing
a client becomes a client on BOTH flags (`is_client` and `raw.isClient`), moves to stage won and
carries the converted date — the half-converted shape the sweeps flag can no longer be created
by a merge; Undo reverses exactly that. Both proven on throwaway rows inside rolled-back
transactions; the tests live in `scripts/qa/live/merge-rollback-tests.sql` and can be re-run by
any session with database access (they change nothing — every block ends by raising its verdict).
*Date: 2026-09-02. Status: ACTIVE.*

**M19 — a company's people and history live in TWO places, and every screen must read both.**
Found in the 2026-09-02 audit, the largest defect of the day. The cards read a company's contacts
and activity timeline from the JSON embedded in the business row (`raw`, the app's own
`b.contacts` / `b.activities`). The corporate-clients import, the Contact Submission import and
the merge function write people to the real `contacts` / `activities` TABLES — which no screen
had ever read (`from` calls across the app: 30 tables, neither of those two). Live at the time:
29 companies with people only in the table (45 people vs 7 embedded), 30 with history only in
the table — to the team those clients showed "No contacts yet". Three consequences, all now in
place: (1) `js/72-people-bridge.js` attaches both tables to the loaded companies (deduped by
e-mail/phone and note+day, tagged `_fromTable`), so every card shows everyone, and shows a
contact's `needs_manual_confirmation` flag as a visible "needs confirmation" badge with its
reason (core-02) — a flag no screen shows is not a flag (P5). (2) js/02 strips `_fromTable` items
before writing `raw`, so the table stays the single home of those rows and nothing doubles on
the next load. (3) The merge carries the EMBEDDED lists too (`fn_carry_embedded_people`, tagged
`mergedFrom`, undo removes exactly those) — the first three merges of the day had moved the
table rows and left the embedded people behind on the archived record; repaired the same day.
Guarded by `scripts/qa/probe-people-bridge.mjs` (card shows the table contact, badge with
reason, timeline, idempotent re-run, save never leaks table rows into raw), sabotage-verified.
Rule: any new writer of people or history writes to the TABLE, never to raw; any new reader
reads through the loaded `b.contacts` / `b.activities` (which the bridge has already completed).
*Date: 2026-09-02. Status: ACTIVE.*

**Every name comparison folds Arabic letter variants and Unicode presentation forms the same
way.** (2026-09-02 attack round.) The linker's `norm()` in `js/41-money-in.js` folded أإآ→ا,
ى→ي, ة→ه, diacritics and tatweel; the alias/exclusion lookup's `norm62()` in
`js/62-finance-guardrails.js` did not — so an alias registered as "…المحدودة" silently missed an
export row spelled "…المحدوده" and the sibling never linked. Both now fold the same set and
apply NFKC first (presentation forms such as ﻻ). Guarded by the ARABIC VARIANTS scenario in
`scripts/qa/probe-alias-autolink.mjs`, sabotage-verified. Rule: a new name comparison anywhere
reuses one of these two helpers; never a bare lower-casing of the raw string.
*Date: 2026-09-02. Status: ACTIVE.*

**A probe that fails because the app changed on purpose is corrected, not deleted, and never
left red.** The 2026-09-02 full-suite run had five probes carrying assertions from before a
deliberate change: the promo card (turned off by rule), the "two optional columns" filler line
(dropped in the density pass), the Ledger's totals (it reads transactions now, never invoices),
the collections heading, the importer's five-count wording. Each was re-pointed at the rule that
replaced it (e.g. "promo card ABSENT", "ledger did NOT move with an invoice edit") — so the suite
keeps guarding the decision instead of the old wording. A red probe nobody reads teaches the
team to ignore red. Twelve probes in the suite need the staff's real logins or the live database
(`scripts/qa/emp-rig.mjs`) and can only run from a machine that has them; they are listed as
environmental, never counted as green.
*Date: 2026-09-02. Status: ACTIVE.*

**SUPERSEDED — the invoice item split (Service Fee / 3rd Party Fee) is a VAT split, never
real cost.** An earlier round of this project treated the 3rd-Party-Fee line as the real
cost figure; re-verified live against Direct Payments and found wrong — that line is a VAT
split, not a cost. Do not resurrect "cost = the non-taxable pass-through line" as a rule; it
is the same mistake under a different name. Real cost comes only from the rule above.
*Date corrected: 2026-08-22, commit `a454709` ("Correct the money-model chain"). Status:
SUPERSEDED-BY: "Cost = approved expenses only", above.*

**Takamol and Techtic Support never appear anywhere — not in Finance, not in Clients, not
in any export or report.** They are SVP/QVP verification revenue from a different system,
not BD income. Owner ruling 2026-08-23, verbatim: **"No takamol what so ever."** Any row
matching takamol/techtic on `client_group` or `customer_raw_name` is excluded from every
total. If a future import re-introduces them, that is a BUG, not new data.

Full history, since this was contested for a few hours before the ruling settled it —
proof the mechanism catches exactly what it's for: exactly ten Takamol invoices
(invoice numbers recorded in each row's `exclusion_reason`, not here) entered `finance_invoices` live, summing
**6,724,291.12** of a displayed total of 8,755,055.41 — independently re-verified against
the database, exact match. A `Takamol for Business Services` client record was created and
the ten linked to it 2026-08-22 — the opposite of exclusion. Two readings were open (full
exclusion vs. partial genuine-client revenue) until the owner ruled outright for exclusion.
Resolution, independently re-verified against the database: all ten soft-deleted
(`deleted_at` set), `integrity_status='excluded'`, `exclusion_reason` recorded on every row;
the wrongly-created client archived; its `finance_client_link` deleted. Live Finance total
after: **2,030,764.29** (46 invoices) — within 1.8% of an independent non-Takamol workbook
figure, a decent cross-check that the right ten came out.

**Root cause, confirmed, worth recording precisely.** The exclusion list
(`js/62-finance-guardrails.js` `finExclusionCheck()`) was seeded correctly on 2026-08-21 —
client ID 7, match names "Takamol for Business Services" / "Techtic Support" — and IS
correctly wired into all three of this app's own import paths (`js/41-money-in.js:110`,
`js/65-universal-importer.js:275`, `js/16-finance-ledger.js:822`, confirmed by reading all
three, not assumed). The guard was right, wired, and live, and it never fired: the ten rows
were written straight into `finance_invoices` with direct SQL, going around the app's
importer entirely — confirmed directly by the person who ran it, not inferred. No
client-side import-time check can ever defend against a write that never goes through the
client. Fixed 2026-08-23 with a second, independent line of defense:
`js/16-finance-ledger.js`'s `live()` — the one chokepoint every Finance total/export reads
through — now re-checks every row against the same exclusion list on every call, not once
at load. That mattered in practice: a first version that filtered only inside the load
callback passed on a manual reload but silently let the row through on the real first
render, because `finance_invoices` can finish loading before `DB.settings.financeExclusions`
does — `live()` re-evaluates on every call, so it can't lose that race. Caught and fixed by
`scripts/qa/probe-finance-invariants.mjs` before shipping, not after.
*Date: 2026-08-23. Status: ACTIVE.*

**A standing exclusion is not satisfied by loading the data and labelling it.** If a rule
says a party is excluded, its rows do not enter the table at all — full stop. The Takamol
mistake above was exactly this: a client record was created, its invoices linked, and
100% attribution reported as a success, while a written rule said exclude. The number
looked better precisely because the rule was broken. "We loaded it and can explain why
later" is not compliance with an exclusion rule.
*Date: 2026-08-23. Status: ACTIVE.*

**Wallet top-ups are never revenue.** Skipped by the importer the same way verification
services are.
*Status: ACTIVE.*

**Never sum `finance_invoices` (`FIN.rows`) and `finance_transactions` (`TXN.rows`) in one
total.** They are two parallel datasets covering overlapping but not identical money — the
Ledger tab reads transactions, Overview/Clients/Reports read invoices. Summing both double
counts.
*Status: ACTIVE.*

**VOID is excluded from every total, everywhere, always.**
*Date: 2026-08-22. Status: ACTIVE.*

**Only confirmed, fully-paid tax invoices count as revenue.** A transaction with expenses
registered is "recorded and tracked" until its tax invoice is issued — work-done-but-not-
yet-invoiced is normal and must show as its own Ready-vs-Pending split, never be folded into
revenue early and never be hidden.
*Date: 2026-08-22. Status: ACTIVE.*

**Never fabricate a number to fill a data gap — leave it null and say why.** Proven twice:
the promo-code registry showed 27,304,067 SAR that was never real (114/134 codes flagged
active-and-expired simultaneously, 131/134 with a discount not matching their own stated
percentage, all seeded in one batch the day before real finance data landed) — the fix was
to turn the card off, not fabricate a cleaner number. And separately: client-level cost
totals from the Direct Payments workbooks don't reconcile to per-invoice amounts closely
enough to spread across invoices (1.8% gap) — spreading them anyway would have put wrong
numbers on individual invoices. Left both as an honest, stated gap instead.
*Date: 2026-08-22/23. Status: ACTIVE.*

## User-facing text

**Help text may state a RULE the user could otherwise violate. It may not explain our
architecture.** A heading like "Payment proofs — the audit file cabinet" or "Individual
bookings — the fifth revenue pattern" is this project's internal spec vocabulary leaking
onto a real employee's screen — nobody on the team can name the other four revenue
patterns, and it teaches nothing. Cut it. But two sentences under Expenses and Payment
proofs state real rules — "these amounts never change an invoice's cost or profit," "wallet
top-ups are never counted as revenue" — and are the only thing at the point of use stopping
someone from assuming an expense moved a number it shouldn't, or that a wallet top-up counts
as income. **If removing a sentence would let someone make a money mistake, rewrite it
shorter — do not delete it.**
*Date: 2026-08-23. Status: ACTIVE.*

