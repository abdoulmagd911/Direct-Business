## 2026-08-23 · M1 corrected (dissolved, not just reworded); backups moved off localStorage into Supabase; owner ruled on the restart plan

Three owner rulings landed in one message, on top of the two-file-join round below.

**RULING 1 — M1 was never about the glyph "VAT" on screen.** Owner verbatim: "I dont care
weither vat shows or not, what i want is a clean cost, profit, and revenue." The old wording
("VAT is never shown or mentioned — anywhere, at any stage, in any view or report") overshot
into a rule that would have had someone strip a legitimate VAT line off a client-facing
quotation while believing they were enforcing the real rule. Corrected in `docs/DECISIONS.md`
(now labelled **M1**, matching how this file's own earlier entries already referred to it) and
in `CLAUDE.md`'s top banner, which repeated the same overshot wording verbatim and would have
misled the very next session to skim it. `js/core/core-04-proposals.js`'s quotation VAT line
needs no work — left untouched, and the Proposal & Documents task will be told the same when
it starts.

`scripts/qa/probe-no-vat-display.mjs` was rewritten from a text scan (asserted the string
"VAT" never rendered — gave false comfort, since it would pass on a VAT-contaminated Profit
figure so long as nothing printed the literal word) to real arithmetic: for every live
`finance_invoices` row with `vat_sar > 0`, `revenue_sar` must not include the VAT amount and
`profit_sar` must reconcile from `revenue_sar - cost_sar` with no VAT term anywhere in it. The
checker is proven against a synthetic contaminated row inside the probe itself before it's
ever trusted against live data — a self-test that would have caught the old probe's exact
failure mode. `scripts/qa/mock-supabase.mjs` gained a dedicated VAT-bearing fixture row
(`i-qa-vatclean`, the seed batch previously carried no VAT figures at all) so this is
genuinely exercised, not just structurally possible. The old label scan is kept but demoted to
observational-only (printed, never fails the build) since the owner explicitly said the glyph
itself doesn't matter.

**RULING 2 — backups move off localStorage into Supabase, per P1 ("take our long-run
recommendation").** Not a retention trim — the browser was the wrong home for this from the
start. Turned out to be a small P5 case of its own: two tables already existed on the live
project, already correctly permissioned, and nothing in this app's code ever used them.
`app_state_history` has a working trigger (`trg_app_state_snapshot`, confirmed by reading its
real definition) that already snapshots the full prior state on every save this app makes,
capped at 20 by the trigger itself — 20 real rows already existed before this change touched
anything. `app_state_bak` is open to any authenticated user for all operations and has a
`note` column that lines up exactly with the existing "Tag current state" feature's name
prompt. Rebuilt `js/core/core-06-v18-v21.js`'s whole backup module against these: `tagCurrentState()`
now writes a real row (checked against the RLS-silent-write rule — `r.data.length`, not just
absence of an error), `restoreFromBackup()`/`deleteTag()` read/delete the real rows, and
`app_state_history`'s admin-only RLS is respected client-side (checked directly via the
signed-in user's own `app_users.role`, never inferred from an empty result — an empty result
from an RLS-gated table proves nothing, the exact shape this file already warns about
elsewhere).

**Migration, built to the letter of what the owner asked for:** `bkMigrateLocalToSupabase()`
runs automatically (on every save, and once shortly after load), uploads every existing local
snapshot (incremental + daily + tagged) into `app_state_bak` with the original timestamp
preserved, and **only clears the local copies once every single entry is confirmed uploaded**
— a partial or failed batch leaves 100% of local data untouched and retries automatically next
load. A failure **toasts and console.errors immediately** — never a silent continuation on
local data. `scripts/qa/probe-backup-supabase.mjs` (new) proves this directly: it seeds local
backup data, blocks the live route on purpose, asserts the data survives untouched and a loud
failure fires, then unblocks the route and asserts the same data migrates, is confirmed
server-side, clears locally only then, and that re-running afterward is a no-op (no duplicate
uploads). `scripts/qa/mock-supabase.mjs` gained real (not stub) REST handling for
`app_state_bak` insert/delete and generic `.order()/.limit()` support, plus 3 seeded
`app_state_history` fixture rows, mirroring the real live table exactly.

**Verified live, no schema change needed:** `app_state_bak`'s three writable columns
(`data`, `note`, `created_at`) are all nullable with no constraints beyond what already exists
— the table already accepts exactly the shape this app now writes. Confirmed by reading the
real live schema and RLS policies (`vkxoeeoauexyfpzqufqd`), not assumed. **Known, pre-existing
gap, NOT introduced by this change, and not fixed here on purpose:** `app_state_bak`'s RLS
(`app_state_bak_auth`, cmd ALL, `qual: true`) lets any authenticated user read, write, or
delete any row — no per-row ownership. This was already flagged in an earlier access audit
(see "workspace backups" in the 2026-08-xx access-gap entry elsewhere in this file); tightening
it is a deliberate RLS decision this change didn't set out to make, so it's called out here
instead of silently changed.

**RULING 3 — restart.** Same answer as Ruling 2: the long-run recommendation. Land cost
first (blocked as of this writing on the oversight session's own side — a `per_page=100`
request against Direct Payments has been holding the whole session lock for 20+ minutes with
no way to cancel it; see the D7-widening entry below), then both sessions restart at a clean
checkpoint with `docs/DECISIONS.md` and `docs/BACKLOG.md` carrying everything — the handover,
not a summary written after the fact. Given the scale of `docs/BACKLOG.md` specifically, a
genuine "make this readable cold, not just complete" pass is worth doing as its own explicit
step before the cutover, flagged here rather than attempted informally inside this entry.

Verified: `node -c` on every touched file, `check-structure.mjs` (58 files), the full probe
battery including both new/rewritten probes, `check-decisions-wired.mjs`, `audit-finance-tabs.mjs`,
`sweep-pages.mjs` — all green, EN+AR, zero console/JS errors.

## 2026-08-23 · Cost-capture rebuilt as a two-file join; three new standing rules; one real bug caught before shipping

**Same day, one more correction on top of the entry directly below this one.** The single-file
`expense_report_capture` design shipped in commit `ef7c254` (previous entry) required a
`txn_expense_status` column on every expense-report row. The oversight session then tested it
against the real source and found `admin.stats.expense-report` does not carry that column at
all — its columns are `INVOICE # | AMOUNT (SAR) | STATUS | APPROVAL DATE | MERCHANT`, confirmed
by checking, not assumed. **`expense_report_capture` is superseded.** The gate lives on a
different Direct Payments screen entirely, `/en/admin/corporate_clients/transactions`
(`RECEIPT REF. | PRODUCT | AMOUNT (SAR) | INVOICE ISSUING | CREATED AT | EXPENSE STATUS`, 153
rows against 219 expense lines — the expected many-to-one shape, not a mismatch), confirmed by
the oversight session 2026-08-23.

**Rebuilt as two joined signatures in `js/65-universal-importer.js`:** `expense_lines_capture`
(the per-line Approved/Pending/Cancelled/Under Review status) and `expense_gate_capture` (the
transaction-level Ready/Issued gate) — resolved by a new `resolveExpenseJoin()`, which produces
one synthetic result entry that slots into the existing multi-file combined-preview/commit UI
unchanged. Every guard from the single-file design survived the rebuild: the exclusion list is
re-checked even on a live match, a cost exceeding the invoice's own total is rejected, a
malformed line amount voids that invoice's whole write, a gate file that disagrees with itself
on one invoice_no is refused, and a Pending-gated invoice is left completely untouched. **New
in this version:** every invoice_no waiting on the other file is now reported individually in
the preview (`costCaptureDetail`), not folded into a bare summary count — the oversight session
asked for this explicitly, because the join key itself (expense-report's `INVOICE #` = the
transactions page's `RECEIPT REF.`) is an *unverified claim*, same number space but not yet
proven on a real matching pair, so a wrong assumption there must surface as a visible list, not
a quietly-clean import that understates cost.

**A real bug caught before it ever shipped, by re-reading the code, not by a test failing.**
The first draft of `processFileList()` called `resetExpenseJoin()` at the top of every drop
batch. That would have silently thrown away an already-captured file's data the moment a
second file was dropped in a *separate* action — a very real workflow, since the two files
come from two different Direct Payments pages and may genuinely be captured a day apart. It
directly contradicted the importer's own stated rule ("a file that references something not
seen yet just sits unlinked until the file that supplies it arrives"). Fixed before commit:
`EXPENSE_JOIN` now persists for the page's lifetime, cleared only by a reload.
`scripts/qa/probe-expense-report-capture.mjs` was rewritten to drop the two files via two
*separate* `page.setInputFiles()` calls specifically to prove this holds, not just to re-test
the money math.

**Three new rules added to `docs/DECISIONS.md`, Principles section:**
- **P1** — between two working options, take the one that endures (owner's verbatim standing
  rule, 23 Aug). Governed the second-file-and-join-in-code decision above.
- **P4** — this repo now has two concurrent tasks (Finance/oversight; Proposal & Documents,
  newly split off). File ownership is explicit — see the rule for the exact split — and
  `docs/DECISIONS.md` itself is written only by the Finance/oversight pairing.
- **P5** — "a correct rule that nothing consults is not a rule," after hitting the same
  failure shape three times (Takamol exclusion list, `MIN_PW`, and now `/brand/tokens.css` not
  being loaded by the two pages that render Direct's brand — the last one is the Proposal &
  Documents task's to fix, recorded here only as a cross-reference). Given a mechanical teeth:
  new `scripts/qa/check-decisions-wired.mjs` parses every ACTIVE rule's backtick code
  citations (a function call, an ALL_CAPS constant, a file path) and fails the build if a
  citation is stale (points at code that doesn't exist) or dead (defined but never called
  anywhere else) — caught its own first real bug immediately: my own P5 entry cited
  `proposal.html` and `core-04-proposals.js` as bare filenames, which don't resolve from repo
  root; fixed to the real paths (`brand/proposal.html`, `js/core/core-04-proposals.js`) before
  this was committed.

**Two Direct Payments landmines recorded, both in `docs/DIRECT_SYSTEMS_PLAYBOOK.md` and
`docs/DECISIONS.md`:** (1) the sync export/`?export=1` path is not slow, it's a session-wide
stall — the fetch is accepted server-side and never returns, and while in flight it holds the
Laravel session lock for the *whole browser session*, queuing every other request (a separate
paginated DOM capture hung too, and stayed hung after a full tab reload). Never poll or retry
it; the queued "Fast Excel Export" route is the only export worth evaluating later. (2) the
same session lock also fires on an ordinary `per_page=100` page fetch — confirmed on both
`/en/admin/corporate_clients/transactions` and `/en/admin/stats/cog-report` — so every capture
should page at 10–25, not 100; the 219-row expense-report capture at `per_page=100` worked but
sits on the edge of the same lock.

**One landmine on our own side, flagged by the oversight session and fixed same day:**
`bkWrite()` in `js/core/core-06-v18-v21.js` (the local backup-snapshot writer) caught
`QuotaExceededError` with only a `console.warn` — nobody would ever see a failure there, while
`save()` right above it in load order already toasts+warns-once for the identical failure on
the main data key. Fixed: one retry with the array halved (an emergency trim, not a retention
policy change), then a loud one-time toast if that still fails. **Not fixed, needs the owner's
call, not a bug fix:** on the same browser origin, `directBusinessBackupsInc_v21` is 3.6 MB and
`directBusinessBackupsDay_v21` is 1.0 MB against a roughly 5 MB origin quota — the backup layer
is close to full already. `BK_INC_LIMIT`/`BK_DAY_LIMIT` (currently 100 incremental / 30 daily,
each a full DB snapshot) could be lowered to buy headroom, but that's a retention trade-off,
not something to change unilaterally.

Verified: `node -c` on every touched file, `check-structure.mjs` (58 script files), the full
probe battery, `check-decisions-wired.mjs` (new). See the deploy verification note below this
entry for the exact list and results.

## 2026-08-23 · Real cost-import path built: js/65's expense_report_capture

**SUPERSEDED — see the entry directly above.** `expense_report_capture` (single-file,
`txn_expense_status` required on every row) was replaced the same day by the two-file join
(`expense_lines_capture` + `expense_gate_capture`) once it was confirmed the real source
doesn't carry that column. Left in place below as the design history — the three-iteration
trail (modal scrape → single-file → two-file join) is worth keeping intact so nobody
re-discovers iteration #1 or #2 from scratch.

Three rounds of cost-capture design happened this same day, each corrected by the last —
recorded in full so a future session doesn't repeat any of the three:

1. **First design (parked, never shipped):** per-invoice modal scrape ("View Assignments"
   iframe), one pre-summed `approved_cost_sar` per invoice. Killed after a real near-miss —
   the iframe element persists between modal opens and doesn't always refresh before being
   read, so a stale reference silently returned the PREVIOUS invoice's figure for four rows
   in a row, every one well-formed and plausible. Caught before any of it reached a
   database; all 4 rows discarded.
2. **Second design (also parked):** same source, function rewired to gate on a
   `txn_expense_status` per row — right instinct (owner's notes: per-line Approved isn't
   enough, the invoice's own transaction Expense Status must read Ready/Issued), but the
   modal-scrape source it was built against had already been abandoned by the time this was
   built, and the exact shape of the real transaction-status join was still unconfirmed.
3. **Real source, found and shipped:** `admin.stats.expense-report`
   (`?of_corporate_client=true`, 219 corporate rows, one row per expense line, has its own
   Export/Fast Excel Export — found by reading the app's own Ziggy route registry out of the
   page source rather than guessing URLs). Cross-verified against the abandoned modal path
   on one real invoice before trusting it (both independently read 12,247.00 for invoice
   <ref>).

**Two real traps in this source, both defended in code:**
- The report's own `expense_status` URL filter does not apply server-side — a request
  filtered to `expense_approved` still returned Pending/Cancelled/Under Review rows
  alongside Approved ones. The importer filters on each row's own status VALUE, never
  trusts a query string.
- Repeated identical (amount, expense_type) pairs on one invoice are real, separate
  expenses, not duplicates — verified: invoice <ref> carries three Hotel Cost /
  RateHawk lines, two at the identical 12,121.16, all three with different approval
  timestamps (13:12:36 / 13:13:08 / 13:13:35). The importer sums every Approved line;
  nothing is deduplicated.

**Built: `js/65-universal-importer.js`'s `expense_report_capture` signature.** Required
columns `invoice_no,amount_sar,expense_status,txn_expense_status` (the last is the
transaction-level Ready/Issued gate, joined in before the file is dropped — not on the raw
report itself). Never creates a new `finance_invoices` row — matches only an
already-live `invoice_no`, or reports it unmatched. Guards, every one independently
verified in the harness (`scripts/qa/probe-expense-report-capture.mjs`, 9 scenarios, all
green): the exclusion list is re-checked even though a live match already implies it passed
once; a cost that would exceed the invoice's own total is rejected (the exact shape of the
stale-iframe class of bug from design #1); a malformed amount on any one line voids that
whole invoice's write rather than guessing which lines to trust; conflicting
`txn_expense_status` values across one invoice's lines are refused rather than picked
between; and — the rule that matters most — **an invoice whose gate reads anything other
than Ready/Issued is left completely untouched, even when it has real Approved lines on
file.** `docs/DECISIONS.md` carries the standing rule.

`scripts/qa/probe-finance-invariants.mjs` also gained a new universal check: no live
invoice may have `cost_sar` exceeding its own `total_incl_vat_sar` — the general form of
the same guard, catching it regardless of which import path a future cost figure comes
through.

**Still open, both flagged rather than silently skipped, per the person who found them:**
- B2C/individual-booking cost is unverified — the expense-report is corporate-only
  (`of_corporate_client=true`); whether the same field covers individual bookings has never
  been checked. Even a perfect corporate capture leaves B2C cost at null; the page must not
  imply completeness there.
- The COGs Report (`admin.stats.cog-report`) loads but returns 0 rows without filters, and
  its filter inputs are Vue components with no readable form-name attributes, so the params
  can't be set from the DOM. If the owner sends a filtered URL (Status=Approved, wide date
  range) directly, that would give `cog_approved` as a real report and could replace this
  whole per-line-sum approach with something simpler — not acted on until that lands.

**Not yet done:** nobody has captured the real 219 rows or the transaction-status join yet
— this entry documents the CODE, verified against a synthetic fixture matching the
confirmed real shape, not a completed data import. `expense_report_capture` will simply not
recognize a file that's missing the `txn_expense_status` column (fails safe — an incomplete
file falls through to "not recognized," never silently applies partial data).

Full regression battery green: check-structure (58 files), csv-injection, finance-export,
leads-counts, money-placement, password-recovery, no-vat-display, finance-invariants
(strengthened), expense-report-capture (new, 9/9), audit-finance-tabs (8×EN/AR),
sweep-pages (141 buttons, 0 errors).

## 2026-08-23 · Client ID beside client name (built) + session/VAT/Ledger owner Q&A

Four owner items relayed by the oversight session, diagnosed live before being reported.

**1. "Stay logged in until they sign off" — app side confirmed already correct, not a code
fix.** Independently re-verified `js/01-v44a`: `createClient` is memoised into one singleton
with `persistSession:true`, `autoRefreshToken:true`, `detectSessionInUrl:true`, and every
other layer's `window.supabase.createClient(...)` call returns that same shared client — no
bug found. Also checked every `signOut()` / `localStorage` call site in the codebase (5
found): two are explicit "Sign out" button clicks, one only shows a banner and signs out on
click (`js/55-session-guard.js`, "read-only, no tokens rotated" by its own design), one
clears legacy `directBusinessData_v*` local-cache keys on sign-in (not the Supabase auth
token), and one (`js/50-v74`) auto-signs-out on a confirmed `active===false` from the
database with an explicit `if(r.error||!r.data)return; // network hiccup — never act on
doubt` guard — a deliberate, defensively-written feature (kicking a switched-off account),
not an accidental-logout source. Nothing on the app side can explain a session not
persisting. The lever is Supabase Auth project config (JWT expiry, refresh-token
rotation/reuse interval) — neither session has a way to read or set that (no management API
in this session's Supabase MCP tools either, confirmed by checking the available tool list).
This is a one-toggle instruction for the owner: Supabase Dashboard → Authentication →
Sessions — check "Time-box user sessions" / inactivity timeout are off or generous if he
wants indefinite persistence.

**2. VAT rule restated positively.** Owner verbatim: "we don't need to mention any VAT. We
just need to mention three things: cost, profit, revenue." `docs/DECISIONS.md` M1 updated —
Finance speaks in exactly three money words, not just "no VAT." Live-verified Clients &
collections already matches exactly (CLIENT / REVENUE / COST / PROFIT columns,
`probe-no-vat-display.mjs` passes). This also settles the `core-04-proposals.js`
flight-quotation VAT-line question flagged last round — no carve-out; the oversight session
is putting the explicit strip-it instruction to the owner directly, not decided here.

**3. "The Ledger is empty" — confirmed data, not code; no rendering bug to chase.** Live:
`TXN.rows=0`, `TXN.loadErr=null`, table/filters/Payment column all work correctly against
zero rows because there are zero live rows in `finance_transactions` (33 rows, all
soft-deleted practice data). Separately, "clients collection is empty" is **no longer
true** — Clients & collections renders real revenue per client (Client M 642,549, Client N
599,347, etc.); what's actually zero is the COST column and "Client credit (held)" — i.e.
item 4 below (cost import) is the real fix, not a Clients-page bug.

**4. Client ID beside the client name — built.** `businesses.direct_client_id` (Direct
Payments portal id) now renders next to the client name in three places, all using the
Ledger's existing muted-badge treatment (`Name #123`, nothing rendered when the id is
unset — never `#null`/`#—`):
- Finance → Clients & collections → "Top clients by revenue" table.
- The Clients page itself.
- The Ledger already had this pattern; unchanged, used as the reference.

`js/16-finance-ledger.js`: added `_finBizDirectId()`/`_finBizDirectIdIndex`, mirroring the
existing `_finBizName()` cache exactly (same lazy-build, same `clearFinCanon()`
invalidation), and `finCanon()` now returns `directId` alongside `name`/`key` when a group
resolves to a linked business — pulled off the already-resolved business, no second lookup,
per the ask. One real bug caught before shipping: the app-side field is `directClientId`
(camelCase, per `js/02`'s `rowToApp`/`appToRow` mapping) — an initial pass read
`direct_client_id` (the raw DB column name) directly off `DB.businesses` entries, which are
already-mapped app objects; caught by testing against the actual harness rather than
assuming the DB column name carries through, fixed in both `js/16` and
`js/core/core-02-leads.js` before commit. Verified in the harness: `finCanon()` called
directly returns the correct `directId`; the Clients-page table renders `#95` for the one
fixture business that has one (`b0`/`L4`... — see file for exact fixture id).

**On cost (item 4's real blocker, not yet built — my view, requested).** Agree the importer
is the right home, not hand-scraped modals written in by SQL — that is exactly the D1
violation that put Takamol in, and Direct Payments' Corporate Expenses page does carry
`INVOICE #` per row, so a per-`invoice_no` join is real, not invented. Agree the simplest
honest shape — one `cost_sar` per `invoice_no`, approved-expense-lines only, nothing else —
is right-sized to "I don't want it complicated." One thing worth flagging: this is a
different, legitimate cost-IMPORT path, not the same thing as `finance_expenses` (the
record-only internal cost log, whose own header comment says its rows may never be
substituted into an invoice's `cost_sar` automatically) — no conflict, this is the "Part 1b"
real-cost-import gap that's been flagged as outstanding since 2026-08-22. Not built this
round; capture-side blockers (per-row DOM reads through 46+ modals, no bulk export) are the
oversight session's lane, not this session's.

Full regression battery green: check-structure (58 files), csv-injection, finance-export,
leads-counts, money-placement, password-recovery, no-vat-display, finance-invariants,
audit-finance-tabs (8×EN/AR), sweep-pages (141 buttons, 0 errors).

## 2026-08-23 · Jargon sweep + Takamol root cause confirmed (direct SQL bypass) + adversarial probe hardening

Owner instruction: sweep every button/note/clarification, remove anything that doesn't
belong, does no good, or is jargon — "especially the drop-down menus for the finance."

**The 18 Finance dropdowns were checked and are clean — left alone.** Spot-verified: every
option is a real business word (Prepaid/Postpaid/Tender, Expenses pending/Ready to
invoice/Invoiced/Overdue, Normal booking/Project (with a proposal), etc.), no dead options
like the "New" chip killed on Leads earlier. Reporting "checked, clean" rather than
manufacturing a change to look responsive.

**Five jargon findings in headings/help text, fixed:**
- `js/58-b2c-manual.js`, `js/57-payment-proofs.js`, `js/45-expenses.js`: cut the
  "— the fifth revenue pattern" / "— the audit file cabinet" / "— the cost behind a
  service" suffixes from three Finance-tab headings — internal spec vocabulary nobody on
  the team could parse, teaching nothing.
- `js/16-finance-ledger.js`: the "Confirmed = has an invoice number, or Expense Status is
  Ready..." help text rewritten plainer, same rule kept intact.
- `js/16-finance-ledger.js`'s import panel: the raw `origin,proposal_ref` column names
  moved out of the visible sentence and into the expected-header code block where they
  belong; the sentence now just says the last two columns are optional.
- **Two sentences were NOT decoration and were deliberately kept, compressed rather than
  deleted** (`js/45-expenses.js`, `js/57-payment-proofs.js`): "these amounts never change
  an invoice's cost or profit" and "wallet top-ups are never counted as revenue" are the
  only thing at the point of use stopping an employee from assuming an expense moved a
  number it shouldn't, or that a wallet top-up is revenue — both hard owner rules. New
  standing rule in `docs/DECISIONS.md`: help text may state a rule the user could
  otherwise violate; it may not explain our architecture; if removing a sentence would let
  someone make a money mistake, rewrite it shorter, don't delete it.
- `js/core/core-10-v29-reports.js:687`: two literal 0x00 bytes inside a string literal in
  `leadSortTieBreak()` (deliberate low-sorting separators, not corruption) replaced with
  the `\0` escape — identical runtime value, but the raw byte made `grep`/tools treat the
  whole file as binary and silently skip it in every source search.

**Takamol root cause CONFIRMED, not inferred.** The exclusion list was correctly seeded
2026-08-21 and correctly wired into all three of this app's import paths — none of that
was the gap. The ten rows entered by direct SQL against Supabase, going around the app's
importer entirely, confirmed directly by the person who ran it. New standing rule in
`docs/DECISIONS.md`: business data enters through the app's own import path, never by
direct SQL — the importer enforces exclusions, dedup and the five-count preview; a direct
write bypasses every one of them, silently. (One self-correction recorded in the same
spirit: an earlier "routine" cleanup of 7 dead `finance_client_links` test rows this same
session was also a direct SQL write — no total changed, own test data, but the rule
doesn't get waived for convenience, so it's flagged rather than passed over.)

**Both new probes independently adversarially verified** (oversight session, not taken on
trust): sabotaged the exclusion list to return `[]` and re-ran `probe-finance-invariants.mjs`
— caught the leak on Clients, both CSV export paths, real exit 1; restored, re-ran clean.
Injected a literal "VAT" label onto a Finance KPI card and re-ran `probe-no-vat-display.mjs`
— caught it on the Finance page and both language passes of Overview, real exit 1; restored,
re-ran clean. One genuine gap surfaced by that adversarial pass: Overview shows KPI sums
only, no client names anywhere, so the finance-invariants probe's text-scan check could never
fail there even if the excluded row's money had leaked into a total — it was structurally
incapable of proving anything on that one tab. Fixed by adding a real numeric check: the
probe now reads the Revenue KPI's exact value straight off its DOM `title` attribute and
compares it to an independently-computed expected sum (all seeded rows except the excluded
one). Verified in both directions again: sabotaging the same exclusion list now fails with
"Revenue KPI shows 362558, expected 48399.00" — exactly the excluded row's 314,159 SAR gap;
restored, clean pass with the real number shown.

Full regression battery green: check-structure (58 files), csv-injection, finance-export,
leads-counts, money-placement, password-recovery, no-vat-display, finance-invariants
(strengthened), audit-finance-tabs (8×EN/AR), sweep-pages (141 buttons, 0 errors).

## 2026-08-23 · docs/DECISIONS.md built + Takamol resolved + two new standing probes

Owner told both this session and the oversight session off, fairly: a written decision
(the in-page "camera" capture, agreed 2026-08-21) got missed by the oversight session
asking him to hand-export files, because the knowledge existed but nothing forced a check
against it at the moment of acting. Built `docs/DECISIONS.md` in response — a short,
ruthlessly pruned list of rules currently binding (RULE / why / date / ACTIVE /
OPEN-CONTESTED / SUPERSEDED-BY, edited in place when something is unlearned, never appended
under). `CLAUDE.md` now points to it as the mandatory first read for anything touching
money display, permissions, or data provenance, with the highest-stakes rules inlined
directly (not just linked) since `CLAUDE.md` is the one file guaranteed to be in context
every turn — a link alone already proved insufficient once.

**Takamol resolved.** Ten live Takamol invoices (6,724,291.12 of a displayed 8,755,055.41 —
overstating BD revenue ~4.3x) turned out to be exactly the verification-service line a
standing rule already excludes; a client record wrongly created for them the day before was
the opposite of exclusion. Owner ruling, verbatim: "No takamol what so ever." All ten
independently re-verified as soft-deleted post-ruling (46 invoices / 2,030,764.29 live,
matches an independent workbook figure within 1.8%). Root cause recorded precisely in
`docs/DECISIONS.md`: the exclusion list existed and was correctly wired into both of this
app's importers — the rows entered through some other path entirely, which no import-time
check can catch. Fixed with a second, independent line of defense: `js/16-finance-ledger.js`
`live()` (the one chokepoint every Finance total/export reads through) now re-checks every
row against the exclusion list on every call, not just once at load — a first version that
only filtered at load time passed a manual reload but silently let the row through on the
real first render, because `finance_invoices` can finish loading before
`DB.settings.financeExclusions` does. Caught by the new probe below before it shipped.

**Two new standing probes, both green:**
- `scripts/qa/probe-no-vat-display.mjs` — rendered-DOM check (not a source grep, since
  `vat_sar` is a legitimate stored column) across every nav page and all 8 Finance tabs,
  EN+AR. Found and fixed two real, previously-unknown violations of the owner's VAT rule on
  its first real run: the legacy Invoices page (`js/core/core-06-v18-v21.js`) had a live
  `Billed inc. VAT` stat tile and a per-invoice `Subtotal | VAT | Total` table column —
  removed both (kept `Subtotal`/`Total`, renamed the tile to `Billed`, dropped the dead
  `'VAT'`/`'Billed inc. VAT'` entries from the Arabic translation dictionary in
  `js/21-v27-arabic-column-header-stat-label-transl.js`). The probe also correctly exempts
  "CR, VAT, IBAN, Wakeel" / "CR / VAT" as a company registration-ID field label (confirmed
  by reading the actual rendered text before excluding it) — a VAT *registration number* is
  a different kind of data than a VAT *amount*, and the rule is about the amount.
  **Open question for the owner, not resolved here:** `js/core/core-04-proposals.js`'s offer
  document (`offerHTML`) shows a `Ticket price | Partner's fees | Service fees | VAT | DIP |
  Total` breakdown on client-facing flight quotations, with `o.vat` a field the BD person
  fills in by hand — a formal itemized fare quote, not an internal report, so left alone
  pending a ruling rather than guessed at either way.
- `scripts/qa/probe-finance-invariants.mjs` — seeds one extra live, non-deleted,
  verified_paid `finance_invoices` row for an excluded client (mirrors the exact shape the
  Takamol mistake produced) and asserts it never reaches any rendered total or any of the
  three real export paths (`finLedgerCSV`, Export ▾ list/full), on the first render with no
  manual reload. This is the regression guard for the race condition described above.

## 2026-08-23 · URGENT FIX: owner locked out of his own account — password-minimum mismatch

`js/02-direct-business-cloud-layer-login-shared-c.js` had two password screens (the
recovery-link "Set a new password" card and the forced first-login change), each hardcoded
to accept a password of 8+ characters. The Supabase project's own Auth policy requires 10+.
So: the form accepted an 8-char password, `sb.auth.updateUser()` then failed **server-side**
with Supabase's own "Password should be at least 10 characters." error — meaning **the
password was never actually changed** — and the next sign-in attempt with the password the
person believed they'd just set came back "Wrong email or password," sending them straight
back to the same reset screen. This is exactly the loop Abdulrahman hit trying to get back
into his own Super Admin account, and it would hit anyone else using recovery or a forced
first-login change.

Fix: a single `var MIN_PW=10;` declared once near the top of the module (comment: must match
the Supabase policy exactly, change together in the same commit if the policy ever changes).
Both `length<8` checks now read `length<MIN_PW`, and both screens now show "At least 10
characters." directly under the "New password" label, before the person types anything —
so the real rule is visible up front instead of surfacing only after a failed attempt.

Verified: `new Function(fs.readFileSync(...))` parse check clean; `check-structure.mjs` OK
(58 files); `scripts/qa/probe-password-recovery.mjs` — the existing dedicated harness for
this exact flow — shows `tooShortError: "Password must be at least 10 characters."` and a
real successful update at password length 14 reaching `/today`, plus all other recovery
behavior (mismatch error, skip-and-sign-in link, forgot-password neutral messaging,
admin-only "Reset password" button, manager blocked) still passing, zero JS errors.

Nobody's password was set or reset as part of this fix — that stays a human action.

