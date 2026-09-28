## Round 48 — the Individual bookings tab past 1,000 rows (2026-09-06)

Taking the item watch cycle 28 flagged as outside its lane. `js/58`'s `load()` read
`finance_invoices` with **no paging**. The API returns at most 1000 rows however many exist, and
says so only in a Content-Range header nobody reads — so past 1,000 hand-entered bookings the tab
would have shown the first 1,000 as if that were all of them. A clean, plausible, wrong answer, and
the same shape watch cycle 13 fixed in six reads in `js/16`. Fixed with `window.finPageAll`, which
js/16 already exports for exactly this, plus a local fallback so the file still works if the load
order changes.

**The fix arrived unguarded, so it now has a guard.** `probe-b2c-manual-attacks` enters four
bookings through the real form — the right test for everything else it checks, and one that cannot
touch this: four rows never reach the ceiling. New `scripts/qa/probe-b2c-paging.mjs` seeds 1,240
bookings and holds four things: the tab loads all 1,240 rather than 1,000; a control proves the
ceiling is genuinely enforced in the harness, so passing means the app pages and not that the mock
returned everything; a booking that exists only past the first page is really among them, by name;
and the bookings on the tab add up to an independent recount, because a right count can still sit
beside a total computed off a truncated set. Sabotage — restore the original single unpaged select
— turns two of them red (1000 of 1240, and 712,204 against 892,180). File restored byte-identical.

**Verified from the live database rather than taken on trust:** cycle 28's "19 of the 46 live
invoices carry no collection due date" is exactly right, and no live invoice is future-dated. One
thing to add to their entry, though — **total outstanding on live data is currently 0**, so the
ageing card renders "Nothing outstanding" and neither the 0% nor the new note appears yet. Both
fixes are correct and both matter at the 653-invoice backfill; neither is visible today.

## 2026-09-06 · Watch cycle 28 — the ageing card, invoice by invoice, and the fifth revenue way end to end

**Attack area (v): the Clients ageing buckets across a ten-year span. Attack area (w): `revenue_way='b2c_manual'` from the form that writes it to every surface that reads it.**

`probe-scale-attacks` already checked that the ageing **total** matches a recount and that the buckets sum to it. Neither is the question a collections manager asks the card, and **both pass perfectly while every invoice sits in the wrong bucket** — shift all four boundaries by a month and the total is unchanged and the buckets still sum. Nothing anywhere checked that a *given* invoice lands in the bucket its own age says it belongs in, and nothing had ever exercised a boundary, a leap day, a ten-year-old debt or a date in the future.

**Two real defects in the ageing card, both fixed in lane (`js/16`).**

1. **An invoice dated in the FUTURE was reported as 0–30 days old.** A future date gives a negative age, and the first comparison in the chain is `d<=30`, so `-121` fell straight into the freshest bucket. That is an age the invoice cannot have — the same invented-number shape cycle 6 removed from the no-date row, and it gets the same answer: its own amount, still inside Outstanding, never in a bucket that claims it has aged. New chip, "Dated in the future" / "بتاريخ مستقبلي". No live invoice is future-dated today; the 653-invoice backfill is where this becomes visible.
2. **"% overdue" read as a fact about money it had never looked at.** It can only ever see an invoice carrying a `collection_due_date`. **19 of the 46 live invoices carry none** — so the figure is a percentage of a subset while presenting as a percentage of everything, and where nothing has a due date it prints a confident **0% beside a full 90+ bucket**. The card now says, underneath, how much of the outstanding money carries a due date and how much cannot ever count as overdue however old it gets.

**No defect found in the boundaries themselves**, which is worth recording as a positive: 30/31, 60/61 and 90/91 all land exactly where the labels promise, and a ten-year-old 29-February debt ages correctly.

