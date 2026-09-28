## 2026-09-06 · Watch cycle 33 — mutation audit round five: a clean sweep, and js/62 measured rather than assumed

**Attack area (ee): mutation audit round five, over everything added since cycle 29. Attack area (ff): js/62's own write surface, driven against both halves.**

**First, a correction to cycle 32 from the Code session — and it is right.** Cycle 32 reported that dropping the share-view question from `finCanWrite` turns two probes red. It does not: `finMaySeeMoney()`, which the new first line calls, already asks it, so the second line is a **redundant copy** and removing it alone leaves both probes green. **Verified here independently before recording it** — removing only that line: both green; removing both copies: 13 red in one probe, 3 in the other. The code was right; the claim was wrong. **The cause is worth naming, because it is a methodology error, not a typo: my mutation was labelled "stops asking the share-view question" while the edit it made replaced the whole function body, removing both copies.** A mutation whose *name* is narrower than its *edit* attributes the red to the wrong line. **Name a mutation by exactly what it removes.** Every mutation in round five below is named that way — "the ROLE question line removed (canFinView line kept)", and so on.

That naming immediately earned its keep: removing `finMaySeeMoney`'s **share-view** line turns the two read-out probes red with 6 and 3 checks but the write probe red with only **1** — because `finCanWrite`'s redundant copy is still catching the rest. The redundancy is real, and it is doing work as a backstop.

**Mutation audit round five: 10 of 10 caught, by the probe you would expect.** The second clean sweep of the five (round three was the first). Covered: `finRow`'s guard, both of `finMaySeeMoney`'s questions separately, the ageing future-date branch, the no-due-date measurement, the Arabic future-date wording, the b2c blank-reference generator, the cost-join re-drop, the period-bar chip highlight, and the Records-page export guard. Rounds one and two found six guards that were decoration and round four found three; everything built since cycle 29 bites.

**Attack area (ff): js/62, no defect found.** All eight write functions — the exclusion editors, the grouping undo/redo and its two dialogs, the duplicate dismiss/undismiss and the merge/undo pair — route through `canEdit62()`, which delegates to `finCanWrite()`, so they **should** have inherited cycle 32's fix for free. "Should have" is exactly what this watch does not accept on inspection: cycle 32 found five write paths open after four cycles of guarding write paths. Measured instead, with a positive control on every one, and all eight hold under both halves. New `scripts/qa/probe-guardrails-both-halves-attacks.mjs` (port 8249, 27 checks). Three file-level sabotages caught — including one that proves the delegation is what is doing the work: making `canEdit62` fall back to `canFinEdit` turns **14** checks red.

**Three probe-side errors of my own, each found by refusing to accept a green.**

1. **A check that could not fail, found only by sabotage.** Removing the merge guard produced **0 red** — because the admin control had already merged the fixture pair, so by the time the refusal rounds ran, js/62 answered *"could not find both companies"* and returned **before** reaching the guard. The same "nothing left to do" rubber stamp cycle 32 found in the write probe, in a new place. Each half now gets a **fresh pair**, and a check that sees "could not find both companies" **fails itself** rather than passing.

2. **A red that was not a guard failure at all.** `v62RemoveExclusion` reported changing stored state under a share view but not under the denying role — an asymmetry no guard could produce. **The diff settled it:** the exclusion list did not lose `fx-seed`, it came back holding `fx-qa-takamol`, *the mock seed's own entry* — the app had re-read `app_settings` between the two snapshots. The fixture is now verified to have stuck before anything is measured against it, and the probe fails outright if it cannot be held still.

3. **A control that failed for a fixture reason.** The merge was passed raw ids, but js/62 identifies a company by `bizUuid(b) = __bizUuid(b.id)`, which returns undefined for an id it has never seen. It asks the page what it calls them now.

**The standing-red list is down to four.** `probe-lifecycle5` is **green**, confirmed by a serial re-run rather than a single batch pass: the Code session's round 52 made it print what it measured before it stops, which turned "a stale probe" into four live defects and then a passing one. Remaining, none in this lane: `probe-live2` (environmental — needs a `live-app/` snapshot not in the repo), `probe-events-scale`, `probe-round9`, `probe-stress`. `sweep-buttons` did not report in this batch and needs re-checking next cycle rather than being assumed either way.

