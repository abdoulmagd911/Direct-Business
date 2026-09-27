## Round 68 — 2026-09-07 — the standing exclusion was missing from the OTHER money table

js/16's own header states the doctrine the Takamol incident taught, in these words: *"a standing
exclusion must hold no matter how a row arrived, so live() — the one chokepoint every total and
export in this file reads through — re-checks client_group/customer_raw_name against the exclusion
list on every call, not just once at load."* Ten Takamol invoices had reached `finance_invoices` by
a path outside this app entirely and rendered in every total until they were found and removed by
hand.

That is `live()`, and it covers **invoices**. Transactions are a second money table, loaded from
the same source system, and their chokepoint was:

```js
function txnLive(){
  var rows=(TXN.rows||[]);
  for(var i=0;i<rows.length;i++)txnSanitizeMoney(rows[i]);
  return rows;                          // ← sanitised, and nothing else
}
```

**Measured, with a transaction on the standing-excluded client:** the Transactions tab's confirmed
revenue read **751,000 SAR of which 750,000 was the excluded client's**, and both excluded rows were
written into the file `finTxnCSV()` hands the owner to send onward. Not a screen — a file that
leaves the building.

**Fixed** in `txnLive()`, by two tests because each covers a row the other cannot see. Transactions
carry a stronger key than invoices do: an exclusion entry has a `clientId` and a transaction's
client_profile row has `direct_client_id` — the real client-ID bridge js/62's comment says it is
waiting for, already present on this table — so a second spelling of the company name no longer
brings the money back. The company name is checked too, for a row whose profile is missing.

`finTxnCSV()` also refuses while the exclusion list has not landed, for cycle 40's reason: a number
on screen can degrade honestly, a file cannot. That duplicates js/62's `settingsLanded()` on
purpose — **the right home for it is `finExclusionCheck` itself**, the only code that can tell "not
excluded" from "cannot answer yet", and that file is the oversight lane's (see round 67).

**Two mistakes of my own, both caught by the probe rather than by reading.**

1. The first version of the name test called `bizName(...)` — which is a **local** of the
   transactions render function (`var bizName=_finBizName`, further down the file), so at that
   point it resolves to nothing, `typeof bizName==='function'` is false, and **the name test
   silently never ran.** The guard was there and did nothing. `_finBizName` is the file-scope one.
2. That only surfaced because the fixture has a transaction with **no client profile**, where the
   name is the only thing that can hold the row — and I had to add it. With the first three rows
   both excluded transactions also carried the excluded clientId, so removing the name test changed
   nothing and that half was untested. **The two-halves trap, in my own fixture, one round after
   finding it in someone else's.**

New guard: `scripts/qa/probe-txn-exclusion-attacks.mjs` (port 9027), seven checks. Removing either
half reddens exactly two. Six finance probes green with the fix, including the ledger, the
invariants and cycle 39's invoice modal.

## Round 67 — 2026-09-07 — cycle 40 verified, its guard made able to fail, and the importer question answered

**The defect is real and the fix is right.** Against the true pre-fix js/62 (`git show e77ae71^`)
the merge confirmation reads, word for word, what cycle 40 reported:

```
… invoice links (2 invoices, 0 SAR) … moves to "Merge B" (1 invoices, 500 SAR).
```

Count right, money zero, on the screen where someone chooses which company record to keep and which
to archive.

**But the new guard could not have caught it here, and the stated sabotage does not reproduce it.**
Two things, both measured:

* The patch says *"drop the finSanitizeMoney call from bizFinance — check 2 goes red"*. It does not:
  the fix has **two independent halves** — the `finLive()` read *and* a `finSanitizeMoney` call kept
  in the fallback loop — and removing either alone leaves the dialog correct. Same shape as round
  62's Save button, where three mechanisms defended one property and no single removal reddened
  anything.
