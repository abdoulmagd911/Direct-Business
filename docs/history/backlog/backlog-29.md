## 2026-08-25 (round 3) · A commit's durability can no longer depend on the browser staying alive (M16)

The oversight session (separate sandbox, direct Supabase access, no filesystem in common with
this one) ran a deliberate single-invoice test of the M15 importer end to end and reported two
things: the good news first — ingest, the two-file join, and the preview were all correct even
at minimum scale, matching full-scale behavior exactly. Then the actual blocker, explicitly
flagged as theirs, not this app's: `v65Commit()` failed every single time from their side with
`Failed to execute forEach on Headers: The provided callback is no longer runnable` — their
browser-extension injection context dying mid-request, the same root cause as the dead
file-I/O layer they'd already documented the day before, and explicitly NOT the M13 `year` bug
(they never got far enough to reach the database). Verified on their side directly against
Supabase: the test invoice was untouched — `cost_sar` still 0.00, `updated_at` unchanged —
a clean failure with no partial write, but also proof the OLD commit path (several sequential
`.insert()`/`.upsert()` HTTP round trips, one per 50-row batch) gave that kind of mid-flight
context death a wide window to land mid-batch on a real, larger import.

They asked for a judgment call, not a vote: fix the client's own fetch to survive a dying
context (avoid holding a live `Headers` reference across an `await`), or move the commit
server-side so the browser context becomes irrelevant to whether the write lands. Worked through
where their actual failure occurs before picking: it's inside the browser/extension's own
fetch/Headers internals — code neither this app nor its author controls or wraps either way — so
no amount of client-side defensive coding reaches it. That ruled out option (a). Chose (b), but
narrower than the literal ask: not a separate Deno edge function, a plain Postgres RPC
(`SECURITY INVOKER`, so it runs as the calling user and the existing `can_edit_page('finance')`
RLS policy still applies — no privilege escalation). A function on the same PostgREST/RLS layer
every other write already goes through gives the identical two guarantees a dedicated edge
function would (one round trip, one atomic server-side transaction) with materially less new
operational surface. This also directly answers the oversight session's own earlier question
about where M15's join state should live — they're the same underlying problem, an importer
that lived entirely inside one fragile browser session, so it made sense to fix both with one
mechanism rather than patch them separately.

Built `fn_commit_finance_import` (new migration `finance_commit_import_rpc`) — one Postgres
function taking the already-resolved insert/update arrays plus this session's pending M15
capture rows, and writing all of it (invoices, capture lines, capture gates) inside ONE
transaction. `jsonb_to_recordset`'s explicit column-type lists are the SQL-side equivalent of
`pickWritable()`'s M13 allowlist — a stray key is silently ignored, never fails the statement,
which is stricter and kinder than the direct-REST path it replaces. True atomicity (the whole
batch lands or none of it does) fell out of this as a side effect, strictly stronger than the
old per-50-row-batch behavior. `window.v65Commit()` (`js/65-universal-importer.js`) now makes
exactly ONE `c.rpc('fn_commit_finance_import', {...})` call; `flushPendingCapture()` is gone —
its job is now done server-side, inside the same transaction, on the same request.

Proved the actual guarantee, not just argued for it: `scripts/qa/probe-commit-survives-context-death.mjs`
intercepts the RPC request at the network layer from the TEST PROCESS itself (not from inside
the browser page — the forward-to-server `fetch()` that does the real write runs in Node, so
closing the browser page and its entire context cannot cancel it), destroys the whole browser
context the instant the request leaves the page and before any response could possibly come
back, then reads the database directly with no browser involved at all and confirms the write
landed anyway. Sabotage-tested the other direction too: `v65Commit()` was temporarily reverted
to the old direct-REST path (never calling the RPC), and the probe correctly failed to observe
the expected request — the very first attempt hung indefinitely rather than exiting cleanly,
since the sabotage caused a promise the probe awaits to never resolve; treated as valid
confirmation, and a 15-second timeout guard was added to the probe immediately after so a REAL
future regression reports cleanly (exit 1) instead of hanging the suite. Restored and diffed
byte-identical, re-ran green. Also updated `scripts/qa/probe-false-success-commit.mjs` (both
scenarios now watch/intercept the RPC endpoint instead of the old direct-insert endpoint —
Scenario 2's forced-failure now returns a realistic Postgres unique-constraint error instead of
the now-unreachable year-column error text) and `scripts/qa/mock-supabase.mjs` (new
`fn_commit_finance_import` RPC dispatch case mirroring the real function's allowlist and
delete-then-insert/upsert semantics for the two M15 capture tables).