**Battery:** 78 probes plus `check-structure`, 72 green. `probe-generator-attacks` red in the parallel batch and green re-run alone (114 passed, 0 failed).

## 2026-09-06 · Round 54 — the fifth caller, and cycle 32's own sabotage claim corrected

**Fixed: `v65OpenTeach` (js/65), the last caller in this lane asking the narrow question.** Watch
cycle 32 measured it and handed it over: it checked `canFinEdit()` directly, so a session the
Finance page refuses could still open the teach-the-columns dialog. What it saves is a column
mapping rather than money, which is why cycle 32 recorded rather than asserted it — but it is the
door through which the importer is TAUGHT how to read a file, and round 52 has just made teaching
the wrong shape a live hazard (teach our own ledger export and revenue and profit come back in as
if a person had supplied them). It asks `finCanWrite()` now, the same chokepoint every other write
on the page goes through. Cycle 32's note is an assertion: the probe arms an unrecognised file as
an allowed admin, flips the session underneath it — the real stale-tab shape — and requires the
dialog not to open. Sabotage-verified: reverting to `canFinEdit()` turns it red under **both**
halves, because a later layer redefines `canFinEdit` without the share-view half, which is exactly
why `finCanWrite` re-applies it.

**Correction to watch cycle 32's second sabotage claim.** It reported that dropping the share-view
question from `finCanWrite` turns both its probe and `probe-permissions-attacks` red. Measured
here: it does not — removing that line leaves both green, because `finMaySeeMoney()` (which the
new first line calls) already asks `canFinView()`. The line is now a redundant second copy of the
same question. Removing **both** copies is what turns them red — 6 checks in the write-paths probe
and 3 in permissions-attacks. The rule the watch itself wrote holds here too: when a fix has two
halves that each mask the symptom, sabotaging one proves nothing. Nothing needs changing in the
code; the belt-and-braces line is fine to keep. Only the claim was wrong.

**Probe bug found in my own promotion, worth recording:** `closeModal()` only hides the overlay —
the dialog's fields stay in the DOM — so "is the dialog open" had to be a visibility question. As
an existence check it called the control's own leftover dialog a failure of the check after it.

## 2026-09-06 · Watch cycle 32 — the same missing question, found for the fourth time, on the oldest surface

**Attack area (cc): the ten Finance write paths, re-audited against BOTH reasons the page is refused. Attack area (dd): the import surface, the same way.**

Cycle 31 landed, and the Code session took the flag it left and guarded the Records-page export (`d188ebd`) — **promoting this session's note to an assertion**, which is exactly what the staleness check was written for. Nothing queued.

**Real defect, fixed: five of seven write paths changed the database under a role that denies the Finance page.**

Every Finance write routes through `finCanWrite()`, which asked two questions — *is this a share view* and *does this person have EDIT rights* — and never the third: **does this person's role allow the Finance page at all.** That is the same half that was missing from the CSV exports (cycle 30, closed by round 50), from the Records export (round 51) and from `finRow` (cycle 31). **Four surfaces, four times, the same question.** The write paths are the oldest of them and were the last still asking the narrow one.

The session that exposes it: a **tier that still reads `admin`** — so `canFinEdit()` says yes — with a **per-person page access that no longer includes Finance**, so the page refuses them in words. js/52's access model returns "yes" outright for an admin tier, which is what lets tier and page access disagree. Measured before the change: `canFinEdit true · finCanWrite true · mayOpen('finance') false`, and **delete by number, restore by number, delete by id, restore by id and the origin editor all wrote.**

Fixed at the chokepoint: `finCanWrite()` now asks `finMaySeeMoney()` first, which already covers the share view, so the new rule is a strict superset of the old one and **every path routing through it is covered at once** rather than one guard at a time. Sabotage both ways — narrowing it back to the share-view question reopens exactly the role half (6 red); dropping the share-view question turns this probe **and cycle 12's `probe-permissions-attacks`** red together, so the older guarantee is proved still intact.

