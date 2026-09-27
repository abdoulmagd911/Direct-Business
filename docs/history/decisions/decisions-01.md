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
**Suspended 2026-09-25 by the owner, conditionally:** while exactly one session writes to this repo
(the Claude Code build session that opened on 2026-09-25), that session may write any file,
this one and `/brand/*` included. **P4 returns in full the moment a second writing session is
started** — the new session is told which files are whose before its first commit.
*Date: 2026-08-23; suspended 2026-09-25. Status: SUSPENDED while one session writes — returns
if a second writing session starts.*

**P6 — Once approved, always approved.** The owner, 2026-09-25, verbatim: "Always allow anything
you asked me for in this session or any other session so don't get back to me for them again as
long as I'm allowed it once then you can have it all the time." A kind of action the owner has
approved once — in any session — is approved from then on, and a session does not come back to ask
again. Read with D2's "every phase lands by pull request": the owner has approved merging (PR #31),
so a session merges its own pull request once its tests are green, and says so in its report. What
this does NOT cover: an action of a kind never approved before, and anything that deletes real data
or cannot be undone — those still go to the owner first (CLAUDE.md rule 9's carve-out).
**Restated 2026-09-26, verbatim: "Always approve all the previous requests"** — given on release 4 (#46), which had
gone up for review as a new kind of release. So the pending asks were approved (#46 merged once its full run was
green, its database change applied from the merged commit); releases are still built and tested exactly as before
(full run green, a rolled-back live run, the live check after), and the carve-out above still stands.
*Date: 2026-09-25; restated 2026-09-26. Status: ACTIVE.*

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
`js/45-expenses.js`'s own header comment). Real per-invoice cost now comes from Direct
Payments through the M9–M17 capture chain (live since late August: 1,538,141.70 across 27 of
the 46 invoices as of 2026-09-02). Where that chain has not produced a number —
19 invoices today, including the two M9 cases (the 7-transaction government invoice that
computed zero; the invoice whose approved cost exceeds its own total and is held for
review) — `cost_sar=0` stays an honest gap, never
something to compute a number for, and the Finance page says so in its "N of M invoices carry
no recorded cost" line.
*Date: 2026-08-16 (expenses model built), reconfirmed 2026-08-22 (BACKLOG entry: cost "must
come from approved expenses... not a VAT computation"), figures refreshed 2026-09-02.
Status: ACTIVE.*

**Clarification, 2026-09-17 (fire #82): a gap the app WRITES is left null; the 0s already in the
table are history, and they carry a stored profit nobody verified.** The rule above and
CLAUDE.md's one-line summary of it had drifted apart — this file said "`cost_sar=0` stays an
honest gap", CLAUDE.md said "leave it null and say why" — so here is what is true, measured on
the live ledger the same day.
Every place the app DECIDES whether a cost was recorded tests `(+r.cost_sar||0)===0`, which is
true for 0 and for null alike (js/16: the client table's cost and profit cells, the "N of M
invoices carry no recorded cost" line, the period totals). So on screen the two are already
identical, and both correctly print the words rather than a number.
What differs is what is STORED. The database trigger derives profit = revenue − cost, so a cost
of 0 stores a profit equal to the whole sale, while a null cost leaves profit null. Live today:
**19 invoices carry `cost_sar = 0`, and all 19 store `profit_sar = revenue_sar` — 214,550 SAR
of margin nobody has verified, sitting in the table.** The Finance page never shows it as profit;
anything reading the table directly does (an export, a SQL query, a future report).
So: anything the app writes from now on leaves an unrecorded cost NULL — done for the individual
(B2C) booking form on 2026-09-17 (js/58; a 0 the person actually types still means a genuinely
free booking), guarded by `scripts/qa/probe-b2c-blank-cost-stays-unrecorded.mjs`. The 19 existing
rows are NOT touched: clearing their `cost_sar`/`profit_sar` to null is one reversible statement
and the screen would not change, but it is real money data and the owner's call.
*Status: ACTIVE for new writes. The 19 existing rows are OPEN — owner's decision.*

**M9 — real cost is only FINAL once every contributing transaction's own expenses are done,
and that is a TWO-LEVEL join, not a one-level one.** Corrected 2026-08-24 — the 2026-08-23
version of this rule described a one-level join (expense lines → directly to a tax invoice)
that was proven wrong the same day it shipped, on a real record end to end: expense line
the expense line's `INVOICE #` value is not a tax invoice number, it is the *transaction's own
reference* — that transaction's own `INVOICE ISSUING` column reads "Issued `<a different
number>`", and THAT number IS a real `finance_invoices` row (5,600.00 SAR), matching the transaction's amount and its
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
(numbers recorded in the importer's needs-review output, not here) have no matching row in `finance_invoices` at
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
clients by data, not invention: one client's short English name (1 invoice, 507,800.00 SAR)
and its full Arabic legal name (2 invoices, 134,748.95 SAR) reported as two companies; same
shape for a "...Co" vs "...Company" pair and a pair differing only by an inserted legal-form
phrase. (Real names deliberately not recorded here — rule 7; they're in `DB.settings.financeGroupMap`.) A one-time rename of the affected
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
candidates two ways — same normalised spelling (catches a same-script rename like the "Co/Company"
pair automatically) and same `finance_client_links` business_id (catches a cross-script rename
like the EN/AR pair's, which the automatic linking system had already silently resolved at the business
level, just never surfaced as a display-name decision) — both need only a confirming click, per
the owner's explicit requirement that every merge is previewed (both source names, both live
totals, shown before Add) and reversible after. Sabotage-verified: `finCanon()`'s
`finGroupCheck()` consultation was temporarily removed, `scripts/qa/probe-client-group-map.mjs`
was run and confirmed to fail (exit 1) reproducing the exact reported symptom (the merged
totals split back into two separate client rows), then restored and diffed byte-identical.
Sweep addendum, 2026-08-29: the owner's instruction said the map must be consulted on the
IMPORT path too, "beside `finExclusionCheck()`, called the same way" — and only the display
path had it. The automatic finance↔client linker (`js/41-money-in.js`) matched a new
client_group by normalised business name alone, so a freshly imported alias spelling that is
not itself a business name stayed "needs linking"; that now matters because `finSectorOf()`
reads the link by RAW client_group, so such a row would sector as plain B2B even when its
sibling spelling is a linked Tender client. Fixed: when the name index misses, the linker asks
`finGroupCheck()`; if the spelling is a registered alias and a sibling is already linked, it
links to the same business with `confirmed_by='auto-match-alias'` (visible provenance, never
silent). Guarded by `scripts/qa/probe-alias-autolink.mjs`, sabotage-verified (fallback removed
→ the spelling stays unlinked and no link write goes out), restored byte-identical.
*Date: 2026-08-25, linking-path addendum 2026-08-29. Status: SUPERSEDED-BY: D16 (27 Sep) — names now collapse only when a person types them onto a company on Finance → Rules (`company_name_aliases`, read by the `money_rows` view); the settings alias map and the automatic alias linker are retired, and the text above is kept as history.*

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