Verified: `node -c` on every touched file, `check-structure.mjs`, `check-decisions-wired.mjs`
(M16 added as its own ACTIVE rule, all citations resolve; also fixed two stale-citation false
positives from the checker's JS-only citation regex being unable to verify SQL/Postgres-side
function names — `fn_commit_finance_import` and `jsonb_to_recordset` cited without trailing
`()` so they read as decorative rather than checkable), the full probe battery including the
new `probe-commit-survives-context-death.mjs` and the updated `probe-false-success-commit.mjs`
— all green. `audit-finance-tabs.mjs`'s EN tab-switch timing check flaked at ~811-815ms against
an 800ms threshold; reproduced the identical flake at the identical magnitude against the prior
pushed commit (before any of this round's changes, via `git stash`), confirming it's a
pre-existing, unrelated timing flake and not a regression from this round.

## 2026-08-25 (round 2) · Owner brief — UI density/copy pass, client name aliases (M14), expense-capture persistence (M15)

Three workstreams from one owner brief, after M13 (below) shipped. Order below is build order,
not priority — the owner marked the importer (Workstream 3 / M15) as the one he cares most about.

**Workstream 1 — UI density and copy.** Fixed the four named offenders on the Import tab: the
stale green "New: this screen now reads Direct Payments' own Invoice Export file directly"
banner (`js/41-money-in.js`) — announced a feature that stopped being new weeks ago and sat
there permanently once injected, removed outright; the raw 14-column CSV header dump plus the
"last two columns are optional" filler (`js/16-finance-ledger.js` `rImport()`) — stale prose
explaining the importer's own plumbing (v65's real signatures auto-detect columns; nobody needs
to read a hand-typed spec), removed; the safety-promise sentence ("nothing is written until you
confirm the preview") kept, shortened, per B6. Biggest offender: the preview printed the
identical Takamol exclusion sentence once per excluded row — real case, 20 times. Built
`groupDupes()` (`js/65-universal-importer.js`) — groups `clientExcludedDetail`/
`costCaptureDetail` entries by their own identity and collapses identical rows into one line
with a count ("Takamol for Business Services (#7: reason) — 20 rows"); the reason text itself
is never shortened or dropped, only the repetition. Same collapse applies to the held-back
list. Also lightly tightened the exclusion-list and billing-profile-grouping card copy in
`js/62-finance-guardrails.js` while already in that file for M14. Checked the rest of Finance
(Overview, Ledger, Report Builder, income-by-service, Expenses) for the same pattern —
genuinely clean already, reported as such rather than inventing edits. Sabotage-tested: the
collapse was reverted to a plain join, `scripts/qa/probe-import-preview-density.mjs` failed
(exit 1) reproducing the sentence repeating 5 times, restored and diffed byte-identical.

**Workstream 2 — company grouping (M14).** Investigated before building: queried
`finance_client_links` directly and found the underlying business-linking for all three
duplicate pairs (Client M, Client Q, Client R) was ALREADY correct — every spelling variant already
resolves to the same `business_id`, automatically, via the existing auto-linker. What was
actually missing was a deliberate, visible, reversible NAME decision, plus a durable place for
it to live so a future import doesn't recreate the split — not a data-linking fix. Owner then
confirmed the exact canonical names and that all three pairs (not just Client M) should merge; Public
Security and Client RC need nothing, they're already single and clean. Built
`window.finGroupCheck()` (`js/62-finance-guardrails.js`) — an exact-shape twin of
`finExclusionCheck()`, storing canonical name + aliases (`DB.settings.financeGroupMap`),
undo-not-delete. `finCanon()` (`js/16-finance-ledger.js`) consults it FIRST on every
client_group→display-name resolution, so the mapping applies live to every row that ever
carries a mapped alias — past AND future, zero backfill. Built the "+ Add alias" admin UI: a
live picker showing each candidate's real invoice count and total (a genuine preview, not a
blind text field), a confirm dialog summarizing the merge before it applies, and Undo/Redo
buttons with full visible history. Auto-suggest surfaces candidates two ways — same normalised
spelling (`norm62()`, catches a same-script rename like Client Q automatically) and same
`finance_client_links` business_id (catches a cross-script rename like Client M's, which the
automatic linker had already silently resolved at the business level). Added to
`check-decisions-wired.mjs` coverage as M14 — its citations resolve like every other ACTIVE
rule's. Sabotage-tested: `finCanon()`'s `finGroupCheck()` consultation was removed,
`scripts/qa/probe-client-group-map.mjs` failed (exit 1) reproducing the reported split, restored
and diffed byte-identical.