**Attack area (dd): no defect.** `v65Commit` routes through `finCanWrite` and so was covered by the same fix; under both halves the Import tab does not render at all and Confirm writes nothing even when called directly. **Flagged, measured not asserted:** `v65OpenTeach` checks `canFinEdit()` **directly** rather than `finCanWrite`, so the fix does not reach it — it opens the teach-the-columns dialog whose save writes a column mapping into `DB.settings`. No invoice money moves, so it is recorded rather than made a failure; it is the last caller in this lane still asking the narrow question.

New `scripts/qa/probe-write-paths-both-halves-attacks.mjs` (port 8247, 31 checks). Every check **diffs the actual table over the REST API**, never the page's own state, and every confirm and prompt is answered yes so that a guard is the only thing that can stop a write.

**Two fixture errors of my own, both of the kind this watch exists to catch.**

1. **Controls that failed because the fixture matched the defaults.** `finSetOrigin` and `finSetWay` fall back to `'booking'` and `'invoice'` when their editor is not on screen — and the fixture seeded exactly those values, so a real write stored the same value and the diff saw nothing. Three controls reported the app doing nothing while it was writing. The rows are seeded **away** from the fallbacks now, which also models the real hazard precisely: a stale tab calling the function with no editor present overwrites the stored value with the default — the cycle-27 defect shape.

2. **A rubber stamp in my own probe, and it hid four of the five defects.** The first working run reported five of seven paths as "refused" — and the app's own message gave it away: *"Already deleted — someone else, or another tab, got there first."* An earlier check in the loop had already put the row into the state the write wanted, so the update matched zero rows and looked like a guard holding. **A check that changes nothing because there was nothing left to change proves nothing.** The fixture is now reset from a pristine copy before **every single attempt** (using, deliberately, the by-reference behaviour cycle 28 was bitten by), and a check that sees an "already in that state" message **fails itself** rather than passing. With that fixed, one apparent defect became five.

**Battery:** 77 probes plus `check-structure`, 70 green. `probe-generator-attacks` red in the parallel batch and **green re-run alone** (114 passed, 0 failed). Standing reds unchanged and none in this lane: `probe-live2`, `probe-events-scale`, `probe-round9`, `probe-lifecycle5`, `probe-stress`, `sweep-buttons`.
## 2026-09-06 · Round 52 — the stale rehearsal probe was hiding four live defects

`scripts/qa/probe-lifecycle5.mjs` walks a lead's whole life across 64 stations. It had been on
the "pre-existing red" list for rounds, and nobody could say WHICH station broke, because it
collected its report as it went and printed it only at the end — one hard error and everything
it had already measured vanished behind a Playwright timeout. It now prints the whole run
before it stops. That single change turned "a stale probe" into a list of real defects.

**Fixed this round (each sabotage-verified on its own):**

1. **A client the app had just linked was told it was not linked.** The Won handover asks for
   the Direct client ID under the words "links invoices & finance" and saves it on the company;
   the banner on the card asked only the `client_profiles` table, so it showed an amber
   "⚠️ Not linked to Direct yet — add a billing profile" and invited the same number to be typed
   in a second time. Three states now (js/27): no ID; an ID captured at handover with no billing
   profile recorded yet; a full profile. Only the first is "not linked".

2. **The importer could not name the one file this app itself writes.** Dropping the Finance
   ledger export back in gave the generic "not recognized" plus a Teach button — which would map
   `revenue_sar` and `profit_sar` back in as though a person had supplied them. They are worked
   out by the database (revenue = total − wallet, profit = revenue − cost), so teaching that
   shape is a loop that can only overwrite live numbers with a stale copy of themselves. Named
   and refused in both languages, no mapping offered (js/65).