* More importantly, `probe-merge-dialog-money` **passes in full against the pre-fix tree** on this
  host. Its "cold path" is not cold: `live()` sanitises **in place**, and four other layers call
  `finLive()` during ordinary rendering — js/25, js/31, js/38, js/41 — and the probe renders Today.
  So by the time the dialog opens, some unrelated screen has usually already cleaned `FIN.rows`,
  and the pre-fix code reads clean numbers. Cycle 40's "2 invoices, 0 SAR" was real; it needed a run
  where none of those layers happened to touch the rows first.

That race is the strongest argument *for* the fix — whether the dialog is honest should not depend
on which unrelated screen rendered first — but a guard that only fails when the race lands the wrong
way is not a guard. **The probe now forces the raw state**: the rows are put back exactly as the
database sends them, strings and all, immediately before the dialog opens. Fixed tree → 20,000 SAR
every time; pre-fix tree → `(2 invoices, 0 SAR)` every time, on any host.

### The importer fail-open: confirmed, and it belongs one function higher

`probe-importer-scale-attacks` was green here under six-way load, as was everything else. **It does
not need to reproduce.** The hole is structural, and reading `finExclusionCheck` settles it:

```js
window.finExclusionCheck=function(name){
  var n=norm62(name); if(!n)return null;
  var list=exclusions();          // (DB.settings && DB.settings.financeExclusions) || []
  … return null;                  // ← the same answer for "not on the list" and "no list yet"
};
```

The race only decides *whether the moment occurs*, not whether the hole exists. And it is not the
importer's alone — **six call sites share it**: js/16's `live()` and its line 1544, js/31's linking
card, js/41's money-in, and js/65 three times. Cycle 40 fixed the symptom at one of them, with
`settingsLanded()` in the merge dialog.

The honest place for the fix is `finExclusionCheck` itself, which is the only code that can tell the
two cases apart: return `null` for "not excluded", and something distinguishable — a sentinel, or a
companion `finExclusionsReady()` — for "cannot answer yet", then let each caller decide. Displaying
a number can degrade to "not checked yet"; **writing rows must refuse.** That is js/62, which is the
oversight lane and where cycle 41 is already headed, so it is written down rather than done here.

## 2026-09-07 · Watch cycle 39 — the invoice modal showed a deleted invoice as all zeros, next to its own Restore button

**A real defect in this lane, found by opening a dialog nobody had opened.** The Code session's Arabic round made the point that a dialog does not exist until someone presses a button, which is why nav-driven sweeps had never seen three dialogs in daily use. The same argument applies to numbers: `window.finRow(id)` prints one invoice's whole money — total, cost, revenue, profit, received, outstanding, wallet, and a line table — and **nothing had ever checked what it prints.** Cycle 31 gave it a permission check and stopped there.

Two things about how it is written made it worth attacking rather than assuming. It sums the invoice's lines straight off `FIN.rows` with `+x.total_incl_vat_sar||0`, **not** through `live()` — the chokepoint js/16's own comment says every total in the file reads through, precisely because a money field can arrive as the string `"1,250.00"` and `+` on that is `NaN`, which `money()` prints as a clean `0.00`. And `live()` sanitises rows *in place*, so a row it has returned is clean — but it **filters soft-deleted rows out before it sanitises**, so a deleted invoice never passes the chokepoint at all.

**Measured, with a deleted invoice storing `"9,999.00"`:**

```
Invoice IM-004 | Restore | Open in Direct ↗ | Close
Flights  B2B   0.00   0.00   0.00
Invoice total · 1 service(s)  0.00  0.00  0.00
Received  0.00 SAR      Outstanding  0.00 SAR
```

Every figure zero, on the one surface with no second number to contradict it, in front of the person deciding whether to bring the invoice back. **Fixed** — `finRow` sanitises the lines before summing (one line, using the exported `finSanitizeMoney`) — and the same modal now reads 9,999.00 / 3,333.00 / 6,666.00. Sabotage-verified: reverting that one line reddens exactly the check that names it, byte-identical restore.

