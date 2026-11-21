# Landing 35 — the seven fails of the full sweep (21 Nov 2026)

Base `371c6c4` (Landing 34b) · target `v2/main` · one push.

Scope: the owner's full sweep — 58 checked, 51 clean, 7 failed — and the "reflection" check that the sweep could
not do because the partner Finance tab never loaded.

## In plain words — what changed

1. **The Board is a board.** `?layout=board` now shows one column per status, side by side, in one row that
   scrolls sideways inside its own frame; each column scrolls on its own; on a phone a column snaps into place; in
   Arabic the columns run right to left. Two causes: the columns were drawn in a grid that wrapped them under each
   other, and a saved default view quietly sent the address back to List. Cards are not dragged — a task changes
   status from its status menu, as before.
2. **Partner Codes tab, 3. Partner Finance tab, 5. Finance sections, 6. Tasks Team list — one family, one cause.**
   The database was doing the same work many times over for every read, and the smallest Supabase machine queued
   behind it until the 8-second limit cut the read off ("57014"). See "What made it slow" below. Nothing about what
   the pages show changed: 519 reads compared before and after return the same answer, to the character.
4. **Today's three fills up.** Each group is still led by its own rule (Important — starred; Short — due today or
   within 2 days; Maintenance — the rest), and is now topped up from the person's other own open tasks until it
   holds three: Important takes the longest overdue next, Short takes the next due days. A person with nine or more
   own open tasks sees 3 + 3 + 3; the three shown do not change on a reload. The captions say so in both languages.
   It was always each person's own tasks — the seeded TEST tasks only carry look-alike titles.
7. **Tasks search filters as you type** (a quarter of a second after the last key; Enter still works).

Also in this landing:

- **A client's achievements are listed on the client's record** (Related tab), newest first, only what the reader
  may see. This is the "add an achievement and see it on the client" half of the reflection check.
- **Two repairs to the checks themselves** (run 1616): one Tasks test read a list that is capped at 200 rows and
  broke on a well-used database — it now reads its own three tasks by a made-up word; and the job that proves every
  browser test can fail ran out of its 120 minutes in 3 parts — it now runs in 5.

## The reflection check (asked for once the partner Finance tab loads)

- **A finance detail edited on a client page shows on Finance — yes, both ways.** The one finance detail that can
  be edited on a client page is its Client ID. A browser test adds a Client ID on a client's page, and the
  client's Finance tab and the Finance page then show the same Revenue, Cost and Profit, difference 0.
- **An achievement added shows on the client — yes (new, see above). On Finance — no, on purpose.** An
  achievement's value is "not revenue" by the standing money rule (FIX-06 / D29), so no Finance figure moves. Showing
  achievements on Finance as a separate, non-money list is the owner's call — not built.

## What made it slow — measured, not guessed

The data is small (about 150 invoices, 120 tasks, 44 organisations). The time went to repeated work:

1. **"Who is asking" was worked out from scratch on every call** — and every read asks it several times, some
   once per row.
2. **The small helpers each list calls per row** (last activity, task flags, stale-on …) had the same fault.
3. **Finance worked the money rows out again for every mention** — 2 to 12 times in one read; the codes list did
   it once per code (58 times for 22 codes).
4. **Each invoice was matched to its organisation three times**, and the wallet and commission words were read
   again for every line.
5. **The Finance health check compared every invoice with every invoice.**

After the change, on a test database of live-like size (made-up data), first call / warm call, in milliseconds:

| Read | Before | After |
|---|---|---|
| Partner Finance tab (ledger for one organisation) | 593 / 434 | 145 / 70 |
| Partner Codes tab (organisation summary) | 316–558 / 194–321 | 135 / 63–84 |
| Codes list | 4912 / 3506 | 79 / 67 |
| Income by service | 811 / 617 | 151 / 89 |
| Finance figures for a period | 334 / 263 | 136 / 64 |
| Counted by month | 278 / 287 | 124 / 43 |
| Finance health | 295 / 225 | 130 / 79 |
| Tasks list | 337–389 / 283–344 | 85–92 / 54–57 |
| Partners list | 202 / 163 | 57 / 20 |