**No defect found in attack area (w).** A booking entered through js/58's own form is counted once in Revenue, counted as its own distinct reference on the Invoices tile, listed in the Ledger, carried into the CSV export by name, reaches Outstanding when unpaid and ages into the right bucket, and does not disturb the sector chips. **js/58's own stated guarantee is now checked for the first time**: two bookings saved with the reference field left blank each get their own generated identity, so they do not collapse into one on a tile that counts DISTINCT `invoice_no` (several nulls count as one). And a later Direct Payments export naming a hand-entered booking declares it — **New 1 · Updated 1** — rather than overwriting it silently.

Two new probes:

- `scripts/qa/probe-ageing-attacks.mjs` (port 8235, 12 checks). Every boundary invoice carries a **distinct power of two** as its outstanding amount, so each rendered bucket total decomposes to exactly one set of invoices and the failure message *names which ones moved*. Every amount is deliberately kept under 1,000 SAR because `moneyS()` abbreviates at 1K and 1M and prints the exact integer below that — so the figures are readable at full precision off the page without changing the app to make the test possible. Dates are generated from today's UTC day, so the fixture can never go stale.
- `scripts/qa/probe-b2c-manual-attacks.mjs` (port 8237, 13 checks). Drives js/58 — **outside this lane** — through its own form and its own Save button, then asserts only what the lane it feeds is responsible for.

**Sabotage, at file level, restore byte-identical** (md5 `4fc00f8cace620b64b6785d4735fc720` js/16, `db44fd46626370af4c84a04a68c8d0c0` js/65). Bucket boundaries shifted by a month → 4 red, each naming the invoices that moved. The future-date branch removed → 2 red. The no-due-date note silenced → 1 red. Deleted rows unfiltered → 3 red. `b2c_manual` dropped inside `live()` → 6 red. The ageing card skipping `record_type='b2c'` → 2 red. The importer's index no longer seeing hand-entered bookings → the collision reads New 2 · Updated 0.

**Three probe-side errors of my own, caught and recorded.**
- **A check that a leak could slip past.** The deleted/excluded guard searched the rendered text for "777" or "999" — and **passed while the deleted debt was leaking**, because `moneyS()` abbreviates a leaked 778,161 to "778.2K" and neither string appears. It now tests the bucket a 400-day debt would land in against its exact expected value. Found by reading the sabotage output rather than the summary line: three other checks went red and this one did not, which is the tell.
- **The fixture array is live.** `start(PORT, {finance_invoices: SEED})` takes the array **by reference** and the mock pushes every insert into it, so `SEED.length` grew as the bookings saved. Three checks reported the app four rows short when the app was exactly right. Snapshot any count taken off a seed array before the server starts.
- **A check that exercised nothing.** The import-collision check first used invented column names, so the importer answered *"not recognized — teach this file's columns"*, no preview was ever produced, and the check passed having put nothing to the app. It teaches the signature first now, and refuses to read a verdict off a preview that never ran.

**Flagged, not this lane.** `js/58`'s `load()` reads `finance_invoices` with no paging, so past 1,000 hand-entered bookings the Individual bookings tab silently shows the first 1,000 — the same shape cycle 13 fixed in six reads here. `window.finPageAll` is already exported for exactly this. One line, its owner's call. Separately, measured not asserted: a hand-entered booking has no client link and so classifies as **B2B** on the sector chips — the chips cannot distinguish an individual booking from a corporate one, and there is no B2C chip. Nothing is lost or double-counted; whether that wants a fourth chip is the owner's call.

**Battery:** 71 probes plus `check-structure`, 62 green in the parallel batch. `probe-premortem-attacks` and `probe-generator-attacks` were red in the batch and **green when re-run alone** — environmental, the same parallel-batch pressure classified in cycles 17 and 20. The other six are the identical pre-existing set named in the cycle-27 entry below (`probe-live2`, `probe-events-scale`, `probe-money-placement`, `probe-round9`, `probe-lifecycle5`, `probe-stress`) — unchanged, none in this lane, still waiting on a cycle of their own.

