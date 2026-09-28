## Watch cycle 57 — six boxes that said "nothing", above a column that said "Revenue"

**2026-09-08.** Both candidates left open for this cycle turned out to be the same defect. The
empty-vs-filtered question, asked of the Report Builder's Metrics row, is `finRBM`.

### What was wrong

The Metrics row is six checkboxes — Revenue, Cost, Profit, Received, Outstanding, Service lines —
each wired to `finRBM(key, checked)`. Untick the last one and the table did not go quiet. It showed
Revenue, because `rReports()` did this:

```js
var mets=Object.keys(rb.metrics).filter(function(k){return rb.metrics[k];});
if(!mets.length)mets=['revenue_sar'];
```

So the screen held two answers at once: every box off, and a money column on, with nothing saying
the report had chosen that column itself. This is the family cycles 41–43, 55 and 56 kept finding —
the app answering with more confidence than its own state supports — except here it is not "not
found" standing in for "not loaded yet". It is a **default worn as a choice**.

It did not stop at the screen. The fallback rode into `FIN._lastReport`, so **Export CSV handed
over a file with a Revenue total nobody ticked**. Someone reading the checkboxes to know what is in
the file they are about to send an accountant would have been wrong about it.

Underneath, in the same square inch, `finCSV()` opened with `var R=FIN._lastReport;if(!R)return;` —
a button that did nothing, in silence. It was nearly unreachable *only because* of the fallback
above. Fixing one without the other would have traded a wrong file for a dead button.

### What it does now

No figure selected means no report, said in words, with the controls still on screen so it is one
tick away rather than switched off:

> **No figure is selected.** There is nothing to total in this report until you tick at least one
> of the boxes under **Metrics** above — Revenue, Cost, Profit, Received, Outstanding or Service
> lines. The invoices are still here; nothing has been asked of them yet.

`FIN._lastReport` is cleared in the same breath — an export built from a report no longer on screen
is the same lie one step later — and `finCSV()` now says *"There is no report to export yet — tick
at least one figure under Metrics above."* Both bilingual. The drill-down in js/25 already read
`_lastReport` null-safely, so nothing else needed touching.

### The probe, and the false green it started as

`scripts/qa/probe-report-metrics-honesty.mjs` (port 8728, verified free). Four checks: a control
with two boxes ticked; the defect; the export; and recovery, because a "fix" that leaves the report
dead would pass the middle two and be worthless.

**The first draft passed under sabotage.** Two reasons, both worth keeping:

1. Its "does the screen say why" test scanned the whole page for words like *choose*, *select*,
   *figure*, *metric* — and the Finance page is full of them. A check that could not fail
   (cycle 48). It now diffs the page's sentences against the same page with metrics ticked and
   requires a genuinely **new** one.
2. Even after that, it still passed — because **one of this probe's own fixture clients was named
   "Metric Co"**, and the table blob containing it counted as the new sentence. A probe must not
   hand the app a word the probe is about to search for. Renamed to Alpha/Beta Trading.

It also accepted "falls back to Revenue but says so on screen" as a pass. That is a design this
cycle rejected; leaving the branch in the probe is what let the sabotage through. Removed. The
standard is now the app's own promise: the boxes say which figures the table shows, so zero ticked
must mean zero money columns.

Sabotage — the old fallback restored behind a marker unique to it — turns checks 2 and 3 red with
the exact wording of the defect, and only those two. Restore verified by `md5sum -c` against a
baseline taken **after** the fix (cycle 44), a marker count of 0, and `git status`.

### The battery, and something the battery is starting to say about itself

Two full runs. **92 probes that can fail; every one of them green** — but not in a single run:

| | `-j 6` | `-j 4` |
|---|---|---|
| green | 90 / 92 | 89 / 92 |
| red | `probe-premortem-attacks` (check H), `sweep-language-deep` | `probe-alias-dedupe-attacks`, `probe-import-preview-phone`, `probe-importer-scale-attacks` |

