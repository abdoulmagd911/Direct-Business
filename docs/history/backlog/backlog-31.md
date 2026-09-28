## 2026-08-22 · Owner's 4 Finance rulings applied: promo card off, Payment column, standing tab audit

The owner ruled on the 4 pending decisions from the entry below. Three of the four are pure
layout/scope calls already applied here; the fourth ("leave Plan-vs-actual and Monthly revenue
alone, he still needs to check them") is **untouched on purpose** — do not touch those two
blocks until he says so.

1. **Promo codes off the Finance overview, "for now."** `js/25-finance-reporting.js` — the
   promo-code card injection is now gated behind `SHOW_PROMO_ON_FINANCE = false`. `FIN.promos`
   still loads and the separate "How did this revenue arrive?" selector (a different IIFE in
   the same file) is untouched — only the card is switched off. He wants it back later on its
   own page, not deleted.

   **Why this was the right call on the data itself, not just placement** (found after
   removing the block, independently verified against the live `promo_codes` table before
   writing this): the 27,304,067 SAR the card was showing was never real money. Of the 134
   promo codes with `total_sales_sar>0`, **114 are flagged `active` and `expired` at the same
   time** (impossible on a real record) and **131 of 134 have a discount that doesn't match
   their own stated percentage** — e.g. `DIR10`, a 2% code, shows a 7.5% discount rate on its
   recorded sales. All 134 rows carry the identical `created_at` of 2026-08-12 17:25:35, i.e.
   seeded in one batch the day before the real finance data landed (2026-08-13). Verified via:
   ```sql
   select count(*) filter (where active and expired) as active_and_expired,
          count(*) filter (where kind='percent' and abs(round(total_sales_sar*value_pct/100.0,2) - total_discount_sar) > 1) as mismatched_discount,
          count(*) as total_used, sum(total_sales_sar) as sum_sales, min(created_at), max(created_at)
   from promo_codes where total_sales_sar>0;
   -- 114 / 131 / 134 / 27304066.55 / 2026-08-12 17:25:35 / 2026-08-12 17:25:35
   ```
   **If the promo registry ever gets its own page, this table must be CLEARED first, not
   displayed as-is.** Showing a fabricated sales figure 3x larger than real revenue, with no
   flag that it's synthetic, is how it ended up above the fold on the owner's Finance page in
   the first place. The rows were left in place — clearing test data is the owner's call, not
   something to do unasked.

2. **Payment column added to the Ledger tab.** Corrects an earlier miscall in this same round:
   the Ledger tab's transaction table (`rLedger()` in `js/16-finance-ledger.js`) already **is**
   the owner's spec item C, the per-transaction table — it was not missing, it was one column
   short. Added `Payment` (Paid / Partly paid / Unpaid / —) computed per row from
   `amount_received_sar` vs `amount_remaining_sar`. Verified against seeded harness rows: an
   invoiced-and-received row reads "Paid", a pending row reads blank.

   **On live production this column will render but the table under it will be empty**, and
   that is a pre-existing data gap, not a bug in this change: `finance_transactions` currently
   has 33 rows, **all 33 soft-deleted** (`deleted_at` set), none matching the real 1163-series
   invoices — verified directly against the table. They're `TXN-INV-2026-*`/`TXN-COM-*`/
   `TXN-CN-*` rows generated against the archived practice invoices, correctly deleted 2026-08-22
   when that practice data was cleared. The 56 real invoices (`source_batch
   'direct-payments-2026-08-22'`) have **zero transactions** — the transaction data behind them
   was never imported, only the invoices were. So the Ledger — the table the owner's spec is
   built around — has no rows to show on live right now, independent of anything in this repo.
   **Do not fabricate transactions to fill it.** Per the owner's own model (transaction created
   first, tax invoice issued later, expenses approved in between) that data has to come from
   Direct Payments through the importer, the same way the invoices did — generating placeholder
   rows here would repeat the exact mistake just found and removed in the promo table. This is
   likely the single biggest gap standing between the Finance page and being useful to staff.