## 2026-09-03 · Watch cycle 27 — the promo-code revenue way, and the tile nobody had ever recounted

**Attack area (t): `revenue_way='promo_code'` and the 200-code registry behind it. Attack area (u): the Overview's Received and Outstanding tiles, recounted independently at scale.**

Revenue reaches Direct five ways. Two of them had never been driven by a probe, and one — promo_code — has a registry sitting behind it claiming **27,304,067 SAR against 2,030,764 SAR of real revenue**. Nothing guarded the owner's 2026-08-22 ruling that the registry must stay off the Finance page, and nothing checked that promo money is counted once. Separately: **no probe had ever recounted the Received tile.** `diag-ledger.mjs` asserts only that a tile with that label exists; `probe-overview-attacks` and `probe-outstanding-split` both run on the 15-row default seed and neither recomputes it.

**One real defect, fixed — the revenue-way editor silently rewrote a way it could not display.**
`js/25` offered **four** revenue ways. The database accepts **five**: the live CHECK constraint is `revenue_way = ANY (ARRAY['invoice','transaction','commission','promo_code','b2c_manual'])`. `b2c_manual` arrived on 2026-08-20 with js/58 ("the fifth revenue pattern"); this editor, written 2026-08-12, was never told. The consequence was not a missing option. Opening a b2c_manual invoice produced a `<select>` with no matching `<option>`, so the browser showed the **first** one — "Actual invoice" — and one press of Save wrote `'invoice'` over the stored way without anybody choosing it. Fixed by carrying every value the constraint accepts, plus a fallback that offers an unrecognised stored way back as itself rather than ever presenting a value the row does not hold. No live row is `b2c_manual` today (all 46 are `invoice`), so nothing was silently rewritten in production — the defect was waiting on the first hand-entered individual booking.

**One probe defect, fixed.** `probe-premortem-attacks` check C has been red since watch cycle 13 for a reason that was never the app's. It writes 6,000 capture rows on purpose to cross the 5,000-row batch boundary, then verified the count with an **unpaged** fetch — and since cycle 13 the mock enforces the real 1000-row ceiling, so it could only ever read 1,000 back and reported "got 1000" as a defect. The same attack's real assertion (the cost summed to exactly 1500) had been passing throughout. Its verification fetches now page.

**No defect found in either attack area itself.** Both probes are kept as permanent guards.

Two new probes:

- `scripts/qa/probe-promo-revenue-attacks.mjs` (port 8231, 19 checks). A 1,200-code registry — forcing the read past the 1000-row ceiling — holding a zero code, a negative total, two codes named `DUPE`, null totals and a code named like markup, against 40 invoices carrying **all five** revenue ways across 2 years × 4 clients (2 tender, 2 B2B). Checks that the registry loads in full; that neither its 31.8M of claimed sales nor its discounts appears anywhere on the Finance page (with a control proving the same scan *can* find the real revenue total, so a leak would have been visible to it); that promo revenue is counted exactly once in the tiles, the ledger and the export; and that promo rows scope by year, month, quarter and sector like any other row. Until this cycle **no probe had ever seen a non-empty promo registry** — the mock answers an unknown table with an empty list, so every existing probe loaded `promo_codes` as `[]` and proved nothing about it.
- `scripts/qa/probe-received-outstanding-attacks.mjs` (port 8233, 15 checks). 3,207 invoices, of which 5 carry unreadable money in the amount fields, one is soft-deleted holding 777,777 and one belongs to a standing-excluded client holding 999,999. These two tiles are the pair most likely to drift because they alone are computed on **different bases**, and js/16 says so in its own comment: the five money indicators read verified-paid rows, but Outstanding is recomputed over *every* live row in the period — an invoice is only verified-paid once nothing is left to pay, so summing what remains across verified rows is always zero. The probe holds each tile to its own stated basis, and a control proves the two bases genuinely differ on this fixture (0 vs 3,517,389) rather than being one check wearing two labels.