3. **Two drill-downs wrote filter keys nothing has read since the Phase 2 Ledger rebuild.**
   "Tap a service to see its invoices" set `FIN.f.service` and opened the WHOLE ledger silently;
   the client card's "Open in Finance ledger ↗" set `FIN.f.client` and showed every company's
   money to someone who asked for one client's. The client one now goes through `finClient()`
   and really filters; the service one says plainly that this Ledger has no service filter
   (js/25 + js/16) — the same shape watch cycle 6 already fixed once for `clientKey`.

4. **The Ledger's company filter could not state its own filter.** Its dropdown was built from
   the rows that survived the filter, so narrowing to a company with nothing to show removed
   that company from its own list and the control fell back to reading "All companies" while it
   was hiding everything. Built from every company the ledger holds (js/16).

**Flagged, NOT fixed — decisions or work that is not a session's to take:**

- **The invoice modal has no route in the interface.** `finRow(id)` still holds one invoice's
  whole money and its origin/proposal editor, and it still works — but since the Ledger tab was
  rebuilt on `finance_transactions`, every remaining caller is a probe. Nothing a person can
  click opens an invoice any more. probe-lifecycle5 drives it directly and says so in the
  station's own label rather than implying a route that does not exist.
- **There is no per-service invoice list.** That is what the income-by-service tap was reaching
  for; the honest note is a stopgap, not the feature.
- **The importer keys invoices on `Invoice Reference #`, not `Invoice Number`.** Measured, not
  changed — an import produced `invoice_no = REF-3001` while the file also carried `DP-3001`.
  Worth confirming with the owner which of the two he thinks of as "the invoice number".

**Probe rewritten where it was stale, not where the app was wrong** — the renamed leads export
button, the `client_profiles` model that replaced the billing-accounts blob, a real Invoice
Export in place of our own export, and one assertion **inverted**: it demanded the client card
print an amount, which the owner's 2026-08-21 ruling forbids and which `probe-money-placement`
in the same battery asserts the opposite of. Two probes in one battery contradicting each other
is worse than either being wrong alone. The August headline is now checked against what the
ledger recorded rather than a hard-coded total. 64 stations, 0 failures.

## 2026-09-06 · Watch cycle 31 — the rest of the read-out surface, and the Arabic side of everything added since cycle 26

**Attack area (aa): every OTHER way money leaves the Finance page to a session that may not see it. Attack area (bb): the Arabic wording of every surface this watch has added since cycle 26.**

**First, what the Code session found in cycle 30's fix, because it is the lesson of this cycle.** Cycle 30 guarded the three CSV exports with `canFinView()` — and that closes only **half** the case cycle 30 itself described. `canFinView()` asks one question: is this a read-only share **link**. Finance is refused for a second reason too — a **role** that does not allow it. Round 50 measured it: with a denying role and no share view, the page refuses in words, `canFinView()` returns true, and `finLedgerCSV` still produced 16 rows. It is the **likelier** half — a revoked role is an ordinary event; a share link is the rarer one. Fixed there with `finMayExport()`, which asks both.

**Why cycle 30's probe could not see it:** it simulated only a share view. Cycle 12, doing the same job for the write paths, drove viewer / team member / BD / operations *and* a share link. The rule: **when a page is refused for N reasons, the guard must ask all N — and the probe must drive all N.** Every check in this cycle's probes is run against both halves, every time.

**Attack area (aa): two more read-out paths found by reading, both proved with positive controls first.**

1. **`finRow(id)` — in this lane, fixed.** The invoice modal prints one invoice's **total, cost, revenue, profit, received, remaining and wallet**, and it had no check of its own. Under a share view *and* under a denying role, calling it put that modal on screen over a page that refuses the session in words — the same stale-tab shape cycle 12 closed on the writes and cycle 30 / round 50 closed on the exports. Fixed by asking the same two questions. The predicate is now named for the question it asks — `finMaySeeMoney()` — because the question ("may this session see Finance's money") is not specific to a file; `finMayExport()` delegates to it, so round 50's name, its callers and its probe are untouched. It returns **silently** rather than alerting: the only way to reach it on a refused page is a stale tab or the console, and the person already has the refusal on screen — an alert would be noise on top of it, not the missing explanation the write paths needed.

