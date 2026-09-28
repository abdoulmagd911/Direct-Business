## 2026-09-07 · Watch cycle 37 — the "environmental" reds were one harness defect, and it had been accusing the app of leaking excluded money

**The runner built at the end of cycle 36 paid for itself on its first run.** Because it now keeps every probe's full output instead of the last line, four reds could be *read* rather than argued about — and they turned out to be one defect with one cause.

### What the log said

`probe-scale-attacks` failed nine checks: *"Revenue tile shows 8163575, an independent recount gives 7163576"* — a difference of **exactly 999,999**, which is the amount on `SC-EXCL-1`, the probe's own **excluded** row. Also one extra invoice in the header count, and the Top-clients label reading 121 clients where 108 were expected, because the twelve alias twins had not folded. `probe-alias-dedupe-attacks` failed four: *`exclusion "Takamol for Business Services" → null, expected 7`*. Two probes, two symptoms, one cause.

### The cause: a fixture that the app's own loader throws away

`js/35` fetches `app_settings` and merges the blob **key by key over `DB.settings`**. A probe that writes its fixture into the page — `p.evaluate(() => DB.settings.financeExclusions = [...])` — is racing that loader. Land the write first and it is silently replaced by the server's copy; land it second and it survives. Which happens depends on how busy the machine is.

**Reproduced deterministically** by holding back only the `app_settings` response: the probe's own `fx-probe-fixture` is `fx-qa-takamol` 1.5 seconds later, every time. Watch cycle 33 met this same thing and patched around it inside one probe; nobody had gone looking for the root.

The reverse hazard is the same defect read the other way: a probe that *reads* `DB.settings` before the loader lands sees an empty exclusion list. That is what produced `probe-alias-dedupe-attacks`' four reds, `probe-finance-invariants`' six in cycle 36, and — worst of the set — `probe-expense-report-capture` reporting **"the excluded Takamol row received a cost write — the exclusion re-check inside the join did not fire."** That is the strongest possible accusation against the owner's hardest ruling, and it was false. The list simply had not arrived.

### Fixed at the harness, not in each probe

- `mock-supabase.mjs` `start()` takes **`__settings`**, which merges into the `app_settings` blob the app itself loads — so the app delivers the fixture and there is no ordering left to get wrong. `probe-scale-attacks` seeds its exclusion that way now.
- A shared **`settingsLoaded(page)`** waits for the blob to land and returns false on timeout; every caller **fails loudly** on false rather than measuring an empty world. Added to `probe-alias-dedupe-attacks`, `probe-finance-invariants` and `probe-expense-report-capture`.
- `probe-scale-attacks` also pushes 108 companies into `DB.businesses` from outside the page — the same race one object along, which is what left the twelve twins unfolded. It now confirms the push actually stuck.

**Two traps hit while writing that helper, both worth naming, both found only by sabotage.** It first read `window.DB` — `DB` is a top-level binding, a global but *not* a window property, so it answered "never arrived" forever. Then it watched `DB.settings.currency`, **a key the app sets for itself**: with the served blob deliberately broken the helper still said "landed" and the probe passed. *A guard that cannot fail is the exact thing this work exists to remove, and only sabotage found it.* It now watches `__mockSettingsLanded`, which nothing but the seed sets — sabotage-verified green clean, red broken, restored byte-identical.

### A check that measured the machine

`probe-mega` asserted a **15-second wall-clock budget** on a page reload. In the battery it failed at **15,062 ms** and passed alone: six probes on two vCPUs is 3× oversubscription, so the number it measured was the box, not the app. Split — the claim that a refresh comes back to a rendered page stays an assertion; the duration is now REPORTED, so a real slowdown is still visible without a red that is about what else was running.

### And a third trap in the same helper, found by re-running the battery rather than trusting the fix

With the marker in place, `probe-finance-invariants` still failed in the next batch — but now with its own precise message: *"the exclusion list does not name 'Takamol for Business Services' — fixture/app_settings mismatch."* The marker had landed and the exclusion was gone anyway, because **`DB.settings` is replaced more than once during boot.** Seeing the fixture arrive is not the same as it still being there when the checks run.