**Sabotage, at file level, restore byte-identical (md5 `0ca19a3f5e8d296d44a5b9ac2e2ed551` js/16, `f72c2922ac5a30fb9e9fe4c039d7fcdd` js/25).** Promo card switched back on → 2 red. `promo_code` rows dropped inside `live()` → 10 red. Promo money counted **twice** in the Revenue tile → 5 red. The pre-fix editor → 2 red. Outstanding computed on the verified-paid basis → 6 red. Received stops accumulating → 6 red. Exclusion stops applying → 6 red. Deleted rows stop being filtered → 6 red.

**A methodology correction worth keeping.** The first sabotage of "drop promo rows" was applied to `window.finLive` — the *exported* seam — and only one check went red. The tiles read the internal `live()`; the export is what other files read. Sabotaging the export therefore proves nothing about the tiles. Re-applied inside `live()` itself, ten checks went red. **Sabotage the internal chokepoint, not its export.** A second correction: the first draft of the Received fixture derived the year from `i % 3` and the month from `i % 12`, which maps each month to exactly one year — so "2026 · Q2" and "2026 · June" returned identical figures and the quarter check proved nothing the month check had not. Year and month must be decorrelated in any fixture that tests both.

**Six pre-existing reds, verified identical on the untouched origin tree — none caused by this cycle.** Recorded here by name so they are not re-diagnosed a third time. `probe-live2` — environmental: it needs a `live-app/` snapshot directory that does not exist in the repo. `probe-events-scale` — the KSA-events pager reports the raw 83 rather than the filtered total (not the P4 lane). `probe-money-placement` — a bare `" SAR"` with no number renders on the opened-lead dashboard view, EN and AR (not the P4 lane). `probe-round9` — crashes because `#xp_desc` is null while `#xp_date`/`#xp_via`/`#xp_amt` exist; the field is present in js/45, so this is a timing or render-state issue the probe never asserted before using. `probe-lifecycle5` and `probe-stress` — both time out waiting for a row that never arrives. All six should be picked up as their own cycle; only the premortem one was in this lane and it is fixed above.

Battery: 68 probes plus `check-structure` (67 script files, no inline logic, no duplicate ids, no known landmine patterns). Everything green apart from the six above.

## 2026-09-03 · Watch cycle 26 — the filters in combination: no defect found, kept as a guard

**Attack area: a year, a period, a sector chip and a client drill-down all in force at once.**
Every filter had been tested on its own; nobody uses them on their own. One screen making four
claims at the same time is where a filter that quietly fails to apply — or quietly stays applied
after being cleared — produces a number no single-filter test can see is wrong.

**No defect found.** New `scripts/qa/probe-filter-combination-attacks.mjs` (port 8229, 18 checks)
on a fixture built so every combination leaves a different set: three years × four clients (two
tender, two B2B) × four months. Eleven combinations of year × period × sector each checked against
a recount computed from the fixture, never read off the page — and checked twice over, once on the
rows the page believes are in scope and once on the Revenue tile itself, which are separate code.

**Held:** all eleven scope correctly; Clients & collections shows the same scope as Performance at
the same moment; the invoice export carries exactly the rows the combined filter leaves, so the
file cannot describe a wider scope than the screen; clearing the sector widens to the whole month
without disturbing the year, and clearing the month widens to the year without silently restoring
the sector; and a combination matching nothing says so instead of printing a confident set of
zeros.

**A correction to this probe, and the second of its kind — so it is now a rule.** The check first
asserted that the Report Builder honours the sector chip. It does not, deliberately, and **its own
caption says so**: *"across all years and sectors — the period bar above does not apply to this
report."* Cycle 22 made the same mistake about the years half of that same sentence. The rule:
**read the caption the app prints about itself before deciding what the app should do.** What is
checked now is the guarantee the app actually makes — the report spans everything, and says so
where a reader will see it.