New `probe-invoice-modal-attacks` (8717, 9 checks) guards it and the rest of the modal: a plain invoice's Received and Outstanding as stored; a three-line invoice summing its lines rather than printing one line's figures as the invoice's; a live row carrying formatted strings; the deleted row above; an `integrity_status` the label map has never heard of printed as the stored value rather than left blank; no NaN/undefined/null anywhere; and in Arabic, no English label from the meta table plus all four amounts beside a currency word direction-isolated.

**Two probe-side errors of my own, both the kind that make a check pass while examining nothing.** The modal element is `#finModal`, and gating on `offsetParent !== null` — which is null for it even on screen — made every read fall back to the page *behind* the modal; the "no NaN" check passed that way while looking at nothing. And closing with the app-wide `closeModal()` instead of js/16's own `finCloseModal()` left the previous invoice on screen, so every check after the first read IM-001's numbers and reported them as the next invoice's.

### The open red, one step further

`probe-scale-attacks`' Top-clients label reproduced here **once in five runs** under the same load, with **exactly one occurrence** of the label reading 120 — so round 61's four green runs and this session's red are both right, and the first-match theory is dead on both hosts. What is left is that the page really did render 120 distinct client keys at that moment while `finCanon`, asked a second later, folds the twin correctly. Rare enough that waiting and guessing is the wrong tool, so the probe now prints, **only when the label is already wrong**, the distinct-key count at that instant, both canon answers, the fixture company count, the twin's link, and the same label after one more `clearFinCanon` + render — which will say in its own output whether the app is simply one render behind.

### And one more fixed wait, from the same family

`probe-premortem-attacks` came back red in this cycle's battery on the check round 60 had just fixed — *"the lines-only drop did not resolve — cost is 12605, expected 750"*. Its poll budget was 20 seconds; under six-way load the commit had still not landed. Raised to 90 s, matching the settings wait, for the same reason: **a poll costs nothing when the value is already there, so the budget should fit the slowest honest case rather than the typical one**, and the failure keeps its full strength — if the value never arrives the check still fails with the last thing actually seen. Green alone and under load afterwards.

### Hand-off status

The cycle-39 patch was **delayed, then delivered** (corrected here in cycle 40 — the line this replaced said "saved, not delivered", which was true when the patch was written and false by the time it landed). At hand-off the browser extension reported "not connected" and `switch_browser` found no other browser, so the patch was written and held; it went over about an hour later, the moment the browser was reachable again. No work lost, and nothing that needed asking for.

### Housekeeping settled

`probe-password-recovery` is now `diag-password-recovery`: it asserts nothing and always exits 0, and the old name promised a guard where there is a report. `sweep-buttons` stays in the battery for now — the argument on both sides is recorded in `reports.txt`, and it is a 363-second cost against a report that has produced one real finding.

## Round 66 — 2026-09-07 — cycle 39 verified, and the question it raises answered

**The defect is real and the fix is right — checked, not accepted.** Reverting cycle 39's single
line in `finRow` and re-running its probe reddens **exactly one check**, the one that names the
soft-deleted invoice, and the captured modal text is the one the patch describes: `Flights B2B
0.00 0.00 0.00`, `Received 0.00 SAR`, `Outstanding 0.00 SAR`, beside a Restore button. Restored
byte-identical. The probe's nine checks are green on the fixed tree, and six finance probes
(ledger, invariants, no-VAT, deleted-invoice, money-placement, Arabic finance) are green with it.

**The obvious next question — does the same root cause bite a second surface? — is no, and it was
worth asking rather than assuming.** `live()` filtering soft-deleted rows before it sanitises is a
hole only for a surface that *displays* a deleted row's money. Every other consumer of `FIN.rows`
in the app drops deleted rows instead of showing them (js/25, js/31, js/38, js/41 all
`if (r.deleted_at) return`), and the two that sum money read through `finLive()` with a raw-rows
fallback that can only fire if js/16 never loaded, in which case there are no rows to read. So the
invoice modal was the one surface, and it is now closed.

## 2026-09-07 · Watch cycle 38 — NO_FAIL_SIGNAL is a build failure now, and the settings wait was timing out honestly

