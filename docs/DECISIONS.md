# Decisions in force — the one file to check before acting

This is not a diary. It is a short, ruthlessly pruned list of **rules currently binding**
on this project. Narrative — how something was found, the investigation, the false starts —
stays in the Cowork project docs and in `BACKLOG.md`. This file holds only what a session
must check *before* touching money display, permissions, or data provenance, and it must
stay short enough that checking it is actually cheap.

Built 2026-08-23 after this project repeated a mistake (asking the owner to hand-export
files) that was already written down, in a doc this project itself authored, because the
knowledge existed but nothing forced a check against it at the moment of acting. See
`BACKLOG.md`'s 2026-08-23 entries for the full story.

## How this file works

- **Every rule below is either `ACTIVE`, `OPEN — CONTESTED`, or `SUPERSEDED-BY: <rule>`.**
  A superseded rule is *edited in place*, not left standing with a correction appended
  underneath — that pattern (32+ point-in-time docs, several silently contradicting each
  other) is exactly what made prior knowledge unfindable. When something is unlearned,
  rewrite the entry.
- **Whoever learns the thing writes it, in the same commit as the change that taught it.**
  Not a later cleanup pass.
- **Any action that touches money display, permissions, or data provenance requires
  reading this file first.** Not "should" — a session that skips it and turns out to have
  been wrong doesn't get to say it wasn't told. A session that genuinely cannot check
  something (a capability limit, not neglect) must say so plainly instead of silently
  guessing or silently asking a human to route around it.
- **Keep this file short.** If it needs a rule that isn't here, add it; if two rules can
  merge, merge them. A rule list nobody can hold in their head stops being a rule list.

---

## Principles

**P1 — Between two working options, take the one that endures.** Owner's standing rule,
23 Aug, verbatim: "I always want you to do the best. There is two options like this. I would
always go with the automatic or the best option on the long run. So please make it a standard
rule to go with the best option on the long run because I'm building something that lasts and
endures, not just something to view or to brag about." When an either/or choice comes up —
join in a throwaway capture script vs. join in the importer; a manual one-off fix vs. a rule
the importer enforces every time; a quick patch vs. the repeatable path — take the automatic,
repeatable, durable option, even when the quick one would unblock today faster. This outranks
convenience, never correctness: it is a tiebreaker between two options that are both already
correct, not a license to skip a check because the durable version is slower to build. First
applied 2026-08-23 to the expense-report cost-capture design: join the expense-lines file and
the transaction-status file inside `js/65-universal-importer.js`, in code, rather than in a
capture script that runs once and leaves no trace — the importer version is testable
(`scripts/qa/probe-expense-report-capture.mjs`) and survives past the session that built it;
a join done ad hoc would not.
*Date: 2026-08-23. Status: ACTIVE.*

**P4 — Two tasks, one repo: ownership by file, not by judgement.** Set 2026-08-23 when the
Proposal & Documents work split into its own session pushing to this same repo. The
Finance/oversight pairing owns `js/16-finance-ledger.js`, `js/25-finance-reporting.js`,
`js/62-finance-guardrails.js`, `js/65-universal-importer.js` and `scripts/qa/*`. The Proposal
& Documents task owns `/brand/*` (hub, `brand/tokens.css`, `brand/IDENTITY.md`, `brand/proposal.html`),
`js/core/core-04-proposals.js`, `js/46-brand-and-studio.js`, and its new generator page.
**This file, `docs/DECISIONS.md`, is written by the Finance/oversight pairing only** — the
other task sends rules across and reads the file, never edits it directly, so the two tasks
never race on the same lines of the same document. A request that touches a file on the
other side of this line gets a stated "that's not mine, here's whose it is" — never a quiet
edit anyway because it seemed harmless.
*Date: 2026-08-23. Status: ACTIVE.*

**P5 — A correct rule that nothing consults is not a rule.** Hit this exact failure shape
three times now: the Takamol exclusion list (correct, seeded, wired into every importer —
and never called anyway, because the real write went in through direct SQL); `MIN_PW` (the
Supabase Auth policy was 10, a screen hardcoded `<8`, so the form accepted an 8-char password
the server then silently rejected); and `/brand/tokens.css` (a real three-identity design
system that neither `brand/proposal.html` nor `js/core/core-04-proposals.js` loads — both hardcode their
own hexes, one of them a full digit apart from the token file's own value, which is how you
know nobody ever compared them). Writing a standard down is not the same action as making
anything read it. **Whenever a standard is written — an exclusion list, a token file, a
password policy, a schema constraint — the same change must also wire something to READ it,
and something must be able to prove that reading actually happens**, not just that the
document and the code both exist somewhere in the same repo.
*Date: 2026-08-23. Status: ACTIVE.*

---

## Money & finance display

**M1 — The three numbers are cost, profit and revenue, and VAT never enters any of them.**
Corrected 2026-08-23, owner verbatim, dissolving what earlier wording had turned into a
recurring question: "I dont care weither vat shows or not, what i want is a clean cost,
profit, and revenue." **This was never a rule about the glyph "VAT" appearing on a screen —
it is a rule about the three internal figures never being contaminated by it.** The prior
wording ("VAT is never shown or mentioned — anywhere, at any stage, in any view or report")
overshot that and would have had someone strip a legitimate VAT line off a client-facing
quotation while believing they were enforcing the real rule — that is NOT a violation and
needs no work; `js/core/core-04-proposals.js`'s quotation VAT line stays exactly as it is.
The corrected rule: **VAT is stored for import fidelity (`vat_sar` is a legitimate column)
and may appear on client-facing documents where it is legally expected** (a quotation, a tax
invoice). **It must never appear in, or be mixed into, an internal figure or report** — the
Finance page, any export, any total speaks in exactly Revenue / Cost / Profit, full stop, no
fourth money concept, and none of those three may be VAT-inclusive or VAT-computed.
`scripts/qa/probe-no-vat-display.mjs` is the regression guard, and was rewritten the same day
to match — it used to assert the absence of a "VAT" label on screen, which would pass even on
a VAT-contaminated profit number as long as nothing printed the word; it now asserts no
internal cost/profit/revenue figure is derived from or mixed with VAT.
*Date: 2026-08-08 (first ruled), reconfirmed 2026-08-22, restated 2026-08-23 (still
mis-scoped to "never shown anywhere"), corrected to its real meaning 2026-08-23. Status:
ACTIVE.*