No probe was red in both runs, and each red was green when re-run alone. Their failure texts say
what the cause was: `sweep-language-deep` drove **1** sub-tab under load and **9** alone;
`probe-alias-dedupe-attacks` refused to conclude at all because `DB.settings` never arrived
("which is not a finding about the app" — a probe behaving exactly as it should);
`probe-importer-scale-attacks` counted 20 rows as new that the exclusion list would have caught,
which is the same starved `app_settings`; `sweep-buttons` died on "execution context was destroyed".
All contention, none of it about this cycle's change — but cycle 56 ran 91/91 in one shot at `-j 6`
and this tree no longer does. **That is a finding about the harness**, logged below.

Commit — "Watch cycle 57: six boxes that said nothing, above a column that said Revenue"
(the hash is recorded in the build log, not here: a commit cannot honestly name itself).
Patch at `/mnt/user-data/outputs/oversight-cycle-57.patch`.

## Open for cycle 58 — CLOSED, see cycle 58 below


**The battery's own contention floor.** Five different probes went red once each across two runs
and none of them twice; every one recovered alone. The harness now starves `app_settings` and the
page load under parallelism, which means a red result can no longer be read at face value without
a serial re-run. This is in lane (`scripts/qa`) and it is the thing most likely to hide a real
defect next: a genuine failure is now indistinguishable from a busy machine. Candidates: make
`run-battery.sh` re-run its own reds serially before reporting, so the summary states a fact rather
than a race; or give the mock a readiness signal the probes can wait on instead of a timeout.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 58 — the instrument, not the app: a summary line that was reporting a race

**2026-09-08.** Nothing in this cycle is about the Direct app. It is about whether the thing that
judges the app can tell *this is broken* from *the machine was busy*.

### What was wrong

Cycle 57 ran the whole battery twice on an unchanged tree and got **two different sets of reds**.
Five probes went red once each, none of them twice, and every one was green when re-run alone.
Their own texts named the cause — one drove 1 sub-tab under load and 9 alone; two never received
`app_settings` at all; one died on "execution context was destroyed". So `green: 90 / 92` was a
statement about contention wearing the clothes of a statement about the code, and a red could no
longer be read at face value. That is exactly how a real defect hides: among excuses that are
usually true.

Diagnosing it cost cycle 57 a second full battery plus four serial re-runs by hand — twenty-odd
minutes of judgement that the runner should have been making itself.

### What it does now

`scripts/qa/run-battery.sh` re-runs **only** its non-zero results, **one at a time**, before it
prints anything, and reports the two outcomes as different things:

```
re-running 1 non-zero result(s) one at a time — a red under load is not a fact until it reproduces alone
  · probe-audit-events-search-attacks — did not reproduce alone

green: 93 / 93 probes that can fail (every red above was re-run alone before this line was printed)
DID NOT REPRODUCE ALONE — went red under -j 4, green on their own: probe-audit-events-search-attacks
  These are counted green because they passed with the machine to themselves, and that is
  the honest reading of one run. It is NOT a clean bill: a probe that lands here run after
  run is a race in the app or the harness, not a busy machine.
```

Three properties, each deliberate. **Greens are never re-run**, so the retry costs what was
already failing rather than doubling a 25-minute run. **A red that reproduces alone is still red
and still exits 1** — a retry that forgave everything would be worse than no retry. And **both
attempts stay on disk**, `<probe>.log` crowded and `<probe>.retry.log` quiet: cycle 36 wrote this
runner in the first place because six cycles of moving reds had been diagnosed from a summary line
with the real output already thrown away, and a retry that clobbered the first log would walk
straight back into that.

Two new options, `-l <list>` and `-d <dir>`, exist so the script can be driven against fakes.

### The probe

`scripts/qa/probe-battery-retry-honesty.mjs` — no port; it drives a shell script, not a browser.
It writes three fakes into a temp folder (never into `scripts/qa`, where an undeclared probe is
caught by `check-probe-integrity` — cycle 56): one that always passes, one that always fails, and
one that **fails the first time it is ever run and passes afterwards**, which is what contention
looks like from the outside. Each fake records that it ran, so "was this re-run?" is a count and
not an inference.

Five checks: the contention red is kept out of RED *and* named in its own section (swallowing it
would be the other half of the same defect); the genuine red survives and the run still exits 1;
`fake-green` runs once while the two non-zero ones run twice; both logs survive; and a clean list
retries nothing and still says "battery OK".