**Sabotage-verified twice, file-level:** making `finInPeriod` ignore the month turns 8 checks red;
making the sector classifier a no-op turns 10 red. Restores byte-identical (md5). Twenty-two
probes and the structure check green.


## 2026-09-03 · Watch cycle 25 — mutation audit round three: a clean sweep, and the export checked against its own rows

**Mutation audit round three**, over everything added since cycle 20 — the sector key and its
archived-profile skip, the Ledger's money chokepoint, the duplicate-reference index, the target
pre-read, the drill-down's reconcile, the twelve-month chart, the whitespace-name placeholder, and
the importer's all-or-nothing commit. Ten mutations, each breaking one rule a probe claims to
guard, each reverted byte-identically (md5).

**All ten were caught, by the probe you would expect.** That is the first clean sweep of the three
audits, and it is the point of having run the earlier two: rounds one and two found six guards
that were decoration, and everything built since has been written to bite.

**With no blind spot to close, the cycle went after the next unguarded thing: the Report Builder's
CSV.** The file a manager sends to an accountant is built from the same group totals the
drill-down reconciles against, but through a completely separate code path — so if the export ever
read a different filter, the file and the screen it was taken from would disagree and only the
accountant would find out. `probe-drilldown-attacks` now captures the real file and checks **every
exported line against the invoices the drill-down opens for that same row** — 8 lines grouped by
client, 46 grouped by client › month — plus the file's TOTAL against the report's own grand total.
No defect found. Sabotage-verified: shifting the exported figures by 5% turns both checks red.

**One probe-side correction:** the first parse read each CSV line as a label with no value, because
the file is CRLF and the hand-rolled comma split fell through to a fallback that returned the whole
line. It reported "0 of 0 lines disagree" — a check that had examined nothing while printing a
failure that looked like a real one. Split fixed against the actual file.

Twenty-one probes and the structure check green.


## 2026-09-03 · Watch cycle 24 — two people importing overlapping files: no defect found, kept as a guard

**Attack area: the importer under real concurrency.** Cycle 15 covered two tabs importing the SAME
file. The harder case is two DIFFERENT files that happen to share some invoice numbers — which is
what actually happens when two people export overlapping date ranges from Direct Payments on the
same afternoon. Each preview is computed against the table as it was **before** the other person
confirmed, so the second Confirm tries to insert rows that now exist.

**No defect found.** New `scripts/qa/probe-importer-concurrency-attacks.mjs` (port 8227, 12
checks). The question that matters is what the loser is left with: a partial write — some invoices
in, some out, and no way to tell which — is far worse than a clean refusal.

**Held under attack.** Both tabs preview honestly against the table as it was (8 new and 7 new,
three of them the same invoices). The first Confirm lands all eight. The second fails as a whole:
no invoice number exists twice; **none** of the second file's four own invoices were written, so
there is no half-imported file to reconcile by hand; nothing leaked into the expense-capture
tables either; the three shared invoices still hold the first tab's figures; and the second tab is
told its import **failed and nothing landed**, carrying the database's own reason rather than a
success message. Reloading that tab shows the truth instead of its stale preview, and re-dropping
the very same file then reports its four own invoices as new and the three shared ones as already
there — one more Confirm finishes the job cleanly, every invoice present exactly once.

**Sabotage-verified twice, file-level.** Making `v65Commit` ignore the error turns the message
into **"Done. Imported 0 new, updated 0."** — a success notice for a batch that wrote nothing,
which is precisely the shape rule M13 exists to prevent, and the probe catches it. Making the
commit RPC insert row-by-row instead of all-or-nothing turns three checks red, including the four
orphan rows being written anyway. Restores byte-identical (md5). Twenty probes and the structure
check green.


## Round 47 — mutation audit part two: the conversion check was hollow (2026-09-03)

Continued round 46's audit into `attack-wave3`. One finding, and it is the most consequential of the
series.

