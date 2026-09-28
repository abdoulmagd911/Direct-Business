## Watch cycle 69 — a defect that is not there, established rather than assumed

**2026-09-09.** Target: js/65's preview-to-commit gap — "a person approves what they were shown,
and something else is written", the family this project cares about most. The answer is that the
gap does not exist, and every step of establishing that is worth more than the fix would have been.

### Three things checked before writing a line of code

Read from the live database, read-only (`pg_get_functiondef`, `pg_indexes`):

- **A row previewed as NEW that someone else inserts in between cannot silently duplicate.**
  `finance_invoices` carries a UNIQUE index on `(invoice_no, line_no)`, so the insert raises,
  `fn_commit_finance_import` rolls the whole transaction back, and the app says *"FAILED — nothing
  landed"*. Honest already.
- **The success message already reports the database's own counts**, not the app's hopes (M13).
- **The update path is an upsert on `id`**, and `deleted_at` is not in its column list, so an
  update cannot quietly resurrect a soft-deleted invoice.

### The hypothesis, and how it died

`v65Commit` runs `mergeUpdatesByInvoice(toUpdate)` **after** the preview counted, so several file
rows touching one invoice collapse into a single write — the button could promise 3 updates and the
database perform 2, and on success nothing compares the two. A real-looking gap.

It is not reachable. Driven from the UI by every route there is:

- **Two rows carrying the same reference in one file** — the parser refuses the second *by name*:
  *"appears more than once in this file — the first row was kept, this one needs manual review."*
  Only one ever reaches the merge.
- **Two files each naming the same reference** — the later file's row replaces the earlier one's,
  and `toUpdate` still holds a single entry.

Then the decisive test: **`mergeUpdatesByInvoice` was removed entirely and nothing observable
changed** in either case. It guards a case the parser already prevents. Cycle 56's rule —
*"unreachable" is a more honest answer than "low-risk"* — so it is now documented as such at the
function, kept because it is cheap and correctly shaped, but explicitly not load-bearing.

### Two mistakes of mine, both instructive

**The fixture was keyed on the wrong column.** Every seeded row looked new, and the control
"passed" while exercising nothing. Reading back the row the importer actually wrote gave the
answer: **`invoice_no` comes from "Invoice Reference #", not "Invoice Number".** Nothing in the
repo said so; it does now, at the function that depends on it.

**The "nothing moved" check asserted the wrong number** — 1,500, the first file's figure, when two
files naming one reference correctly end at 1,750, the later one's. The app was right and my check
was wrong. Third time this session that the check written to prove a fix moved nothing has been the
thing that was broken (60, 62, 66).

### The probe was written and then deleted

`probe-import-promise-vs-write.mjs` reached all-green — and then failed its own sabotage twice. A
marker that swapped the database's counts for the app's intent was **inert**, because in this
fixture the two numbers are equal. Removing the merge outright was **also inert**, because the
merge never has two entries to collapse. A probe that cannot fail is not a probe (48, 61), so it
was deleted rather than declared, exactly as cycle 56 deleted `probe-empty-filter-honesty`. What
survives is the knowledge, written where the next reader will hit it.

### The battery, and cycle 64's fix earning itself under load

**103 / 103 probes that can fail, green.** One non-reproducer: `sweep-buttons`, its **third**
appearance (57, 63, 69) — and this time it said so:

```
✗ some pages produced no result at all: Client detail, Clients list, Finance, Settings
FAILED — the sweep did not complete (1 reason(s)). The button verdicts above are a report and
never fail a run; this is about the sweep itself.
```

In cycles 57 and 63 it died with a raw stack and produced **nothing**, and the battery could only
say "did not finish". Cycle 64 gave it a failure path for silence alone; this is that change
working on real contention rather than on a sabotage. The distinction it draws is exactly the one
intended: the 189 button verdicts stayed a report, and what failed the run was the sweep not
finishing.

**No probe starved on `app_settings` this cycle**, so cycle 68's wire-versus-page wording has still
not been exercised by a real starvation. Recorded as untested rather than assumed working.

Commit — "Watch cycle 69: the preview-to-commit gap is not reachable, and here is how that was established"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 70 — CLOSED, see cycle 70 below


**Cycle 68's readiness wording is still unproven in the wild.** Keep watching the runner's
"DID NOT REPRODUCE ALONE" section; when a probe next starves on `app_settings`, read the log and
record which half it named. Do not manufacture one.