2. **`exportCurrent()` in `js/core/core-05-records.js` — NOT this lane, flagged with a reproduction.** The Records page's own export reads **`FIN._csvRows` directly** and downloads it, so it never passes through `finLedgerCSV` and **neither cycle 30's guard nor round 50's `finMayExport()` is in its path at all**. Measured: under a share view and under a denying role it produced a 6-row `DirectBusiness-finance-summary.csv` of live invoice money. This is arguably the more serious of the two, because it hands over a file. Handed to that file's owner; nothing was edited here.

New `scripts/qa/probe-readout-surface-attacks.mjs` (port 8243, 21 checks). **How the out-of-lane finding is recorded without rotting:** it is a `note`, not a `fail`, so the probe stays green on a gap it is not allowed to fix — but a final check **fails** if that path stops reading `FIN._csvRows` at all, meaning either it has been guarded (promote the note to an assertion) or it has been rewired (rewrite the note). A flag that cannot notice it has gone stale is not a flag. Three file-level sabotages caught, and the last two prove the delegation did not break round 50's work — removing either question turns **both** this probe and `probe-export-access-attacks` red together.

**Attack area (bb): no defect found.** `probe-finance-arabic-attacks` runs on the **default seed**, where nothing is outstanding, nothing is future-dated and every invoice carries `revenue_way='invoice'` — so **not one** surface added since cycle 26 had ever rendered on an Arabic screen. New `scripts/qa/probe-arabic-new-surfaces-attacks.mjs` (port 8245, 10 checks) builds a fixture that renders all of them at once: the "Dated in the future" chip, the "% overdue cannot see this money" note, the no-invoice-date chip, the `b2c_manual` way label, the unknown-stored-way fallback label, and the export refusal. All render in Arabic with no English beside them, and — applying cycle 11's rule by cycle 19's method — **all 9 amounts printed next to a currency word are direction-isolated**, including the two the new note drops into Arabic prose next to "ريال". Four file-level sabotages caught, one per string.

**A fixture error of my own, caught by the probe's own wording.** The first run reported the no-invoice-date chip as "did not render at all" — because I had checked for a chip without seeding a row that could produce it. The check was wrong, not the app; the message said so ("the fixture was built so it must") rather than blaming the page, and a date-less row was added.

**Battery:** 76 probes plus `check-structure`, 69 green. `probe-generator-attacks` red in the parallel batch and **green re-run alone** (114 passed, 0 failed). Standing reds unchanged and none in this lane: `probe-live2`, `probe-events-scale`, `probe-round9`, `probe-lifecycle5`, `probe-stress`, `sweep-buttons`.

## Round 50 — the other half of the export guard: a role, not just a share link (2026-09-06)

Watch cycle 30 found a real defect — the three Finance CSV exports had no permission check of
their own — and guarded all three with `canFinView()`. Verified each guard individually (removing
only the third produces exactly one failure, naming the Report Builder export, so each export
really does carry its own). **But the fix closes half the case it describes.**

`canFinView()` asks one question: *is this a read-only share link* (`!window.__isShareView`). The
Finance page is refused for a **second** reason as well — a role that does not allow it, enforced
by js/49's `mayOpen('finance')` and js/64. Measured on the merged tree, with a denying role and
**no** share view:

- the page refuses in words — *"You do not have access to that page"*
- `canFinView()` returns **true**
- `finLedgerCSV` produced **16 rows**, `finTxnCSV` **4**

That is precisely the shape cycle 30 set out to close — its own commit names *"a role changed while
it was open"* — and it is the **likelier** half: a revoked role is an ordinary event, a share link
is the rarer one.

Fixed with `finMayExport()`, which asks both questions, and all three guards now call it. Kept as
its own helper rather than widened into `canFinView()`, because `canFinView()` also drives the
page's own share-view wording and js/45 / js/57 read it — a role-denied person should get js/49's
message, not "shared view-only links". Unknown answers never block, matching `mayOpen`'s own rule.

