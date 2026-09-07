# The 50 ungated warnings, read one by one

`scripts/qa/check-probe-integrity.mjs` had been printing ~50 warnings that nobody had to act
on. A warning nobody must act on is decoration. Watch cycle 35 read all of them and gave each
a verdict: **promote to a build failure, fix, or say plainly why it is fine.**

Cycle 34 had already learned this the hard way — `PORT_DUP` sat in this same list for six
cycles while the collisions it named were being written off as "environmental".

## Done in cycle 35

**CWD_PATH (3 hits, 2 files) → promoted to a build failure, both files fixed.**
`probe-audit-undo` read `js/63` and `probe-client-documents` read `js/67` and `js/71` from an
absolute path under a home directory that belongs to nobody on this machine. The earlier note
in the checker assumed those probes had therefore never run. They had — an earlier session had
left a symlink at that path pointing back at the repo. That is worse than dead: the three
checks read the **repo** even when the run was pointed at a sabotaged copy through `APP_DIR`,
and sabotage is the only way a probe is ever verified. Both now resolve the tree from the
probe's own location. Re-verified by sabotage: breaking one Arabic refusal string in a copy
now fails the probe (it did not before), and adding a second `amountInWords` to a copy of
js/71 now fails the other. A path outside the probe's own tree is a build failure from here on.

**NO_FAIL_SIGNAL, the seven that the battery actually runs → fixed. Budget ratcheted 43 → 35.**
`probe-live2`, `probe-mega`, `probe-notes`, `probe-round8`, `probe-round9`, `probe-stress`,
`sweep-consistency` each counted their failures, printed the count, and exited 0. The runner
reads exit codes. **Every regression those seven could see has been reported to the battery as
a pass for as long as they have existed** — 152 checks' worth. They exit on their own count
now; all seven are green on a real run (0 failures out of 21/49/17/14/20/31/n), and a
deliberately false check makes one exit 1, so the wiring is proved rather than assumed.

**LITERAL_TRUE, the two in battery probes → fixed.** `probe-live2` pushed a business finding
for Abdulrahman through the assertion helper with a literal `true`, so an unchecked number
printed as PASS and was counted in the pass total; it is a `REPORT` now. `probe-mega` did the
same for a check its seed could not set up; that is a `SKIP` now. Neither is counted as a pass.
A check that did not run has not passed.

## Left, with a verdict each — 35 files, none of them in the battery except where marked

### Report tools with no assertions — legitimate, but must stop being called probes (17)

`audit-crm-full`, `audit-proposal-client-pickers`, `diag-audit-logins`, `diag-ledger`,
`diag-payload`, `diag-tier`, `diag-v48`, `diag-writes`, `nav-check`, `verify-pages`,
`verify-savepages`, and — in the battery — `manual-visual-sweep`, `probe-password-recovery`,
`sweep-buttons`, `sweep-language`, `sweep-nav`, `sweep-pages`.

These print findings for a person to read. They are not broken. The problem is that they are
counted, run and reported exactly like probes, so the battery's "79 green" includes six files
that **cannot go red**. Verdict: teach the checker the difference by intent rather than by
name — a file that never calls an assertion helper is a REPORT — list them explicitly, and
have the battery print them under a separate heading instead of as passes. `sweep-buttons` is
the one to look at first: it costs 363 seconds of every battery run and cannot fail.
`probe-password-recovery` is misnamed — it is a report, and its name promises a probe.

### Counts its failures and exits 0 — the same defect just fixed in the battery seven (18)

`attack-wave2`, `attack-wave3`, `probe-cowork-fixes`, `probe-delete`, `probe-firstlogin`,
`probe-freeze`, `probe-handover`, `probe-newfeatures`, `probe-phone`, `probe-race-final`,
`probe-rls-matrix`, `probe-roles`, `probe-round11`, `probe-teamwork`, `verify-final`,
`verify-literal`, `verify-manager`, `verify-teamscreen`.

Verdict: **the same one-line fix, and then decide whether each belongs in the battery.** They
were left this cycle for one reason — none of them is in `fullrun.txt`, so unlike the seven
above they are not currently telling anyone anything false. They are one-off audit scripts from
earlier rounds. Two questions per file, in this order: does it still describe the app as it is
today, and if so why is it not in the battery? A probe worth keeping is worth running; one that
is not worth running should be deleted, not left to rot into a false green.

`attack-wave3` also carries two `LITERAL_TRUE` hits (lines 84, 95) — read them with the file.