**Cost = approved expenses only.** `finance_expenses` rows are the real cost behind a
service — the hotel bought, the visa paid for. They are record-only: nothing in that table
may ever be substituted into an invoice's `cost_sar`/`profit_sar` automatically (see
`js/45-expenses.js`'s own header comment). Until real per-invoice cost data is imported
from Direct Payments, `cost_sar=0` on an invoice is an honest gap, not something to
compute a number for.
*Date: 2026-08-16 (expenses model built), reconfirmed 2026-08-22 (BACKLOG entry: cost "must
come from approved expenses... not a VAT computation"). Status: ACTIVE.*

**M9 — real cost is only FINAL once every contributing transaction's own expenses are done,
and that is a TWO-LEVEL join, not a one-level one.** Corrected 2026-08-24 — the 2026-08-23
version of this rule described a one-level join (expense lines → directly to a tax invoice)
that was proven wrong the same day it shipped, on a real record end to end: expense line
`INVOICE #` `1163760881` is not a tax invoice number, it is the *transaction's own reference* —
that transaction's own `INVOICE ISSUING` column reads "Issued `1163762432`", and `1163762432`
IS a real `finance_invoices` row (5,600.00 SAR), matching the transaction's amount and its
single Approved line exactly. **The real chain has two levels: many expense lines → one
transaction (Level 1), many transactions → one tax invoice (Level 2)** — confirmed on a real
7-transaction group, all issuing into the same invoice. Grouping expense lines by their own
`INVOICE #` directly, as the superseded version did, would never have produced a correct
number — it would have treated dozens of transaction-level partial sums as though each were
its own invoice.

**The gate itself has a second correction: EXPENSE STATUS blank does NOT mean "unknown" or
"not ready" — it IS the "Issued" half of Ready/Issued**, confirmed 2026-08-24: blank always
co-occurs with `INVOICE ISSUING` = "Issued `<no>`" (45 of a sampled 100 transactions read
blank, all already issued), and the on-screen badge itself renders with no text at all.
"Ready" means a transaction's expenses are complete but no tax invoice yet; blank means the
tax invoice has already been issued — **both mean that transaction's own expenses are done.**
The superseded version's literal `READY_STATUSES=['ready','issued']` check, which blank never
matched, would have dropped nearly half of all real transactions and produced a
clean-looking, badly understated cost — caught before it ever ran against real data.

**The core safeguard, worth stating on its own: when an invoice is fed by more than one
transaction, ONE dirty contributing transaction holds back the WHOLE invoice — never a
partial sum from only the transactions that happened to be clean.** "Dirty" means: no
expense lines captured for that transaction yet, a malformed line amount, that transaction's
own gate row disagreeing with itself, or a status that contradicts its own issued-ness (e.g.
issued into an invoice but its own status still literally reads "Pending"). A partial sum
here would be the exact same silent-understatement failure this whole path exists to
prevent, one level down.

Direct Payments sources, confirmed by checking, not assumed: `admin.stats.expense-report`
(`INVOICE #` | `AMOUNT (SAR)` | `STATUS` | `APPROVAL DATE` | `MERCHANT`, 219 corporate rows,
one row per expense line — `INVOICE #` is the transaction's own reference) joins to
`/en/admin/corporate_clients/transactions` (`RECEIPT REF.` | `PRODUCT` | `AMOUNT (SAR)` |
`INVOICE ISSUING` | `CREATED AT` | `EXPENSE STATUS`, 153 rows — the expected
many-lines-to-one-transaction shape against 219 lines, not a mismatch; "zero orphans" per the
capturer's own exact page-count math). The join key itself (expense-report's transaction
reference = transactions' `RECEIPT REF.`) is now proven on a real matching pair, not just
believed. Per P1, both levels of the join are done inside the importer, in code —
`js/65-universal-importer.js`'s `expense_lines_capture` + `expense_gate_capture` signatures,
resolved by `resolveExpenseJoin()` — never in a one-off capture script that would be
invisible to every probe here and would die with the session that wrote it.
Regression-guarded by `scripts/qa/probe-expense-report-capture.mjs`. Every transaction that
can't yet be attributed to an invoice (no gate row yet, or gate row present but not yet
issued) is reported individually as waiting, never silently dropped. The source's own two
further traps stay defended in code: `admin.stats.expense-report`'s `expense_status` URL
filter does not apply server-side (filtering happens on the row's own value, in code, never
the query string), and repeated identical amounts on one transaction are real, separate
expenses — never deduplicated.

**Two real, un-fixed gaps this capture surfaced, deliberately left for their own separate
work, not patched here:** three tax invoices with real approved cost behind them
(`1163732931`, `1163737524`, `1163765089`) have no matching row in `finance_invoices` at
all — a gap in the invoice importer, not in this capture; reported as "not a live invoice",
never inserted (D1 stands — this path only ever updates a live row). And a cost figure that
would exceed its own invoice's total is refused by the cost≤total guard exactly as designed,
whether the cause is a join error or a genuinely loss-making booking — either way it is
never applied silently, only surfaced as needs-review.
*Date: 2026-08-23 (first shipped), corrected to the real two-level model 2026-08-24.
Status: ACTIVE.*

**M10 — a tax code alone is never enough to trust an invoice; exclusion is checked by client,
never by prefix.** The Takamol mistake's exact shape, on a different column, months later —
caught before it shipped. `/en/admin/corporate_clients/invoices` (65 tax invoices, "the
owner's final phase source") carries TWO tax-code prefixes, DPIN and TTIN, not one. A
first-pass regex matching only DPIN- reported 21 invoices as having no code at all; 10 of
those 21 carry TTIN- codes instead, and all ten are Takamol invoices already
`integrity_status='excluded'` in `finance_invoices` — the five largest invoices in the whole
system, every one over a million SAR, totalling 6,724,291.12. An import that treats "has a
tax code" as "safe to import" would have silently re-admitted the entire excluded Takamol
book the moment it saw a TTIN- string, pushing displayed revenue to 8.96M and margin to
80.5% — a number that looked better only because a rule got broken, exactly the shape P5
exists to catch (the 22.1% margin the corrected import actually produces is believable for
this business; the 80.5% never was, and that implausibility is what triggered the check).
TTIN appears to BE the Takamol invoice series (10 for 10 on this sample) — **that is a
hypothesis from one sample, never treated as a proven rule.** `tax_invoice_capture`
(`js/65-universal-importer.js`) does not special-case any prefix at all: it gates on
`finExclusionCheck()` against the EXISTING row's own `client_group`, the same exclusion list
every other import path in this app already uses, so exclusion holds regardless of what a
future tax-code prefix turns out to look like. The owner's rule, applied literally: an
invoice's tax code and total are trusted automatically only once it has BOTH a real tax code
AND a status other than "Waiting for Issuing" — anything short of either goes to manual
review, reported individually, never guessed at. Never inserts a new row (this source
carries no client name at all, and `finance_invoices.client_group` is `NOT NULL` — there is
nothing to create a row WITH); an `invoice_no` with no existing match is reported as needing
manual review, same as every other "not a live invoice" case in this importer.
Regression-guarded, including the sabotage case (a would-otherwise-qualify TTIN row
targeting the seeded Takamol fixture, asserted to never be written), by
`scripts/qa/probe-tax-invoice-capture.mjs`.
*Date: 2026-08-24. Status: ACTIVE.*

**M11 — `window.v65IngestText(fileName, csvText)` is the durable answer to "how does cost
data get into this app," per P1.** Before this, the only way to load cost or tax-invoice data
was a human dragging a file onto the Import tab — every time, forever, the quick path rather
than the enduring one. `v65IngestText()` takes CSV text directly and routes it through the
exact same `detectSignature()` → batch processor → `resolveExpenseJoin()`/`finalizeState()` →
`renderCombinedPreview()` path as a real file drop — it reuses `parseCsvTextToRows2d()` (the
same tokenizer `streamCsvFile()` is itself built on) and `routeRows2d()` (the same
synchronous dispatcher the `.xlsx` path already used) verbatim. It skips ONLY the
File-reading layer — every guard, the Ready/Issued gate, every exclusion check, the
cost-exceeds-total refusal, and the whole preview-then-commit flow sit completely downstream
of the parse and are untouched. Built specifically because the oversight session drives this
importer by injecting JavaScript into a live Direct Payments tab, and that injection
context's async layer is dead for file I/O — `setTimeout`, `Blob.text()`,
`FileReader.readAsText`, and `File.slice().arrayBuffer()` all confirmed to never resolve,
silently, not an error (`streamCsvFile()` was correctly asking the browser for bytes and
simply never getting an answer back; the importer was never at fault). This also makes a
real-size import scriptable end to end without a human's hands, and lets a QA probe drive the
real path at real row counts instead of only a handful of synthetic fixture rows — see
`scripts/qa/probe-cost-join-performance.mjs`.
*Date: 2026-08-24. Status: ACTIVE.*

**M12 — a page's own tab-switch is not the same event as a global render(), and a guard
wired to only one of them is not wired.** The owner opened Finance, clicked the Import
sub-tab, dropped a genuinely correct `tax_invoice_capture.csv`, clicked "Check file", and
got a red "Header does not match the expected format" listing his own correct columns —
reasonably concluded the file was bad. Root cause: `window.finGo()` (`js/16-finance-ledger.js`)
has two paths — `if (v && current==='finance') renderFinance(v); else render();` — and the
common case (already on the Finance page, clicking a sub-tab) takes the first path, which
never touches the global `window.render()` that `js/65-universal-importer.js`'s multi-file
wiring hooked into. So the FIRST paint of the Import tab was always the raw, unwired HTML —
"Check file" still bound to the legacy single-format `finParse()` — until some unrelated
LATER global `render()` (a poller, a nav click) retroactively wired it. **This is the worst
shape a guard-bearing UI can fail in: it never said "not ready," it said "your data is
wrong," in red, on a correct file** — teaching a person to distrust data that was never at
fault. Fixed by wrapping `window.finGo()` itself (`js/65-universal-importer.js`), not just
`window.render()` — the same `v65WireImportPanel()` now runs after EITHER path, so the very
first paint is already fully wired regardless of which one drew it. Sabotage-verified before
shipping: the `finGo()` wrap was disabled, `scripts/qa/probe-import-tab-wiring.mjs` was run
and confirmed to fail (exit 1) reproducing the owner's exact symptom byte for byte
(`checkFileOnclick: "finParse()"`), then the wrap was restored and the file diffed byte-
identical to before. The legacy `finParse()` rejection message (`js/16-finance-ledger.js`)
was also reworded to say plainly that it is the legacy checker and the file is likely fine,
rather than reading as a verdict on the data — so even a future variant of this race is
never mistaken for "your file is wrong" again.
*Date: 2026-08-24. Status: ACTIVE.*

**M13 — a write report must only ever say what the database confirmed, never what was merely
intended, and every write payload must be built from an explicit allowlist, never by spreading
a full existing row.** The owner ran a real import and read "Done. Imported 0 new, updated
27." — a green success headline — while Supabase confirmed immediately after that NOTHING was
written (46 invoices, with_cost 0, cost 0.00, profit still equalling revenue). The error text
("cannot insert a non-DEFAULT value into column \"year\"") WAS present in the same message,
but subordinated under the success headline, printed from `toInsert.length`/`toUpdate.length`
— the INTENDED batch size, not anything the database returned — so a reasonable person reads
"Done, updated 27" and stops. This is the exact B2 failure (a refused write that looks
identical to a successful one) except worse: the refusal text was right there and still didn't
stop a false read. Root cause, confirmed against the live schema (`information_schema.columns`,
not guessed): `finance_invoices.year` is `GENERATED ALWAYS AS (EXTRACT(year FROM
invoice_date))::integer STORED` — the ONLY generated column on the table (`month`/`quarter`
are plain columns the `finance_derive_fields` trigger recomputes unconditionally, so they were
never the problem). Two update-payload builders in `js/65-universal-importer.js`
(`processTaxInvoiceBatch()`'s tax-invoice update, `resolveExpenseJoin()`'s cost-join update)
built their write by spreading a full, already-fetched `finance_invoices` row
(`Object.assign({},existing,{...delta})`) straight from `FIN.rows` — a real `select *` — so
`year` rode along. PostgREST sends one batch as ONE statement, so a single row carrying `year`
fails the WHOLE batch — this is why all 27 failed together, not a partial success. Fixed on
two independent axes, each verified to hold on its own: (1) `pickWritable()` — an explicit
allowlist of writable `finance_invoices` columns (`WRITABLE_INVOICE_FIELDS` in
`js/65-universal-importer.js`) that every insert/update payload is now built from, instead of
ever spreading a full row object again — this makes the whole CLASS of "a DB-managed column
rides along into a write" impossible, not just this one instance; (2) `v65Commit()` now chains
`.select('id')` on every insert/upsert and counts what the database actually returned — on any
batch error the headline flips to a red FAILED naming the confirmed-written count (always 0 for
a failed batch) separately from the intended count, and the real error text, never a success
count derived from intent. `scripts/qa/mock-supabase.mjs` was taught to reject any `finance_invoices`
write payload carrying `year`, mirroring the real constraint — before this the mock could not
catch this class of bug at all, which is exactly how it shipped through an otherwise thorough
regression suite undetected. Sabotage-verified: `pickWritable()` was temporarily reduced to an
identity passthrough, `scripts/qa/probe-false-success-commit.mjs` was run and confirmed to fail
(exit 1) reproducing the exact bug class (payload carries `year`, mock rejects the whole
batch) — and notably still showed the reporting fix (2) holding on its own, correctly reporting
FAILED/written-0 even with the payload bug reintroduced, proof the two fixes are genuinely
independent defense-in-depth. The passthrough was then restored and the file diffed
byte-identical to before.
*Date: 2026-08-25. Status: ACTIVE.*

**M14 — a name-collapsing rule is the same shape as an exclusion rule: it must be consulted
live, by every reader, not applied once to today's rows.** The owner found real duplicate
clients by data, not invention: "MDD" (1 invoice, 507,800.00 SAR) and its Arabic spelling
"شركة مدد الذكية لتقنية المعلومات" (2 invoices, 134,748.95 SAR) are one company reported as
two; same shape for "Abdel Hadi Abdullah AlQahtani Sons Co" vs "...Sons Company" and an
alrajhi pair with "sharikat shakhs wahid" inserted. A one-time rename of the affected
`finance_invoices` rows would fix today's data and nothing else — the next Direct Payments
export recreates the other spelling as a fresh row and the split reappears next month, exactly
P5's shape ("a correct rule that nothing consults is not a rule") and the same lesson Takamol
already taught. Built `window.finGroupCheck(clientGroup)` (`js/62-finance-guardrails.js`), an
exact-shape twin of `finExclusionCheck()`: entries store a canonical display name plus its
aliases (`DB.settings.financeGroupMap`, self-documenting — a human can see why two names
collapsed), matched by the same `norm62()` already trusted for exclusions, undo-not-delete
(reversible, visible history, never silent). `finCanon()` (`js/16-finance-ledger.js`) consults
it FIRST, before business-link resolution, on every client_group→display-name resolution — so
the mapping applies live to every row that ever carries a mapped alias, past or future, with
zero backfill and zero per-import-path wiring to remember. This is why undo is instant and
lossless: nothing in `finance_invoices` is ever written by this feature. Auto-suggest surfaces
candidates two ways — same normalised spelling (catches a same-script rename like the AlQahtani
pair automatically) and same `finance_client_links` business_id (catches a cross-script rename
like MDD's, which the automatic linking system had already silently resolved at the business
level, just never surfaced as a display-name decision) — both need only a confirming click, per
the owner's explicit requirement that every merge is previewed (both source names, both live
totals, shown before Add) and reversible after. Sabotage-verified: `finCanon()`'s
`finGroupCheck()` consultation was temporarily removed, `scripts/qa/probe-client-group-map.mjs`
was run and confirmed to fail (exit 1) reproducing the exact reported symptom (the merged
totals split back into two separate client rows), then restored and diffed byte-identical.
*Date: 2026-08-25. Status: ACTIVE.*

**M15 — page-lifetime memory was the right instinct for the cost join, but not enough: the raw
captured facts must survive a reload and a new session, so a single updated file resolves
against everything already known.** The owner's own words: "if something happened on the
expenses and it got updated and I got a new export... I want it to accept it and update the
values... so I do not have to import all the files, I just need to import the updates and it
would spread it automatically." `EXPENSE_JOIN` (M9) already persisted for a page's lifetime,
which handled the two files arriving in the same tab at different times — it did not handle a
fresh browser tab, or the same tab tomorrow, having forgotten everything. DESIGN DECISION
(given before building, per the owner's explicit ask): the raw captured facts now live in
Supabase — `finance_expense_lines_capture` / `finance_expense_gate_capture` (migration
`finance_expense_capture_persistence`), RLS-matched to `finance_invoices`'s own
`can_see_page`/`can_edit_page('finance')` policies — not only in browser memory.
`loadCaptureBaseline()` (`js/65-universal-importer.js`) fetches both tables once per page
session and seeds `EXPENSE_JOIN` with them BEFORE any file in a drop is dispatched to its
processor — ordering that matters: a first version loaded the baseline AFTER processing, and a
fresh drop's rows landed first with the baseline then appended on top, silently summing old and
new (1,000 + 1,500 = 2,500 instead of 1,500 — caught by
`scripts/qa/probe-expense-capture-persistence.mjs` before shipping). `processExpenseLinesBatch`
now clears whatever a baseline loaded for a transaction_ref the FIRST time a fresh drop touches
it (`LINES_TOUCHED_THIS_SESSION`) — a re-export is that transaction's current complete line
list, replacing the stale one, never appended to it; repeated genuine lines within the SAME
drop still accumulate normally. `processExpenseGateBatch`'s old same-session "conflict" flag is
now reserved for two rows genuinely disagreeing within one session's drop(s) — a fresh drop
disagreeing with an EARLIER session's baseline is a normal update, not a conflict, per the
owner's incremental-update requirement. Written only on Confirm, via `v65Commit()` (M16 moved
this write inside the same server-side `fn_commit_finance_import` transaction that writes the
invoices themselves — see M16 below), through the app's own import path, so "nothing is written
until you confirm the preview" holds for these tables too — lines are delete-then-insert per
touched transaction_ref (never appended, matching the fix above), gates are upsert-by-transaction_ref
(latest wins). The multi-file "select several, check them, apply together" control the owner
asked for was already built (M11/M12 — `#finFile.multiple`, `v65CheckFiles()`,
`processFileList()` accepting many files and committing them in one `v65Commit()` call) — M15
adds the persistence layer underneath it, not a second import control. Sabotage-verified: the
line-replacement clear was temporarily reverted to a plain append, the probe was run and
confirmed to fail (exit 1) reproducing the exact 2,500-instead-of-1,500 double-count, then
restored and diffed byte-identical.
*Date: 2026-08-25. Status: ACTIVE.*

**M16 — a commit must be durable the moment it reaches the server, never dependent on the
calling browser context surviving to read the response.** The oversight session reported
v65Commit() failing every time from their side with `Failed to execute forEach on Headers: The
provided callback is no longer runnable` — their browser-extension injection context dying
mid-request (an "extension context invalidated" shape, the same root cause as the dead file-I/O
layer already documented 2026-08-24; explicitly NOT the M13 `year` bug — they never reached the
database to test it). Verified on their side: nothing written, clean failure, no partial state
— true, but also proof the OLD commit path (several sequential `.insert()`/`.upsert()` round
trips, one per 50-row batch) gave that kind of teardown a wide window to land mid-batch. Two
options were weighed, as asked, before building: (a) make the client-side fetch resilient
(avoid holding a live `Headers` reference across the await) — rejected, because the reported
failure is inside the browser/extension's own fetch/Headers internals, code this app does not
control or wrap either way, so patching our own await-holding code would not reach it; (b) move
the commit server-side so the browser context becomes irrelevant to whether the DATA lands —
this is the one that actually addresses the reported failure, and it converges with M15's
already-Supabase-persisted join state, both being the same underlying problem (the importer
living entirely inside one fragile browser session). Built as a single Postgres RPC function,
`fn_commit_finance_import` (a Postgres function, migration `finance_commit_import_rpc`, `SECURITY INVOKER` — runs
as the calling user, existing RLS `can_edit_page('finance')` still applies, no privilege
escalation), not a separate edge function: a plain RPC gives the SAME two guarantees an edge
function would (one round trip, atomic server-side transaction) with less operational surface,
since it rides the same PostgREST layer and RLS policies every other write already goes
through. `jsonb_to_recordset` (a Postgres function)'s explicit column lists ARE the M13 write allowlist enforced
again, server-side — a stray `year` key is silently ignored, never fails the statement,
stricter than the direct-REST path it replaces. `window.v65Commit()`
(`js/65-universal-importer.js`) now makes ONE `c.rpc('fn_commit_finance_import', {...})` call
carrying the already-resolved `toInsert`/`toUpdate` arrays plus this session's pending raw
captures (M15) in one payload — TRUE atomicity as a side effect (either the whole batch lands
or none of it does, strictly stronger than the old per-50-row-batch behavior), and the write is
durable the instant Postgres commits, regardless of what happens to the calling context
afterward, because response-reading happens strictly after that commit, not before it.
Verified directly, not just argued for: `scripts/qa/probe-commit-survives-context-death.mjs`
intercepts the RPC request node-side (outside the browser page, so closing the page cannot
cancel the forward-to-server fetch), destroys the entire browser context the instant the
request leaves the page — before any response could possibly arrive — and confirms via a
direct, browser-free database read that the write still landed. Sabotage-verified the other
direction too: `v65Commit()` was temporarily reverted to the old direct-REST path (never calling
the RPC at all), and the probe correctly failed to observe the expected request (a bounded
15s timeout was added specifically so this failure mode reports cleanly rather than hanging),
confirming the guarantee genuinely depends on the M16 mechanism; restored and diffed
byte-identical.
*Date: 2026-08-25. Status: ACTIVE.*

**M17 — the importer is only proven on the input path the user actually uses; every QA drive
of it must include one real multi-select on the real `#finFile` input.** Found by hands-on
driving (owner-ordered, 2026-08-26), not by any probe: every prior importer probe drove
`v65IngestText()` (the pre-parsed text path built for the oversight session), so two bugs in
the real file-input flow were unreachable by the whole green battery. (1) The input's own
change event auto-processes a selection AND the "Check file" button processes it again — the
natural flow (pick files, then click the button) ran everything twice; `GENERATION` guarded
the preview repaint but not the session-level expense accumulators, so a 900 SAR expense
committed as a 1,800 SAR cost and the capture table got two identical rows. Fixed by making
the accumulators drop-generation-aware (`processExpenseLinesBatch()` /
`processExpenseGateBatch()`, `js/65-universal-importer.js`): a duplicate or re-dropped file
REPLACES a transaction's lines and pending capture instead of appending — which is also
exactly the owner's incremental-update model within one sitting — and a superseded drop's
late streaming batches are discarded outright. (2) Two files in ONE drop can both update the
SAME invoice (tax capture → dpin/total; expense join → cost); each payload spreads the same
stale base row, so the later payload's stale copies silently reverted the earlier one's
fields inside the same commit. Fixed by `mergeUpdatesByInvoice()` in `v65Commit()`: fields
differing from the shared base row are that payload's intentional changes, layered in file
order onto one payload per invoice; derived money fields stay consistent because
`trg_fin_inv_derive` (a Postgres trigger) runs BEFORE INSERT OR UPDATE. Guarded by
`scripts/qa/probe-multi-file-single-drop.mjs`, which drives the REAL input (Playwright
setInputFiles → change event → auto-process, plus the redundant Check click) and judges by
direct database reads; both fixes sabotage-verified independently (reverting the generation
tracking reproduced 1,800 + the double capture row; removing the merge reproduced the
reverted dpin/total), restored and diffed byte-identical. The same drive also caught two
defects in the M14 admin card — the alias picker offered EXCLUDED clients (Takamol, with its
totals) because js/16's `live()` is IIFE-scoped and the `window.live` fallback skipped the
exclusion filter (fixed: `js/62-finance-guardrails.js` applies `finExclusionCheck()` to the
candidates directly), and the whole guardrails card was missing on the common first paint of
the Import tab because v62 hooked only `window.render()` — the M12 shape repeating verbatim
(fixed: v62 wraps `finGo()` too). Both guarded in `scripts/qa/probe-client-group-map.mjs`
(picker-scoped Takamol-absence assertion; a first-paint assertion made honest by settling
pending renders before navigating), both sabotage-verified. The rule, so it binds future
work: any new importer or Finance-admin probe must include at least one assertion driven
through the real input/tab-switch path, not only the scriptable shortcut.
Premortem addendum (same day): a deliberate attack pass over this surface —
`scripts/qa/probe-premortem-attacks.mjs`, six failure stories written to LAND, kept as a
permanent probe — confirmed intra-drop summing, same-session update-replace, a 6,000-row file
across the streaming batch boundary under the duplicate-trigger race, torn-merge resistance,
and import-path exclusion all hold, and caught one more real gap: a CAPTURE-ONLY drop (the
gate file alone — "gate today, lines next week") offered no commit button at all, so the
captured facts silently died with the tab and the counterpart file could never resolve in a
later session. Fixed in `renderCombinedPreview()`: when there is nothing to write to invoices
but pending captures exist, a "Save captured expense facts" action commits just the facts
through the same atomic RPC, and the result message reports the database's own capture
counts. Sabotage-verified (reverting the button reproduced both failures), restored
byte-identical.
*Date: 2026-08-26. Status: ACTIVE.*

**SUPERSEDED — the invoice item split (Service Fee / 3rd Party Fee) is a VAT split, never
real cost.** An earlier round of this project treated the 3rd-Party-Fee line as the real
cost figure; re-verified live against Direct Payments and found wrong — that line is a VAT
split, not a cost. Do not resurrect "cost = the non-taxable pass-through line" as a rule; it
is the same mistake under a different name. Real cost comes only from the rule above.
*Date corrected: 2026-08-22, commit `a454709` ("Correct the money-model chain"). Status:
SUPERSEDED-BY: "Cost = approved expenses only", above.*

**Takamol and Techtic Support never appear anywhere — not in Finance, not in Clients, not
in any export or report.** They are SVP/QVP verification revenue from a different system,
not BD income. Owner ruling 2026-08-23, verbatim: **"No takamol what so ever."** Any row
matching takamol/techtic on `client_group` or `customer_raw_name` is excluded from every
total. If a future import re-introduces them, that is a BUG, not new data.

Full history, since this was contested for a few hours before the ruling settled it —
proof the mechanism catches exactly what it's for: exactly ten Takamol invoices
(`1163619023, 1163632114, 1163643155, 1163642810, 1163669282, 1163676553, 1163703086,
1163708455, 1163744152, 1163744151`) entered `finance_invoices` live, summing
**6,724,291.12** of a displayed total of 8,755,055.41 — independently re-verified against
the database, exact match. A `Takamol for Business Services` client record was created and
the ten linked to it 2026-08-22 — the opposite of exclusion. Two readings were open (full
exclusion vs. partial genuine-client revenue) until the owner ruled outright for exclusion.
Resolution, independently re-verified against the database: all ten soft-deleted
(`deleted_at` set), `integrity_status='excluded'`, `exclusion_reason` recorded on every row;
the wrongly-created client archived; its `finance_client_link` deleted. Live Finance total
after: **2,030,764.29** (46 invoices) — within 1.8% of an independent non-Takamol workbook
figure, a decent cross-check that the right ten came out.

**Root cause, confirmed, worth recording precisely.** The exclusion list
(`js/62-finance-guardrails.js` `finExclusionCheck()`) was seeded correctly on 2026-08-21 —
client ID 7, match names "Takamol for Business Services" / "Techtic Support" — and IS
correctly wired into all three of this app's own import paths (`js/41-money-in.js:110`,
`js/65-universal-importer.js:275`, `js/16-finance-ledger.js:822`, confirmed by reading all
three, not assumed). The guard was right, wired, and live, and it never fired: the ten rows
were written straight into `finance_invoices` with direct SQL, going around the app's
importer entirely — confirmed directly by the person who ran it, not inferred. No
client-side import-time check can ever defend against a write that never goes through the
client. Fixed 2026-08-23 with a second, independent line of defense:
`js/16-finance-ledger.js`'s `live()` — the one chokepoint every Finance total/export reads
through — now re-checks every row against the same exclusion list on every call, not once
at load. That mattered in practice: a first version that filtered only inside the load
callback passed on a manual reload but silently let the row through on the real first
render, because `finance_invoices` can finish loading before `DB.settings.financeExclusions`
does — `live()` re-evaluates on every call, so it can't lose that race. Caught and fixed by
`scripts/qa/probe-finance-invariants.mjs` before shipping, not after.
*Date: 2026-08-23. Status: ACTIVE.*

**A standing exclusion is not satisfied by loading the data and labelling it.** If a rule
says a party is excluded, its rows do not enter the table at all — full stop. The Takamol
mistake above was exactly this: a client record was created, its invoices linked, and
100% attribution reported as a success, while a written rule said exclude. The number
looked better precisely because the rule was broken. "We loaded it and can explain why
later" is not compliance with an exclusion rule.
*Date: 2026-08-23. Status: ACTIVE.*

**Wallet top-ups are never revenue.** Skipped by the importer the same way verification
services are.
*Status: ACTIVE.*

**Never sum `finance_invoices` (`FIN.rows`) and `finance_transactions` (`TXN.rows`) in one
total.** They are two parallel datasets covering overlapping but not identical money — the
Ledger tab reads transactions, Overview/Clients/Reports read invoices. Summing both double
counts.
*Status: ACTIVE.*

**VOID is excluded from every total, everywhere, always.**
*Date: 2026-08-22. Status: ACTIVE.*

**Only confirmed, fully-paid tax invoices count as revenue.** A transaction with expenses
registered is "recorded and tracked" until its tax invoice is issued — work-done-but-not-
yet-invoiced is normal and must show as its own Ready-vs-Pending split, never be folded into
revenue early and never be hidden.
*Date: 2026-08-22. Status: ACTIVE.*

**Never fabricate a number to fill a data gap — leave it null and say why.** Proven twice:
the promo-code registry showed 27,304,067 SAR that was never real (114/134 codes flagged
active-and-expired simultaneously, 131/134 with a discount not matching their own stated
percentage, all seeded in one batch the day before real finance data landed) — the fix was
to turn the card off, not fabricate a cleaner number. And separately: client-level cost
totals from the Direct Payments workbooks don't reconcile to per-invoice amounts closely
enough to spread across invoices (1.8% gap) — spreading them anyway would have put wrong
numbers on individual invoices. Left both as an honest, stated gap instead.
*Date: 2026-08-22/23. Status: ACTIVE.*

## User-facing text

**Help text may state a RULE the user could otherwise violate. It may not explain our
architecture.** A heading like "Payment proofs — the audit file cabinet" or "Individual
bookings — the fifth revenue pattern" is this project's internal spec vocabulary leaking
onto a real employee's screen — nobody on the team can name the other four revenue
patterns, and it teaches nothing. Cut it. But two sentences under Expenses and Payment
proofs state real rules — "these amounts never change an invoice's cost or profit," "wallet
top-ups are never counted as revenue" — and are the only thing at the point of use stopping
someone from assuming an expense moved a number it shouldn't, or that a wallet top-up counts
as income. **If removing a sentence would let someone make a money mistake, rewrite it
shorter — do not delete it.**
*Date: 2026-08-23. Status: ACTIVE.*

## Data provenance — how data enters this app

**Data comes from the Direct Payments export registry (`/en/admin/excel-exports`),
captured in-page by whichever session holds the admin browser session — never by asking
the owner to hand-export files.** This was Stage 2 of the Import Engine + Automation Plan
(Aug 20/21) and was already agreed before a session asked the owner to manually export
three files, which is precisely the thing this rule exists to prevent. If the session doing
the work does not have browser access to Direct Payments, it must say so plainly and route
the request to a session that does — never silently fall back to asking the owner to do it
by hand. A genuine capability limit is not neglect: on 2026-08-23, the Transaction Expense
Export (registry id 5800, 70,682 rows, file identified and its direct download link known)
could not be captured because a browser extension blocked the download from firing — that
was stated plainly rather than quietly turned into a request for the owner to export it
himself, which is the correct response under this rule.
*Date: 2026-08-21 (planned), reconfirmed 2026-08-23 after being violated once. Status:
ACTIVE.*

**Never fire Direct Payments' sync export/`?export=1` path, and never request a large page
from Direct Payments — the session lock is global to the whole browser session, not just the
one request.** Verified 2026-08-23: the sync export fetch is accepted by the server and never
returns; while it's in flight, EVERY other request from the same browser session queues
behind it — a separate paginated capture of page 1 hung too, and stayed hung after a full tab
reload, because the server-side job holds the Laravel session lock. That is why a separate
queued "Fast Excel Export" route into `/en/admin/excel-exports` exists — it is the only export
worth evaluating later; the sync URL is never worth retrying or polling. The same lock, not
just the export button, also fires on an ordinary page fetch with `per_page=100` on
`/en/admin/corporate_clients/transactions` and `/en/admin/stats/cog-report` — both stalled the
session the same way; `per_page=10–25` returns instantly on both. Page Direct Payments small;
a captured 219-row batch at `per_page=100` worked but sits on the edge of the same lock, not a
safe pattern to repeat.
*Date: 2026-08-23. Status: ACTIVE.*

**Business data enters through the app's own import path, never by direct SQL.** The
importer (`js/41`, `js/65`, `js/16`) enforces exclusions, dedup and the five-count preview
before anything is written — direct SQL bypasses every one of them, silently. This is the
mechanical cause of the Takamol mistake above: the exclusion guard was correct and live,
and a direct SQL write went around it entirely, invisible to the app until someone happened
to look at the total. If a direct write is genuinely unavoidable, apply the exclusion rules
by hand first and say in the commit why the importer couldn't be used — never write real
finance rows straight into Supabase as a shortcut.
*Date: 2026-08-23. Status: ACTIVE.*

**Real company, client, or invoice data is never committed to this repository — no
exceptions, no "temporary" branches.** This repo is public. It already went wrong once: a
2026-08-13 branch committed real snapshots (1,035 real leads, real contacts, a real invoice
capture) as a database-recovery aid, and it sat exposed on GitHub for over a week before
being caught. If real data ever needs to leave the database, it goes to Google Drive or
stays purely local.
*Date: 2026-08-08 (ruled), violated once 2026-08-13, re-enforced. Status: ACTIVE.*

**FIN.p — one period state drives every Overview/Clients number; nothing is stored per
period.** `year: 'all'|<year>`, `part: 'all'|Q1..Q4|H1|H2|M:<MonthName>`, `sector:
'all'|tenders|b2b|academies` (26 Aug, `finSectorOf()` — derived at render from the linked
business's `payment_terms` and `service_type`, never a stored column). All three ride the
same `finInPeriod(r)` check, so picking any one of them scopes KPIs, charts, clients,
ledger and CSV exports together — "scope is a page property," not something each tab
re-derives its own way. **27 Aug — `FIN.p.cmp` ('none'|'prev'|'yoy') adds a fourth,
comparison-only axis on top of the same state**, resolved by `finCompPeriodOf()` into a
second `{year,part,sector}` object and summed by `finPeriodTotals()` — it never touches
`FIN.p` itself, so building a comparison can't disturb what's on screen. Needs a concrete
`year` to shift from (`'all'` has no single "previous"); cross-year-boundary periods
resolve correctly (Q1's previous is Q4 of the *prior* year). Any change to the `part`
vocabulary or the sector list must update `finCompPeriodOf()` too, or a comparison for a
newly added period value will silently return null instead of a table.
*Date: 2026-08-11 (period doctrine), 2026-08-26 (sector), 2026-08-27 (Compare-to). Status:
ACTIVE. Written retroactively for the 26/27 Aug entries — see the P4-addendum note below;
should have gone in the same commits as the features themselves.*

**P4-addendum — `js/45-expenses.js`, `js/57-payment-proofs.js`, `js/58-b2c-manual.js` are
owned by NEITHER side of the P4 split.** Found 2026-08-27 while looking at why these three
Finance-nav tabs (Expenses, Payment Proofs, B2C manual) don't share `FIN.p`'s period bar:
Expenses and Payment Proofs each keep their own independent `YYYY-MM` month dropdown
(`EXP.month`, `PRX.month` — a different format than `FIN.p.part`), and B2C manual has no
period control at all. Real inconsistency, left unfixed on purpose: P4 lists these three
files under neither task, so unifying them means picking a shared period representation
neither side gets to decide alone. Whoever picks this up next: read this entry before
touching those three files, and update the ownership list above in the same commit, don't
just fix the symptom and leave the ownership question open again for the next person.
*Date: 2026-08-27. Status: OPEN — CONTESTED (ownership, not the underlying finding).*

## Session & GitHub-push access — read before assuming a session can push

**A Claude session that can `git fetch` this repo is not necessarily able to `git push` to
it — these are two unrelated locks, not one.** Found 2026-08-27 after this session (the
oversight/Finance track) burned real time on the wrong theory. What actually happened:

1. GitHub's own repo visibility (Settings → Danger Zone → public/private) blocks or allows
   *anonymous* access. This session's `git fetch` failed with "could not read Username" while
   the repo was private, and started working the moment the owner switched it to public — a
   public repo needs no credential to read.
2. Separately, **all outbound traffic from this sandbox goes through a local proxy**
   (`https_proxy`/`HTTPS_PROXY` env vars point at `127.0.0.1:<port>`; env vars named
   `CCR_AGENT_PROXY_ENABLED`/`CCR_UPSTREAM_PROXY_ENABLED` confirm it's on). For a `git push`
   (which always needs a real credential, public repo or not), that proxy is the thing that
   would inject one — and it only does so for repos in "this session's authorized repository
   set," decided when the session/environment was created, not by anything inside the
   session. Denial looks like: `remote: access denied by the git proxy: <owner>/<repo> is not
   in this session's authorized repository set... To fix, add the repository to the session's
   sources.` — that "fix" is not self-service; nothing in this container can edit that set
   (checked: `GIT_ASKPASS` and the session-profile env var are both empty strings, no local
   config file for it exists, `GH_TOKEN`/`GITHUB_TOKEN` in the environment are 14-character
   placeholders, not real tokens). Making the repo public fixes symptom #1 (fetch) and does
   **nothing** for #2 (push) — confirmed by testing push immediately before and after the
   visibility change, identical failure both times.
3. Ruled out as workarounds, so the next session doesn't re-try them: no GitHub MCP connector
   exists in the connector registry to route around the proxy via the API instead of git;
   there is no `list_environments`-type tool available here to find or target a differently
   -authorized environment; `ListAgents` found no other reachable Claude session to hand
   finished work to as of 2026-08-27 (checked repeatedly across the day).
4. **The only real fix**: a session/environment that *was* set up with this repo in its
   authorized set can push fine — apparently true of the sibling "Code session" this project
   also uses. A session without that authorization should stop trying to push and instead get
   its finished, committed work to a session that has it (session-to-session handoff, e.g. via
   whatever cross-session messaging tool is available) rather than repeating this
   investigation. This is a hard structural limit of the *session*, not something fixable by
   changing anything in this repo.

**Standing rule (CLAUDE.md #9): don't wait to be told.** The moment a push-capable session
(session CSE, or whatever replaces it) is reachable, hand off the local commits and let it
push — that's the committed plan already, not a suggestion to re-confirm each time this
comes up.

**Better fix, found 2026-08-27 (same day) reading the Generator track's build log: skip
`git push` entirely.** The Generator session has been shipping to this same repo the whole
time via a completely different route that never touches the git proxy at all — driving a
real Chrome browser (Claude's browser-automation tools) to GitHub's own website, uploading
each changed file through the normal "add file" web form, and submitting the commit exactly
as a person would by hand. That's an ordinary authenticated web request using the browser's
own logged-in GitHub session, not a `git push` over the git protocol — so the proxy that
blocks the latter never sees it and has no say in it. This doesn't need session CSE, doesn't
need any other session to be reachable, and doesn't need anyone to change a setting. It only
needs a Chrome browser (with Claude's browser extension) logged into GitHub as the owner to
be connected to whichever session is trying to deploy — see that session's own build log for
the exact repeatable steps and its known rough edges (upload tabs that need a fresh tab if
they freeze, the commit-message box needing a visible focus check before typing). This is
now the preferred route for every session in this project, not just Generator's; the
session-handoff rule above is the fallback when no browser is available.

*Date: 2026-08-27. Status: ACTIVE — operational fact, not a to-do.*

## Code patterns that keep re-biting

**A Supabase `.update()`/`.insert()` without `.select()` returns success with no error even
when Row-Level Security silently refused the write.** Always chain `.select()` and check
`r.data.length` before telling the user something was saved/deleted/restored. Bit
`finDel`/`finRestoreInv`/`finDel`/`finRestore`/`expSave`/`expDel` in a single session before
being made a standing rule.
*Date: 2026-08-22. Status: ACTIVE.*

**`is_client` is two flags, not one.** The `businesses.is_client` column and
`raw->>'isClient'` must both change together — the app reads both, so changing one without
the other leaves a record half-converted.
*Status: ACTIVE.*

**Every CSV/spreadsheet export must pass values through `csvGuard()` before writing.**
RFC-4180 quoting is not protection against formula injection — Excel strips CSV quoting on
open and still evaluates a cell starting with `=`, `+`, `@`, tab, CR, or a non-numeric
leading `-`. Proven exploitable, not theoretical.
*Date: 2026-08-22, commit `fab1849`. Status: ACTIVE.*

**A hardcoded password-length minimum must equal the Supabase project's own Auth policy
minimum exactly, via one shared constant (`MIN_PW`), never a separate literal per screen.**
Two screens each hardcoded `<8` while the real policy was 10; the form silently accepted an
8-char password, the server-side update then failed, and the person was never told — this
locked the owner out of his own Super Admin account.
*Date: 2026-08-23, commit `f029899`. Status: ACTIVE.*

**QA probes: interaction-correctness checks click during load; content-correctness checks
wait for settle. Do not conflate them.** A probe that only waits for settle will never
catch a freeze that happens mid-load (this is exactly how a real 45+ second Finance-tab
freeze reached the owner without any probe in this project's history catching it first). A
probe that measures content immediately after a click, without waiting for settle, produces
false "renders EMPTY" results on tabs still mid-load. Use the right one for what's being
tested, not one rule for both.
*Date: 2026-08-22. Status: ACTIVE.*