3. **New standing probe: `scripts/qa/audit-finance-tabs.mjs`.** Owner ruling #3 was "keep all
   8 tabs, but make every bit inside each one working" — so a probe was written to check exactly
   that, walking all 8 tabs (Performance, Clients & collections, Ledger, Report Builder, Import,
   Expenses, Payment proofs, B2C) × EN/AR and asserting: every `onclick`/`onchange`/`oninput`
   handler resolves to something real, the tab renders non-trivial settled content, no tab
   switch is slow, no JS/console errors. Built with two specific false-positive classes guarded
   against up front (both hit and fixed during this same round, see below), and independently
   re-verified against a fresh 8-tab list derived by reading `finTabs()` plus grepping every
   `finGo('` call site in the codebase — not taken on trust.

   Two bugs found and fixed in the probe itself before trusting a green run:
   - **Handler-checker false positive on `document`.** The Import tab's file-drop zone calls
     `document.getElementById('finFile').click()`; the checker's first pass required every
     resolved global to be `typeof === 'function'`, so it flagged `document` (an object, not a
     function) as an "unresolved handler" in both EN and AR. Fixed by also accepting a resolved
     name that is a real object (`fn != null && typeof fn === 'object'`), which still catches
     genuinely undefined names.
   - **"Slow tab switch" false positive on first-visit Expenses.** First run flagged EN
     `expenses` at 826ms as a "freeze-class regression" but AR `expenses` (the second visit, same
     run) was 139ms. Read `js/45-expenses.js`'s `load()`: it guards on `EXP.loading` and only
     fetches `finance_expenses` when `EXP.rows==null`, i.e. exactly once per session — so the
     826ms is one real Supabase round-trip on first visit, not a regression, and it isn't touched
     by anything in this round's changes. Left as expected first-load latency, not "fixed."

   Final clean run: 16/16 tab×lang checks pass — all handlers resolve, no empty tabs, no slow
   switches, zero JS/console errors. Also ran the full regression battery (`check-structure.mjs`,
   `probe-csv-injection.mjs`, `probe-finance-export.mjs`, `probe-leads-counts.mjs`,
   `probe-money-placement.mjs`, `sweep-pages.mjs`) — all green.

## 2026-08-22 · Finance-tab freeze fixed (pure perf); page does not match owner's spec — his call, not fixed

The owner opened Finance and called it a disaster: a real freeze, plus the live page not
matching his own written spec (Cowork doc "Finance Model Master Reference + Finance Page
Spec", Part 5 — one page, one filter bar, one KPI strip, one row-per-transaction table with
expand/export/import; live reality is 8 tabs, 3 unrequested blocks on the Performance view
including a promo-code block claiming 27,304,067 SAR against 8,755,055 real revenue, and the
spec's actual centrepiece — the transaction table — isn't on the page at all). **Nothing about
the layout/tabs/blocks was touched here** — he has 4 pending decisions (promo codes' home,
keep/move/cut Plan-vs-actual and Monthly revenue, which of the 8 tabs survive, building the
missing transaction table) and guessing at any of them is exactly what produced the current
page. Also reconfirmed, verbatim, a rule already settled twice in writing: **VAT is never
shown or mentioned, anywhere, at any stage — no VAT split is to be built.** The only real
issue behind the 100%-margin look is `cost_sar = 0` on all 56 invoices, which the page already
self-flags; cost must come from approved expenses (Part 1b), not a VAT computation.

**The freeze itself is a pure bug, not a design question, so it was fixed.** Clicking a
Finance tab while the page is still loading locked the browser 45+ seconds (owner reproduced
twice; no probe in this project's history has ever caught it, because every probe — including
every one written this session — waits for load to finish before doing anything, which is
exactly the window this bug lives in). Root causes, both confirmed by reading the actual code
before touching it:
1. `_finBizName()` (`js/16-finance-ledger.js`) did a plain linear scan over every business,
   called once per invoice row via `finCanon()` — O(rows × businesses) on every Clients/
   Overview/Report-Builder finance render. Indexed once per cache lifetime instead (a plain
   object keyed by business id), invalidated on the exact same `clearFinCanon()` calls the
   existing client-name cache already relies on, so it can never go stale independently of
   that cache.
2. `finGo()` (tab-switch) called the GLOBAL `render()` — which runs `buildNav()`,
   `applyLang()`, `renderTopExtras()`, and, since `'finance'` isn't a key in the base
   `render()` dispatcher, a full **wasted** `renderDash()` computation over every business
   that gets thrown away the instant `renderFinance()` overwrites the same `#view.innerHTML`
   right after — a second, independently-found waste beyond what was reported. None of that
   depends on which Finance tab is active, so `finGo()` now calls `renderFinance()` directly
   on the already-open Finance view instead of the whole app's render chain.