Sabotage — the serial re-run block removed behind a marker unique to it — turns checks 1, 3 and 5
red and leaves 2 and 4 green, which is right: a genuine red is genuinely red either way. Worth
noting what the sabotaged run printed: *"every red above was re-run alone before this line was
printed"*, on a script that no longer did. Restore verified by `md5sum -c` against a baseline
taken **after** the fix, a marker count of 0, and `git status`.

### The battery

**93 / 93 probes that can fail, green, in a single run** — the first single-run all-green since
cycle 56, and this time the number is the runner's own verdict rather than one assembled by hand.
One probe, `probe-audit-events-search-attacks`, went red under `-j 4` with four checks failing
(A1, A2, A3, A6 — its A3 line even printed the site's marketing strapline where the cap notice
should have been, the signature of a page that had not finished rendering) and passed **47 of 47**
alone. Under the old runner that would have been an eighth cycle of "moving reds".

Commit — "Watch cycle 58: a summary line that was reporting a race"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 59 — CLOSED, see cycle 59 below


**The non-reproducer list is now a measurement — start reading it.** Every run from here names the
probes that went red under load and passed alone. One appearance is a busy machine. The same probe
appearing three runs running is a race in the app or the harness, and this list is the only place
it will ever show up. Cycle 59 should record which probes land there and start a tally, because
that tally is the thing most likely to surface a genuine intermittent defect — the class this
project has never yet caught.

**`probe-audit-events-search-attacks` is candidate number one for that tally** — it starved
under `-j 4` today (cycle 57 starved `probe-alias-dedupe-attacks`, `probe-import-preview-phone`
and `probe-importer-scale-attacks` the same way). All four fail on data that has not arrived. If
the same probes keep landing there, the second candidate from cycle 58's brief — a readiness
signal in `mock-supabase` that probes can wait on instead of a timeout — is the fix, and it is in
lane.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 59 — the drill-down's promise, checked against the screen instead of the data

**2026-09-08.** js/25 opens the invoices behind a Report Builder total, and its entire reason for
existing is that *what a row expands to adds up to the row it expanded from*. It guards that with
a reconcile loop, and `probe-drilldown-attacks` (cycle 22) proves the guard works.

Both of them compare `src.reduce(...)` against `tot[m]` — the raw numbers held in
`FIN._lastReport`. **Nobody had ever compared the numbers a person can see.**

### What was wrong

They are not the same numbers. The group row prints `money0(total)`; each detail line prints
`m0(value)`; both are `Math.round(n).toLocaleString()`, rounded **independently**. So three
invoices of 100.40 print as

```
▾ Quill Partners                    301
      2026-03-03 · PA-F1 · Flights  100
      2026-03-03 · PA-F2 · Flights  100
      2026-03-03 · PA-F3 · Flights  100
```

The internal check passes to the hallala. The visible arithmetic is out by a riyal. This matters
here more than anywhere in the app, because **adding the lines up is the one thing this feature is
for** — the owner's original ask was "expandable down to the invoices and services under it" so a
figure could be checked.

Not contrived, either: the approved expense lines total 1,935,461.74, and profit is revenue minus
cost, so fractions are ordinary on every cost and profit column.

### What it does now

The house pattern from cycles 49 and 50 — keep the rounded headline, print the exact number
underneath when they differ:

> These lines are rounded to the nearest riyal, so adding them up does not land on the total above.
> Revenue: the lines read 300, the total reads 301, and the exact figure is 301.20 SAR.

Only when the whole set is on screen; past the 200-row cap the existing note already explains why
the lines cannot sum to the total. The metric's name is read from **the table's own header**
rather than a second copy of the label map, so it cannot drift from the column it describes.
Nothing about any figure changed — the underlying total is still 301.20 and the row still prints
301, proved by its own check.

### The probe

`scripts/qa/probe-drilldown-printed-arithmetic.mjs` (port 8729, verified free). Its reading is
strictly DOM text — no `FIN` internals in the measurement, which is the whole point, since reading
the internals is what let this sit unnoticed through a dedicated drill-down probe. Four checks: a
whole-riyal control (proving the probe can read the screen at all); the defect; that the figure
behind the row and the printed headline are untouched; and that the genuine reconcile refusal
still fires when a total is poisoned by 5,000 — a rounding explanation that could also cover a
real disagreement would be far worse than the defect.