**Cycle 65's open item, still untouched:** a row whose stored `quarter` disagrees with its
`invoice_date` is counted as stored. Surface it — a count on the Finance page or a line in the
importer preview — and do not pick a winner in code. Zero live rows disagree today.

**A fresh target, given the importer is now well understood:** `js/65`'s "appears more than once in
this file" path. It refuses the second row and counts it under `excludedByRule` — but does the
person see WHICH row was dropped and why, or only a number? That is the same
"say what happened, not just how many" family as cycles 55–57, and it is in lane.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch. For whoever owns
`js/core/core-05-records.js`: its finance export's comment claims `FIN._csvRows` is "the
currently-filtered Ledger rows"; it is the period filter only.

**For the owner:** the go-live question was put to Abdulrahman again on 9 September (a fresh day
since the first ask). Unchanged besides that: a real deep link into Direct Payments needs that
export to carry a uuid or id column; it does not today.

---

## Watch cycle 70 — telling the owner two fields disagree, without deciding which one is right

**2026-09-09.** Two candidates were offered. The first was checked and turned out to be already
done, which is worth recording before the second.

### The candidate that was already built

js/65's "appears more than once in this file" path: does the person see WHICH row was dropped, or
only a count? Read before writing anything — `renderCombinedPreview` groups
`excludedDetail.costCaptureDetail` by reason and prints the invoice numbers, collapsing into a
`<details>` when there are more than three:

```
3 — REF-A, REF-B, REF-C: appears more than once in this file — the first row was kept,
    this one needs manual review
```

Nothing to fix. Two cycles running now that a candidate has proved already-handled (66's server-side
guards, 69's unreachable merge), which is a reasonable sign the obvious gaps in this area are
closed.

### The one that was real

Cycle 65 gave month and quarter the same date-fallback `finYearOf` has always had, so a row with a
date and no stored period stopped vanishing from every quarter. It deliberately left the other case
alone: **a row whose stored quarter says Q2 while its date says March is still counted as Q2.**
That was the right call and this cycle does not change it — overruling a stored value on the say-so
of a date that might itself be the wrong field would move money silently, and which of the two is
authoritative is Abdulrahman's decision, not this code's.

What was wrong is that **nothing said the two disagree**. The Finance page now does:

> ⚠ 1 invoice carries a month or quarter that does not match its invoice date. They are counted
> under the stored value as they always were — no figure has changed — but the period bar above
> follows what is stored, not the date.

Checked read-only on 8 September: **zero live invoices disagree today**, so this is a watch rather
than an alarm. It appears only when it has something to show.

The derivation is now named once — `finMonthFromDate()` / `finQuarterFromDate()`, with
`finMonthOf`/`finQuarterOf` calling them and `finPeriodDisagrees()` as the third caller. Those are
two different questions ("which period does this row belong to" versus "what does the date say")
and a second copy of the second one would drift the day either is touched — cycle 68's rule applied
before the copies existed.

### The probe

`scripts/qa/probe-period-disagreement-visible.mjs` (port 8738 — free again since cycle 69's probe
was written, found unable to fail, and deleted). Four checks, and the third is the one that matters:
**the disagreeing invoice is still counted in Q2, the quarter it stores.** A "fix" that quietly
re-sorted it on the date's say-so would pass the other three and be exactly the thing this cycle
refused to do. Also: an undated row is not counted as a disagreement — there is nothing to
contradict, and inventing one would be M8 in a new place.

Fixture values are chosen for the property (March stored as June/Q2), not at random: with zero live
rows disagreeing, a benign fixture would prove nothing (cycles 63, 64).

Sabotage — the count forced to zero behind a marker unique to it — turns check 2 red alone, with
the other three green. Marker asserted **and** effect confirmed (66, 69). Restored, `md5sum -c` OK,
marker count 0, `git status` clean.

### The battery

**104 / 104 probes that can fail, green.** One non-reproducer: `probe-restore-scope-attacks`, its
second appearance (59, 70), failing both times on its own setup — *"the attack did not set itself
up… 5000 after the delete (expected 0)"*, i.e. its writes had not landed. Not an `app_settings`
starvation, so it does not exercise cycle 68's wire-versus-page wording; **that is still untested in
the wild** and is recorded as untested rather than assumed working.

Commit — "Watch cycle 70: say the two fields disagree, do not decide which one wins"
(the hash is recorded here, not in the repo: a commit cannot honestly name itself).

## Open for cycle 71 — CLOSED, see cycle 71 below

**`probe-restore-scope-attacks` is now the second name to appear twice** (59, 70), and both times
its own writes had not landed when its control ran. Unlike `probe-alias-dedupe-attacks` this is not
`app_settings` — it is the probe's own setup — so cycle 67's readiness signal does not cover it. It
is a `probe-*-attacks.mjs` file this session did not write; the honest options are to leave it to
whoever owns it, or to take it as a deliberate exception with the reason recorded. Do not do it
silently.

**Cycle 68's readiness wording remains untested in the wild.** Keep watching; do not manufacture a
starvation to test it.

**A question for the owner, not for code, now that it is visible:** if invoices ever do start
carrying a month or quarter that contradicts their date, which field should win? The app currently
counts the stored value and now says when the two differ. Do not raise this until there is at least
one real row — today there are none, and asking about a hypothetical is not worth his time.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch. For whoever owns
`js/core/core-05-records.js`: its finance export's comment claims `FIN._csvRows` is "the
currently-filtered Ledger rows"; it is the period filter only.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 71 — the refusal was right, and it said nothing

**2026-09-09.** Cycle 32 closed the correctness half of the Finance write guard: eight paths ask
both questions — is this a read-only share view, and does this person's role still allow the
Finance page — and under either refusal not one row changes.
`probe-write-paths-both-halves-attacks` holds that, and it also *recorded*, without asking anything
of it, what the app said while refusing. Its own output line is
`under a role that denies the Finance page: delete an invoice changed nothing` — with the optional
`— "…"` that would have carried the message printed empty, every time. Six of the eight write paths
did the same thing when `finCanWrite()` said no: `return`. No alert, no console line, nothing on
screen. **The database was safe and the person was told nothing at all.**

That session is ordinary, not hypothetical. js/65's own guard names it — *"a stale tab (or a role
changed while it was open)"* — and it is the shape cycle 32 measured: a TIER that still reads
`admin`, so `canFinEdit()` says yes, while the person's page access no longer includes Finance. The
Finance page refuses that session **in words**. The buttons already drawn on it refused in silence.
Someone who presses Delete and sees the invoice still sitting there cannot tell *"you may not"*
from *"this button is broken"*, so they press it again and learn nothing either time.