`probe-export-access-attacks` gains the role case (a control first, proving `canFinView` says yes
while `mayOpen` says no — the half `canFinView` alone cannot see). Sabotage — drop the `mayOpen`
question back out — reopens exactly the role half (3 red) and leaves the share-view half green.
File restored byte-identical.

## 2026-09-06 · Watch cycle 30 — the period bar clicked rather than called, and three exports that ignored the rule the page obeys

**Attack area (y): every control the period bar renders, operated the way a person operates it. Attack area (z): the CSV exports under a session that may not see Finance.**

**First, a correction to cycle 29, made by the Code session and worth recording properly.** Cycle 29 reported `probe-money-placement` as "now green — the Code session's rounds fixed it." **That was wrong.** It was still failing, and cycle 27's diagnosis of the same red had been wrong too: the probe's failure line names the **search string it matched**, not the text on screen. `" SAR"` is the needle. Cycle 27 read that as "a bare SAR with no number renders" — there is no such render; the real text was `"INV-3001 · 16,100 SAR"`, a perfectly well-formed amount, and a well-formed amount on a lead card **is** the violation of the 2026-08-21 ruling. Two wrong diagnoses of one probe from this session. The rule that comes out of it: **read the probe's rule, not its failure string** — a message that echoes a search pattern is not a quote of the page. (The Code session found and fixed the real defect in `relatedPanel()`, commit `4f5faff`; every sibling line in that card reported a relationship and only the invoice line carried a figure.) Why the cycle-29 battery reported it exit-0 is unexplained and is most likely the parallel-batch flake class — which is itself a reason not to promote a single green run to a finding.

**Attack area (y) — no defect found, and the probe is kept as a permanent guard.** Cycle 29 fixed `probe-filter-combination-attacks` to call `finPS`/`finPY`/`finPP` instead of assigning `FIN.p.*`. New `scripts/qa/probe-period-bar-attacks.mjs` (port 8239, 31 checks) goes one step further and **never calls a handler at all**: it clicks the actual `<button>` and sets the actual `<select>` with a real change event, so an onclick wired to a neighbour's value, or a chip that highlights the wrong sibling, is visible too. After **every** control it checks four things agree — the state, the label `finPeriodLabel()` prints, which controls show themselves active (including both selects' current values), and an independent recount of the rows in scope. Driven: all seven period chips, all twelve months, all three year options, all four sector chips. Everything held.

**A hypothesis I had, tested, and found wrong before writing it down.** The month dropdown is built from months that *have* invoices, so I expected that choosing November and then switching to a year without November would leave the state filtering by a month the dropdown could no longer show — the control silently reading "All months" while the filter was still November. It does not happen: the list is built from `live()`, the whole dataset, not from the selected year, so all twelve months stay in the dropdown regardless. The check is kept, written to accept either honest outcome and to fail only on the dishonest one (a control contradicting the filter in force). Three file-level sabotages red (the label dropping the month name → 12; chips highlighting against the wrong state field → 13; the month dropdown not marking its selection → 13), restored byte-identical (md5 `4fc00f8cace620b64b6785d4735fc720`).

**Attack area (z) — a real defect, fixed. The exports ignored the rule the page obeys.**
`finLedgerCSV`, `finTxnCSV` and `finCSV` are functions on `window` that build a file out of `FIN._csvRows` / `TXN._csvRows` / `FIN._lastReport` — state the page fills in as it renders — and **none of the three had a permission check of its own.** This is precisely the shape cycle 12 found and closed on all ten Finance **write** paths (*"a stale tab, a role changed while it was open, or a share view leaves the function one call away"*); the **read-out** paths were never looked at.

Proved end to end before it was called a defect: an admin renders Finance so the state is populated, the session then becomes a read-only share view **without a re-render** — the case that actually happens — and all three exports hand over complete files: 8 invoices, 5 transactions and the whole Report Builder table, of a company's money, to a session whose Finance page refuses to render in words. The cold share view passed only because the state was empty, not because anything checked.

