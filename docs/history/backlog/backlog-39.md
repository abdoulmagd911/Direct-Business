## Watch cycle 63 — the fifth surface, the standing rule, and the first repeat in the tally

**2026-09-08.** Three things this cycle: the last untested money table in the printed-arithmetic
class, the lesson written down where the next probe-writer will read it, and a name that appeared
in the contention list for the second time.

### The fifth surface

"Top clients by revenue" — the table where a manager decides which client is worth the effort.
Every cell is `money0()`: each row rounded to the whole riyal **separately** from the Total under
it. Five clients billing 1,000.40 print five rows of 1,000 above a Total of 5,002, and the Cost
column does the same.

This table already had a probe — `probe-client-profit-honest`, which guards something genuinely
important (a client with no recorded cost must not show a 0 and a profit equal to its whole
revenue). It reads `FIN`. It could not see this.

The fix is the house pattern, with two exclusions that matter more here than anywhere else,
because this table has **two legitimate reasons its columns may not add up and both are already
declared on screen**:

- only the top 10 rows are shown while the Total covers every client — said in the header, so the
  new note stays silent unless every client is on screen;
- a client with no recorded cost anywhere prints the *words* "not recorded" / "unknown" rather than
  a 0 (rule M8), which makes those columns unaddable — skipped, and the existing `_tcNote` already
  explains that case.

Restating either of those as a rounding artefact would have been a new lie in place of an old one.
The probe holds the fix to both: check 3 fails if the no-cost client's words ever become numbers.

### The standing rule, written down

Five surfaces in a row, each with a probe that passed, each with a defect visible on screen. That
is no longer a run of incidents. `scripts/qa/README.md` now opens its probe-writing guidance with
it:

> **A probe that reads the model cannot see a defect that lives in the view.**