**The change (js/16, adopted in js/25 and js/65).** `finWriteBlock()` answers one question with two
uses: `''` when the write may proceed, a reason code when it may not. `finCanWrite()` is that answer
read as a boolean — same three questions, same order, same catch semantics, so no caller's behaviour
moved. `finRefuseWrite()` is the same answer read out loud, returning `true` when the caller must
stop, so a guard reads `if(finRefuseWrite())return;` — the shape it replaces. Splitting the guard
from the sentence would let the two drift, which is how a person gets told *"only admins may do
this"* while they are an admin. Cycle 68's rule: put the change in the thing the callers share.

**Three reasons, named separately**, because the wrong true sentence is worse than none: a share
link is told it is a share link, a revoked page access is told to ask for the page back, and a
non-editor is told the tier rule. Telling an admin *"only admins and managers may change Finance
data"* is a claim they can disprove at a glance and it sends them to the wrong person.

**The probe found a defect in the fix, on its first run.** The reason for a share view could never
be reached: `finMaySeeMoney()` asks `canFinView()`, which *is* `!__isShareView`, so with the order
inherited from `finCanWrite` — where every no was the same no — all eight paths read the *access*
sentence to a share link. Asking the narrower question first changes no answer, only which true
thing gets said.

**And a defect in the probe, which is the README's own trap.** Its first run reported
`finSetTargets` and `finSetWay` as silent. They are not: **js/49 wraps exactly those two**
(`guardFn`, its finance list) and refuses them with a modal *before the function body is entered*.
The probe was listening to `window.alert` and js/49 draws `#v70box` — *a probe that reads the model
cannot see what lives in the view*, verbatim the lesson cycles 59–64 wrote into
`scripts/qa/README.md`. It reads both places now and accepts either vocabulary, as long as the words
name the reason that applied. js/49 governs every page and is not this lane's to rewrite, so the two
mechanisms are **recorded, not merged** — the app now speaks on all eight paths, in two voices.

