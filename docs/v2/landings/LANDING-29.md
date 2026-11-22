# Landing 29 — a window coming back sends no read twice; the payments date runs with JIT off; every browser read logs its attempts

Base `9cf5d30` (Landing 35, CI #1617 all green) · target `v2/main` · one push.

Brief: the owner's message of 22 Nov, carrying the scope of the spec "landing-29-spec-2026-11-15" (written on
Landing 27) and Rocky's re-check of it on `9cf5d30`. **The spec file itself was not found** — not on any branch of
the repository, not on this machine, not in Drive by its name — so this landing was built from the scope written
out in the brief. Every "already done" claim was checked again on the code before building; all of them held.

## In plain words — what changed

1. **A window that comes back to Finance sends nothing twice (spec 2a) — verified, and one gap closed.**
   Landing 34 already built this; it was not built again, and no second signal was added beside it. The proof
   asked for is a new test that runs the real shell beside a whole page of Finance blocks and counts every request
   that leaves the browser:
   - the window comes back while the page is still loading → **nothing is sent**; the reads on their way stay on
     their way and each read ends up sent exactly once;
   - the window comes back to answers under a minute old → nothing is sent;
   - the window comes back to answers over a minute old → each is asked **once**, the figures stay on screen
     meanwhile (no flash of "Loading"), and coming back again while those are on their way sends nothing more.

   **The proof found one real duplicate, and it is fixed in place.** When two blocks ask for the same read and the
   second is still waiting for its turn (two reads run at a time) at the moment the first one's answer arrives, the
   second used to send the same read again. It now takes the answer that just arrived. This was independent of the
   window coming back; it is a small change inside the existing mechanism (`once` in `use-reads.ts`).
2. **The payments as-of date runs with JIT off (spec 2b).** One new migration, a setting only:
   `finance.payments_as_of()` gets `jit = off`, like the other Finance reads on the same pages. The database test
   JIT-04 has a **seventh assertion** naming `finance.payments_as_of` (the file was not renamed).
3. **Every attempt of a browser read logs one line (spec 2c).** Both browser paths — `rpc()` and the Finance reads —
   now write, for every attempt:
   `[browserRpc] fn=<function> ms=<milliseconds> outcome=ready|failed [kind=<error kind>] attempt=<n> retry=<true|false>`.
   It is the browser's twin of the server's `[serverRpc]` line. Timings only: never an argument, never an answer
   (a test holds that). An answer taken from what was kept sends nothing and logs nothing; a person who moved on
   before the answer is not logged as a failure.

Not changed, as the brief says: the Import section (1c); `FOCUS_AFTER_MS` 15 s, `FOCUS_SETTLE_MS` 400 ms, the
write guard and the visibility check in the shell; two reads at a time; the one second ask after 1.2 s; a sent
request is never cancelled; `forgetFinanceReads()`; notifications.

**This landing does not promise the 8-second bar (1d).** It promises no duplicate request and no re-send of a read
on its way.

## What the brief said, checked on `9cf5d30`

| Claim | On the code |
|---|---|
| `FOCUS_AFTER_MS` = 15,000 and `FOCUS_SETTLE_MS` = 400 in `RefetchBridge.tsx` | yes, untouched |
| Landing 34 tells a window coming back from a write (`causeNow`, `refetchPlan`, `BACK_WINDOW_MS`, `BACK_STALE_MS` 60 s, `financeWrote`) | yes |
| what was kept is cleared only on a write | yes |
| `KEEP_MS` 20 s, two reads at a time | yes |
| `finance.payments_as_of` had no jit setting | yes — on live too (read before the change) |
| JIT-04 had six assertions | yes — now seven |
| no per-attempt logging in `use-reads.ts` or `rpc.ts` | yes — now there is |
| newest migration `20261122110000` | yes — the new one is `20261122120000` |

One thing the old spec did not know: Landing 34 gave the Finance reads a 20-second limit of their own (a read with
no answer is let go and says so). It was left exactly as it is.

## Database — forward-only

| Migration | What it does |
|---|---|
| `20261122120000_finance_payments_as_of_no_jit` | `alter function finance.payments_as_of() set jit = off;` — a setting only. No body, signature, grant or type change; `grants.expected` and `database.types.ts` are unchanged. |

## Tests added

- Unit `landing-29-a-window-coming-back-sends-no-read-twice` (2 cases — the proof above).
- Unit `landing-29-every-browser-attempt-logs-one-line` (8 cases).
- Database: JIT-04, seventh assertion.
- Proofs that the tests can fail: 10 unit plants (`tests/sabotage/landing-29.mjs`) and 1 database plant
  (`payments-as-of-loses-jit-off`), each seen red with its own words.

Counts did not drop and no test was loosened: unit 1,711 → 1,721 tests (237 → 239 files); database 370 files
(JIT-04 six → seven assertions); browser suite 595 tests, as before.

## Verification — this landing's head

On the final tree, 22 Nov:

- Types, lint, formatting: clean. The 19 house checks: green. Registry and generated database types: in step.
- Unit tests: 1,721 of 1,721 (239 files).
- Database tests: 370 of 370 on a fresh database; JIT-04 green with its seventh assertion.
- Production build: exit 0 (the browser suite runs on it).
- Browser tests on a fresh database: 584 passed, 0 failed, 11 skipped, 595 in all. Landing 35 read 585 / 10: the
  one extra skip is an older test that skips itself before nine in the morning in Riyadh (`when-chips`), and this
  run was at 04:40 Riyadh time. No test was changed.
- Proofs that the tests can fail: database 555, unit 738, checks 33, lint 2 — every plant red, as it must be; the
  browser proof for "a window coming back asks Finance again" — red, as it must be. No stale proof.

## Live figures to hold

Read from the live database before the push (read-only): Finance for 2026 — typed and imported invoices
350,750 / 177,170 / 120,680 (Revenue / Cost / Profit), which with the imported rows (1,200 / 100 / 400) is the
351,950 / 177,270 / 121,080 of the brief; provisional 53,600. The migration changes a setting, not a figure; the
same read is made again after it is applied and reported to the owner.

## Seen, not changed

- The spec file `egm-fix/landing-29-spec-2026-11-15.md` is not in the repository; if it holds anything beyond the
  brief, it was not built.
- Section 6's bar is proven in unit tests on the real shell bridge and the real read code, with the database
  stood in for; the browser suite's existing "a window coming back" test (Landing 34b) still passes and still goes
  red under its sabotage.