### The remaining tells

`NO_FAIL_SIGNAL` is now the only ungated tell left. `CWD_PATH`, `PORT_DUP`, `LITERAL_TRUE` in
gated probes, `TAUTOLOGY` and the gated set are all build failures. When the 18 above are fixed
the budget can go to 17, and when the reports are separated out it can go to 0 and the tell can
be promoted like the rest.

---

# Watch cycle 36 — the rest of the list, and what reading it actually found

## The eighteen exit-0 files: fixed, but the reason they were never in the battery is the finding

All eighteen now exit on their own failure count. That was the easy half. The question the cycle-35
list told cycle 36 to ask first — *why is this probe not in the battery?* — has one answer for
every one of them, and it is not neglect: **they cannot run here at all.** Fifteen import
`emp-rig.mjs`, which signs in as a real member of staff and reads the passwords from `DB_PW_*`
environment variables — never from the file, because CLAUDE.md forbids the team's real passwords
from being in this repository. The other three talk to the production database directly.

So they were excluded for a good reason. What nobody had noticed is what they do when run
without those credentials.

## The loud guard that 36 of 49 callers never called

`emp-rig.mjs` has had, from the beginning, a function whose own comment says it exists to *"fail
loudly rather than silently testing nothing"*: `requirePw(key)` throws when the password is
missing. **36 of the 49 probes that import the rig never call it.** They read `TEAM.<who>.pw`
directly, get `''`, and sign in as nobody.

Measured, not inferred. `probe-teamwork` run here with the rig unchanged:

```
FAIL · both people saved at the same moment without an error — ["missing","missing"]
FAIL · neither person's work was wiped by the other — {"a":null,"b":null,"total":65}
FAIL · the company list is still whole (30) — 65
FAIL · the lead is handed back to Raad (world restored) — null

FAILS: 8 / 8          ← every check failed
EXIT=0                ← and it reported success
```

Eight of eight failing, exit 0. Not because the app is broken — because it signed in with an
empty password, and the file then told its runner everything was fine.

**Fixed at the chokepoint, not at the 36 call sites.** `signIn()` is the one function every one
of them goes through, so it now refuses an empty password with the reason in the message. A guard
a caller can forget to call is not a guard. The same probe now stops on the first sign-in with
*"was given an EMPTY password … Refusing rather than testing nothing"*, and exits 1.

The exit-code fixes still matter for whoever runs these **with** the credentials, which is the
only context where they mean anything. They could not be run here to prove it end to end, and
that is recorded rather than glossed: each one's counter was checked against the failure count
the file itself prints, and the pattern is the one cycle 35 proved bites (a deliberately false
check makes it exit 1).

## Where battery membership lives — it did not live anywhere

Until this cycle the battery's contents existed only as `/tmp/fullrun.txt`: a scratch file that
dies with the container, cannot be diffed, cannot be reviewed, and gives no answer to "why is
this probe not in the battery?". That is how eighteen exit-0 probes sat outside it unnoticed —
and how `probe-deeplink-boot-race`, written by the Code session hours earlier to guard a live
defect, was not being run by anything.

Now: **`scripts/qa/battery.txt`** (82 entries) and **`scripts/qa/battery-excluded.txt`** (102,
each with a one-line reason), and `check-probe-integrity` fails if a probe is in neither, in
both, or named in a list but missing from the tree. Sabotage-verified in all three directions.
A probe in neither list is a probe nobody decided about.

Six entries in the excluded list are flagged for someone else to answer: the `generator-qa`
probes (`probe-contract`, `probe-price-offer`, `probe-service-fees`, `probe-company-profile`,
`probe-tender`, `probe-generator-brand`) use the mock and look runnable, but they belong to the
document Generator track and **nobody in this session has ever run them**. That task should
confirm they still pass and say who runs them.

## Still open: the 17 report tools

Unchanged from cycle 35 and now the entire remaining `NO_FAIL_SIGNAL` budget (43 → 35 → 17).
Six of them sit in the battery and cannot go red, so the battery's green count includes six
files that can only report — `sweep-buttons` costs 363 seconds of every run and can only report.
They need a category, not an exit code: teach the checker that a file which never calls an
assertion helper is a REPORT, list them explicitly, and have the battery print them under their
own heading rather than counting them as passes. Then the budget can go to 0 and
`NO_FAIL_SIGNAL` can be promoted to a build failure like the rest.