Fixture clients are named Zephyr Holdings and Quill Partners: no word this probe later searches
the screen for (cycle 57, where a fixture called "Metric Co" made the probe's own text search pass
under sabotage). Sabotage — the note's list emptied behind a marker unique to it — turns check 2
red alone, exactly as predicted. Restored, `md5sum -c` OK, marker count 0, `git status` clean.

### The battery, and the first entries in the new tally

**94 / 94 probes that can fail, green, in one run.** The runner's own re-run caught two
non-reproducers: `probe-mega` (its refresh came back to a blank page under load) and
`probe-restore-scope-attacks` (its control never set itself up — 1500 before, 1500 after delete,
1500 after restore, i.e. its own writes had not landed). Both passed alone.

**Contention tally, running (cycle 58 introduced the list; this is the point of keeping it):**

| cycle | did not reproduce alone |
|---|---|
| 57 | probe-premortem-attacks, sweep-language-deep, probe-alias-dedupe-attacks, probe-import-preview-phone, probe-importer-scale-attacks |
| 58 | probe-audit-events-search-attacks |
| 59 | probe-mega, probe-restore-scope-attacks |

**Eight distinct probes, and not one has appeared twice.** That is the useful reading so far: this
is not a race in one probe or one screen, it is whichever probes happen to be co-scheduled when
the machine is short — every failure text is a page or a write that had not arrived. A repeat is
what would change the diagnosis, and there is still no repeat.

Commit — "Watch cycle 59: three invoices of 100.40, printed as 100 + 100 + 100 = 301"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 60 — CLOSED, see cycle 60 below


**Keep the tally, and watch for the first repeat.** Three cycles in, eight probes, zero repeats.
If a probe lands in that list twice, that is a race worth chasing and the readiness-signal work in
`scripts/qa/mock-supabase.mjs` becomes the target. Until a repeat appears, the evidence says the
machine is short, not that the app is racing — do not build the readiness signal on the strength
of eight one-offs.

**The same "read the internals, not the screen" question, asked elsewhere.** This cycle's defect
survived a dedicated probe because the probe measured `FIN`, not the DOM. That is a class, not an
incident: `probe-report-builder-attacks`, `probe-client-profit-honest` and the ageing probes all
reconcile against internals. Cycle 60 should pick one surface and re-ask its promise in printed
text only.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 60 — the same rounding, one level up, on the surface a manager reads

**2026-09-08.** Cycle 59 said its finding was a class, not an incident. This cycle asked the same
question of the Report Builder table itself and got the same answer, plus a second defect nobody
was looking for.

### What was wrong, part one: the column does not reach the number at the bottom of it

`rReports()` prints every group row with `money0(g[k].__tot[m])` and the TOTAL row with
`money0(grand[m])`, where `grand` sums the **raw** values and rounds once. So:

```
Zephyr Holdings     100
Orchard Freight     100
Vellum Group        100
TOTAL               301
```

Three clients billing 100.40 each. Sub-rows under a second grouping have the identical shape
against their own group row — on the very view the owner asked for by name, *"<client> January
total"*.

`probe-report-builder-attacks` proves this table's arithmetic to the hallala at four groupings and
has never compared two **printed** figures to each other. That is exactly how this stood in plain
sight since the table was built.

### What was wrong, part two: found while proving nothing moved

The probe's last check asserts the export still carries exact figures — a guard against "fixing"
the screen by rounding the file. It printed what the file actually said:

```
TOTAL,301.20000000000005
```

Binary floating point, written into the document an accountant works from. `finCSV` pushed raw JS
numbers straight into the CSV. Nobody had ever looked at the file's own text either.

### What it does now

Screen: the house pattern from cycles 49, 50 and 59 — keep the rounded headline, state the exact
figure when the rounding shows, and only when it shows. On whole-riyal data, which is most of this
file, nothing appears at all.

> The figures here are rounded to the nearest riyal and each total is rounded separately, so
> adding a column up may not land on the figure below it. Revenue: the rows read 300, the total
> reads 301, and the exact figure is 301.20 SAR. The exported CSV carries the exact figures.

File: money goes out at two decimals, counts as integers. A formatting change only — the value is
unchanged to the hallala, and `TOTAL,301.20` is what the file now says.

### The probe