**"lifecycle 3: Won auto-converts to client" and "lifecycle 4: appears in the Clients list" were
both hollow.** Both read `DB.businesses`, the in-memory array. Mutation: force `is_client:false` on
every write, so no lead ever becomes a client in the database — **both steps still passed.**

Conversion is the hinge of the whole book of business: it drives the Clients page, the finance
link, and the account-manager work. CLAUDE.md names it as a database trigger. A conversion that
never lands is one the person loses on the next reload, having been told it worked. Both steps now
read the row back and report `database is_client=false` when it diverges; re-tested against the
same mutation, both go red.

**Checked and found genuinely sound, so not changed:**
- The importer's commit path. `attack-wave3`'s importer section *skips* here — its fixture is
  gitignored and under rule 7 a real Direct Payments export may never be committed — and it names
  `probe-importer-attacks.mjs` as the substitute. Verified that claim rather than trusting it:
  pointing the commit at a non-existent RPC makes that probe go red with four failures, including
  "Imported 0 new, updated 0". The delegation is accurate and the path is properly guarded.

**Harness debt found, not fixed here:** `probe-lifecycle5.mjs` errors out on a locator timeout, and
does so identically on a clean tree — it has been failing regardless of the code for some time. A
probe that always errors is worse than no probe: the noise is what a real failure would hide in.

## 2026-09-03 · Watch cycle 23 — the monthly chart drew a year that did not happen

**Attack area: the Overview's monthly chart**, new `scripts/qa/probe-monthly-chart-attacks.mjs`
(port 8225, 11 checks). It is the first thing anyone looks at on the Finance page, and no probe
had ever measured it. A bar chart makes a claim about **shape** — which months were strong, which
way the year is going — and shape is the one thing a correct total cannot correct.

**Real gap: months with no business were left off the chart entirely.** The bars were built from
`MO.filter(function(m){return by[m];})` — only months that had invoices. A year with billing in
January, February, May and December therefore drew four bars side by side, labelled Jan Feb May
Dec, describing a continuous run of business that never happened; the two long silences simply
vanished. Worse at the extreme: a year holding a single invoice drew **one full-height bar across
the whole chart**, which reads as a complete year at a glance. Every month is now drawn, empty
ones as a 2px stub with a printed 0 beneath — "nothing was billed here" is information, and the
gap between May and December is part of what the year looks like.

**Held under attack:** every bar's tooltip carries that month's own revenue, recounted
independently; every height is proportional to the tallest month, so one month at 250,000 beside
one at 4,000 does not distort the rest; the months on the chart add up exactly to the Revenue tile
above them, so the picture and the number cannot disagree; Arabic month names in Arabic with the
same twelve slots; and a credit note stays outside the chart exactly as it stays outside the tile.

**Three corrections to this probe, all mine, all before it could be trusted:** it looked for the
card by the wrong heading and found nothing in English while passing in Arabic; it read each
slot's *amount* as the month label, so every month lookup silently missed; and it expected a bare
`height:0` for an empty month when the app floors every bar at 2px on purpose. Each was fixed
against the real markup rather than by loosening the check.

**Sabotage-verified, file-level:** restoring the filter turns 2 checks red (the seven silent
months, and the single-invoice year drawing one slot). Restore byte-identical (md5). Twenty probes
and the structure check green.


## Round 46 — mutation audit of the CRM battery: three guards that were not guarding (2026-09-03)

Rounds 43 and 45 both found real problems by attacking the **instruments** rather than the code, and
a hollow guard means everything it claims to protect is actually unguarded. The oversight session
mutation-audited its own Finance lane in cycles 17 and 20; the CRM/leads battery had never been
audited. Each mutation below breaks one thing a step claims to guard, is run against the battery,
and is restored byte-identical.

**1 & 2. "leads: new business SAVES" and "quick-edit stage change persists" — both hollow.**
Both read `DB.businesses`, the in-memory array, and never asked the database. With the businesses
insert changed to send an empty array — nothing whatsoever reaching the database — both steps still
passed. In a project whose entire history is writes that look fine and never land (M13 exists for
exactly that), a green step claiming a save is worse than no step at all. Both now query the mock
over HTTP and report `memory=true database=false` when they diverge. Re-tested against the same
mutation: both go red.