So `settingsLoaded(page, ms, alsoRequire)` now takes the predicate the probe actually depends on — for these four, `finExclusionCheck('Takamol for Business Services')` — and requires it to hold **twice, 700 ms apart**, so a later replacement is caught instead of raced. `probe-scale-attacks` holds its `DB.businesses` fixture the same way. Sabotage-verified twice over: with the marker removed it reddens, and with the marker present but the exclusion entry renamed it reddens on the predicate. Restored byte-identical each time.

**Result, measured over four full battery runs:** `probe-finance-invariants`, `probe-alias-dedupe-attacks`, `probe-expense-report-capture`, `probe-import-preview-density`, `probe-scale-attacks`, `probe-csv-injection` and `probe-mega` all green in the final run — **75 of 78**, and every probe that had been failing on the settings race is fixed.

**Three left for cycle 38, all now legible rather than mysterious.** The work is mechanical from here because the cause is proven; what is left is applying the same wait where it belongs.

- **`probe-received-outstanding-attacks`** — *"Received tile 17527857.5, independent recount 16527858.5"*. The gap is **exactly 999,999**, the excluded fixture row, in six checks. Same family, one more probe: it needs `settingsLoaded` with the exclusion predicate.
- **`probe-import-tab-wiring`** — *"could not find the Import sub-tab button — cannot reproduce the real navigation path at all"*. Not the settings race: fixed sleeps where a condition wait belongs. The probe gives up before the tab renders under load.
- **`probe-premortem-attacks`** — *"H: after reload, the lines-only drop did not resolve — cost is 12605, expected 750."* The only one of the three that has not been explained yet, and the only one that could still turn out to be about the app. Worth reading properly rather than assuming it joins the family.

None of the three is to be called environmental. All three now print what they measured.

## 2026-09-07 · Round 59 — the deep-link rate settled, and cycle 36's guards verified