Verified as a pure optimisation, not a behaviour change: captured the exact rendered text of
the Clients, Ledger, and Report-Builder tabs under the OLD code (via `git stash`) and the NEW
code, byte-for-byte identical on all three (735/1167/728 chars respectively, `diff` empty).
Could not reproduce the exact 45-second freeze in the QA harness itself — the mock backend
responds near-instantly and the fixture is smaller (60 businesses vs 108 real), so the
"loading window" this bug lives in barely exists there; the fix is verified by complexity
(O(rows×businesses) → O(rows+businesses)) and by output-equivalence, not by reproducing the
symptom under a mock that structurally can't reproduce it. Full regression battery clean:
`check-structure.mjs`, `probe-finance-export.mjs`, `probe-csv-injection.mjs`,
`probe-leads-counts.mjs`, `probe-money-placement.mjs`, `sweep-pages.mjs` — all green, EN+AR,
0 console errors.

## 2026-08-22 · Bulletproof oversight round — CSV formula injection + silent money-parsing bugs

A parallel "oversight session" (separate sandbox, no shared filesystem, no push rights — every
finding relayed as text and independently re-verified here before anything was applied) split
a pre-launch audit by angle. This entry covers the code-side fixes; the session's own DB/RLS/
storage-bucket findings were relayed separately and are not repeated here.