*The rule itself was never unguarded* — `probe-save-confirms-rows` catches that mutation cleanly,
including the app's own honest "Only 0 of 1 records were accepted by the database". The app is
right; the labels were lying.

**3. The CSV export check asserted only that a download EVENT fired.** An export producing a
header row and nothing under it passed just as happily, while "downloads a file" stayed true and
the person got nothing usable. It now opens the file and requires a header, at least one data row,
and a company that is really in the list. Mutation — export the empty list, so the download still
fires — now goes red with `1 line(s) · a listed company present: false`.

**Two steps that never run at all.** The invoice-modal check (which includes the M1 "no VAT text"
assertion) and the ledger view toggle sit behind a guard that skips when the legacy seed has no
ledger rows — which is always. The skip is honestly logged and the count of 41 only counts steps
that executed, so nothing is being overstated, and M1 is genuinely guarded by
`probe-no-vat-display` and `probe-ledger-attacks`. Recorded here so a future session does not read
"invoice modal: … NO VAT text" in this file and believe it ran.

**Verified real, not changed:** the promo-card check (owner ruling, 2026-08-22) — switching
`SHOW_PROMO_ON_FINANCE` back to true makes it go red, so that ruling is properly held.

## Round 45 — the Arabic sweep was lying, and the one real leak under it (2026-09-03)

Ran the app-wide sweeps nobody had run in a while. `sweep-language.mjs` reported **36 untranslated
Latin strings across 8 pages**. Thirty-five of them were not defects.

**The measuring instrument was wrong**, in two ways:

1. It read `textContent`, which happily reads nodes the app has **hidden**. js/22 hides the
   developer/QA cards on Settings with `display:none`, and the sweep reported all fourteen of their
   buttons — "Wipe local data", "Run a day", "Developer / test harness" — as untranslated
   user-facing text, on two pages. 28 of the 36 findings, none of them visible to anybody. A future
   session would have spent a round translating buttons no employee can see. This is the round-33
   lesson in reverse: there I wrote a note the CSS hid and the probe passed; here the tool failed
   text nobody reads. It now judges only what is actually on screen (measuring the `<select>` for
   an `<option>`, which has no box of its own).
2. Its allowlist of terms that legitimately stay Latin was missing **NDC, EMD, ZATCA, API** — five
   more findings. A travel or finance professional in Riyadh writes those exactly like that;
   "translating" them would be wrong, not thorough.

36 became 1: a person's name, which is data and correctly untranslated.

**The one real leak.** The Clients tier filter rendered `<option>Key</option>` with **no `value`
attribute**, so the browser used the visible text as the value and `clFilter.tier=this.value`
compared it against `b.tier==='Key'`. js/21 therefore refused to translate it — correctly, and by
its own documented rule that a value-less option must never be translated because that changes what
gets stored. **The translator was right; the markup was the bug.** An Arabic user read "Key" and
"Standard" in English while "All tiers" beside them was Arabic, because that one already had a
value.

Giving the options explicit values is the entire fix — js/21's dictionary already held
Key → رئيسي, Standard → قياسي. First draft also hardcoded the Arabic in `core-02`; that was
removed after testing each half separately showed the dictionary alone does it. One dictionary, one
place to change a wording, nothing to drift — the same reasoning that made js/71 reuse js/67's
amount-in-words instead of copying it.

Guarded by `scripts/qa/probe-tier-filter-bilingual.mjs` (10 checks: Arabic words, English values,
and the filter returning identical rows in both languages). Sabotage — remove the value attributes,
which is the original bug exactly — goes red; file restored byte-identical.

## 2026-09-03 · Watch cycle 22 — the Report Builder drill-down: no defect found, kept as a guard