**New `probe-write-refusal-speaks.mjs` (port 8739), 5 things:** (1) control — as an allowed admin
every path really writes *and* says nothing, because a refusal read out to someone who is allowed is
a worse fault than the silence being closed; (2) the load-bearing one — under a role that no longer
allows Finance, all eight paths say so; (3) the words name the access, and must not tell an admin
that only admins may do this; (4) under a share view the words name the share link; (5) and nothing
is written under either refusal — a regression guard on cycle 32, so *"it speaks now"* can never be
bought by loosening the guard that made it refuse.

**Sabotage** (`finRefuseWrite()` returns true without alerting): 12 red — the six paths this lane
gave a voice, across both halves — while the controls and check 5 stayed green, and
`finSetTargets`/`finSetWay` stayed green because js/49 speaks for them. That asymmetry was predicted
before the run, which is the point of cycle 66's rule: assert the marker *and* that the expected
checks turn red.

**Where this came from.** `probe-restore-scope-attacks` was the second name to appear twice in the
contention tally (cycles 59 and 70) and both times it failed on its own setup with the same words —
*"before 1500, after delete 1500"*, and nothing said. That is not a slow write. It is
`finDelInv`'s `if(!finCanWrite())return;` firing before the role had loaded and returning in
silence, which the probe can only read as *"the app ignored the click"* — exactly what a person
would read. The probe is a `probe-*-attacks.mjs` this session did not write and it has **not** been
edited; the app it is pointed at now answers, which is the honest end of that thread.

**And on the very first battery run after the change, the app named the cause of a two-cycle-old
mystery — in the wild, without the probe being touched.** `probe-restore-scope-attacks` went red
under `-j 4` for the third time (cycles 59, 70, 71), always with the same two lines: *"before 1500,
after delete 1500"* — the delete had no effect — and nothing said. This run its fourth line carried
the app's own explanation:

> `Changing Finance data is limited to admins and managers, so the change was not made and nothing in the data changed.`

`window.__userTier` had not loaded when the probe pressed Delete. That is the whole of it, and it
was invisible for two cycles because the refusal was silent. **The probe was not edited.** The app
it is pointed at answers now, which is the honest end of that thread — and it opens the next one.

## Open for cycle 72 — CLOSED, see cycle 72 below

**A TIER THAT IS NOT YET KNOWN IS BEING READ AS A TIER THAT IS NOT ENOUGH.** `canFinEdit()` is
`__userTier==='admin'||__userTier==='manager'`, so an unloaded tier reads as *no*, and the person is
now told — in words, which is the improvement — *"Changing Finance data is limited to admins and
managers"*. For an actual admin in the first moment after load, that sentence is **false**. js/49
already has the rule for exactly this and states it in its own comment: *"role not known yet — never
block a real user by accident"*, and `mayOpen()` likewise returns true on an unknown answer. Finance
has no such distinction: unknown and insufficient are the same `false`. Two candidate shapes, and
the choice matters — a fourth reason code that says *"still loading, try again in a moment"* keeps
the refusal (safe, honest, and a person can act on it), whereas letting an unknown tier through
would be widening a write guard, which this lane does not do without a much better reason than a
tidier sentence. **Measure first**: how long is that window in a real load, and is `__userTier` ever
simply absent rather than late? `probe-restore-scope-attacks`' crowded log is the standing evidence
that it is reachable.

**The two voices.** All eight Finance write paths now refuse in words, but two of them do it through
js/49's modal and six through this lane's alert, with different wording for the same state. Merging
them means editing js/49, which governs every page — out of lane. Recorded here for whoever owns it.

**Untested in the wild, still:** cycle 68's wire-versus-page wording inside `settingsLoaded()`. Watch
for it; do not manufacture a starvation to test it.

**Not carried forward:** the shared "my write is readable" waiter floated for cycle 71.
`probe-restore-scope-attacks` already polls the table for the effect with a 30-second budget; the
poll was never the problem. Building a waiter for it would have been infrastructure for a cause that
had been diagnosed away.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; js/49's refusal wording; `probe-premortem-attacks` check H;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

**A question for the owner, not for code:** if invoices ever do start carrying a month or quarter
that contradicts their date, which field should win? Do not raise it until there is at least one
real row — today there are none.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 72 — a tier that had not arrived was being read as a tier that was not enough

**2026-09-09.** Cycle 71 gave the Finance write refusal a voice. Within one battery run the voice
said something false. `canFinEdit()` is `__userTier==='admin'||__userTier==='manager'`, so a tier
that has not **loaded** reads as a tier that is not **enough**, and the app told an actual admin:

> `Changing Finance data is limited to admins and managers, so the change was not made and nothing in the data changed.`

That is a claim the person can disprove at a glance, and it sends them to ask for a permission they
already hold. It was invisible for two cycles because the refusal used to be silent.

### Measured before anything was changed

A throwaway harness timed the boot against the mock — not inspection, and not the probe's own
simulation:

| boot | write functions exist | `__roleKnown` true | window | `__userTier` inside it |
|---|---|---|---|---|
| healthy | 141 ms after sign-in | 289 ms | **~150 ms** | `undefined`, every sample |
| role lookup delayed 3 s | 78 ms | 3,175 ms | **~3.1 s** | `undefined`, every sample |
| **one transient 500 on the role lookup** | 127 ms | 5,237 ms | **~5.2 s** | `undefined`, every sample |

The third row is not a contrivance. It is the path js/02 built deliberately and documents in its own
comment — *"let them in on the floor, keep trying"* — `hideOverlay()` then `setTimeout(fetchRole,5000)`.
The Finance page is **fully drawn and interactive** for those 5.2 seconds, and the window repeats on
every retry. So this is reachable by a person on a flaky connection, not only by a loaded probe.

The two states are **distinguishable**: `__userTier` is `undefined` throughout, never a string. The
app already knows how to make exactly this distinction and says so in its own words — js/49's
`can()`: *"role not known yet — never block a real user by accident"* — and js/52's `known()`, which
js/53, js/55 and js/64 all gate on. Finance was the one place that collapsed them.

### The change, which does not widen the guard