**CSV / spreadsheet-formula injection — real, not theoretical.** All 7 CSV export paths quoted
per RFC-4180 (wrap in `"..."`, double embedded `"`) but that is NOT protection: Excel strips the
CSV quoting on open and still evaluates a cell whose first character is `=`, `+`, `@`, or a bare
`-` that isn't a real number. Proved directly: `=HYPERLINK(...)` executes on open, and a real
client name like "-Al Rajhi Trading" becomes a broken formula instead of a name. Fixed with one
shared `csvGuard()` (`js/core/core-01-foundation.js`, loads before every exporter) — prefixes a
dangerous leading character with a literal apostrophe so Excel treats the cell as text, and is
number-aware on the `-` case specifically so a credit note/refund like `-1500.50` stays a real
negative number and `SUM()` in the sheet still works. Wired into all 7 builders: `core-05-
records.js` (`csvCell`, used by the whole Export ▾ menu), `js/16-finance-ledger.js` ×3
(`finLedgerCSV`, `finTxnCSV`, the Report Builder's own export), `js/09-funnels.js` (`q()`),
`js/45-expenses.js` (`expCSV`), `js/57-payment-proofs.js` (`proofCSV`). Three of those only
quote a cell when it already needs it (comma/quote/newline) — added `charCodeAt(0)===39` so a
cell we just guarded is still force-quoted, or the leading apostrophe would show up literally
in the sheet instead of just suppressing formula evaluation.
New guard: `scripts/qa/probe-csv-injection.mjs` — plants hostile cells into `FIN._csvRows`,
fires the real `finLedgerCSV()` button, reads the real downloaded file, unquotes it the way
Excel does, and asserts 0 executable cells AND a legitimate negative number survives unguarded.
Verified both directions: 0 executable cells with the fix, 6/6 execute without it.

**Silent 1000x money-parsing error — the dangerous one, not the loud ones.** Every manual
amount field (`js/45-expenses.js`'s expense amount, `js/58-b2c-manual.js`'s individual-booking
amount and cost) parsed with `parseFloat(String(v).replace(/[^\d.]/g,''))`, which has three
distinct failure modes:
- Arabic-Indic digits (١٢٣) and Extended Arabic-Indic/Persian digits (۱۲۳) are stripped
  entirely (JS's `\d` only matches ASCII 0-9) — an amount typed on an Arabic keyboard, normal
  for this app's staff, silently became empty, then 0, then a generic "amount required" alert
  with no clue why. Loud, but confusing.
- A leading `-` was stripped too, silently flipping an intended negative/credit entry positive.
- European-style formatting (`"1.500,50"`, dot=thousands/comma=decimal) parses under naive
  digit-stripping as `1.5005` — **wrong by a factor of 1000, and still passes every `>0` guard**,
  so it was stored silently wrong. This is the one that mattered: the other two fail loudly
  (blocked by the app's own `amount>0` check and, for expenses, by
  `finance_expenses_amount_sar_check CHECK (amount_sar > 0)` at the database level too), but a
  wrong-but-positive number sails straight through every guard that exists.
- `b2c-manual.js`'s `cost` field had no `>0` guard at all (only `amt` did), so a mis-parsed cost
  landed straight in `cost_sar` and flowed into the Profit card with zero rejection.
Fixed with one shared `parseMoneyInput()` (`js/core/core-01-foundation.js`): normalises
Arabic-Indic/Extended-Arabic-Indic digits and Arabic decimal/thousands separators (٫ ٬) to
ASCII, disambiguates `"1,500.50"` vs `"1.500,50"` by treating the rightmost separator as
decimal, treats a repeated same-type separator (`"1.500.500"`) as valid ONLY when every group
after the first is exactly 3 digits (so `"1500.50.25"` — a typo, not a real number shape — is
correctly rejected rather than silently truncated), and preserves a leading sign. Returns `NaN`
for anything that doesn't parse cleanly — never 0 — so every existing `>0` guard keeps working
exactly as before; malformed input still reaches the same "amount is required" rejection it
already had, it just no longer misparses first. Added a `cost` guard to `b2c-manual.js`
(rejects only a value that failed to parse; 0/blank still passes, since a genuinely free/no-cost
booking is legitimate — this doesn't newly block anything that worked before).

**The 4 finance delete/restore functions had a live RLS-silent-failure bug**, found while
tracing the export bug: `finDelInv`/`finRestoreInv`/`finDel`/`finRestore`
(`js/16-finance-ledger.js`) all called `.update(...).then()` with no `.select()`. Supabase
returns no error when an RLS policy silently matches zero rows, so a delete/restore a viewer
wasn't allowed to make looked like it worked — modal closes, row appears gone — then reappeared
on the next refresh with no explanation. Added `.select()` + an empty-data check to all four
(bilingual alert), and made `finDel`'s confirm dialog bilingual (it was English-only while
`finDelInv` right above it already was). Inert today — every active account is `finance:editor`,
verified 0 non-editors — but fires the day the owner sets a new hire to a role without
finance-edit rights.

Also independently re-verified two things reported by the oversight session, not touched here:
confirmed via SQL that on all 56 live invoices `revenue_sar = total_incl_vat_sar` (gross, VAT-
inclusive), `vat_sar` is null, and `cost_sar = 0` — the Finance page's "Revenue"/"Profit" cards
are currently showing gross with zero cost, not net figures. Totals are internally consistent
but the field *meaning* is wrong; this needs the owner's ruling on gross-vs-net display and on
where approved-expense cost should come from (only 1 row exists in `finance_expenses` today,
18,500 SAR) — data-load correction, not a code bug, left for the owner to rule on rather than
silently "fixed" by writing numbers.

Verified before push: `check-structure.mjs` OK (58 files) · `probe-csv-injection.mjs` (new,
both directions) · `probe-finance-export.mjs` · `probe-leads-counts.mjs` ·
`probe-money-placement.mjs` · `sweep-pages.mjs` — all clean, EN+AR.

## 2026-08-22 · Go-live UI audit round 2 — real fixes, six files

Six real, independently-verified fixes from a second pass of the go-live UI audit (built in
the first pass, `scripts/qa/audit-ui-golive.mjs`):

1. **`index.html`** — a `min-height:26px` floor on `.btn.sm`, `.btn.ghost.sm`, `.seg button`,
   `.segbtn`, `.inp.sm` (30px under `@media(hover:none) and (pointer:coarse)`, real touch
   devices) survives inline `padding:1px 7px` overrides used by row-action buttons across 6+
   files, since those overrides never touch `min-height`. Verified rendered height: Clients
   "Edit" button 16px → 26px. Also: `.inp` (used 45+ times for Settings' access/role pickers
   and several forms) had **no CSS rule at all** — those inputs/selects were on bare browser
   defaults. Added `.inp`/`.inp.sm` modelled on the existing `.field input` style. Verified
   rendered: a Settings `.inp` select now has a real 1px border, 9px radius, 30px height.
2. **`js/09-funnels.js`** — two hardcoded-English lead-card warnings ("No contact person
   recorded", "Next action overdue") are now bilingual.
3. **`js/core/core-06-v18-v21.js`** — the accessibility skip-link's "Skip to content" text
   is now LANG-aware at injection time; given an id (`v21SkipLink`) so it can also be kept in
   sync on a later language switch (see #5).
4. **`js/core/core-08-v25.js`** — real bug, not just a translation gap: the OTHER skip-link
   (`#v25SkipLink`, `href="#view"`) was labelled with the `backToList` string ("Back to
   list"/"العودة إلى القائمة") — wrong information for a screen-reader user, since it isn't a
   back link. Added a real `skipToContent` key (EN+AR) and pointed the skip-link at it.
5. **`js/21-v27-arabic-column-header-stat-label-transl.js`** — both skip-links are inserted
   once as the first child of `<body>`, a sibling of `#view`/`.top`, not a descendant of
   either — so no amount of tweaking `scopeTranslate`'s selector list would ever reach them.
   Added a dedicated `patchSkipLinks(isAr)`, same shape as the existing `#gsearch` placeholder
   patch (direct by-id patch + remembered original for restore), called from both branches of
   `v27ArHeaders()` so a language switch after first load keeps them correct too.
6. **`scripts/qa/audit-ui-golive.mjs`** — the Latin-leak check was flagging real DATA (person
   names, company names) as translation bugs on Arabic pages, burying genuine gaps in noise.
   Excluded: any string matching a name-ish field pulled live from `DB` (walks every array —
   `name`/`nameAr`/`full_name`/`account_manager`/etc.), the `Direct <Product>` proper-noun
   family, a bare `<b>`/`<strong>` leaf inside a `.card` (record title), and anything inside
   `.foot` (the sidebar signed-in chip) or exactly matching the signed-in person's own name
   (which also appears, undecorated by `.foot`, in the Today greeting). Two real bugs found
   and fixed in the exclusion logic itself before trusting it: the word-boundary regex didn't
   include digits, so a fixture name like "Test Company 38" matched only as "Test Company"
   and never equalled the real name in the exclusion set; and the signed-in name was only
   compared against a leaf's *full* text, not the regex-matched *substring*, so it wasn't
   recognised inside a longer decorated string like "☀️ يومك — QA Test Account". Adversarially
   re-checked after fixing both: injected a fake untranslated string into a live Arabic page
   and confirmed the probe still caught it before trusting "FINDINGS: none" on the real run.

Separately, done directly against production Supabase, nothing to commit here: revoked `anon`
EXECUTE on `app_role`, `my_page_access`, `page_access`, `can_see_page`, `can_edit_page`,
`team_nicknames`, `log_page_denied`; `undo_change` and `record_history_write` needed
`REVOKE ... FROM PUBLIC` specifically (revoking from `anon` alone is a no-op when `PUBLIC`
still grants it — `anon` inherits `PUBLIC`) — `undo_change` is now authenticated-only,
`record_history_write` callable by nobody over the API. Verified via `pg_proc.proacl`: every
one of those functions now shows only `{postgres, authenticated, service_role}` (or narrower
for `record_history_write`), no `anon`, no bare public grant. The Supabase Auth Site URL /
redirect allow-list change (away from `direct-business.vercel.app`, onto
`www.directksab2b.com`) could not be independently re-verified from here — no tool in this
session reads GoTrue's auth config — so that one claim is relayed, not confirmed.

## 2026-08-22 · Phantom records cleared — the Leads-page "+8" was a hardcoded re-seed, not a display bug

The prior Leads-count fix (funnel/chip/table agreement) still left the funnel "All" tab
reading 8 higher than the real table. Root cause: `js/core/core-06-v18-v21.js` hardcoded 8
B2B clients from an old `Q:\Downloads\B2B.xlsx` import (`B2B_CLIENTS_V21`) and re-injected
them into `d.businesses` on **every page load**, inside `migrateV21` step 3. They were never
rows in the `businesses` table. 7 of the 8 duplicated a client that already existed in the
database under its real name — the team was seeing Client PS twice and
Client RC three times (`b_rcc_vip` and `b_rcc_team` both duplicated the one real "Client RC" row).

**Code change:** `B2B_CLIENTS_V21` is now `[]`. `migrateV21` step 3 no longer seeds anything,
and now also strips any phantom row an older build already injected into a session's local
DB object (`_v21added` + synthetic `b_`-prefixed id on `d.businesses` only), so an existing
open tab heals itself on its next load instead of carrying a fake client forward forever.
Verified by grep that the strip predicate can never touch a real record — only 3 places in
the file ever set `_v21added:true` (airlines, vendors, this seed list), on non-overlapping id
prefixes and different arrays; the one real pre-v21 lead sharing a `b_` id (`b_client_m`) is never
tagged `_v21added`.

**The one entry with no database counterpart, dropped but preserved here** in case it still
needs to be entered for real, through the UI, by a person who confirms it first: **Riyadh
Economic Forum / منتدى الرياض الإقتصادي** — segment "Forum/event", entity type "Government
entity", payment configuration "Tender", customer type "Tender", note "Per WhatsApp findings"
(this was never verified against Direct Payments — that's exactly why it shouldn't be
auto-seeded again without a person confirming it first).

**Database cleanup** (done separately, verified independently against production via SQL
before trusting it): 2 duplicate synthetic rows — "Client RC" and "the conferences client" (old seed id pattern `a13e0000-0000-4000-8000-1...`, `direct_client_id` null) —
archived (`archived_at` + `archived_by='cleanup-2026-08-22-duplicate-of-direct-import'`, not
deleted) because each duplicated a real Direct-Payments-imported row under the same name
(`direct_client_id` 8 and 23). Confirmed by direct query: 108 live rows (80 leads / 28
clients), 0 duplicate names remaining, exactly 2 archived. 8 other rows share that same old
synthetic id pattern but are the **only** copy of their record and were correctly left alone:
Client B, Client J, Client K, Client Ml,
Client Mw, Client M, Client Rw, Client SF.

Verified before push: `check-structure.mjs` OK (58 script files) · `probe-leads-counts.mjs`
OK (funnel/chip/table agree in both languages and both hide-closed states, refresher fires
both directions) · `sweep-pages.mjs` PASS (144 EN buttons + full AR nav check, 0 errors).

## 2026-08-22 · Branch cleanup follow-up: appraisal boundary, finance rules, one closed reconciliation

Three corrections from Abdulrahman, same day as the branch cleanup below:

1. **`docs/APPRAISAL_TOOL.md` removed from the repo, permanently.** The appraisal / KPI /
   task-manager project (Supabase `directksa-performance`, ref `byhxnmafaumersoaiybq`) is a
   different project Abdulrahman does not want this repo anywhere near — "it's totally
   different and I don't want to get near it." That file was a read-only survey of it, but it
   carried named staff appraisal scores and belonged to that other project regardless. New
   standing rule added to `CLAUDE.md` and `docs/DIRECT_SYSTEMS_PLAYBOOK.md` §5 marking that
   whole project out of scope — never read, write, or document it here.
2. **Finance rules confirmed and added to the playbook (§3):** only a Fully Paid tax invoice
   counts as revenue; VOID is excluded from every total everywhere; a transaction with
   expenses registered is "recorded and tracked" until its tax invoice is issued (Direct
   waits for the money before issuing), so the gap between work-done and invoiced is normal
   and must show as its own "Not yet invoiced" section, split Ready vs Pending — live 22 Aug:
   54 transactions / 1,133,517.20 SAR (17 Ready, 317,115.18 SAR · 37 Pending, 816,402.02 SAR).
3. **The open reconciliation flag in the playbook §2 is closed, not real.** The small
   7,389.40 SAR gap found while reconciling it traced to mixing transaction references into
   a tax-invoice total: refs `<ref>` / `<ref>` are VOID transactions, refs
   `<ref>` / `<ref>` are live transactions still "Published - Pending Payment" —
   none of the four is actually a tax invoice. Once excluded correctly the gap disappears.
   Full detail and the corrected reconciliation note live in the playbook itself — do not
   re-open this without genuinely new evidence.

No GitHub support request for the 2026-08-13 real-data exposure (`im9o80` branch) —
Abdulrahman confirmed no internal reporting is needed; the branch is simply deleted as part
of the same cleanup.

## 2026-08-22 · PROMOTED TO PRODUCTION — handoff-docs merged into claude/new-session-9fhlp1

Abdulrahman approved promotion explicitly (he was locked out of Super Admin and the
password-recovery fix was the only way back in). Merged `claude/handoff-docs-2026-08-10-6n5ihq`
into production as commit `e9c40bf` (merge parent `918b071`), pushed, Vercel deployed and went
Ready. **Production is now current** — the "100+ commits behind" gap from earlier today is
closed.

**3 conflicts resolved**, exactly as scoped in the earlier technical brief:
- `index.html` — mechanical script-tag concatenation; production stopped at `js/61`, this adds
  `62-finance-guardrails`, `63-undo-and-real-audit`, `64-page-access-enforce`,
  `65-universal-importer`.
- `js/09-funnels.js` — handoff-docs is a strict superset (adds the Arabic half of an
  already-shipped export button); took it whole.
- `js/16-finance-ledger.js` — the real judgment call. Production's `rLedger()` had none of the
  `TXN.*`/company-profile scaffolding at all (git's line-level diff made the conflict look
  partial; it wasn't — checked both full function bodies directly), so this replaced production's
  entire old invoice-grouped `rLedger()` with handoff-docs' newer company-grouped
  confirmed-only Transactions view, per the recommendation already given to Abdulrahman before
  he approved.

**Verified on the actual merge result** (not on handoff-docs alone, per explicit instruction):
`check-structure.mjs` (58 files, clean), `sweep-pages.mjs` (144 buttons/18 pages, 0 errors,
EN+AR), `probe-money-placement.mjs` (money stayed off Leads/Clients), `probe-role-nav.mjs`
(6/6 roles reach exactly what they should), `probe-page-access-enforce.mjs` (0 failures),
`probe-password-recovery.mjs` (full green, including two new checks — see below).

**Two more fixes folded into the same push**, both from Abdulrahman mid-promotion:
1. **`vercel.json` — his team must only ever land on `www.directksab2b.com`.** Added 307
   (reversible — 308 would get cached hard by browsers) host-based redirects for the two
   *stable* vercel.app aliases (`direct-business.vercel.app` and
   `direct-business-abdoulmagd911s-projects.vercel.app`) only — never a wildcard, so every
   per-deployment and git-branch preview URL keeps working untouched. The existing `/brand`
   rewrites and the `/index.html` catch-all are unaffected (Vercel always runs redirects before
   rewrites, regardless of array order in the file). Verified live: both aliases 307 to the
   real domain with the path intact (`/leads` → `/leads`); a deployment preview URL and the
   git-branch preview alias both still return 200.
2. **Recovery-dialog clarity.** Abdulrahman clicked his own reset link, got a bare two-box
   password form with no explanation, closed it without typing (he only wanted to sign in),
   and ended up signed in on a password he doesn't know. `js/02`'s recovery card now says
   "Choose a new password for `<email>`" and adds a visible "Only wanted to sign in — skip
   this" link that continues straight into the app on the session the link already created —
   losing nothing except the chance to also set a password right then. Extended
   `probe-password-recovery.mjs` with checks for both (account name shown, skip works,
   signs in, cleans the token off the URL) — green.

**Live verification, not just Vercel's status:** fetched `https://www.directksab2b.com/`
directly and counted script tags — **58 files total** (10 `core/` + 48 top-level), highest
numbered `js/65-universal-importer.js`, with 62/63/64/65 all present as expected.

**Reset links sent for real**, through the app's own flow (the live `admin-users` edge
function's `send_reset_link` action, signed in as the `test@directksa.com` test admin account
— never a real staff password) to `a.hassan@directksa.net` and `aboelmagd@directksa.com`.
Both returned `{"ok":true}` and both logged to `record_history` (`table_name='access'`,
`action='reset_link_sent'`) with no password anywhere in the log. SMTP delivery itself still
can't be confirmed from this sandbox — only Abdulrahman checking his inbox can close that loop.

**Flagged, not touched:** `app_users` shows `a.hassan@directksa.net` at role `team_member`,
not `admin` — `docs/ROLES_AND_ACCESS.md` (2026-08-13) lists him as a Super admin. Could be an
intentional later change or a real gap; didn't correct it without asking, since role changes
are exactly the kind of action that needs a person's sign-off, not an inference from a
mismatched doc.

**Mirrored back onto `claude/handoff-docs-2026-08-10-6n5ihq`** (commit `89b6876`) so the branch
matches what's actually live and the next promotion doesn't re-conflict on these two files.

Real-money import into Finance was explicitly NOT done — deliberately deferred until
Abdulrahman is back to review it himself.

## 2026-08-22 · Password recovery — launch-critical, built and verified in the harness

Pushed as `3a73723`. Abdulrahman was locked out of his own Super Admin account (only had
Othman's test session), so this jumped ahead of everything else. Three pieces, all now live
in this branch (not yet promoted — see the promotion entry below):

1. **A real pre-existing bug, found and fixed.** A recovery email link was supposed to show
   a "choose a new password" screen, but a race condition in the sign-in code meant the
   ordinary sign-in check usually won the race and signed the person straight into the app
   instead — without them ever setting a new password. Fixed in `js/02` by checking for a
   recovery link before the ordinary sign-in check even starts, so it can no longer be raced.
   Caught only because the QA probe was driven end-to-end, not by reading the code.
2. **"Forgot password?" on the sign-in screen** — already existed and was already correct
   (same neutral message whether or not the email is a real account); verified, not changed.
3. **New "Send reset link" button in Team & Access, admin-only.** Replaces the old flow
   where an admin/manager typed and could see a person's new temporary password. Now nobody
   but that person ever sees their own password — the button just emails them Supabase's own
   reset link. Restricted to admins (not managers, per Abdulrahman's explicit reasoning:
   resetting someone's password is effectively becoming them). Every send is logged to
   `record_history` as an `access` / `reset_link_sent` row — who sent it, for whom. Backing
   edge function (`admin-users`) deployed live as version 5, additive-only diff, smoke-tested.

Verified end-to-end in the QA harness (`scripts/qa/probe-password-recovery.mjs`, new):
recovery screen (wrong-match / too-short / success), forgot-password neutrality, and the
admin button (admin sees + can send; manager does not see it, and a direct API call bypassing
the UI is still refused server-side). Full regression (`check-structure.mjs`, `sweep-pages.mjs`)
clean. Arabic spot-checked on the new button and its confirmation text.

**Cannot be verified from this sandbox: whether SMTP is actually configured on the real
Supabase project**, i.e. whether the reset email actually lands in an inbox. The only way to
know is a human clicking "Forgot password?" on the real sign-in screen and checking their
own inbox — Abdulrahman doing this himself is the fastest way to confirm end to end.

**Separate, unrelated, non-blocking observation surfaced while testing this:** signing in
normally and landing on `/today` shows the businesses list as empty even though the API call
underneath correctly returns rows — reproduced with an ordinary sign-in, nothing to do with
recovery. Not investigated further; noted here for a later session to pick up.

## 2026-08-22 · PROMOTION IS THE CRITICAL PATH — production is 100+ commits behind

**Confirmed by diffing branches directly:** Vercel's production branch (`claude/new-session-9fhlp1`)
last moved 2026-08-21 and does not carry ANY of the work on `claude/handoff-docs-2026-08-10-6n5ihq`
since they diverged — not the file-split's later chapters, not the world rebuild, not the
Direct Payments importer, not any of the Arabic fixes across 4 rounds today. Production has 4
commits of its own (CRM/Finance audit fixes, 2026-08-20/21) that handoff-docs does not have.
Abdulrahman is deciding whether to promote; this repo is not merged/pushed to production —
only prepared and verified in a throwaway worktree, never committed anywhere real. Full
technical brief (conflicts, resolution, rollback) given in chat. **When he approves: merge
handoff-docs → new-session-9fhlp1, resolving index.html (script-tag concat) and
js/09-funnels.js (take handoff-docs, strict superset) mechanically, and js/16-finance-ledger.js
as a real judgment call — production's rLedger() is the old invoice-grouped view, handoff-docs'
is a newer company-grouped "confirmed-only" Transactions redesign (Round 7/8 work); recommended
take is handoff-docs' version, but confirm before merging since it changes what the Ledger tab
shows to production's real users on day one.**

## 2026-08-22 · Round 4 — banner/Credit-Pool/Settings-card fixes, sweep's Brand mislabeling found & fixed

Pushed as `f778b79`. Follow-on to Round 3. The owner pushed back on three "deliberately
deferred" calls from Round 3 and was right to: the read-only sync banner (Bookings/Invoices/
Tickets), Today's Commercial Credit Pool widget, and Settings' "Admin & history" card were all
genuinely fixable, not admin-only dev-tooling — all three now translate. Also traced why the
sweep never caught the pagination bar and had spurious duplicate findings under "Brand": Brand
is `window.open('/brand/','_blank')`, not an in-app view, so clicking it in the headless
harness silently re-scanned whatever page was already showing (Tickets) under the wrong label.
Removed it from the sweep's page list and added a page-title verification so any future nav
item with the same shape gets caught with a clear message instead of silent misattribution.
Also split the sweep's Latin-run findings into CONFIRMED-GAP (not inside a raw `<td>`) vs
PROBABLY-DATA (inside one) per the owner's explicit request, so a real gap doesn't sit next to
"Test Company 9" in the same line. Full details and live verification in chat; regression clean.