The Code session had already closed the three reds cycle 37 named (`7d1499f`), and none was about the app — its own summary of the class is the right one: **a probe that waits a fixed number of milliseconds for something it could wait for a condition on is measuring the machine, not the app.** Its `probe-premortem` fix keeps the check's full strength (poll for the value, and if it never arrives fail with the last thing actually seen), which was the part worth checking before accepting it. It also found a real Arabic gap by pressing buttons instead of walking navigation (`cd61e2a`) — three dialogs in daily use sitting in English on a fully Arabic screen, invisible to every previous sweep because a dialog does not exist until someone presses a button.

### The settings wait was right to fail, and wrong about how long to wait

Cycle 37's guard reappeared in this cycle's first battery: `probe-finance-invariants` and `probe-expense-report-capture` red with *"the exclusion list never arrived from app_settings"*. The guard was doing its job — refusing to measure a world where nothing is excluded rather than accusing the app of leaking money — but it was giving up too early. **Measured rather than assumed:** the failing run logs js/35's own `[v59] blob sections loaded from tables (… settings:yes)`, so the settings *were* coming, just later than 25 seconds. js/35 retries its whole batch every 1.5s until a session exists, and under six-way load on two vCPUs that adds up.

**A guard that times out early is a red for the wrong reason, exactly like the ones this work has been removing.** The budget is 90 s now — it returns the instant the predicate holds, so it costs nothing on an idle machine, and the probe's own limit is 600 s. `probe-scale-attacks`' `DB.businesses` hold got the same treatment (15 s → 90 s), which is what had brought back its 120-instead-of-108 client count. Sabotage re-verified: with the marker removed from the served blob it still fails, and says why.

### Attack area (kk) closed: NO_FAIL_SIGNAL is a build failure

The last 17 files that cannot report a failure were never going to be fixed with an exit code — they are diagnostics, and what they needed was a **category**. `scripts/qa/reports.txt` is that category, with a line for each saying what it reports and why it has nothing to assert. `check-probe-integrity` now fails on `NO_FAIL_SIGNAL` **everywhere else**, and gates in both directions: a declared report that grows a real failure path fails the run too, because it is a probe now. Both proved — a canary file that asserts nothing reddens the run; appending an exit path to `nav-check` reddens it the other way; restored byte-identical.

That completes the arc the 2026-09-03 baseline started: **43 files could not report a failure. 7 were lying to the battery (cycle 35), 18 were credential-gated probes that cannot run here at all (cycle 36), and the remaining 17 are declared reports (this cycle).** `NO_FAIL_SIGNAL` now sits beside `CWD_PATH` and `PORT_DUP` as a build failure, and the budget is gone.

`run-battery.sh` prints reports under their own heading instead of among the passes, so the green number counts only things that could actually have failed. **Six of them are in the battery** — `sweep-buttons` costs 363 seconds of every run and can only report. Whether it belongs there is now a visible question rather than a hidden one; `reports.txt` records the argument on both sides (round 57 got a real finding out of it, but by *reading* it).

## 2026-09-07 · Round 60 — the last three "environmental" reds closed, all three probes measuring themselves

Watch cycle 37 proved the cause of the whole class — a probe that writes or reads `DB.settings`
is racing js/35's `app_settings` loader — fixed it at the harness, and left three named reds. All
three are closed, and **none was about the app**. Verified the way the cycle asked for: not just
green alone, but green under the six-way parallel load that produced the reds.

- **`probe-received-outstanding-attacks`** — same family exactly. Its standing exclusion was
  written into the page after sign-in, so on a busy machine the loader replaced it and the
  excluded 999,999 row counted; six checks red with a gap of precisely that. Seeded through
  `__settings` now, with `settingsLoaded` and the exclusion as its predicate.
- **`probe-import-tab-wiring`** — waited a fixed 900 ms for the Finance sub-tabs to draw, then
  looked once. Under load they were not there yet, and it reported *"could not find the Import
  sub-tab button — cannot reproduce the real navigation path at all"*, which reads as the app
  having lost the control. It waits for the condition now.