**On the throttle rate, settled.** Cycle 35 measured the deep link lost from 6x, round 58 from 4x,
cycle 36 re-measured 4x as surviving. All three runs were honest. **Cycle 36's conclusion is the
right one: the rate is a property of the machine, not of the app** — throttling only has to make
script execution slow enough for js/03's 200ms timer to beat js/66, and how slow that is depends
on the host. Checked here with cycle 36's own probe against a deliberately broken tree: **4x
reddens on this host**, so round 58's figure holds for the repo machine and cycle 36's holds for
theirs. Neither number is a fact about the app, which is exactly the point — and cycle 36's answer
(hold js/66's response back and force the losing order at 1x, on any box) is the durable one. The
rate checks stay as breadth, and the probe now says out loud when they proved nothing.

**Cycle 36's guards verified independently before pushing:**
- The held-back check reddens under **both** sabotages taken separately — removing js/66's
  fallback, and removing js/03's publish (4 checks red).
- `requirePw` moved to `signIn()`: `probe-teamwork` now **exits 1** with a message naming the
  missing variable, where it used to print `FAILS 8/8` and exit 0.
- The battery-membership gate really gates, both directions: a phantom name in `battery.txt`
  fails the run ("a deleted probe is not a passing probe"), and removing a real probe from both
  lists fails it too ("nobody has decided whether these run"). It caught that round 58's
  `probe-deeplink-boot-race` was not being run by anything.
- `NO_FAIL_SIGNAL` ratcheted 35 → 17; 186 files accounted for, 78 in the battery, 102 excluded
  with a reason.

**Worth naming for whoever reads this next:** 36 of the 49 probes that import `emp-rig` sign in as
real people against the real database, and there are no passwords here by design (rule 7). They
now refuse loudly instead of failing every check for that one reason and reporting success. That
is the honest state, not a regression — but it means that family of probes is verified nowhere
except on a machine that has the owner's list.

## 2026-09-07 · Watch cycle 36 — the loud guard that 36 of 49 callers never called, and a battery list that lived in /tmp

**Attack area (jj) finished: the eighteen remaining exit-0 probes, and where battery membership actually lives.** Plus an independent re-measurement of round 58's correction.

### The 4x/6x disagreement is not about the app, and one of the new probe's checks cannot fail

Round 58 landed cycle 35's deep-link fix and corrected the measurement: the link was lost **from 4x, not 6x**. Re-measured here before recording anything, using **round 58's own probe** against the pre-fix tree, four consecutive runs: **4x survived every time, 10x was lost every time.** Sabotage settles it — remove js/66's fallback, or js/03's publish, one at a time, and only the 10x check goes red. So on this host **the 4x assertion passes on the broken tree**: a check that cannot fail, inside a probe written to end exactly that problem.

Neither number is wrong and neither is a property of the app. CPU throttling only slows script execution until js/03's 200 ms timer beats js/66, and how slow that has to be depends on the box, its load and its cache. **Chasing the number would repeat the mistake.** `probe-deeplink-boot-race` now asserts the guarantee a way that cannot depend on the host at all: **hold js/66's own response back**, which forces the losing order — js/03's rewrite first, js/66 evaluated after — on any machine, at 1x, with no throttle. Pre-fix tree LOST, fixed tree SURVIVED, both sabotages redden it, and its own control (the same run with nothing held back) proves the failure is about the order and not the delay. The rate checks stay for breadth, and the probe now prints a line saying so when every one of them passed, so a green is never mistaken for evidence.

### 36 of 49 probes signed in as nobody, and 15 of them called it a pass

The eighteen files cycle 35 left are all fixed to exit on their own count. That was the easy half. The question the list told this cycle to ask first — *why is this probe not in the battery?* — has the same answer for every one: **they cannot run here at all.** Fifteen import `emp-rig.mjs`, which signs in as a real member of staff and reads the passwords from `DB_PW_*` — never from the file, because CLAUDE.md forbids the team's real passwords from being in this repository.

What nobody had noticed is what they do without those credentials. `emp-rig.mjs` has always carried a function whose own comment says it exists to *"fail loudly rather than silently testing nothing"* — `requirePw()`, which throws when the password is missing. **36 of the 49 probes that import the rig never call it.** They read `TEAM.<who>.pw` directly, get `''`, and sign in as nobody. Measured, not inferred: `probe-teamwork` run here prints **`FAILS: 8 / 8`** — every check failing, all for the one reason — and **exits 0**.

**Fixed at the chokepoint, not at the 36 call sites.** `signIn()` is the one function every one of them goes through, so it refuses an empty password there, with the reason in the message. A guard a caller can forget to call is not a guard. Verified both ways: the probe now stops on the first sign-in and exits 1, and with the guard removed in a scratch copy it goes back to 8-of-8-failing-and-exit-0.

### Battery membership did not live anywhere

Until this cycle the battery's contents existed only as `/tmp/fullrun.txt` — a scratch file that dies with the container, cannot be diffed or reviewed, and gives no answer to "why is this probe not in the battery?". That is how eighteen exit-0 probes sat outside it unnoticed, and how **`probe-deeplink-boot-race`, written hours earlier to guard a live defect, was not being run by anything.**

Now `scripts/qa/battery.txt` and `scripts/qa/battery-excluded.txt` (each exclusion with a one-line reason), and `check-probe-integrity` fails if a probe is in neither, in both, or named in a list but missing from the tree — sabotage-verified in all three directions. It found seven unaccounted files on its first run.

**And it found three phantom green rows.** `emp-rig`, `mock-seed` and `mock-seed-live` were in the battery list. They are **libraries** — imported by probes, with no checks of their own — so the runner ran them, they exited 0, and three of the battery's green rows were modules that cannot fail. Removed. The battery is 76 probes, not 79.

`NO_FAIL_SIGNAL` budget ratcheted **35 → 17**, and the 17 that remain are report tools with no assertions at all; six of them sit in the battery and cannot go red. They need a category, not an exit code — the plan is written up in `docs/PROBE-WARNINGS-TRIAGE.md` and is cycle 37's work.

**Flagged for the Generator task:** six `generator-qa` probes (`probe-contract`, `probe-price-offer`, `probe-service-fees`, `probe-company-profile`, `probe-tender`, `probe-generator-brand`) use the mock and look runnable, but **nobody in this session has ever run them**. Named in the exclusion file with that reason; that task should confirm they still pass and say who runs them.

### Why every one of these mysteries has been diagnosed from a summary line

Two full battery runs this cycle produced **five reds between them, and not one probe failed in both**: `probe-finance-invariants` (6 checks) in the first, `probe-csv-injection`, `probe-expense-report-capture`, `probe-premortem-attacks` and `probe-scale-attacks` in the second. All five are green run alone, green run with their real battery neighbours, and green under three separate deliberate-contention harnesses including six probes plus three CPU burners. Not reproduced, not explained, and **not** written off as environmental.

What is explained is why nobody could ever diagnose them. **The runner kept only the last line of each probe's output.** By the time a red was noticed the failing checks were gone, so every one of these has been argued about from a summary. That is now fixed rather than complained about: **`scripts/qa/run-battery.sh`** reads `battery.txt`, keeps the full output of every probe in its own log, and on a red prints the failing checks and the path to the log. Sabotage-verified — a deliberately false check makes it exit 1 and print the check by name, not the summary. The scratch runner in `/tmp` is retired.

Cycle 37 runs the battery through it and reads the log the next time this happens. The standing hypothesis to test first: **six probes at a time on two vCPUs is 3x oversubscription**, and most of these probes wait with fixed sleeps rather than for a condition — the exact mechanism cycle 35 proved for `probe-generator-attacks`. `run-battery.sh -j 3` is one command away from testing it.

**Battery:** 76 probes plus `check-structure`, `check-probe-integrity` and `check-decisions-wired` (the last of which was not in the battery either and is now).

## 2026-09-06 · Round 58 — the deep link a phone throws away is fixed, and it bit one step earlier than reported

Watch cycle 35 traced six cycles of "probe-generator-attacks is environmental" to a real defect in
the app and handed over a two-line fix, because `js/03` and `js/66` are outside its lane. **Both
lines are landed.**

**Reproduced independently before touching anything, by CPU throttling alone — and the measurement
differs from the handover in the direction that matters: the link was lost from 4x, not 6x.**
Cycle 35 recorded 4x as surviving. It does not. 4x is an ordinary mid-range phone, not a low-end
one; the deep link survived only at **1x**, which is to say only on the machines the people who
built it were using. Anyone opening a `/documents/<tab>` link on a normal phone signed in and
landed on Today, with nothing saying an address had ever been asked for.

**The mechanism, confirmed:** `index.html` loads 68 blocking scripts in order. `js/03` (14th)
captures the boot address, then on a 200 ms timer rewrites `location.pathname` to `'/' + current`
— `'today'`, because nobody is signed in yet. `js/66` (~55th) reads `location.pathname` at its own
evaluation time to decide which editor the link asked for. Neither file is wrong alone; the defect
exists only in the order they run in. `js/03` now publishes `window.__bootPath`, and `js/66`'s boot
IIFE — boot only, never `urlSync()` or the popstate listener, or `dgHome()` could never leave the
editor — falls back to it.

**Guarded deterministically, not by luck.** New `scripts/qa/probe-deeplink-boot-race.mjs` (port
8713) throttles the CPU over CDP and asks the same question at 1x, 4x and 10x, with every wait
scaled to the throttle so it measures the app rather than its own impatience. `probe-generator-
attacks` could only ever catch this when the machine happened to be busy. **Sabotage-verified on
both halves separately** — removing `js/66`'s fallback reddens the throttled rates; removing
`js/03`'s publish reddens all three plus the control. `probe-generator-attacks` is 114/0 again.

**Cycle 35's other two claims verified before pushing:** a deliberately false check in one of the
seven newly-exit-coded probes really does make it exit 1 (`FAILS: 1 / 18`, `exit=1`), and all seven
are green on a real run — 0 failures out of 21 / 49 / 17 / 14 / 20 / 31.

## 2026-09-06 · Watch cycle 35 — "environmental" was a real defect all along, and the battery has been reading pass from probes that cannot fail

**Attack area (ii): the three probes that fail only under parallel load. Attack area (jj): the ~50 ungated warnings in `check-probe-integrity`.**

Cycle 34 removed the port collisions and raised the runner's timeout, so the three remaining "fails in a batch, green alone" probes had no excuse left. Two of them — `probe-recovery-attacks` (37/37) and `probe-scale-attacks` (ALL PASS) — are now green under the same six-way load that used to redden them; the ports were their whole problem. **The third was not environmental at any point. It was reporting a real defect in the app, and it had been for six cycles.**

### A deep link that a slow phone throws away

Open `/documents/contract` while signed out, sign in, and on a fast machine you land in the contract editor. On a slower one you land on **Today** — no error, no sign an address was ever asked for. Same for `/offer`, `/fees`, `/profile`, `/tender`: every link anyone pastes into an email.

`index.html` loads 68 blocking scripts in order and two of them race over the same value. **js/03** (14th) captures the boot address, then on a 200 ms timer rewrites `location.pathname` to `'/' + current` — and nobody is signed in yet, so `current` is `'today'`. **js/66** (~55th) decides which editor a `/documents/<tab>` link asked for by reading `location.pathname` at its own evaluation time. Normally js/66 is evaluated inside 200 ms and wins. Slow the *execution* of those 40 scripts and js/03's timer wins: js/66 reads `/today` and the deep link is gone. Neither file is wrong on its own — the defect exists only in the order they happen to run in.

**Reproduced deterministically with no contention at all**, purely by CPU throttling over CDP, one page at a time: the deep link survives at 1x and 4x and is lost from **6x** up — roughly a low-end Android phone. Per-request latency does not reproduce it; the preload scanner fetches in parallel. It is execution time that decides the race, which is why two vCPUs running six probes reproduces it as reliably as a cheap phone does.

**js/03 and js/66 are outside this session's lane, so the two-line fix is handed over, not landed** — repro table, mechanism and exact diff in `docs/DEEPLINK-BOOT-RACE.md`. Measured both ways under identical load: `113 passed, 1 failed` against the tree as pushed, `114 passed, 0 failed` with the two lines applied.

The probe itself is fixed here, and the shape of the fix matters after round 56's correction: `ensureEditor` still opens the editor **by the deep link first**, and only after that has demonstrably failed opens the tab the way a card click does. It records that it fell back, and the five deep-link checks read that record — so the fallback can never turn a check green. One lost address now costs **one honest FAIL that names the cause** instead of fifteen cascaded reds.

### The battery has been reading "pass" from seven probes that could not fail

Attack area (jj), and the more uncomfortable finding. Seven files the battery actually runs — `probe-live2`, `probe-mega`, `probe-notes`, `probe-round8`, `probe-round9`, `probe-stress`, `sweep-consistency` — counted their failures, printed the count, and then `process.exit(0)`. **The runner reads exit codes. Every regression those seven could see has been reported as a pass for as long as they have existed: 152 checks' worth of guard that was decoration.** They exit on their own count now, all seven are green on a real run (0 failures out of 21/49/17/14/20/31), and a deliberately false check makes one exit 1 — the wiring is proved, not assumed. Budget ratcheted 43 → 35 so they cannot quietly go back.

Two `LITERAL_TRUE` hits in battery probes fixed with them: `probe-live2` was pushing a business finding for Abdulrahman through the assertion helper with a literal `true`, so an unchecked number printed as PASS and counted toward the pass total (a `REPORT` now); `probe-mega` did the same for a check its seed could not set up (a `SKIP` now). **A check that did not run has not passed.**

### Two probes that were reading the wrong copy of the app

`CWD_PATH` promoted from warning to build failure, and both offenders fixed. `probe-audit-undo` read js/63, and `probe-client-documents` read js/67 and js/71, from an absolute path under a home directory belonging to nobody here. The checker's own note assumed they had therefore never run — they had, because an earlier session left a **symlink** at that path pointing back at the repo. That is worse than dead: those three checks read the **repo** even when the run was pointed at a sabotaged copy through `APP_DIR`, and sabotage is the only way a probe is ever verified. Both resolve from their own tree now, and both are re-verified by sabotage — breaking one Arabic refusal string, and adding a second `amountInWords` to js/71, each redden a check that could not have failed before.

The remaining 35 warnings are read and given a verdict one by one in `docs/PROBE-WARNINGS-TRIAGE.md`: 17 are report tools that should stop being counted as probes (six of them sit in the battery and cannot go red — `sweep-buttons` costs 363 seconds of every run and can only report), and 18 are the same exit-0 defect in files that are *not* in the battery, so they are at least not lying to anyone yet.

**Battery:** 79 probes plus `check-structure` and `check-probe-integrity` — 78 green. The one red is `probe-generator-attacks`, and it is red on purpose: it is guarding the deep-link defect above until the two-line fix lands.
## 2026-09-06 · Round 57 — pipeline chips on a single company's card, and a button report worth reading

**Fixed (app):** the Leads section injects stage filter chips — "All 6 · Prospect 0 · Contacted 2 ·
Proposal 1 · Won 0" — and the lead DETAIL card is part of that section, so they sat above one
company's card with nothing to filter. Tapping one highlighted it and did nothing else. This was
already fixed for the CLIENT card (js/38, "no longer wears the Leads costume", guarded by
probe-stress S27) but only inside the is-a-client branch, so the lead card kept wearing it. Hidden
now for any open record; the list keeps them. Sabotage-verified, and probe-lifecycle5 checks both
halves — gone on the card, still there on the list.

**Why it surfaced now:** `sweep-buttons` can finish, which it could not until round 53. But its
verdict was "did the markup grow by 50 characters", so it called **79 of 189** buttons NO-OP. A
list that noisy is one nobody reads — the same disease as the warning nobody must act on that
watch cycle 34 named. The fingerprint now watches what this app's controls actually change: page
text, open/closed cards, row counts, dropdowns, checkboxes, the address, and scroll position.
Two detector gaps closed with it — quick-edit dialogs were invisible because `openModal` puts its
class on `#ov` rather than `#modal`, and an anchor that opens a new tab hands the click to the
browser, so it is read from the element. **79 → 31**, with 33 dialogs, 9 scrolls and 2 external
links now correctly named. The sweep also reports the label of the button it *actually* pressed,
so a verdict can never be filed under the wrong name.

**The 31 that remain are NOT a defect list**, and the probe's own header now says so:
- **"Clients list | Edit" ×11 — driven by hand and verified working.** The click runs
  `leadQuickEdit()`, `#ov` gains its `show` class, the dialog fills with "Quick edit — <name>".
  **Why the sweep still misses it is unexplained** — it is not index drift (no run has shown a
  label mismatch since the sweep started reporting the real one). Left visible rather than
  silenced.
- The jump-bar chips scroll to a section and change nothing else, deliberately; nine are caught by
  the scroll check and the rest sit in a viewport tall enough not to need scrolling.
- Pagination with fewer rows than a page, and a filter that is already active, correctly do nothing.
- "⬇ Excel (CSV)" downloads a file, which this sweep does not watch for.

**Also corrected this round:** watch cycle 34's crash fix in `probe-generator-attacks` carried a
precedence bug in two of its six edits — `(el||{}).innerText||''.includes('…')` is
`innerText || false`, so the substring was never tested and the check passed for any non-empty
page. Demonstrated rather than argued: with a needle provably absent from the page, cycle 34's form
reports 114 passed / 0 failed and the corrected form turns exactly those two red. Neither was
hiding a defect, but neither could have caught one. **A crash fix that quietly turns an assertion
into a rubber stamp is worse than the crash, because the crash was at least loud.**

## 2026-09-06 · Watch cycle 34 — six cycles of "environmental" were twelve port collisions, eleven of them mine

**Attack area (gg): the alias grouping map at scale and under hostile names. Attack area (hh): the client-rollup cache. And, first, the item cycle 33 left unresolved: `sweep-buttons`.**

Cycle 33 landed, and the Code session cleared the last four standing reds (`7e6da51`) — none of them an app defect: fixtures whose meaning drifted with the calendar, a probe asserting a world the owner had replaced, and one that could never run at all. Nothing queued.

**The real find of this cycle is about this session's own work, and it is the largest self-inflicted defect found so far.**

`sweep-buttons` had been "red at a different line every run — load-timing, environmental" since cycle 29. Run alone with a generous limit it **exits 0 in 363 seconds**. The battery runner kills at **240**. It was never failing; it was being killed mid-run, and *where* it happened to be when killed varied — which is exactly the symptom recorded as a mystery for five cycles.

That answered one probe. Then the same question was asked of `probe-generator-attacks`, which fails in a batch and passes alone in 189s — inside the old limit, so the timeout could not be the reason. Reproduced under deliberate contention, it died on **EADDRINUSE, port 8899**. So the ports were audited across the whole suite:

**Twelve pairs of probes were sharing a port. Eleven of the twelve involve probes this session created** — ports 8211 through 8251, picked by incrementing without once checking what was already taken. The battery runs **six at a time**, so whenever two colliding probes overlapped, one died with EADDRINUSE at an unpredictable point. **That is the whole "environmental, red in a batch and green alone" class**, written off across three probes and six cycles.

Worse, and worth recording plainly: **the suite already knew.** `check-probe-integrity.mjs` has had a `PORT_DUP` tell all along, and it was printing these collisions among the ~50 warnings *outside the gated set* — a list nobody had to act on, so nobody read it. **A warning nobody must act on is a warning nobody reads.**

Fixed: all eleven of this session's probes moved to a private block (8701–8711), plus the one remaining pre-existing pair (`probe-finance-tab-honest` 8387 → 8712). And **`PORT_DUP` is now a build failure, not a warning** — `check-probe-integrity` fails the run on a duplicate port and names both files. Verified it can fail (a deliberate collision reddens it and names the pair) and restores clean. It now reports **all 122 probes that open a port use a port of their own**.

**Two real crashes fixed in `probe-generator-attacks` on the way.** Under load it read `.innerText` off `#ctWrap .ct-form` and `.value` off `#ctE_bar` before either had rendered, and died on a null — killing the run and hiding every finding behind a stack trace, the same shape round 52 fixed in `probe-lifecycle5`. Both now wait for their element, and every `getElementById(...).innerText` in that file is null-safe.

**Attack area (gg): no defect found.** New `scripts/qa/probe-grouping-canon-attacks.mjs` (port 8711, 12 checks) drives **306 groups and 1,107 aliases** over 308 invoices. Every invoice lands in exactly one bucket and they sum to the independent recount (68ms); a retired group listed **before** a live one does not capture the live one's client; `finCanon` is stable across repeated calls; `clearFinCanon` genuinely empties the cache (a renamed group is the old name until it is cleared and the new name immediately after); and an ungrouped client keeps the same identity key across a real language switch. Three sabotages caught.

**A blind spot in my own new probe, caught by sabotage and closed.** Turning off `finCanon`'s grouping entirely was caught by only one incidental check — because every fixture name belonged to a *different* group, so grouping-on and grouping-off gave the same bucket count and the same total. **Money moves between buckets, never in or out, so a total can never prove grouping happened.** Three invoices naming a *second* alias of an existing group were added, and the bucket **count** now proves it: with grouping off the mutation reddens three checks, including one that names the cause.

**Two behaviours measured and written down rather than "fixed".** A name listed as an alias by **two active groups** resolves to whichever appears first in the list, silently — order in `financeGroupMap` is not something anyone sets deliberately, so the winner is arbitrary. **Checked against the live database before deciding it mattered: 3 live groups, all active, zero aliases claimed by more than one.** It is a question about the data, not a defect in the code, and it is not raised to the owner because no live money is affected. Separately: a row named exactly a group's **canonicalName**, when that name is not among its own aliases, is *not* matched to it — js/62 matches on aliases only, which is what its code says it does.

**Battery:** 79 probes plus `check-structure` and `check-probe-integrity`, 76 green. `sweep-buttons` is **green in the battery** now. Three probes still fail only under six-way parallel load and pass alone (`probe-generator-attacks`, `probe-recovery-attacks`, `probe-scale-attacks`, all exit 0 serially) — genuine resource contention rather than ports or timeouts, and now a precisely-bounded three rather than a vague class.

## 2026-09-06 · Round 55 — the last four standing reds, and a probe that was writing into real storage

All four are green. **Not one of them was an app defect** — every failure was a probe asserting a
world the owner had deliberately replaced, or a fixture whose meaning drifted with the calendar.

- **`probe-events-scale`** hardcoded "18 ended, so the pager reads 65". Its own fixture dates
  events by month and day-of-month, so on any day after the 1st of September some "upcoming"
  events are already past and the page correctly hides them — 63, not 65. A fixture whose meaning
  changes with the calendar makes a probe that is right for a few days and then accuses the app
  for ever. Both the ended count and the expected total are derived from the fixture and today's
  date now, and "no ended event on the opening view" is checked BY DATE rather than by name.
- **`probe-round9`** set `xp_cat` — a category field the S5 rework replaced with `xp_svc`, the
  real service — so it threw on a null and killed the run before reporting anything. It also
  looked for a button reading "Export CSV" that is now "Export list (CSV)", and drove the remove
  action without ever answering its confirmation, then read the un-deleted row as the app failing
  to delete. 20 of 20 now, with a new check that removing an expense **asks first**.
- **`probe-stress`** waited for the Ledger to draw rows from 1,279 seeded invoices — the Ledger
  was rebuilt on the transaction tables, so it had nothing to draw and hung for 30 seconds. Four
  more stations drove a "By invoice / By service line" toggle that no longer exists. The load
  question is asked of the surfaces that do read those invoices, and the concern the toggle
  protected — a 12-line invoice counts ONCE, and the export still carries all 12 lines — is
  asserted directly. Three more were the same stale-model failures found in round 52: money
  demanded on a client card, three billing-account numbers from the replaced blob, and a
  duplicate-import test written in our own export shape that round 52 now refuses by name.
- **`probe-live2`** could never run at all — same wrong `APP_DIR` as `emp-rig`. Fixed, and then it
  ran, and ten of its sixteen checks were asserting the 2026-08-13 **training world** (28 ledger
  rows, 198 promo codes, 10 clients, one client's billed total to the hundred) against the
  owner's REAL data. A probe pointed at the live database has to test invariants and internal
  consistency, never a snapshot of how much business the company had done on one day in August.

**⚠️ For Abdulrahman — 15 test files are sitting in the live `proposals` storage bucket.**
`probe-live2` uploaded a `live-check.pdf` into the real bucket on every run and never removed it;
they have been accumulating since 2026-08-12, in folders named after real proposal references.
The probe now deletes its own upload after checking it. **The two this session created were
removed; the 15 older ones were left alone** — they are not this session's to delete and deletion
cannot be undone. Say the word and they go.

**Two rubber stamps found inside probe-live2 itself**, the same shape watch cycles 32 and 33 keep
finding: it set `openLead` to a link's **uuid** while the app addresses a record by its own id, so
no client card ever opened — and the check "the card does not print the amount" passed because
there was no card. And it read `FIN.rows` raw rather than through `finLive()`, so it counted
soft-deleted and excluded rows and accused the app of carrying a wallet row. **Checked against the
database directly: the live ledger is clean** — 46 live invoices, zero verification rows, zero
wallet rows, zero wallet portions. The single "Wallet top-up" row it was tripping on is
soft-deleted.

**Measured on live data, reported not asserted:** 28 clients, **20 of them with nobody named on
them**; nothing currently outstanding (AR = 0); no invoice stored as `revenue_way='transaction'`
right now. These are facts about the business, not defects — a probe that fails on them would be
failing the company for doing business.