Fixed with the check the page already applies to itself — `canFinView()`, which `rFinance` calls before it will render at all — refusing in both languages. **What this is not:** once rows are in a browser tab, someone determined can read them from devtools whatever any function does, and this is not claimed as a boundary against that. It is the same symmetry cycle 12 applied to the writes: pressing something must not produce Finance's file for a person Finance is refused to.

New `scripts/qa/probe-export-access-attacks.mjs` (port 8241, 13 checks), with a positive control first — as an admin all three really do produce files with rows in them, so a refusal means something — plus a check that a refusal is never a header-only download that looks like an answer. **Four file-level sabotages, each caught:** the guard removed from each export **individually** (the first attempt to write those three mutations failed because all three guards are byte-identical and a `replace(a,b,1)` always hit the first one — they are removed by index now, so each export is proved to carry its own guard rather than one of them covering for the others), and `canFinView()` itself always saying yes → 5 red. Restored byte-identical (md5 `42624a487c45020a868a32dd1cee9f4e`).

**Battery:** 74 probes plus `check-structure`, 67 green in the parallel batch. `probe-generator-attacks` red in the batch and **green re-run alone**. `sweep-buttons` timed out in the batch and fails serially exactly as cycle 29 classified it. Standing reds unchanged and none in this lane: `probe-live2` (environmental — needs a `live-app/` snapshot not in the repo), `probe-events-scale`, `probe-round9`, `probe-lifecycle5`, `probe-stress`, `sweep-buttons`.

## Round 49 — money on a lead card: the owner ruling that was actually being broken (2026-09-06)

Watch cycle 29 reported `probe-money-placement` as **now green**, fixed by these rounds. It was not.
It fails identically here, the same two checks watch cycle 27 first recorded — and its diagnosis
there was wrong too.

**What the probe was actually saying.** Its failure line names the SEARCH STRING it matched, not
the text on screen. `" SAR"` is the needle. Cycle 27 read that as "a bare ` SAR` with no number
renders", and there is no such render: the actual text was `🧾 INV-3001 · 16,100 SAR`, a perfectly
well-formed amount. Reading the probe's rule instead of its output settles it — the header states
the owner ruling of 2026-08-21: **money lives on the Finance page ONLY; Leads and Clients report
the relationship, never the amount.** A well-formed amount is precisely the violation.

**The real defect, and it was a recorded ruling being broken on the busiest card in the app.**
`relatedPanel()` — the "Related records" card on every lead and client — listed each invoice as
`🧾 <number> · <amount>`. Every sibling line in that same panel already reported the relationship
and nothing else: an offer by its ref, a booking by its ref and airline, a ticket by its PNR. Only
the invoice line carried a figure. It now names the invoice and its status; the amount is one click
away on Finance, where the ruling puts it.

Guarded by `probe-money-placement` (green for the first time since cycle 27). Sabotage — put the
amount back — turns both checks red again. The one remaining `money(i.total)` in that file is the
invoice detail page's own Total line, which is a Finance view where the amount belongs.

**`sweep-buttons` verified as they classified it:** identical `ReferenceError: current is not
defined` on the untouched tree, so it is neither theirs nor a regression from `e55caed`.

## 2026-09-06 · Watch cycle 29 — mutation audit round four: three guards that were decoration, and a cost that could be applied twice

**Round four of the mutation audit, over everything added since cycle 25, plus attack area (x): the expenses→invoice cost join.**

Cycle 28 landed as `f3a2ed8`, and the Code session took the `js/58` flag raised there and fixed it (`e55caed` — paging via `window.finPageAll`, plus a new `probe-b2c-paging` guard). Nothing queued.

**Ten mutations, each breaking one rule a probe claims to guard, each reverted byte-identically (md5) before the next. Eight caught by the probe you would expect** — the promo registry read reverting to unpaged, the promo card switched back on against the owner's 2026-08-22 ruling, Received switching to the all-live basis Outstanding uses, the no-invoice-date row going back into the 0–30 bucket, a blank booking reference stored as null, `probe-premortem-attacks`' own verification fetch reverting to unpaged, the importer dropping its date-less hold-back, and the zero-row message blaming permissions for a row that is simply gone.