- **`probe-premortem-attacks`** (the one cycle 37 said might still be about the app) — check H
  fires a commit, waits a **fixed 2 seconds**, then reads the database. Under load the commit had
  not finished, so it read the old cost (12,605) and reported the incremental-update promise
  broken. It polls for the value the app is supposed to reach instead, **with the failure exactly
  as strong**: if the value never arrives the check still fails, with the last thing actually seen.

**The pattern under all three is the same one, and it is worth naming as a rule:** a probe that
waits a fixed number of milliseconds for something it could wait for a *condition* on is
measuring the machine, not the app. Cycle 37 found it in `probe-mega`'s 15-second budget; these
are three more of it. A fixed sleep is a red for the wrong reason waiting to happen.

**Cycle 37's own fix verified before trusting it:** with `__mockSettingsLanded` removed from the
served blob, `probe-finance-invariants` and `probe-expense-report-capture` both **exit 1** with
"the exclusion list never arrived from app_settings" — so the marker really is a key only the
seed can set, and the guard can fail. That was the trap that had already caught them once.

## Round 65 — 2026-09-07 — Today was raising alarms about things that never happened

Round 64's badge turned out to be one instance of a pattern, so I swept every `Math.random()` in the
app. Most are honest (ids, uuids, dedup keys). Four were not, and they all fed the **alert strip on
the Today page — the first screen every employee opens.**

`migrateV20()` invented the entire integration panel: a status per source from a hard-coded
expression (kiwi "down", ZATCA "token expired", everything else "connected"), a `lastSync` of
`Date.now() - random(30 minutes)`, and `errorsToday` of 7 and 2. A separate `_v20seed` block
fabricated twelve sync events with random timestamps and a one-in-seven chance of being marked
failed, plus a conflict reading "Total differs by 30 SAR (FX adjustment)" and a kiwi webhook
timeout. Nothing in this app polls anything — Direct Payments data arrives by CSV import.

**Checked against the live database before touching anything.** `app_state` held 12 integration
objects and 14 sync events, 2 marked failed and 1 a conflict. So Today was showing every employee
**"🔴 2 failed syncs"** and **"🔌 2 integrations need attention"** — and one of the two was ZATCA,
the Saudi tax authority, reading "token expired". Somebody could lose a morning to a tax-compliance
problem that had never happened.

Two more of the same shape, both also invented at migration time and both reaching the screen:
`lastSyncedAt` backfilled to a random point in the last hour or two (fmtRel prints it as fact, and
`v20StaleRecords()` decides whether to raise a stale-record alarm by comparing it against a
threshold — so a random number becomes an alarm), and `syncHealth:'synced'` claimed for records
that had never synced. A per-ticket `fraudScore` of `random(15)` was invented too; it never showed,
because the badge only renders above 40, but the tickets table does render "Fraud risk N" from it.

**Fixed** in js/core/core-06: sources the app does not talk to read "not connected", with no time
and no error count; the `_v20seed` block is removed rather than rewritten, because there is nothing
truthful to put in its place until something real reports a sync; a record that has never synced
keeps no sync time, no "synced" claim and no log line; no fraud score is invented.

**New guard: `scripts/qa/probe-invented-alerts-attacks.mjs`** (port 9026), seven checks. The
important one is check 4: the failed-sync pill is verified against the number of failed events
really in the data, and then the failed event is removed and the pill must disappear — otherwise
the count check would also pass on a strip that had simply stopped rendering. Restoring the old
status expression reddens exactly checks 1 and 2.

The probe's own first version measured the fixture instead of the code — the harness's app_state
carries `integrations:{}` and is loaded over the migrated object — and reported "no integration
entries at all", which was true and about nothing. It now asks `migrateV20` directly.