**Attack area: the drill-down** (js/25, chapter 25 part 3) — clicking a grouped row opens the
invoices behind that total. Ninety-odd probes existed and none had ever driven it. The whole
promise is that what a row expands to adds up to the row it expanded from; if that were ever
untrue a manager would read a total and a contradicting list side by side and believe both.

**No defect found.** New `scripts/qa/probe-drilldown-attacks.mjs` (port 8223, 22 checks) opens
**every** openable row across five shapes — client, month, service type, client › month, and both
with verified-only on and off — and reconciles each one against its own printed total on every
metric. All 251 detail lines across all shapes reconcile exactly. A client with a single invoice
opens to one line; a client with 260 says "the first 200 of 260 invoices — use Export CSV for all
of them" rather than quietly stopping at 200; with a second grouping only the sub-rows open, so a
client's invoices never appear above its own months; opening every client and closing them again
leaves nothing stranded. The reconciliation guard is real: deliberately moving one invoice's
revenue without moving the total makes the app refuse the detail in words.

**Two corrections to this probe, both mine, both worth recording.** It first asserted that every
opened invoice must fall inside the period on the bar — and flagged correct behaviour as a defect.
The Report Builder deliberately spans all years and sectors, and **says so in its own caption on
screen** ("the period bar above does not apply to this report"). The check now verifies that the
page says it, which is the actual guarantee. Second, its open/close counting depended on whatever
the previous check had left open, and read exactly backwards once (0 open, 250 after "closing");
it now starts from a known-closed state and toggles until the detail is really painted.

**Sabotage-verified twice, file-level:** dropping the reconcile loop turns the guard check red;
making the sub-grouping open the group rows turns 36 rows red — via the app's own withholding
notice, which is that guard doing its job. Restores byte-identical (md5). Nineteen probes and the
structure check green.


## Round 44 — the five documents a client actually reads (2026-09-03)

js/67 price offer, js/68 service fees, js/69 company profile, js/70 contract, js/71 tender:
**3,949 lines producing the documents a real client reads and signs, and not one probe drove any
of them.** They even expose QA hooks (`__poCalcProbe`, `__ctProbe`, `__ctPlaceholderClauses`,
`__tdProbe`) — a previous session built them to be testable and the test was never written.

**No product defect found in the money.** The arithmetic is right in both VAT directions, rounds
to the halala, and the amount-in-words is written once in js/67 and *reused* by the tender rather
than duplicated — so an offer and a tender can never spell the same amount differently. On these
pages VAT belongs: M1 bars it from cost/profit/revenue, and the owner's 2026-08-23 correction says
a client-facing quotation may show it. The test is therefore reconciliation, not absence.

Two real things did come out of it:

1. **`contract_clauses` was unseeded in the mock**, so `S.tpl` was `[]`, `snapshotClauses()`
   returned early, and the whole clause system — including the guard that stops a contract going
   out still saying "[Edit per agreement]" — had never run in any test. Proven, not assumed: the
   guard was deleted outright and the battery stayed green. The fixture now carries real clauses.
2. **The tender printed an empty "In words" line** when the shared speller was unavailable. js/71
   correctly refuses to fabricate a spelling (M8) and returned `''` — but a blank on a client
   document is indistinguishable from a real blank amount. It now says so out loud, the same rule
   the documents layer already follows for a missing VAT number.

**A hollow check of my own, caught by sabotage.** The first version of this probe only asserted
that the placeholder-guard hook existed. Deleting the guard left it green. It now seeds a
placeholder clause, drives `ctIssue()`, and asserts the refusal happens, names the clause, clears
when that clause is switched off, and returns when it is switched back on.

Guarded by `scripts/qa/probe-client-documents.mjs` (23 checks). Four sabotages, all red:
VAT dropped from the offer total (2), words describing the subtotal instead of the total (1),
the placeholder guard neutered (1), the tender grand total dropping VAT (1), the tender words
back to a silent blank (1). Every file restored byte-identical.