`scripts/qa/probe-report-table-printed-arithmetic.mjs` (port 8730, verified free). Reads printed
table text only; `FIN` appears once, in the check that proves no figure moved. Four checks: a
whole-riyal control, the column against its TOTAL, the sub-rows against their group row, and the
export still exact. Fixtures are named Zephyr Holdings, Orchard Freight and Vellum Group — no word
the probe later searches the screen for (cycle 57).

Sabotage — the offending-metric list emptied behind a marker unique to it — turns checks 2 and 3
red and leaves the control and the export check green. Restored, `md5sum -c` OK, marker count 0,
`git status` clean.

### The battery, and the tally

**95 / 95 probes that can fail, green, in one run.** One non-reproducer:
`probe-exclusion-not-loaded`, starved under `-j 4`, green alone.

**Contention tally:**

| cycle | did not reproduce alone |
|---|---|
| 57 | probe-premortem-attacks, sweep-language-deep, probe-alias-dedupe-attacks, probe-import-preview-phone, probe-importer-scale-attacks |
| 58 | probe-audit-events-search-attacks |
| 59 | probe-mega, probe-restore-scope-attacks |
| 60 | probe-exclusion-not-loaded |

**Nine distinct probes over four cycles. Still not one repeat.** The reading holds: a short
machine, not a race in the app. Nothing should be built on this list until a name appears twice.

Commit — "Watch cycle 60: a column of 100s under a total of 301, and a CSV saying 301.20000000000005"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 61 — CLOSED, see cycle 61 below


**The class is not exhausted.** Two cycles, two surfaces, two versions of the same defect, both
invisible to probes that read internals. The remaining money surfaces whose promise is arithmetic
by eye: the ageing buckets (cycle 49 gave them an exact-figure helper — do the buckets sum to
Outstanding *on screen*?), the per-client table's Revenue/Cost/Profit columns, and the Overview
cards against the ledger they claim to summarise. Pick one and read only what is printed.

**Also worth one look: every other export.** The CSV float defect was found by accident, in a
check written for something else. `finLedgerCSV`, the Records finance export and the B2C export
were never read as text either. That is a half-cycle of work and it is in lane.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 61 — the other exports, read as files: mostly a negative result, and two things that were not

**2026-09-08.** Cycle 60 found `TOTAL,301.20000000000005` in the Report Builder's CSV by accident,
in a check written to prove a fix had moved nothing. That was the first time any of these files
had been read as text. This cycle read the other two.

### The negative result, which is the main finding

`finLedgerCSV` (invoice rows) and `finTxnCSV` (transactions) **do not have cycle 60's defect, and
there is a reason worth writing down**: they write stored values, and every write path in the app
rounds before storing — js/65 stores `Math.round((rev-cost)*100)/100`, js/41 the same, the mapped
importer path takes the file's own figure or rounds it. A value with more than two decimals never
reaches a stored row. `finCSV` broke because it is **the one export that sums**, and a sum of
clean two-decimal doubles routinely is not one.

That distinction mattered while writing the probe. Its first fixture wrote `100.4 - 33.35` straight
into a row and duly caught `profit_sar="67.05000000000001"` in the ledger export — a defect the app
cannot produce, because nothing writes an unrounded figure. That is cycle 50's trap exactly, and it
was one small step from a commit "fixing" a file that was already right. The fixture now writes
what the app's own paths would write, and the check asks the only question that can honestly be
asked of an export: **does it add float noise of its own?**

### Two things that were not negative

**`window.finLedgerCSV` is unreachable from the UI.** No button, no menu, no caller: the whole repo
mentions the name in comments and in one probe. The Ledger tab's "Excel (CSV)" is `finTxnCSV`, and
the Records page's finance export reads `FIN._csvRows` directly rather than calling it. Its role
guard, its Arabic header path and the probe coverage on it are all about a file nobody can produce
by pressing anything. Cycle 56's rule: "unreachable" is a more honest answer than "low-risk". Kept
rather than deleted — `probe-access-truth` exercises it and it is the obvious thing to wire up if
the Ledger is ever asked for a row-level invoice export — but now labelled as what it is.