**Live data — done, after the code fix went live** (clearing first would only have let the old code
invent it all again on the next load). Backed up to **`app_state_syncseed_backup_20260907`** (the
full `integrations` object and all 14 `syncEvents` as they stood), then `app_state` was updated:
`syncEvents` is now `[]`, and every integration reads `not connected` except `internal`. Re-checked
after the write: **0 sync events, 0 integrations needing attention, ZATCA no longer "token
expired".** The Today alert strip has nothing false left to show. To undo, copy the two keys back
from the backup table.

## Round 64 — 2026-09-07 — the "Live" badge was a random number

Opened the app with the network cut, to see what a person meets in a dead spot. **The app itself
behaves well**: the session holds, all 60 companies render from the device, the Leads page draws 33
rows, no login wall. One thing on that screen was lying.

The badge in the top bar read **"Live · 58s" with a green dot, while nothing had reached the server
at all.** core-09 builds it as `'Live · ' + Math.floor(Math.random()*50+10) + 's'` — a fresh random
number on every render, wired to nothing. Under sabotage the probe's own output shows it best: the
same "Live · 16s" through a failing connection, a recovery, and a switch to Arabic.

That is worse than a cosmetic slip after round 63. The app now deliberately works through a dead
spot instead of reloading, and the notice it shows tells the person to watch this badge. A badge
that always says Live makes that instruction worthless.

**`js/75-honest-sync-badge.js`** replaces the text with what actually happened, from three real
sources: js/02's status pill (chained through `window.__pillHook`), the `db_cloud_ts` timestamp
js/02 writes after every confirmed save (so the age survives a reload), and `navigator.onLine`.
Same element, same place, same shape — only the words, the dot colour and the truth. It reads
"Synced 2m ago" / "Not synced — saved on this device" / "No connection" / "Not synced yet", in both
languages.

**The regression run earned its keep.** With js/75 added, round 63's guard went red — three checks.
js/49 announces refused and failed saves through the same `window.__pillHook` slot, and its guard
was `if(window.__pillHook) return;` — "somebody has the slot, so I must already be installed". js/75
installs at load and js/49 only from render and a 900ms timer, so js/75 always won and **js/49
silently stopped installing altogether**: every save failure unannounced, refused saves no longer
reloading, nothing on screen to notice. js/49 now guards on its own flag and chains whatever is
already there. `probe-sync-badge-honest` asserts both layers are on the hook, so the coupling
cannot come back quietly.

**New guard: `scripts/qa/probe-sync-badge-honest.mjs`** (port 9025), eight checks. The one that
distinguishes a real clock from a decorative one: read the badge twice eleven seconds apart with
nothing happening in between, and require the age to have grown by about that much. A random number
and a frozen number read identically to any check that only looks once. Removing js/75 reddens
seven of the eight.

## Round 63 — 2026-09-07 — a dead spot is not a refusal (the app was reload-looping on bad wifi)

**The defect.** js/49's `watchSaves()` exists for a good reason: if the database refuses a change,
the screen must not keep showing it, so the layer explains and reloads. But it fired on ANY save
failure, and a dropped connection is the opposite case. Driven with the save endpoints answering
503 — an ordinary mobile dead spot — **the app reloaded three times in twelve seconds, once per
retry.**

Everything about that is wrong. js/02 has already written the change to the device and scheduled a
retry with backoff; the reload throws that retry away. The person is told their change was not
saved, when it is sitting safely on their phone. And on a merely patchy connection it becomes a
reload loop that loses the pending write every time round. Direct's agents work on hotel and
airport wifi — this is their normal, not an edge case.

**The fix.** A refusal (row-level security, 401/403, "not authorized") still reloads, unchanged. A
transport failure now shows one honest notice — *"Not on the server yet · your change is saved on
this device, but it has not reached the server. We are still trying. Keep this tab open until the
badge says saved. Nothing has been lost."* — and does not reload. One notice per outage, re-armed
when a save succeeds, so someone who hits two dead spots in a session is told about both.