At ten times today's data the worst read is 0.72 s (before: 2–9 s, one cut off at 20 s).

**Said plainly:** live is slower than the test machine (about 2× per call, more on a first call). The reads that
took 2–4 s on live should now take roughly 0.3–1 s — to be confirmed on live after this lands. The live machine is
still the smallest size; for today's data that should be enough, for ten times the invoices it would not be. The
lasting answer for growth is to store each invoice's match and cost when it is saved instead of working it out on
every read — a landing of its own, not done here.

## Database — forward-only

| Migration | What it does |
|---|---|
| `20261122090000_perf_identity_plans_are_kept` | The 20 "who is asking" functions keep their plan; asked once per function, not once per row. No check weakened or moved. |
| `20261122090100_perf_finance_money_rows_once` | The money rows are worked out once per mention from one kept plan; the definition lives in `finance.money_row_calc`. |
| `20261122090200_perf_finance_reads_one_pass` | Each Finance and Codes read takes the money rows once. |
| `20261122090300_perf_row_helpers_keep_their_plans` | The 30 per-row helpers, bodies word for word, keep their plan. |
| `20261122090400_perf_finance_checks_by_key` | The health check finds an invoice's units by key. |
| `20261122100000_my_day_todays_three_fill` | Today's three is topped up to three per group. |
| `20261122110000_partner_achievements` | The read behind the achievements list on a client's record. |

No data is changed by any of them. No pushed migration was edited. A future change to the money rows goes in
`finance.money_row_calc`.

## Tests added

- Database: `SPD-01` (Finance reads take the money rows once and answer fast), `SPD-02` (who is asking),
  `SPD-03` (the lists and their row helpers), `WLT-01` (wallet and commission lines, English and Arabic),
  `ACH-15` (a client's achievements); `THREE-01` rewritten for the fill rule.
- Unit: the board is columns side by side (15), the search filters as you type (15), the Related tab lists the
  achievements (12).
- Browser: `landing-35-tasks` (3), `landing-35-todays-three` (1), `landing-35-reflection` (2).
- Proofs that the tests can fail: 14 new database plants, 42 unit plants, 7 browser plants; four older plants
  re-aimed at the new migration. No test was loosened.

The three speed tests carry a clock (2 s, about twenty times the measured time).

## Verification — this landing's head

On the final tree, 21 Nov:

- Types, lint, formatting: clean. The 19 house checks: green. Registry and generated database types: in step.
- Unit tests: 1,711 of 1,711 (237 files).
- Database tests: 370 of 370 on a fresh database.
- Browser tests on a fresh database: 585 passed, 0 failed, 10 skipped (as before).
- Proofs that the tests can fail: database 554, unit 728, checks 33, lint 2 — 0 failures; the 11 new or changed
  browser proofs — 0 failures. No stale proof.

One thing found on the way: a Finance-tab browser test failed once on a fresh database. Cause: two tests in that
file start together and both imported an invoice with the same made-up tax-invoice number; the database keeps a
tax-invoice number once (rightly), so one test lost an invoice. Each test now makes its own number. It was not
caused by the speed work, and the app is unchanged.

## Seen, not changed (say if you want them)

- Finance shows no achievements (by rule; see above).
- A person with fewer than nine own open tasks cannot show 3 + 3 + 3. On live today TEST Member and TEST Viewer
  own 4 open tasks each, TEST Head 7, TEST Commercial 13, TEST Manager 28. No live data was changed.
- A record's "Last activity" in its header does not count achievements.
- The Achievements page's rows do not name the organisation.
- The words "See all / See fewer" for the old board remain in the word lists, unused.
- The first click after a pause is still the slowest (the database opens a new connection).

## Live check that could not be done from here

The live site cannot be opened from this session. After the migrations are applied on live, the slow reads are
measured again on the live database, read-only, and the result is reported to the owner.