with the table of all five, the mechanism (*every figure is formatted independently, so any two of
them can disagree by the width of the formatting, and no amount of correctness in the data prevents
it*), and the two traps that cost real time: **do not test for a word the fix might use** (cycle 57
passed under sabotage on its own fixture name; cycle 62 failed a *correct* fix that said "shortened
to fit" instead of "rounded"), and **ask whether the app can produce the value you are failing on**
(cycles 50 and 61; the latter came one step from "fixing" a correct file).

### The battery — and the first repeat

**98 / 98 probes that can fail, green in one run.** One non-reproducer: `sweep-buttons`.

**That is the first name to appear twice.** It also died under load in cycle 57 — recorded then
under "REPORTS THAT DID NOT FINISH", before the retry mechanism existed, which is why it did not
look like a repeat until now. Both times, the same cause, and it is worth being precise about it:

```
page.evaluate: Execution context was destroyed, most likely because of a navigation
    at goto (scripts/qa/sweep-buttons.mjs:69)
```

**This does not trigger the readiness-signal work, and saying why matters.** The rule was "a name
appearing twice justifies building it" — but the reason for that rule was that repeated starvation
would point at `mock-supabase` not telling probes when data has arrived. `sweep-buttons` is not
starved of data: it navigates while a previous evaluate is still in flight, and loses its execution
context. That is a race in **that file's own navigation handling**, in a report with no assertions,
and the fix belongs there rather than in the mock. Building a readiness signal on this evidence
would be answering a question nobody asked.

**Contention tally:**

| cycle | did not reproduce alone |
|---|---|
| 57 | probe-premortem-attacks, sweep-language-deep, probe-alias-dedupe-attacks, probe-import-preview-phone, probe-importer-scale-attacks, *(sweep-buttons — crashed, recorded separately at the time)* |
| 58 | probe-audit-events-search-attacks |
| 59 | probe-mega, probe-restore-scope-attacks |
| 60 | probe-exclusion-not-loaded |
| 61 | probe-expense-report-capture |
| 62 | *(none)* |
| 63 | **sweep-buttons — second appearance** |

Ten probes still with a single appearance each; one file now with two, for a reason of its own.

Commit — "Watch cycle 63: five rows of 1,000 above a total of 5,002, and the rule written down"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 64 — CLOSED, see cycle 64 below


**The class has one surface left: the Overview cards against the ledger they claim to summarise.**
After that it is genuinely exhausted, and the honest thing will be to say so and go elsewhere
rather than keep hunting the same shape.

**`sweep-buttons` navigation race — in lane, and now evidenced twice.** It calls `goto()` while a
previous `page.evaluate` can still be in flight, and dies with "execution context was destroyed".
It is a report, so it never goes red — it just silently produces nothing, which is the worse
failure. Worth half a cycle: await the navigation properly, and give it a failure path so a run
that produced nothing says so. **Note it is `sweep-buttons.mjs`, not a `probe-*-attacks.mjs` file,
so it is writable by this session.**

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch. For whoever owns
`js/core/core-05-records.js`: its finance export's comment claims `FIN._csvRows` is "the
currently-filtered Ledger rows"; it is the period filter only.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 64 — the last surface, and the report that could only ever be silent

**2026-09-08.** Two things, and the class is finished.

### The sixth surface: the one equation these cards exist to show

Six cards head the Finance Overview. They are **not** a column that sums, and this cycle's care went
into not pretending otherwise — two things about them are deliberate and documented, and reporting
either as a defect would have been the mistake:

- **Outstanding** is measured over ALL live invoices while the other five are verified-only, because
  an invoice is only verified-paid once nothing is left to pay. Cycle 4 fixed the opposite bug;
  narrowing it to make the cards tie would re-break it.
- **Invoices** is a count of distinct invoice numbers, not money.

Exactly one relation holds across them, and it is the first thing anybody checks: **Profit =
Revenue − Cost.** All three are `moneyS()` with an exact line only when the short form hides a whole
riyal — so all three can be individually defensible and jointly wrong:

```
Revenue  3,000        (3,000.30 — the short form hides nothing to the riyal, so no exact line)
Cost     1,202        (1,201.80 — exact line printed)
Profit   1,799        (1,798.50 — exact line printed)
         3,000 − 1,202 = 1,798
```

The Overview now says so when it happens, with all three exact figures. It does **not** happen for
most numbers — `round(a) − round(b)` and `round(a − b)` usually agree — which is exactly why it
needs saying when it does.

**The probe's first fixture was benign and proved nothing.** 1,000.40 against 400.60 renders
consistently, so the check passed on a defect that was really there. The values are now chosen for
the property that exposes it (the cost's fraction the larger one, the difference landing on a half)
and the reason is written into the probe, because a check that cannot fail is not a check — cycle 48,
and cycle 63 had to do the same thing deliberately.

**THE CLASS IS NOW EXHAUSTED.** Six surfaces, six cycles: drill-down (59), Report Builder table and
its CSV (60), the other two exports — clean, with a reason (61), the ageing card (62), Top clients
(63), the Overview cards (64). Every money figure a person can read off this app has now been added
up the way they would add it up. The standing rule is in `scripts/qa/README.md`. **Stop hunting this
shape** — the next cycle that goes looking for it is looking for something that is no longer there.

### The report that could only ever be silent

`sweep-buttons` presses about 190 controls and prints what each did. It died under load in cycles 57
**and** 63 — the first name to appear twice in the contention tally — both times with
`page.evaluate: Execution context was destroyed, most likely because of a navigation`: the previous
click had started a navigation still settling when the next `evaluate` ran.

`alive()` already knew how to survive that. `goto()` and `state()` did not, so the process died with
a raw stack **and produced nothing** — and because the file always ended `process.exit(0)`, a run
that examined zero buttons was indistinguishable from a clean one. The battery could only say "did
not finish", with no idea how far it got.

Both are now routed through one guard that recovers from a torn-down context, retries once, and
counts it. And the file has a real failure path — **but only for silence**:

> `FAILED — the sweep did not complete (2 reason(s)). The button verdicts above are a report and
> never fail a run; this is about the sweep itself.`

That distinction is the whole design. The 189 button verdicts are judgements about controls, not
assertions; a `NO-OP?` line must never redden a battery. What reddens it is a page that produced no
result, fewer than 40 buttons pressed, or a page abandoned mid-sweep. Sabotage — the page loop made
to skip everything behind a marker unique to it — produces exactly those lines and exit 1.

Removed from `scripts/qa/reports.txt` in the same commit: a file with a real failure path is not a
report, and `check-probe-integrity` holds that count so it can only go down. It is now one of the
probes that can fail.

### The battery

**100 / 100 probes that can fail, green, zero non-reproducers** — the second clean parallel run in
three cycles. The count rose by two: the new probe, and `sweep-buttons` joining the probes from the
reports.

**Contention tally:** unchanged from cycle 63 — 57: probe-premortem-attacks, sweep-language-deep,
probe-alias-dedupe-attacks, probe-import-preview-phone, probe-importer-scale-attacks,
(sweep-buttons, crashed); 58: probe-audit-events-search-attacks; 59: probe-mega,
probe-restore-scope-attacks; 60: probe-exclusion-not-loaded; 61: probe-expense-report-capture;
62: none; 63: sweep-buttons; **64: none**.

Commit — "Watch cycle 64: the last surface in the class, and a report that could only ever be silent"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 65 — CLOSED, see cycle 65 below


**The printed-arithmetic class is closed. Go somewhere else.** Candidates that have never been
attacked from this session and are in lane:

- **`js/62`'s merge/undo path** beyond the readiness guard cycle 56 added — what happens when a
  merge is undone twice, or undone after the target has itself been merged.
- **`js/65`'s preview-to-commit gap under a changing file** — the preview is computed from one read
  of the file and the commit from another; nothing has ever changed the input between them.
- **The period bar's own arithmetic** — `finPeriodMatch` decides what every Finance figure counts,
  and no probe drives it directly across year/quarter/half/month/sector combinations.

**Do not** re-attack the drill-down, the report table, the exports, the ageing card, the client
table or the Overview cards.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch. For whoever owns
`js/core/core-05-records.js`: its finance export's comment claims `FIN._csvRows` is "the
currently-filtered Ledger rows"; it is the period filter only.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 65 — money that is in a year and in none of its quarters

**2026-09-08.** First cycle after the printed-arithmetic class closed. New target: `finPeriodMatch`,
four lines through which every money figure on the Finance page passes, and which no probe had ever
driven directly.

### What was wrong

```js
function finYearOf(r){return r.year||(r.invoice_date?+String(r.invoice_date).slice(0,4):null);}
...
if(/^Q[1-4]$/.test(pt))return r.quarter===pt;
if(pt.indexOf('M:')===0)return r.month===pt.slice(2);
```

`finYearOf` falls back to the invoice date when a row carries no year, and **it has to**: js/16's own
B2B import writes `invoice_date`, `month` and `quarter` and **never a year**, so without that
fallback every row it wrote would drop out of every year filter.

That same import writes `month:o.month, quarter:o.quarter` straight off the parsed file. A file with
no Month or Quarter column therefore produces a row that **has a date and no quarter** — and quarter
and month had no fallback at all. Such a row counts in "All periods" and in its year, and vanishes
from every quarter, every half and every month:

```
2026 total        3,100
  Q1 + Q2 + Q3 + Q4 = 1,500
  H1 + H2           = 1,500
```

1,600 SAR in the year and in no quarter, with nothing on any card saying which money went missing or
why. **One field defended, two not, from the same source.**

### Live or latent

Checked against the live database before writing a line of the fix (read-only): all 46 live invoices
carry a date, a month and a quarter, and every one agrees with its date. So this is **latent, not
live** — and it is reachable through the app's own import path, which is the test cycle 61 set for
whether a defect is real rather than invented. Recorded that way rather than dressed up.

### What it does now

`finMonthOf()` and `finQuarterOf()` derive from the invoice date **only when the row carries no
value of its own** — a stored value always wins, so this fills a gap and never overrules what a row
says about itself. Derived, never invented: a row with no date at all still belongs to no period,
which is rule M8, and the probe's fourth check holds the fix to exactly that.

### The probe

`scripts/qa/probe-period-partition.mjs` (port 8735, verified free). Its header says why it asserts on
the model rather than the screen, since the README's standing rule from cycles 59–64 says the
opposite: **this defect lives in the model** — it is about which rows a period counts at all — so the
model is the right place to assert, and the screen is checked once at the end for the consequence a
person actually meets (the Revenue card for a year against its four quarters).

Five checks: a fully populated row lands in its year, half, quarter and month and nowhere else; the
four quarters and two halves each partition the year; the stripped row does not vanish; an undated
row is still never given a period; and the year's Revenue card equals its quarters'. Fixtures are
written exactly as js/16's import writes them — **no `year` field** — because that is the shape that
makes this reachable.

Sabotage — the quarter fallback removed behind a marker unique to it — turns checks 3 and 5 red and
leaves the control and the M8 check green. Restored, `md5sum -c` OK, marker count 0, `git status`
clean.

### The battery

**101 / 101 probes that can fail, green, zero non-reproducers** — third clean parallel run in four
cycles. Tally unchanged: 57 (five, plus sweep-buttons crashed); 58 one; 59 two; 60 one; 61 one;
62 none; 63 sweep-buttons (fixed in 64); 64 none; **65 none**.

Commit — "Watch cycle 65: money that is in a year and in none of its quarters"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 66 — CLOSED, see cycle 66 below


**The disagreement case, deliberately not fixed this cycle.** A row whose stored `quarter` says Q2
while its `invoice_date` says March is now *still* counted as Q2 — the stored value wins, by design,
because overruling it would silently move money on the say-so of a date that might be the wrong
field. But nothing anywhere says the two disagree. Zero live rows do today (checked). The honest next
step is to surface it, not to resolve it silently: a count on the Finance page, or a line in the
importer's preview, saying "N invoices carry a month or quarter that does not match their date".
That is a decision about which field is authoritative, and it may be the owner's to make.

**Two fresh targets left from cycle 65's brief, neither started:**
- `js/62`'s merge/undo path beyond cycle 56's readiness guard — a merge undone twice, or undone
  after the target has itself been merged. Company-identity money; the family of cycles 40, 43, 56.
- `js/65`'s preview-to-commit gap — the preview is computed from one read of the file and the commit
  from another, and nothing has ever changed the input between them.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch. For whoever owns
`js/core/core-05-records.js`: its finance export's comment claims `FIN._csvRows` is "the
currently-filtered Ledger rows"; it is the period filter only.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 66 — merges chain, and undo is order-dependent; plus the tally's first real repeat

**2026-09-08.** Company identity — the family of cycles 40, 43 and 56, where the wrong answer puts
one company's money on another company's record.

### Two of the three scenarios were already guarded, and that is the finding

Both scenarios this cycle's brief named were checked against the live database functions first
(read-only, `pg_get_functiondef`), before a line was written. **Both are already refused
server-side:**

- **double undo** — `fn_unmerge_businesses` selects `where id = p_merge_id and undone_at is null
  for update` and raises *"merge not found or already undone"*;
- **merging into an archived company** — `fn_merge_businesses` raises *"the company to keep is
  archived — keep the live one"*, and refuses an already-archived drop unless explicitly allowed.

Neither is a defect. Recording that is the point: cycle 61's rule is to ask whether the thing can
happen before fixing it, and here the answer came from the functions themselves rather than from
argument.

### What nobody guards is ORDER

Merge B into A. Then merge A into C. Both sit in the history with an Undo button each, and nothing
says they are related.

Undo the **first** and its `moved` list puts B's records back on B — but those records are on C by
then. Undo the **second** afterwards and its own list (which still names those records, because
they were on A when A was merged) puts them on A. **Which company ends up with the money depends on
which button is pressed first**, and the screen gave no way to know that.

The fix is here rather than in the functions — they are not this session's to change (P4) and do not
need to be, because the chain is visible in rows js/62 already holds. A merge whose kept company is
the dropped company of a later, still-live merge now says so instead of offering a button:

> Undo "Ashcombe Holdings → Cotwell Group" first — Ashcombe Holdings has since been merged away, so
> undoing this one now would be reversed by that one.

The **later** merge keeps its Undo: it is the one that is safe, and freezing the whole chain would
leave no way back at all. Once it is undone, the earlier row offers Undo again — the guard reads the
chain as it stands, it does not stamp a row.

**A second defect, found while reading the output.** The Kept column was printing a raw UUID
whenever the kept company had been archived by a later merge — because an archived company is not in
`DB.businesses`, and the lookup had no other source. The later merge holds that name in its own
snapshot; it now uses it. Without this the guard's own message would have named a UUID.

### The sabotage that applied and did nothing

First attempt wrapped the chain search in `if(false){…} else if(!undone){…}` — the marker was
present, `grep -c` said 1, and **the probe stayed green**, because the `else if` still ran the
original branch. Cycle 41's inert-guard trap, this time in the sabotage itself: *the marker being
present is not the same as the sabotage taking effect.* Redone as `blocker=null;` after the search,
which turns check 2 red alone and leaves the other three green.

Check 4 also failed once on its own setup — it called a `window.v62ReloadMerges()` that does not
exist, so the in-memory history never changed. It now reloads the page, which is what
`v62UnmergeBiz` itself does. That check is a regression guard on the *shape* of the fix rather than
an independent finding, and the probe says so.

### The battery — and the first repeat that means what the rule meant

**102 / 102 probes that can fail, green.** One non-reproducer: **`probe-alias-dedupe-attacks`, and
it is its second appearance** (cycle 57). Unlike `sweep-buttons` — whose repeat turned out to be its
own navigation race — this one failed **both times on the same thing**:

> ✗ DB.settings never arrived from app_settings — the exclusion list and group map below would be
> measured against an empty object, which is not a finding about the app

That is precisely the condition the readiness-signal rule was written for: *a probe that repeatedly
fails on data that had not arrived.* The rule is now met, for the first time, on a real starvation.

**Contention tally:**

| cycle | did not reproduce alone |
|---|---|
| 57 | probe-premortem-attacks, sweep-language-deep, **probe-alias-dedupe-attacks**, probe-import-preview-phone, probe-importer-scale-attacks, (sweep-buttons, crashed) |
| 58 | probe-audit-events-search-attacks |
| 59 | probe-mega, probe-restore-scope-attacks |
| 60 | probe-exclusion-not-loaded |
| 61 | probe-expense-report-capture |
| 62 | none |
| 63 | sweep-buttons (own navigation race — fixed in 64) |
| 64 | none |
| 65 | none |
| 66 | **probe-alias-dedupe-attacks — second appearance, same cause both times** |

Commit — "Watch cycle 66: merges chain, and undo is order-dependent"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 67 — CLOSED, see cycle 67 below


**THE READINESS SIGNAL IS NOW JUSTIFIED — build it.** The condition held since cycle 58 has been met:
`probe-alias-dedupe-attacks` starved on `app_settings` in cycles 57 and 66, the same failure text
both times. Two others starved on the same table once each (`probe-importer-scale-attacks` counted
20 rows as new that the exclusion list would have caught; `probe-exclusion-not-loaded` could not run
at all). The work: give `scripts/qa/mock-supabase.mjs` a readiness signal a probe can WAIT on
instead of a timeout — and note what it must not become: a blanket sleep, or a way for a probe to
pass without the data. The probes that guard the exclusion list are the ones that must never be
allowed to conclude from an empty object.

**Not started, still in lane:** `js/65`'s preview-to-commit gap — the preview is computed from one
read of the file and the commit from another, and nothing has ever changed the input between them.

**Left open from cycle 65, unchanged:** a row whose stored `quarter` disagrees with its
`invoice_date` is still counted as stored. Surface it, do not pick a winner in code — deciding which
field is authoritative is likely the owner's call. Zero live rows disagree today.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H; `probe-guardrails-both-halves-attacks`'
2500 ms stopwatch. For whoever owns `js/core/core-05-records.js`: its finance export's comment claims
`FIN._csvRows` is "the currently-filtered Ledger rows"; it is the period filter only.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 67 — the readiness signal, and the line it must not cross

**2026-09-08.** Cycle 58 wrote the condition for building this and then refused to build it for
nine cycles: **not until a probe repeatedly fails on data that had not arrived.** Cycle 66 met it.

`probe-alias-dedupe-attacks` starved on `app_settings` in cycles 57 **and** 66, with the same
sentence both times. `probe-importer-scale-attacks` and `probe-exclusion-not-loaded` starved on the
same table once each. `sweep-buttons` also repeated and was deliberately **not** counted — its
repeat was its own navigation race, fixed in cycle 64 — which is why the rule asked for the same
cause twice rather than any two reds.

### What was actually wrong

The probe's own words were careful and correct:

> ✗ DB.settings never arrived from app_settings — the exclusion list and group map below would be
> measured against an empty object, which is not a finding about the app

And that sentence is the end of the road. A probe waiting on a guessed number of milliseconds
**cannot tell whether the app never asked for the table or asked and the answer was late**, so all
it can do is give up and say something vague. The mock knows the one fact neither the probe nor the
page can see: whether the request was made and answered.

### What was built

`scripts/qa/mock-supabase.mjs` now counts responses per table — reads and writes separately, with a
timestamp — exposed at `GET /__mock/served`, counted at the point the table is known and **before**
the answer is built, so a table that exists but returns nothing still counts as served. An empty
answer is an answer.

`scripts/qa/wait-ready.mjs` is the waiter, and its entire design is one separation:

- `waitServed()` — a fact about the **wire**: the mock answered a request for this table.
- `waitInApp()` — a fact about the **page**: the app has the data and put it where the feature
  reads it from.
- `waitReady()` — both, wire first, so a timeout says which half failed.

**Neither ever resolves true on timeout.** They return `{ok:false, why}` naming what did not happen:
*"…was never requested at all in 1200ms — the app did not ask for it, so this is not a slow answer"*
versus *"…was served 2 reads in 1200ms, fewer than the 2 needed"*. That distinction is the whole
reason the thing exists.

### The line it must not cross, and the check that holds it there

A readiness signal that says "ready" when the app has nothing is **worse than a timeout**. The
probes that starve are precisely the ones guarding the exclusion list, and their whole job is to
refuse to conclude from an empty object; a helper that treated "served" as "ready" would hand them
exactly that failure.

So `probe-mock-readiness.mjs` (port 8737) is mostly about the danger rather than the feature. Five
checks: the counter rises for a table the app really reads; **on timeout it returns false**; it says
which of the two things went wrong; it is per-table, so busy traffic elsewhere satisfies nothing;
and — the one that matters — `waitReady()` with a page condition that is never true fails at the
**app** stage and says *"the answer arrived and the app did not use it."* A probe can never pass on
the strength of the wire alone.

`wait-ready.mjs` is declared as a support file in `check-probe-integrity.mjs`, with the reason
written where the list is: it asserts nothing about the app, so it belongs beside the mock rather
than among the files that must be able to fail. The probe is what holds it to its promises.

### The sabotage, done the way cycle 66 taught

Cycle 66's first sabotage was **present and inert** — the marker was in the file, `grep -c` said 1,
and the probe stayed green. So this one was checked for effect, not just presence: `waitServed()`
made to return `ok:true` on timeout turns **three** checks red (never-asked, the timeout property,
and per-table), leaving the control and the wire-vs-page check green — the last correctly, because
`waitReady` still fails at the app stage. Restored, `md5sum -c` OK, marker count 0, `git status`
clean.

### Not adopted yet, deliberately

**No `probe-*-attacks.mjs` file was touched.** They are not this session's to write, and rewriting
three of them to use a helper written in the same cycle would be changing the thing and the measure
of it together. The waiter exists, is proven, and is available; adopting it belongs to whoever owns
those probes, or to a later cycle that takes one at a time. Said here so it is a decision rather
than an omission.

### The battery

**103 / 103 probes that can fail, green, zero non-reproducers.** Fourth clean parallel run in six
cycles. Tally unchanged from cycle 66.

Commit — "Watch cycle 67: a probe can now wait on a fact instead of a guess"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 68 — CLOSED, see cycle 68 below


**Adopt the waiter, one probe at a time.** `probe-alias-dedupe-attacks` is the obvious first — it is
the one that starved twice — but it is a `probe-*-attacks.mjs` file this session did not write, so
the honest options are: leave it to whoever owns it, or take it as a deliberate exception with the
reason recorded. `probe-exclusion-not-loaded` was written by this session (cycle 42) and is fair
game today. Whichever is taken: the adoption must keep both halves — served, then in the app — and
must not become a reason to weaken what the probe asserts.

**Still in lane, not started:** js/65's preview-to-commit gap — the preview is computed from one
read of the file and the commit from another, and nothing has ever changed the input between them.

**Left open from cycle 65:** a row whose stored `quarter` disagrees with its `invoice_date` is
counted as stored. Surface it, do not pick a winner in code. Zero live rows disagree today.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch. For whoever owns
`js/core/core-05-records.js`: its finance export's comment claims `FIN._csvRows` is "the
currently-filtered Ledger rows"; it is the period filter only.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 68 — adopting the signal at the one place seven probes already share

**2026-09-08.** Cycle 67 built the readiness signal and deliberately adopted it nowhere. This
cycle adopts it, and the interesting part is *where*.

### The obvious way would have been wrong

The brief offered `probe-exclusion-not-loaded` (written by this session, cycle 42) as the safe
first adopter, and `probe-alias-dedupe-attacks` — the one that actually starved twice — as a file
this session does not own. Both framings assumed the change belongs *in a probe*.

It does not. Seven probes already wait on the same helper, `settingsLoaded()` in
`mock-supabase.mjs`:

```
probe-alias-dedupe-attacks      ← starved cycles 57 and 66
probe-expense-report-capture    ← starved cycle 61
probe-exclusion-not-loaded      ← starved cycle 60
probe-finance-invariants · probe-import-preview-density
probe-merge-dialog-money · probe-received-outstanding-attacks
```

**All three probes that have ever starved on `app_settings` are callers of it.** Putting the wire
check inside the helper gives every one of them the diagnosis without editing a single
`probe-*-attacks.mjs` file — no ownership question to take an exception on, and no seven copies of
the same logic to drift apart. The chokepoint principle this codebase keeps relearning, applied
before the copies existed rather than after.

### What changed, and what deliberately did not

`settingsLoaded()` now checks the **wire** first — reading `SERVED` directly, same module, no HTTP
and no second source of truth — and only then does everything it did before. Its hard-won page
logic is untouched: the `__mockSettingsLanded` marker, the caller's own `alsoRequire` predicate, and
the rule that both must hold **twice, 700 ms apart** because `DB.settings` can be replaced more than
once during boot. Adoption must not weaken what a probe asserts, so nothing was removed.

The return value stays a plain boolean, so the four probes this session does not own behave exactly
as before. The reason goes on `settingsLoaded.lastWhy`, and the difference is the whole point:

- *"app_settings was never requested at all in 90000ms — the app did not ask for it, so this is not
  a slow answer"*
- *"app_settings was served 3 time(s), but the app never held the settings the probe needs — the
  answer arrived and the page did not end up with it"*

Three cycles of "never arrived" could not tell those apart. `probe-exclusion-not-loaded` — mine, so
fair game — now prints it.

### The sabotage, and what it revealed about the old message

Skipping the wire check turns check 6 red, and the failure text is worth keeping:

> lastWhy: "app_settings was served **0 time(s)**, but the app never held the settings — **the
> answer arrived** and the page did not end up with it"

Served zero times, and the message says the answer arrived. That is precisely the misdiagnosis this
cycle removes, produced on demand. Marker asserted **and** effect confirmed (cycle 66). Restored,
`md5sum -c` OK, marker count 0, `git status` clean.

`probe-mock-readiness` gained a sixth check rather than a new probe and a new port: it calls
`settingsLoaded()` **before the page has loaded anything**, so `app_settings` genuinely has not been
requested, and the helper must say so quickly instead of spending its whole budget waiting on a page
that was never going to receive it.

### The battery

**103 / 103 probes that can fail, green, zero non-reproducers.** Fifth clean parallel run in seven
cycles.

Commit — "Watch cycle 68: the readiness signal adopted where seven probes already share a waiter"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 69 — CLOSED, see cycle 69 below


**Whether this actually helped is now measurable, and should be checked rather than assumed.** The
next time a probe lands in "DID NOT REPRODUCE ALONE" on `app_settings`, its log should say which
half failed. That is the test of this cycle's work, and it cannot be run to order — it happens when
it happens. Record the wording when it does.

**Still in lane, not started:** js/65's preview-to-commit gap — the preview is computed from one
read of the file and the commit from another, and nothing has ever changed the input between them.

**Left open from cycle 65:** a row whose stored `quarter` disagrees with its `invoice_date` is
counted as stored. Surface it, do not pick a winner in code. Zero live rows disagree today.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch. For whoever owns
`js/core/core-05-records.js`: its finance export's comment claims `FIN._csvRows` is "the
currently-filtered Ledger rows"; it is the period filter only.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