**New guard: `scripts/qa/probe-save-failure-attacks.mjs`** (port 9020). Six checks, and the one
that makes the rest mean anything is check 4: after the connection returns, the change must reach
the database by itself. Not reloading is only defensible because the retry actually delivers. Check
5 is the other half — a row-level-security refusal must STILL reload, so a fix that simply stopped
reloading for everything would pass 1-4 and reopen the hole js/49 was written to close.

Both halves sabotaged: forcing `denied` true reddens 1, 2, 3, 4 and 6; forcing it false reddens
exactly 5. Restored byte-identical.

**Two probe faults found and fixed before they became false claims.** `nextAction` maps to the
next_action_DATE column, not the note, so the first version wrote a sentence where a date belongs
and its row check could never match — one red that was read rather than believed. And the Arabic
page was being created while the previous block's refusal mode was still on, so the notice fired in
English before the language switch and the once-per-outage guard suppressed the Arabic one: the
probe was accusing the app of being English-only on an Arabic screen, and it was its own leftover
state.

## Round 62 — 2026-09-07 — every dialog in the app, on a phone

The same blind spot as round 61, one dimension over. All the responsive work in this repo measures
PAGES — probe-responsive-finance says so in its own header, and probe-phone, probe-search-phone and
probe-reports-phone-ar are all page walks. A dialog does not exist until someone presses a button,
and on a phone the stakes are higher than on a page: a page that overflows is ugly, while a dialog
whose Save button cannot be reached simply cannot be completed.

**New: `scripts/qa/sweep-dialogs-phone.mjs`** (port 9019) — 390x844, deliberately in Arabic, presses
126 controls across nine pages, opens 43 dialogs (41 distinct) and measures each: does it push the
page sideways, is anything inside it wider than the screen without a scroller, and is its Save
button reachable — hit-tested at its own centre, not merely "visible".

**The app is clean.** No sideways scroll, nothing too wide, every Save reachable. What took the
round was establishing that the green means something.

**Three false findings the sweep produced about itself, in order.**
1. First run: 23 dialogs "unreachable", naming `div.pitem` — the COMMAND PALETTE, which one of the
   pressed buttons had opened and closing the modal did not close. Every later dialog was measured
   underneath a full-screen overlay the sweep had opened itself.
2. Second run: four left, naming `#v48ov` — js/31's Team & Access panel, same shape. It is removed
   rather than hidden to close, and it opens no `#ov`, so the close step was being skipped
   entirely. Now everything is closed after EVERY button, and a generic guard asks what is actually
   on top of the dialog's own middle: anything outside `#ov` means the dialog is reported as
   **not measured** rather than as a finding.
3. And the walk was ending up in Arabic by accident — a Settings card flipped it half way through —
   so half the dialogs were measured LTR and half RTL and the report said neither. Arabic is now
   chosen on purpose (RTL moves Save to the other side) and restored whenever a control flips it.

**The part worth keeping: I could not break this from the CSS.** Sabotaging `.modal`'s
`overflow:auto` to `hidden` AND `.mf`'s `position:sticky` to `static` — both mechanisms that keep
Save reachable — left the sweep entirely green. There are THREE defences, not two: the modal
scrolls, the footer sticks, and the browser scrolls a focused control into view even inside a
clipped box. Good news about the app; bad news about the evidence, since a check nobody has ever
seen fail is a check nobody should trust. Two things came out of that:

* An earlier version of the check **could not have failed at all**: it set `.scrollTop` itself, and
  that succeeds on an `overflow:hidden` box no finger can scroll. It now only scrolls an ancestor
  whose computed overflow actually offers it, and deliberately does not call `scrollIntoView()`,
  which scrolls clipped ancestors too.
* The detector now proves itself on every run: it lays a strip over the bottom of the screen and
  requires the reachability test to report the button as unreachable. That is the same shape as the
  real defect the sweep caught twice — something standing above a dialog.

Also recorded honestly in the file: the tallest dialog in the app needs 687px of an 844px screen, so
the walk's reachability result is currently vacuous on its own, and the run says so out loud. A
forced 3000px dialog is what actually exercises the contract.