**A false claim about what an export contains.** `FIN._csvRows` is `live().filter(finInPeriod)` —
the period bar **only**. It does not carry the client scope or any other filter the person has set.
The Records page's finance export reads it under a comment saying it is *"the currently-filtered
Ledger rows (set by rLedger())"*. It is not, and `rLedger()` has not set it since it was refactored
onto the transactions table. Today that means a person who has scoped Finance to one client and
exports from Records gets **every client in the period**. `js/core/core-05-records.js` is not this
session's file to edit (P4), so this is logged rather than changed; the warning is written at the
definition of `finLedgerCSV`, which is the other thing that would inherit it the moment anyone
wires a button to it.

### The probe

`scripts/qa/probe-export-files-as-text.mjs` (port 8731, verified free) holds all three Finance
exports to what a money file must satisfy, and names which file fails which: every data row has the
header's cell count; no cell carries a binary-float artifact; every filled money cell parses as a
number; and the file holds exactly the rows the page is showing. It reads the bytes with its own
deliberately literal CSV parser. `FIN` is consulted once, to know how many rows the screen has —
the thing the file is compared *to*.

Sabotage — cycle 60's `csvNum` reverted behind a marker unique to it — was the useful part. The
first attempt at it **stayed green**, because the fixture had no client with several fractional
invoices, so nothing in the report actually summed. Three invoices of 100.40 under one client were
added for the express purpose of making check B able to fail; with them, sabotage turns it red on
`Revenue` and `Profit` at exactly the group that sums. Restored, `md5sum -c` OK, marker count 0,
`git status` clean.

### The battery

**96 / 96 probes that can fail, green, in one run.** One non-reproducer,
`probe-expense-report-capture`, green alone.

**Contention tally:**

| cycle | did not reproduce alone |
|---|---|
| 57 | probe-premortem-attacks, sweep-language-deep, probe-alias-dedupe-attacks, probe-import-preview-phone, probe-importer-scale-attacks |
| 58 | probe-audit-events-search-attacks |
| 59 | probe-mega, probe-restore-scope-attacks |
| 60 | probe-exclusion-not-loaded |
| 61 | probe-expense-report-capture |

**Ten distinct probes over five cycles. Still not one repeat.** Whatever is short under load, it is
not one place.

Commit — "Watch cycle 61: the other two exports are clean, and here is why — plus a button that does not exist"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 62 — CLOSED, see cycle 62 below


**For whoever owns `js/core/core-05-records.js`:** its finance export's comment claims
`FIN._csvRows` is the currently-filtered Ledger rows. It is the period filter only. Either scope
the rows to what the Finance page is showing, or say in the file what the file contains — but the
comment as it stands will mislead the next person who reads it, and the export as it stands
misleads the person who opens it.

**The class is still open, and one surface in it is untested:** the ageing buckets. Do
0–30 / 31–60 / 61–90 / 90+ / No invoice date / Dated in the future sum to Outstanding **on screen**?
Cycle 49 gave that area an exact-figure helper, so the pattern is to hand. The per-client
Revenue/Cost/Profit columns and the Overview cards against the ledger are the two after it.

**A rule this cycle earned, worth applying before every "fix":** ask whether the app can actually
produce the value the probe is failing on. Twice now (cycle 50, cycle 61) a probe has demanded
something the app never promised or caught something the app cannot do. Both times the tell was the
same — the fixture, not the app, put the offending value there.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 62 — six amounts that do not come to the total above them, and a quieter kind of rounding

**2026-09-08.** Fourth surface in the class cycles 59–61 opened, and the one where reading down is
the entire job. The Collections & ageing card shows Outstanding, then six amounts under it:
0–30, 31–60, 61–90, 90+, and where they exist "No invoice date" and "Dated in the future". Every
riyal in Outstanding is in exactly one of those six **by construction** — the loop adds `out` to
`arOut` and then to exactly one bucket — so a person deciding who to chase reads down them and
expects the figure above to be their sum.

### What was wrong, and why cycle 49 did not already fix it

Cycle 49 fought a rounding battle on this very card and won it: `moneyS()` renders 8,755,055 as
"8.76M", so `finExactUnder()` now prints the exact figure underneath whenever the short form hides
something. That makes each number legible **on its own**. It says nothing about six of them adding
up to a seventh.

And the gap here is quieter than the one cycle 49 fixed. `moneyS(1000.40)` is `"1.0K"`;
`finExactUnder` stays **silent**, because to the nearest riyal nothing is hidden. Six such silences
are two and a half riyals the reader cannot see anywhere:

```
Outstanding   10,752            ← its exact line fires: 10.8K hides too much
  0–30 days    1.0K             ← silent: 1,000.40 rounds to 1,000
  31–60 days   2.0K
  61–90 days   3.0K
  90+ days     4.0K
  No invoice date  500
  Dated in the future  250
                    ─────
  reading down       10,750
```

### What it does now

One line, only when it shows:

> These amounts are shortened to fit, so reading down them comes to 10,750 where Outstanding reads
> 10,752. Every riyal outstanding is in exactly one of them — the exact total is 10,752.40 SAR.

The interesting part of the change is underneath it. Deciding whether the buckets add up requires
knowing **which figure a reader actually ends up with** — the exact line where one is printed, the
shortened form where it is not. That predicate already existed inside `finExactUnder`, so rather
than copy it, it is now `finShortHides()` / `finShortBack()` / `finPrintedValue()`, with
`finExactUnder` rewritten to use them. One definition, two callers; the chokepoint rule this
codebase keeps relearning.

### The probe

`scripts/qa/probe-ageing-printed-arithmetic.mjs` (port 8732, verified free). Reads the card's
printed text and adds up what a person would add up. Four checks: a whole-riyal control; the
hallala case; that "No invoice date" and "Dated in the future" are both shown **and** counted
inside Outstanding (cycles 6 and 28 put those rows there deliberately — this holds them to it in
printed text); and that no figure moved.

Fixtures are seeded through `Math.round(x*100)/100`, exactly as js/65 and js/41 store — cycle 61's
rule, applied before rather than after the fact. Two decimals is what makes the question real: a
hallala is below the riyal the card prints.

**One correction inside the probe itself.** Its "did the card say why" test first searched the
prose for words like *rounded* and *nearest riyal* — and my fix says "shortened to fit", so a
correct fix read as a failure. Rewriting the check around the wording would have been the wrong
repair: a word-search is satisfied by any sentence containing the word (cycle 57). It now requires
the prose to carry **the exact outstanding total**, which is the substantive thing a reader needs
and cannot be satisfied by furniture.

**And one arithmetic error, mine, not the app's.** The "nothing moved" check asserted the seeded
rows summed to 10,754.40. They sum to 10,752.40. The app was right and the check was wrong —
the same shape as the 3 Sep go-live lesson (*test the property, not what you assumed the number
was*), and it was the app's own answer that exposed it.

Sabotage — the note suppressed behind a marker unique to it — turns check 2 red alone. Restored,
`md5sum -c` OK, marker count 0, `git status` clean.

### The battery

**97 / 97 probes that can fail, green, and for the first time since the tally began, ZERO
non-reproducers** — no probe went red under `-j 4` at all, so nothing needed a serial re-run.

**Contention tally:**

| cycle | did not reproduce alone |
|---|---|
| 57 | probe-premortem-attacks, sweep-language-deep, probe-alias-dedupe-attacks, probe-import-preview-phone, probe-importer-scale-attacks |
| 58 | probe-audit-events-search-attacks |
| 59 | probe-mega, probe-restore-scope-attacks |
| 60 | probe-exclusion-not-loaded |
| 61 | probe-expense-report-capture |
| 62 | *(none)* |

Ten distinct probes over six cycles, no repeat, and now a clean run. Nothing here supports building
a readiness signal.

Commit — "Watch cycle 62: six amounts that do not come to the total above them"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 63 — CLOSED, see cycle 63 below


**Two surfaces left in the class.** The per-client table's Revenue / Cost / Profit columns against
their own totals, and the Overview cards against the ledger they claim to summarise. After those,
the class is genuinely exhausted and the honest thing is to say so rather than keep looking.

**A pattern worth naming now that it has happened four times.** Cycles 59, 60 and 62 each found the
same defect on a different surface, and each time the existing probe had verified the numbers
*behind* the screen. The general lesson is not about rounding: **a probe that reads the model
cannot see a defect that lives in the view.** That belongs in `scripts/qa/README.md` as a standing
instruction for whoever writes the next probe, and writing it there is a fair half-cycle.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch. For whoever owns
`js/core/core-05-records.js`: its finance export's comment claims `FIN._csvRows` is "the
currently-filtered Ledger rows"; it is the period filter only.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