**Workstream 3 — the importer, M15.** The owner's core requirement, verbatim: drop one updated
file and have it "spread automatically" without re-supplying the others. Design question
answered before building, as asked: the raw captured facts now live in Supabase
(`finance_expense_lines_capture` / `finance_expense_gate_capture`, new migration
`finance_expense_capture_persistence`, RLS-matched to `finance_invoices`), not only in browser
memory — page-lifetime memory (M9) was the right instinct but didn't survive a reload or a new
session. `loadCaptureBaseline()` loads both tables once per page session and seeds
`EXPENSE_JOIN` BEFORE any file in a drop is dispatched — an ordering bug in the first version
(baseline loaded AFTER a fresh drop's rows landed) silently summed old and new captures
(1,000 + 1,500 = 2,500 instead of 1,500), caught by the new probe before shipping, not after.
Lines are delete-then-insert per touched transaction_ref on every drop (a re-export is that
transaction's complete current line list, never appended to); gates are upsert-by-transaction_ref
(latest wins) — a fresh drop's data now properly supersedes an EARLIER session's capture instead
of being flagged a same-session conflict, matching the owner's incremental-update ask, while
still catching a genuine self-conflict WITHIN one session's drop(s). Written only on Confirm,
via `v65Commit()` (M16 below later folded this write into the same server-side transaction that
writes the invoices themselves), so "nothing written until confirmed" holds for these tables too. The multi-file "select several, check, apply together" control itself was
already built in M11/M12 (`#finFile.multiple`, `v65CheckFiles()`) — confirmed by re-reading the
code rather than assumed, so M15 is purely the persistence layer underneath an existing control,
not a second one. New probe `scripts/qa/probe-expense-capture-persistence.mjs` drives TWO real
browser sessions (`page.reload()`, not just a JS variable reset) against the same mock database
— session 1 drops both files and confirms; session 2 reloads, drops ONLY an updated lines file,
and asserts the cost updates correctly with the gate file never re-supplied, plus a direct read
of both capture tables proving delete-then-insert (never append) on re-export. Sabotage-tested
twice: the ordering fix reverted (fails as 2,500), and the line-replacement clear reverted
(fails as 2,500 again from a different cause) — both confirmed exit 1, restored, diffed
byte-identical.

Verified across all three workstreams: `node -c` on every touched file, `check-structure.mjs`,
`check-decisions-wired.mjs` (M14 + M15 both resolve, 85 citations total across 29 rules), the
full probe battery including all four new probes
(`probe-client-group-map.mjs`, `probe-import-preview-density.mjs`,
`probe-expense-capture-persistence.mjs`, plus the existing expense/tax-invoice/import-wiring
suite re-run clean against the new async ordering) — all green, EN+AR, zero console/JS errors.

## 2026-08-25 · CRITICAL — a commit reported success while writing nothing; fixed the payload leak and the reporting itself (M13)

Worse than any crash so far, in the oversight session's own words. The owner ran a real
import and read "Done. Imported 0 new, updated 27." — a green success headline — and walked
away believing cost was loaded. Checked in Supabase immediately after: 46 invoices, with_cost
0, cost 0.00, profit still equalling revenue. Nothing had landed. The error text was actually
present in the same message ("cannot insert a non-DEFAULT value into column \"year\""), but
buried under the success headline, printed from the INTENDED batch size, not from anything the
database confirmed — the owner's own diagnosis was exact and it was right.

**Root cause, verified against the live schema (`information_schema.columns`), not guessed.**
`finance_invoices.year` is `GENERATED ALWAYS AS (EXTRACT(year FROM invoice_date))::integer
STORED` — the only generated column on the table (checked every sibling: `month`/`quarter` are
plain columns the `finance_derive_fields` trigger recomputes unconditionally regardless of what
is sent, so they were never a risk). Two update-payload builders in
`js/65-universal-importer.js` — the tax-invoice update (`processTaxInvoiceBatch()`) and the
cost-join update (`resolveExpenseJoin()`) — built their write by spreading a full,
already-fetched `finance_invoices` row (`Object.assign({},existing,{...delta})`) straight from
`FIN.rows`, a real `select *`. Every field on that live row rode along into the write,
including `year`. PostgREST sends one batch as one SQL statement, so a single row carrying
`year` fails the WHOLE batch at once — exactly why all 27 failed together, never a partial
success.

**Fixed on two independent axes, per the owner's own instruction that the reporting bug is the
more important half.**

1. **`pickWritable()`** — a new explicit allowlist (`WRITABLE_INVOICE_FIELDS`) that every
   insert/update payload is now built from, replacing every site that used to spread a full row
   object. This makes the whole CLASS of "a DB-managed column rides along into a write"
   impossible going forward, not just this one instance — exactly as asked.
2. **`v65Commit()`'s reporting** — every insert/upsert now chains `.select('id')` and counts
   what the database actually returned. Any batch error flips the whole headline to a red
   FAILED, naming the confirmed-written count (0 for a failed batch) side by side with the
   intended count, explicitly labeled "intended" — never a success count derived from what was
   merely sent.

`scripts/qa/mock-supabase.mjs` was taught to reject any `finance_invoices` write payload
carrying `year`, mirroring the real Postgres constraint — before this the mock had no way to
catch this class of bug at all, which is exactly how it shipped through an otherwise thorough
regression suite (including the tax-invoice and cost-join probes built two days earlier)
completely undetected.

**Verification, exactly as asked.** New probe `scripts/qa/probe-false-success-commit.mjs` runs
two scenarios: (1) a clean commit — intercepts the real outgoing write body and asserts `year`
is never present, then confirms via `FIN.rows` that the reported "updated 1" genuinely landed
in the database; (2) a forced database refusal — intercepts the network call and returns the
exact real Postgres error text, independent of whether fix (1) holds, and asserts the UI
reports FAILED with a written count of 0, the intended count shown separately and explicitly
labeled, the real error text surfaced, and the target row byte-for-byte unchanged. Sabotage-
tested exactly as requested: `pickWritable()` was temporarily reduced to an identity
passthrough (reintroducing the exact original leak), the probe was run and failed (exit 1)
reproducing the bug class — and notably, even with the payload bug reintroduced, the reporting
fix (2) still correctly reported FAILED/written-0 rather than a false success, direct proof the
two fixes are genuinely independent defense-in-depth, not one fix wearing two hats. The
passthrough was then restored and the file diffed byte-identical to the pre-sabotage backup.

**A gap in the mock itself, worth naming.** `probe-tax-invoice-capture.mjs` and
`probe-expense-report-capture.mjs` — built two days earlier and passing at the time — never
caught this, because the mock accepted any payload shape; it had no model of which columns are
generated. Real-schema fidelity gaps like this are exactly how a bug survives a thorough-
looking regression suite. Both probes were re-run against the now-schema-aware mock after this
fix and still pass clean.

**Open, not yet re-confirmed:** the oversight session separately reported the owner hit the
M12 import-tab wiring race AGAIN, after the M12 fix was already deployed (their own note that
"your improved [finParse rejection] message helped him recover" confirms the M12 deploy was
live at the time). `probe-import-tab-wiring.mjs` still passes clean against the exact
"already-on-Finance, click Import" path M12 was built to fix, and no second code path that
sets `FIN.tab` while skipping both wrapped `render()` and wrapped `finGo()` was found on
inspection (checked every `FIN.tab=` assignment site and the `/finance` deep-link boot route in
`js/16-finance-ledger.js`). Left open rather than guessed at — asked the oversight session for
the exact navigation path and a console-state dump (`#finDrop.__v65`, `#finFile.multiple`,
`Check file`'s onclick) the next time it recurs, the same rigor the original M12 report carried.

**Also surfaced, not acted on:** a Supabase advisory flagged `RLS disabled` on
`public.finance_cogs_expenses_archive_20260822` (an archive table) — anyone with the anon key
can read/write it. Not touched here (enabling RLS without policies blocks all access); flagged
to the owner for a decision.

Verified: `node -c` on every touched file, `check-structure.mjs` (63 files),
`check-decisions-wired.mjs` (M13's own citations all resolve), the full probe battery including
the new probe, `audit-finance-tabs.mjs`, `sweep-pages.mjs` — all green, EN+AR, zero
console/JS errors.

## 2026-08-24 (round 3) · Owner hit a real live bug — a correct file was rejected as wrong; fixed the mount-wiring race (M12)

The owner himself, not the oversight session, hit this one directly: opened Finance,
clicked the Import sub-tab, dropped a genuinely correct `tax_invoice_capture.csv`, clicked
"Check file", and got a red "Header does not match the expected format" listing his own
correct columns. Reasonably concluded the file was bad — it wasn't.

**Root cause.** `window.finGo()` (`js/16-finance-ledger.js`) has two paths —
`if (v && current==='finance') renderFinance(v); else render();` — and the common case (a
person already on the Finance page clicking a sub-tab) takes the first path, which never
touches the global `window.render()` that `js/65-universal-importer.js`'s multi-file wiring
hooked into. So the very FIRST paint of the Import tab was always the raw, unwired HTML:
"Check file" still bound to the legacy single-format `finParse()`, `#finDrop` had no
`__v65` marker, `#finFile.multiple` was still false — until some later, unrelated global
`render()` (a poller, a different nav click) retroactively wired it. Confirmed as a pure
mount-timing race by calling `window.render()` once and watching all three flip correct.
This is the worst shape a guard-bearing UI can fail in: it never said "not ready yet," it
said "your data is wrong," in red, on a file that was completely fine.

**Fix.** Extracted the existing wiring logic in `js/65-universal-importer.js` into a named
`v65WireImportPanel()` function, and wrapped BOTH `window.render` and `window.finGo` to call
it — so the very first paint is fully wired regardless of which path drew it, with no
dependency on a second render ever happening. `js/16-finance-ledger.js` itself was not
touched (the base function stays as the layering convention requires — new behavior wraps
it from outside); the legacy `finParse()` rejection message was reworded there to identify
itself explicitly as "the legacy single-format checker" and suggest the file is likely fine,
so even a future variant of this race reads as "wrong tool," never "your data is wrong."

**Verification.** New probe `scripts/qa/probe-import-tab-wiring.mjs` reproduces the owner's
exact real path — a Finance nav click, then a single click on the Import sub-tab from an
already-open Finance page, no second render(), no wait for a poller — and asserts all three
conditions (`#finDrop.__v65`, `#finFile.multiple`, "Check file" bound to `v65CheckFiles()`)
plus a functional check (a real file dropped immediately after is actually recognized, not
just that the wiring flags are set). Sabotage-tested exactly as asked: backed up
`js/65-universal-importer.js`, disabled the new `finGo` wrap, ran the probe — it failed with
exit code 1, reproducing the owner's exact real symptom byte for byte
(`checkFileOnclick: "finParse()"`) — then restored the fix and confirmed via `diff` the file
was byte-identical to the pre-sabotage backup, re-ran green.

Verified: `node -c` on both touched files, `check-structure.mjs` (62 files),
`check-decisions-wired.mjs` (M12's own citations all resolve — `finGo()`/`render()`/
`v65WireImportPanel()`/`finParse()` all defined and called beyond their own definition), the
full probe battery including the new probe, `audit-finance-tabs.mjs`, `sweep-pages.mjs` — all
green, EN+AR, zero console/JS errors.

## 2026-08-24 (round 2) · Third source (tax invoices, M10) caught a second Takamol-shaped trap; v65IngestText built (M11); freeze report investigated and does not reproduce

Same day, a second round on top of the M9 rebuild below. The oversight session found the
owner's "final phase" source and, testing it, caught a repeat of the Takamol disaster before
it happened — then reported a real-looking freeze, then retracted an earlier freeze report
as their own tooling's fault, then reported this second freeze as real and separate.

**M10 — the tax-invoice report has two tax-code prefixes, not one, and the same mistake
almost happened again.** `/en/admin/corporate_clients/invoices` (65 tax invoices) carries
DPIN and TTIN codes. A first-pass regex matching only DPIN- reported 21 invoices with no
code; 10 of those 21 carry TTIN- instead, and all ten are Takamol invoices already excluded
in `finance_invoices` — the five largest invoices in the system, all over a million SAR,
totalling 6,724,291.12. Importing "has a tax code" as "safe" would have re-admitted the
whole excluded Takamol book and pushed displayed margin to 80.5% — implausible, which is
what triggered the check rather than shipping it. Built `tax_invoice_capture`
(`js/65-universal-importer.js`, columns `invoice_no, tax_code, total_incl_vat_sar,
invoice_status, issue_date`): gates on `finExclusionCheck()` against the EXISTING row's own
`client_group`, never on the tax-code prefix (TTIN-as-Takamol is a hypothesis from one
sample, not a rule); auto-imports only when a real tax code is present AND status isn't
"Waiting for Issuing"; never inserts (no client name in this source, and
`finance_invoices.client_group` is `NOT NULL`). `scripts/qa/probe-tax-invoice-capture.mjs`
(new) proves the sabotage case directly: a row with a real tax code and final status,
targeting the seeded Takamol fixture, must be refused purely on client exclusion — passed
first run.

**M11 — `window.v65IngestText(fileName, csvText)` built.** The oversight session drives this
importer by injecting JavaScript into a live Direct Payments tab; that context's async layer
is dead for file I/O (`setTimeout`, `Blob.text()`, `FileReader.readAsText`,
`File.slice().arrayBuffer()` all confirmed to never resolve, silently — proven three
independent ways in their own retraction). `v65IngestText()` takes CSV text directly and
routes through the exact same `detectSignature → batch → resolveExpenseJoin →
renderCombinedPreview` path as a real file drop, reusing `parseCsvTextToRows2d()` (built on
the same tokenizer `streamCsvFile()` already used) and `routeRows2d()` (the same dispatcher
the `.xlsx` path already used) — every guard sits downstream of the parse, untouched. This
is the P1 answer to "how does data get into this app": no human dragging a file, ever,
required. `processFileList()` was widened to accept a pre-parsed `{name, __rows2d}`
descriptor alongside real `File` objects, so both paths share one implementation rather than
two that could drift apart.

**A three-part bug-report arc worth recording precisely, because the pattern (not the
specific bug) will recur.** (1) An earlier session reported the importer freezing on a real
file drop. (2) The SAME session later retracted that report in full: it was driving the
importer via injected JavaScript in a browser-extension sandbox, and proved — three
independent ways — that the sandbox's async primitives for file I/O never fire at all in
that context. Not a code bug; `streamCsvFile()` was correctly waiting for bytes the browser
extension environment never delivered. (3) The SAME session then reported a SEPARATE, real-
looking freeze on the two-level join specifically (154 transactions, 222 lines; console
hooks installed before the drop show nothing; page unresponsive to script injection for
60-90 seconds; resolves with no preview and nothing written) and asked for it to be profiled
rather than assumed away.

**Investigated rather than trusted either way.** Built `scripts/qa/probe-cost-join-performance.mjs`:
a synthetic fixture at the real cardinality (154 transactions, 222 expense lines, one
8-transaction group and one 4-transaction group feeding single invoices — the exact shape
reported for real invoices, reproduced with fake IDs; real invoice/transaction numbers never
get committed to this repo), driven end to end through `v65IngestText()` with wall-clock
timing measured inside the page around the call itself (fully synchronous — parse, join
resolution, and render all happen in one JS tick, so this measurement is exactly what would
block a real browser's main thread on a real drop). Result: the lines file (222 rows)
processed in 4.0ms, the gate file (154 rows — the one specifically reported to freeze) in
2.7ms. **The reported freeze does not reproduce at real scale in a clean browser.** Given
report (3) used a real `File`/`DataTransfer` drop through `#finFile` (not `v65IngestText()`,
which didn't exist yet), and `streamCsvFile()` calls `file.slice().arrayBuffer()` — the exact
call chain report (2) already proved dead in that same session's injection sandbox — the
strong working hypothesis is that report (3) is the SAME root cause as the already-retracted
report (2), surfacing again because that particular drop still went through the File-reading
layer. Not certain — this session cannot directly inspect the oversight session's browser
extension environment — but consistent with every piece of evidence available, and
`v65IngestText()` (M11, built the same round) sidesteps the File-reading layer entirely,
which should resolve it either way going forward. The probe stays in the regression suite
regardless: if the join's real algorithmic complexity ever does regress as row counts grow,
this is what catches it before a real drop does.

Verified: `node -c` on every touched file, `check-structure.mjs` (58 files), the full probe
battery including both new probes and the widened `check-decisions-wired.mjs` scope,
`audit-finance-tabs.mjs`, `sweep-pages.mjs` — all green, EN+AR, zero console/JS errors.

## 2026-08-24 · Cost-capture join model was wrong; rebuilt as two levels (M9); a bug in the P5 checker itself, caught by re-reading its own output

The oversight session finished a real capture (all 219 expense lines, all 153 transactions,
"zero orphans" by exact page-count math) and, testing it end to end against a real record,
proved the 2026-08-23 join model wrong the same day it shipped.

**THE REAL CHAIN, proven on a live example.** Expense line `INVOICE #` `<ref>` is not a
tax invoice number — it is the TRANSACTION's own reference. That transaction's own
`INVOICE ISSUING` column reads "Issued `<ref>`", and `<ref>` IS a real
`finance_invoices` row (5,600.00 SAR), matching the transaction's amount and its single
Approved expense line exactly. So the real model is **two levels, not one**: many expense
lines → one transaction (Level 1), many transactions → one tax invoice (Level 2) — confirmed
on a real 7-transaction group, all issuing into the same invoice
(`<ref>`, 75,578.00 SAR). Grouping expense lines by their own `INVOICE #` directly, as
the 2026-08-23 version did, would never have produced a correct number.

**SECOND CORRECTION: EXPENSE STATUS blank means "Issued," not "unknown."** Blank always
co-occurs with `INVOICE ISSUING` = "Issued `<no>`" (45 of a sampled 100 transactions read
blank, all already issued); the on-screen badge itself renders with no text at all. The
2026-08-23 version's literal `READY_STATUSES=['ready','issued']` check, which blank never
matched, would have dropped nearly half of all real transactions and produced a
clean-looking, badly understated cost — caught before it ever ran against real data.

**Rebuilt `js/65-universal-importer.js`'s cost path as a genuine two-level join.** File 1
(`expense_lines_capture`) keys on `transaction_ref` (renamed from `invoice_no` — same column,
named for what it actually is) with `amount_sar`/`expense_status` unchanged. File 2
(`expense_gate_capture`) now carries `transaction_ref`, `txn_expense_status`, and
`invoice_issuing_raw` (the raw "Issued `<no>`" / "Need to issue" text) — parsed in code via
`parseInvoiceIssuing()`, never pre-parsed by the capture step, so the parse itself is
testable and survives past the session that captured the file (P1). `resolveExpenseJoin()`
now does Level 1 (sum each transaction's own Approved lines) then Level 2 (group transactions
by the invoice their `invoice_issuing_raw` parses to, and sum Level 1 across the whole group).

**The core new safeguard, worth its own line: one dirty contributing transaction holds back
the WHOLE invoice — never a partial sum from only the transactions that happened to be
clean.** "Dirty" means: no expense lines captured for that transaction yet, a malformed line
amount, that transaction's own gate row disagreeing with itself, or a status that
contradicts its own issued-ness. A partial sum here would be the exact same silent
understatement the whole path exists to prevent, one level down — `scripts/qa/probe-expense-report-capture.mjs`
was rewritten specifically to prove this: a fixture invoice fed by two transactions, one
clean (2,000 SAR) and one with no captured lines at all, must end up completely untouched,
never silently applied as 2,000. It passed on the first real run, along with every other
scenario (multi-transaction summing, blank-status-is-Issued, gate self-conflict, malformed
amount, exceeds-total, not-a-live-invoice, not-yet-issued, and persistence across two
separate file drops).

**Three findings recorded in `docs/DECISIONS.md` (now labelled M9) and left for their own
separate work, not patched here:**
1. Invoice `<ref>` computes cost 28,998.18 against a 26,536.00 total — the cost≤total
   guard correctly refuses it. May be a join error or a genuinely loss-making booking;
   surfaces loudly as needs-review either way, never silently dropped.
2. Three tax invoices with real approved cost have no matching row in `finance_invoices` at
   all (`<ref>`, `<ref>`, `<ref>`) — a gap in the invoice importer, not in
   this capture. Reported as "not a live invoice," never inserted (D1 stands).
3. Ten invoices get no cost from this capture; most are plausibly cost-free service-fee
   invoices, but `<ref>` (the 75,578.00 invoice fed by 7 transactions) reading zero is
   suspicious and worth checking once real data lands — the code now handles the multi-
   transaction case correctly, so if it still comes up zero after a real drop, that's a
   capture-completeness question (were all 7 receipt refs actually captured with correct raw
   text?), not a design gap.

**A bug in `scripts/qa/check-decisions-wired.mjs` itself, caught by re-reading its own
output — a small, direct proof of why P5 needs a mechanical check at all.** The checker split
`docs/DECISIONS.md` into rule blocks on every bolded paragraph start, which silently
fragments any rule spanning more than one bolded paragraph (M9 has four) — only the LAST
fragment carries the rule's own `*Date: ... Status: ...*` marker, so every citation in the
earlier fragments was silently never checked. Re-reading the tool's own output after adding
M9 (it reported zero citations checked for a rule that visibly has several) surfaced this
immediately. Fixed: fragments are now accumulated until one actually contains its own Status
marker, which is the real end of a rule regardless of how many bolded paragraphs it spans.
Once fixed, the widened scope immediately caught a second real bug: P4's own citation of
`tokens.css`/`IDENTITY.md`/`proposal.html` as bare filenames (the same imprecision-citation
mistake fixed in P5 last round) — corrected to the real paths (`brand/tokens.css`,
`brand/IDENTITY.md`, `brand/proposal.html`).

Verified: `node -c` on every touched file, `check-structure.mjs` (58 files), the full probe
battery including the rewritten expense-capture probe, `check-decisions-wired.mjs` (now
fixed), `audit-finance-tabs.mjs`, `sweep-pages.mjs` — all green, EN+AR, zero console/JS
errors.