## Round 61 — 2026-09-07 — the Arabic pass on the surfaces you have to CLICK to reach

Everything that has ever checked the app's Arabic walked the navigation and read each page as it
landed. That is the shallow half. A dialog does not exist until someone presses a button, so a tool
that presses no buttons cannot see one — and the nav walk has been clean for days while three
dialogs in daily use sat in English on a fully Arabic screen.

**New: `scripts/qa/sweep-language-deep.mjs`** (port 9016) — walks nine pages in Arabic, presses
every visible control, and when a dialog opens reads THE DIALOG rather than the page behind it. It
also drives the sub-tab strips, which swap a page's whole body without navigating.

**What it found, and what was fixed**

* The **quick-edit dialog** on a lead and on a client — the one used more than any other screen in
  the app — showed *Assigned to*, *+ Add new person…*, *Quick note (optional - logs an activity)*,
  and on a client *Account tier* and *Next account review*, all in English. Its title read
  "Quick edit - <company>". Fixed: dictionary entries in js/21, and the title is now bilingual.
* The **Ops new-request form** showed all eleven of its Stage and Priority words in English
  (New · Quoting · Awaiting client · Booked · Ticketed · Delivered · Closed · Urgent · High ·
  Normal · Low). This one could not be fixed by a dictionary: those `<option>`s carried no `value`
  attribute, and an option with no value is stored **by its text**, so translating the label would
  have written "محجوز" into `requests.stage`. js/21 has refused to touch value-less options since
  round 28 for exactly that reason. Fixed properly: core-03 now gives every option an explicit
  English value, and the labels are translated on top of that.
* **Settings** — the credit-pool settings dialog, the pool-cap history, and both proposal
  generators were English throughout. Fixed by dictionary.

**New guard: `scripts/qa/probe-dialog-arabic-attacks.mjs`** (port 9018). The request-dialog trade is
only safe while both halves hold, and each is invisible from the other side: the label must read
Arabic, and the stored value must stay English. So the probe picks the Arabic-labelled option the
way a person does, **saves the record**, and reads back what the app stored. Sabotage measured, not
predicted — and the measurement corrected the prediction: removing the `value` attributes does NOT
corrupt anything, because js/21's guard then declines to translate at all. Only removing the values
*and* that guard produces the corruption, and then the probe reports the record coming back as
`{"stage":"محجوز","priority":"مرتفع"}`.

**Two false findings the sweep produced on its first run, both now impossible.** It pressed the
language card on Settings and flipped the app to English, then reported the five dialogs it read
afterwards as Arabic gaps — a tool that flips the setting it is measuring. And it read the
client-facing price-offer document, which is authored in the *document's* language (an Arabic user
producing an English offer is the app working). The sweep now skips the language control, re-reads
LANG at every scan and discards any reading not taken in Arabic, and exempts document previews and
language pickers.
### The one red left, and everything now ruled out about it

`probe-scale-attacks` still reports *"Top clients label reads all 120 clients, top 10 shown; expected all 108"* under six-way load, and is green alone. It is **not** a settings-race instance, and the evidence says it is not the app either. Instrumented under the load that reproduces it, at the moment the label is read:

- `finCanon('Scale Co 000')` and `finCanon('Scale Co 000 LLC')` both return **`Scale Client 000` / `biz:sbz0`** — the twin folds onto its base correctly;
- both links are present and both carry `business_id: sbz0`;
- all 108 fixture companies are in `DB.businesses`, and `clearFinCanon` is reachable and was called;
- a forced round trip through another tab and back — so the Clients body is rebuilt from the cleared cache — changes nothing.

So the app answers the folding question correctly a moment after the rendered label disagrees with it. **The remaining suspect is the probe's own read:** `clientsHtml.match(/all (\d+) clients, top 10 shown/)` takes the FIRST match in the page HTML, and nothing has yet checked whether more than one such string is present. Cycle 39 starts there — count the matches before believing the number — and only then look further. Not called environmental; it reproduces on demand.