A fourth reason code, `FIN_BLOCK_UNKNOWN`, asked before the tier rule and only when there is no
answer to read (`finTierKnown()`: any tier at all is an answer — the `!!window.__userTier` test js/10,
js/45 and js/57 already use — or js/02's settled `__roleKnown===true`). **An unknown tier still
refuses**, and `finCanWrite()` returns false in exactly the cases it did before: every state that
reaches this question with no tier would have fallen through to `FIN_BLOCK_TIER` anyway. Only the
sentence changes — from something false to *"Your access level has not finished loading… try again
in a moment; if it keeps happening, reload the page."* Letting an unknown tier through would have
been widening a write guard to tidy up a message, which is not a trade this lane makes. The probe
asserts `finCanWrite()===false` in the new state and that nothing is written, so the better sentence
cannot have been bought with a weaker guard.

### The probe, and the anchor that stops it being a simulation

`probe-write-refusal-speaks` (8739) gains a third half — the measured boot state reproduced exactly
(`__userTier` and `__roleKnown` both deleted) across all eight write paths — and a final section
that **boots the app in a fresh browser context with the role lookup failing once** and presses a
write inside the real window. Everything else in the probe describes a state; this one stands in it.

**Sabotage** (`finTierKnown()` returns true unconditionally, so an unknown tier falls back to the
tier rule): **9 red, exactly as predicted before the run** — the eight paths under the loading half,
each reporting the tier sentence rather than silence, plus the anchor reporting that a real boot told
the admin only admins may do this. Every other check stayed green.

### Three faults in my own check, before it worked

The anchor is the fifth time the thing written to prove something has itself been the broken thing
(60, 62, 69, 71, and now three ways in one cycle):

1. **It matched the wrong request.** `app_users` + `role` also matches js/50's periodic recheck
   (`select('role,active')`), which ate the single injected failure; js/02's lookup then succeeded
   and the window never opened. Narrowed to `must_change_password`, which only js/02 asks for.
2. **It re-navigated the page it had been driving all along**, which does not re-run the sign-in
   flow — no role lookup was issued at all, so nothing could be failed. It boots a fresh context now.
3. **It broke out of its wait too early.** js/16 defines the write functions at page load, long
   before sign-in, so the very first sample already read *"functions present, no tier, role not
   known"* — a window the role lookup had not yet opened. It now waits for the failure to have been
   **sent**.

Each of those three produced a check that reported *"the page never reached that moment"* about a
page that had. A setup that has quietly stopped setting up still looks like a check.

### One clean run is not a fixed race

Battery 105/105 at `-j 4` with **no reds at all** — the first run since cycle 58 with an empty
"DID NOT REPRODUCE ALONE" section, and `probe-restore-scope-attacks` among the green. **Do not read
that as the flake being fixed.** Cycle 72 changed what the app *says* in that window, not how long
the window lasts: a write fired before the tier loads is still refused, so the probe can still go
red the same way. One quiet run is one quiet run.

## Open for cycle 73 — CLOSED, see cycle 73 below

**The two voices, unchanged from cycle 71.** All eight Finance write paths refuse in words, but two
of them through js/49's modal and six through this lane's alert, with different wording for the same
state — and js/49 has no equivalent of the new loading sentence, so `finSetTargets` and `finSetWay`
under a role denial still say *"You do not have access to that page"* where the other six say why in
Finance's own terms. Merging means editing js/49, which governs every page. Out of lane; recorded.

**Checked and closed rather than carried:** `finTierKnown()` treats any tier string as an answer, so
the obvious way to reintroduce the falsehood under a new name would be a path that sets a
*placeholder* tier before the real role lands. There is none. `window.__userTier` is written in
exactly two places — js/02's `applyRolePerms(roleTier(myRole))`, reached only after `fetchRole()` has
a row with a real `d.role` (a missing or inactive role goes to `showPending()` instead), and js/50's
live re-check, likewise from a fetched `d.role`. `'team'` is js/02's mapping for a role that is not
admin/manager/viewer, never a stand-in for "not yet known", so a person holding it is correctly told
the tier rule. Established by reading every assignment, not assumed.

**Untested in the wild, still:** cycle 68's wire-versus-page wording inside `settingsLoaded()`. Watch
for it; do not manufacture a starvation to test it.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; js/49's refusal wording; `probe-premortem-attacks` check H;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

**A question for the owner, not for code:** if invoices ever do start carrying a month or quarter
that contradicts their date, which field should win? Do not raise it until there is at least one
real row — today there are none.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

## Watch cycle 73 — cycle 43's rule had been applied to one tab of four

**2026-09-09.** Cycle 43 gave the Clients tab a refusal while the exclusion list is still
outstanding, and the reason it gave was general: *"a display may degrade to 'not checked yet'; it
may not present money the owner ruled out as somebody's revenue."* Nothing else in js/16 mentioned
the list. `probe-exclusion-display-attacks` holds the Clients tab and the alias picker. **Nothing
held the other two money tabs.**

### Measured before anything was changed

The app_settings response held back 4 seconds, one ordinary client at 100,000 SAR beside a
standing-excluded partner at 900,000 — a 90% share, chosen near the real case behind the rule
(Takamol: 6.7M SAR, 77% of displayed revenue) so a wrong total cannot be read as rounding:

| tab | in the window | says anything? |
|---|---|---|
| **Overview** | shows **1,000,000** — ten times the truth | no; corrects itself silently later |
| **Reports** | shows 1,000,000 **and names the excluded partner** in its table | no |
| Clients | refuses, in words | yes (cycle 43) |
| Ledger | reads `finance_transactions`, a different source | outside this finding either way |

Reports commits exactly the fault cycle 43 named, on a tab cycle 43 did not visit — and Reports has
an Export CSV button beside it. The Overview quotes a figure inflated tenfold on the tab everyone
lands on, and it is the number people repeat.

### The two tabs are treated differently, on purpose

**Reports refuses.** Its default grouping is *by client*, so it attributes the money to a named
partner — the attribution cycle 43 forbade. Grouping by month instead is not a way out: it only
moves the money from nobody's row into May's revenue.

**The Overview does not blank.** It names no one — every figure there is a total — it is the landing
tab, and `exclLoad()` gives up after five tries, so `finExclusionsKnown()` can be false
**permanently** in a workspace whose app_settings never answers. Cycle 43 accepted a permanently
refusing Clients tab; a permanently blank Finance page is a different bargain. So the Overview keeps
its figures and says, above them, that they have not been checked — *"do not quote a number from
this screen until they do."* **Above** matters: a caveat read after the number is read after the
number is believed, and the probe asserts the position, not just the presence.

This is a judgement, and what would change it is written into the code: **if the Overview ever
starts naming a client** — a top-clients block, a per-client tile — the refusal is right there too,
because the fault is attribution, not size. Today it does not; `rFinClients` owns the only
per-client table in the file.

Cycle 43's wording moved into a shared `finUncheckedRefusal()` rather than being copied, so the two
refusing tabs cannot drift into describing the same state differently.

### New `probe-exclusion-unchecked-surfaces.mjs` (port 8740), six things

Controls that all three tabs are correct and uncaveated with the list loaded; **the load-bearing
check** — Reports names no partner and prints none of its money in the window; that it says why
rather than going quietly blank; that the Overview keeps its figures, says they are unchecked, and
puts that **above** the first money card; that Clients still refuses (a regression guard on cycle
43); and that once the list lands all three come back to the right answer with no caveat — *a
refusal that does not lift is an outage.* The state is produced by holding the app_settings answer
back, never by emptying `DB.settings` by hand: cycle 42 established that a hand-built state proves a
guard that cannot fire in the running app.

**Sabotage** (`rReports`' gate made unable to fire): **exactly 2 red, the two predicted checks and
the predicted kind** — Reports named the partner and printed its 900,000, and said nothing. Every
other check stayed green, because the Overview and Clients hold their own gates.

### Two faults in the probe, both caught by its own controls

1. **It knew only one of the app's two money formats.** The Overview's cards go through `moneyS()`
   and read `1.00M` / `100.0K`; the Reports table uses `money0()` and reads `1,000,000` / `100,000`.
   Knowing only the long form, the probe failed its own Overview control on a correct screen.
2. **Its second boot waited 60 seconds for a login form that never comes.** The session is already
   in storage, so it threw *after* passing all three controls — the same trap cycle 72's anchor fell
   into, twelve hours earlier, in a different file.

### The battery run itself produced two findings, and neither is weather

106/106 at `-j 4`, but with **four** non-reproducers — the most since cycle 57. Reading their
crowded logs rather than counting them:

- `probe-expense-report-capture` failed **honestly**, naming its own cause: *"the exclusion list
  never arrived from app_settings — a fact about this run and not about the app."* That is the
  cycle-67/68 readiness guard doing exactly its job. Nothing to fix.
- `probe-crm-attacks` never got the page far enough to render its cards. Ordinary starvation.
- **`probe-role-nav` died on `EADDRINUSE`, port 8974.** It picks `8700 + Math.floor(random()*500)`,
  so it can collide with any fixed battery port and with its own spawned children. This is not
  weather, it is arithmetic, and it will recur. It also means **`check-probe-integrity.mjs`'s
  "all 155 probes that open a port use a port of their own" is blind to the one probe that does not
  declare a port** — the gate certifies uniqueness it cannot actually see. Both are in this lane.
- **`probe-import-preview-phone` crashed inside the app**, not the harness:
  `TypeError: Cannot set properties of null (setting 'innerHTML')` at
  `js/65-universal-importer.js:1480` — `document.getElementById('finImpOut').innerHTML=…` in
  `processFileList`, with no null check, reached before the Import tab's container was in the DOM.
  Whether the app should degrade or the probe drove too early is precisely the cycles-71/72
  question, and it is answerable by measurement.

## Open for cycle 74 — CLOSED, see cycle 74 below

**Two candidates from this run's own battery, both in lane, both with evidence already in hand:**
the port-integrity hole (`probe-role-nav`'s random port, and the gate that cannot see it), and
js/65's unguarded `finImpOut` write. Measure before fixing either; the second needs establishing
whether a person can reach that state or only a probe under load can.

**A question worth measuring, not guessing:** the Overview's caveat says the figures may include an
excluded partner. It does not say **which** figures moved once the list lands, and a person who read
1.00M and comes back to 100.0K has no way to connect the two. Whether that is worth saying — and
whether it can be said without storing a pre-exclusion total, which the storage doctrine forbids —
is the open question. Do not build it before establishing the person can actually be in that
position long enough to notice.

**The two voices, unchanged from cycles 71-72.** All eight Finance write paths refuse in words, but
two go through js/49's modal and six through js/16's alert, and js/49 has no equivalent of the
"still loading" sentence. Out of lane; recorded for whoever owns js/49.

**Out of lane but worth someone's attention:** `js/31-v48-team-access…` line 388 builds a
per-client revenue rollup filtered by `finExclusionCheck()` with **no** `finExclusionsKnown()` gate
— the same fail-open shape, on a page this lane does not own. Not measured, only read.

**Untested in the wild, still:** cycle 68's wire-versus-page wording inside `settingsLoaded()`.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; js/49's refusal wording; `probe-premortem-attacks` check H;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

**A question for the owner, not for code:** if invoices ever do start carrying a month or quarter
that contradicts their date, which field should win? Do not raise it until there is at least one
real row — today there are none.

**For the owner, unchanged:** a real deep link into Direct Payments needs that export to carry a
uuid or id column; it does not today.

---

