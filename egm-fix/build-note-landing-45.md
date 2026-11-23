# Landing 45 — the enrichment script runs as the TEST Admin through the owner's switch (tools only)

23 Nov 2026 · base `62027dbc` (Landing 44) · target `v2/main` · one push.

## Why

Landing 42's script signed in with the TEST Admin's own e-mail and password. In the live workspace the TEST users have
none: the code that made them (`20261028100000`) makes people only, and V656 says none can sign in by password or
link. So the script could not run against live with any account that exists.

## The change

Script only: `v2/scripts/fixtures/enrich-test-data.mjs` and its local proof. No product code, no migration, no access
or setting change.

- It signs in as the **Admin account** — the one account on the test-user switch list (V656) — and refuses an account
  that is not an admin or is marked TEST. `ENRICH_EMAIL` and `ENRICH_PASSWORD` are now that account's.
- As the Admin account it reads who the TEST users are (the people list needs the admin role, which a switched sign-in
  does not have), then switches this one sign-in to the TEST Admin with the app's own door `api.test_switch_start`. It
  stops unless the app then answers as the TEST Admin. From there every read and write is the TEST Admin's, and every
  log entry names the Admin account behind it.
- **Whatever happens** — done, refused or a fault — it switches back with `api.test_switch_end`, reads who it is again
  and prints `switched back to …: yes`, then signs out. If the switch-back is refused or cannot be proven, it says so in
  capitals, names the remedy (sign the account out of every device) and ends with a failure.
- An account that is not on the switch list is refused by the switch itself, before anything is read as a TEST user.
- Everything else is Landing 42 unchanged: the approved list, the exact Finance change, "adds only what is missing",
  `--clean`.

## Verification (local test database only, made-up data)

`node scripts/fixtures/enrich-prove-local.mjs` on a database built from zero. The proof now builds the live shape: a
made-up Admin account (admin, not TEST, with a sign-in) on the switch list, and four TEST people with **no** sign-in
of their own. Starting from figures that are not zero (revenue 1,234 · cost 234 · profit 1,000):

- plan: writes nothing; prints revenue 1,234 → 17,234, cost 234 → 2,634, profit 1,000 → 4,600
- `--write`: 144 writes; the figures moved by exactly **+16,000 / +2,400 / +3,600**; 9 open tasks each for TEST
  Head, Member and Viewer, 3 blocked, all 6 test invoices linked to their TEST client, 1 achievement from a task
- the log: 148 entries made while switched, every one as the TEST Admin with the Admin account named (0 otherwise)
- a second `--write`: nothing to add, 0 writes, figures unchanged
- `--clean`: everything removed, nothing left under the script's names, figures back at **1,234 / 234 / 1,000**
- a run refused part-way, after the switch (one test invoice on its own): it still switched back
- the account taken off the switch list: refused by the switch (`test_switch.not_allowed`), nothing read or written
- after **every** run, the refused ones included: `switched back … : yes`, and the database holds **0** sign-ins left
  switched to a TEST user

Sabotage, each on a fresh database, each turning the proof red: (1) never switching back — "the run did not prove its switch back"; (2) switching back only when the run went well — red at the refused part-way run; (3) claiming the switch back without doing it — "THE SWITCH BACK COULD NOT BE PROVEN"; (4) never switching — "the writes were not logged as TEST Admin with the Admin account named". The script was restored after each.

Full checks: types, lint and format clean; the 19 house checks green; gen-types and registry up to date; unit 1,821 passed; database 381 passed, 0 failed; browser 605 passed; unit/check/lint sabotage 811 sabotages, 0 failures; tree clean.

## Known, not changed here

`--clean` removes the TEST organisations, but a removed organisation keeps its client ID, so a `--write` after a
`--clean` on the same workspace is refused (`identifier.held`). Landing 42 had this too. It does not touch the first
live run (write once); a re-run after a clean needs the client IDs changed first.

## How to run it against the workspace (only when Rocky says so)

From `v2/` of a checkout of `v2/main`, with the four settings in the shell, never written to a file —
`ENRICH_API_URL`, `ENRICH_PUBLISHABLE_KEY`, `ENRICH_EMAIL`, `ENRICH_PASSWORD` (the last two: the Admin account's):

1. `node scripts/fixtures/enrich-test-data.mjs` — the plan; nothing is written. Its last line must be
   `enrich: switched back to …: yes`.
2. `node scripts/fixtures/enrich-test-data.mjs --write`
3. To take it all back: `node scripts/fixtures/enrich-test-data.mjs --clean`