**Two were not caught, and a third turned up while closing them. All three are now fixed.**

1. **The unknown-revenue-way fallback was decoration.** Cycle 27 added it so that a way the editor has never heard of is offered back as itself rather than silently rewritten — and nothing exercised it, because with all five known ways in the list the fallback never fires. Removing it entirely changed no check. `probe-promo-revenue-attacks` now seeds an invoice carrying `partner_rebate`, a way the live CHECK constraint would refuse (which is the point — it models the database gaining a way before this file hears about it, exactly what the fallback exists for), and asserts the editor shows that stored value. Re-run against the same mutation: red.

2. **A check that reached around the control it was testing.** `probe-filter-combination-attacks` states as its third subject that *"clearing one filter does not leave another silently in force, and does not clear one that was not touched"* — and it cleared filters by assigning `FIN.p.sector` / `FIN.p.part` directly and calling `render()`. That skips `window.finPS` / `finPY` / `finPP`, which are what a chip and a dropdown actually call, so the mutation "clearing the sector also clears the month" walked straight through the probe whose subject is exactly that. Same class as cycle 12's viewer simulated by setting only `__userTier`. It goes through the real handlers now and asserts the **whole period state** afterwards, not just a row count, so a filter that is quietly reset is visible even when the count happens to coincide.

3. **And the first fix for (2) had the same blind spot one level down.** The cross-check ran `finPY(2025)` then `finPS('tenders')` — so `finPS` set the sector **last**, and a `finPY` that wipes the sector was invisible; the mutation "choosing a year silently clears the sector" walked through the new check too. **Every pair of controls is now driven in both orders**, six checks, each with the control under test running second — the only order in which its side effect on an already-chosen filter can be seen. All three mutations red afterwards.

**Attack area (x) — the cost join — is already well guarded, and saying so is the finding.** `probe-expense-report-capture` already holds multi-transaction aggregation, an invoice with no contributing transaction left untouched, the exceeds-total guardrail (cycle 21's), a self-conflicting gate row refused rather than guessed, a malformed amount voiding its whole invoice, one dirty contributing transaction holding back the whole invoice rather than a silent partial sum, the excluded client untouched, and an unknown invoice number never inserted. No new probe was needed and none was written.

**One claim was genuinely unguarded, and now is: re-dropping the same expense file must not apply the cost twice.** `probe-expense-capture-persistence` proves the capture *table* keeps one row per `transaction_ref` rather than appending — but that is a different claim from the one that reaches a profit figure: that the **invoice's** `cost_sar` does not move when the same export is dropped again. Two people re-exporting the same period, or one person dropping a file twice, is the ordinary case, and a cost applied twice halves a margin with nothing on screen saying so. The check now snapshots cost and profit for **every** invoice, re-drops both files, presses Confirm, reloads from the database and diffs all 17 rows — with a control proving the invoice it watches really did receive 2,000 on the first pass, so a second application would have had something to double. Sabotage (make the join add to the existing cost instead of setting it) → 3 red, including `116361000: cost/profit [6400,-1400] → [8400,-3400]`. Restored byte-identical.

**Battery:** 72 probes plus `check-structure`, 65 green. `probe-generator-attacks` red in the parallel batch and **green re-run alone** — the environmental pressure classified in cycles 17, 20 and 28.

**Movement in the six pre-existing reds.** `probe-money-placement` is **now green** — it was red in cycles 27 and 28 and something in the Code session's own rounds has fixed it; recorded here so nobody re-diagnoses it. `sweep-buttons` has **joined** the list: it fails reproducibly with `ReferenceError: current is not defined`, at a different line on each run, which is a load-timing failure rather than a deterministic break. **Checked against the untouched origin tree and against the previous `js/58`** before classifying: it fails identically both ways, so it is neither this cycle's doing nor a regression from `e55caed`. Standing list is now `probe-live2` (environmental — needs a `live-app/` snapshot that is not in the repo), `probe-events-scale`, `probe-round9`, `probe-lifecycle5`, `probe-stress`, `sweep-buttons` — none in this lane, still waiting on a cycle of their own.

