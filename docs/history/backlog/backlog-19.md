## Routine fire #17 (2026-09-11 02:11 UTC) — the MONEY surface (Finance Performance + Clients) reconciled to SQL; M1/M8 honest-gap doctrine confirmed rendering LIVE
Went at the highest-stakes area: does the Finance money the app SHOWS match the real finance_invoices,
and is the unknown-cost gap handled honestly (M1 clean cost/profit/revenue; M8 never fabricate a cost)?
SQL ground truth over the 46 live invoices (deleted_at is null): revenue 2,030,764.29 · cost 1,538,141.70
· profit 492,622.59 · **VAT 0.00 · wallet 0.00** (so revenue==total here) · profit_sar == revenue−cost on
every row (0 mismatches). The DB is clean of QA-probe leftovers.
The one thing worth the dig: the "19 of 46 with no cost" that CLAUDE.md calls an honest gap are stored as
`cost_sar = 0` (NOT null), so their profit_sar == full revenue — 214,550 SAR, i.e. **43.6% of the headline
profit comes from unknown-cost invoices.** That is the exact M8/M1 trap. Verified the app does NOT fall into
it — it renders the gap honestly at all three levels (confirmed against the live-DB screenshots):
- Performance/overview headline is the stored figure (Rev 2.03M / Cost 1.54M / Profit 492.6K, matching SQL
  to the SAR, with an exact rounding-reconciliation note) BUT carries the flag
  "⚠ 19 of 46 invoices in this period carry no recorded cost — margin may read higher than reality."
- Clients & collections: a client with no cost on ANY invoice prints cost "not recorded" / profit "unknown"
  (js/16 _cCell/_pCell) instead of booking full revenue as profit; partial-cost clients carry a ⚠; the total
  row reconciles (2,030,764 / 1,538,142 / 492,623) and the footer warns the profit total is "an upper bound,
  not a final figure."
- No VAT enters any of the three money figures anywhere on the surface (sum_vat is 0 in the data too).
Conclusion: the money surface is exemplary — numerically exact against the real DB and honest about the
unknown-cost gap at row, client and period level. **0 defects.** M1 ACTIVE and satisfied; the M8 doctrine is
not just documented but implemented and rendering. No new oversight commits this fire (HEAD 766b054).

## Routine fire #16 (2026-09-11 00:11 UTC) — Leads SEARCH + STAGE-FILTER CHIPS driven by real DOM events vs the REAL DB
Went past the read-only page-walk into the core daily interaction that has been silently broken before
(the 2026-08-09 chip no-op bug, where clicking a chip highlighted it but filtered nothing). Drove the
actual DOM against the REAL database (scratchpad/live-leadfilter.mjs, same direct-proxy + predicate-matcher
+ bridge): typed into #lq, clicked every stage chip, and reconciled the visible row count against
matchLead over the live 80-lead dataset. **The filters work correctly — 0 defects.**
Reconciled exactly against SQL on the real DB (leads=80: new:53, contacted:25, lost:2; 0 QA-probe
leftovers — the DB is clean):
- search "DirectFN" → 1 row = matchLead's 1 (search narrows correctly; clearing returns to base).
- chip Prospect → 53, Contacted → 25, Lost → 2 — all match the real per-stage counts.
- The 6 raw "findings" the probe first flagged are naive-probe artifacts, NOT app bugs, and were run
  down to their cause: (a) `hideClosed` DEFAULTS true (js/core-10-v29-reports.js:692), so the 2 `lost`
  leads are hidden at rest → 78 of 80 shown; the "all" chip keeps hideClosed on (78), and leadClearFilters
  turns it off → 80. Intended. (b) Qualified/Proposal/Won have 0 real leads, so the table renders a single
  empty-state placeholder `<tr>` — the probe counted it as "1 row". Not a defect.
Takeaway: the historically-broken chip filter is confirmed genuinely working, live, against real data.
No new oversight commits this fire (HEAD be02fcd).

## Routine fire #15 (2026-09-10 22:12 UTC) — EMPLOYEE access model verified LIVE in-browser (fire-#3 + #7 fixes)
Set the QA account to team_member (grant: today/leads/clients/finance; reversed to admin right after)
and drove it in a browser against the REAL database, signing in at TYPING speed (8s on the form) — the
exact window my fire-#3 matrix fix + the fire-#7 settled() gate cover. Result, clean:
- role=team_member, **matrix loaded (fire-#3 fix confirmed LIVE for an employee)**, 9 nicknames, allowed
  = [today,leads,clients,finance].
- The sidebar exposes ONLY the four granted pages — no leak of ungranted ones.
- All 11 UNGRANTED pages (settings, offers, events, ops, reports, airlines, vendors, sopsla, activity,
  archive, documents) bounce to Today WITH the access banner — the fire-#7 settled() gate + my js/64
  banner working correctly for an employee, against real data.
- granted today/leads/clients render clean; the one "finding" (finance 27 chars) is the same known
  probe load-race as fire #13 ("Loading the finance ledger…" caught before the real-DB rows arrived),
  not a defect.
Zero real defects. The access model — the thing the owner's original "not working properly" turned out
to be about — is now confirmed working end-to-end for the majority role, live, in a browser.
No new oversight commits this fire.

## Routine fire #14 (2026-09-10 20:11 UTC) — real detail cards driven in-browser; the empty Ledger explained
Went deeper than the page-walk: opened 6 real leads + 6 real clients as DETAIL cards (where the
v33–v36 + people-bridge + client-address injection layers stack) and the ledger, EN and AR, against
the REAL database (scratchpad/live-details.mjs, same direct-proxy + predicate-matcher + bridge). All
12 cards rendered clean — 1600–1900 chars each, real names, no NaN/undefined/blank, no JS errors.
0 defects.
RESOLVED a question the browser surfaced: the Ledger tab shows "No transactions recorded yet — the
ledger is empty" with Confirmed revenue/cost/profit all 0, WHILE the Performance tab shows 46 invoices
/ 2.03M. Not a bug — the two read different tables: Performance = finance_invoices (46 live); Ledger =
finance_transactions, which has 33 rows ALL soft-deleted in one bulk operation at 2026-08-22 15:08 UTC
(the importer-consolidation migration when finance_invoices became the live source). The ledger reads
`deleted_at is null`, so it honestly shows empty. Recorded so no future session re-flags it. (Open
PRODUCT question for the owner, NOT a defect: the Ledger tab is empty for users while Performance shows
2.03M — is that the intended long-term shape, or should the ledger derive from invoices? His call.)
No new oversight commits this fire.

## Routine fire #13 (2026-09-10 18:11 UTC) — merged app driven against the REAL database in a browser, clean
With the blocker beaten, did what the owner actually asks for: drove the merged app in a browser
against the REAL Supabase (read-only), not the mock. Technique (scratchpad/live-fullwalk.mjs): chromium
`proxy:{server:'direct://'}` so localhost doesn't hang, predicate route matchers for the CDN/font stubs,
and the supabase.co host bridged to the real project via Node fetch — Node KEEPS the proxy env (its
external fetch works) while chromium goes direct and never needs external. Walked every page + Finance
tab, EN and AR.
RESULT — clean: signed in as admin, the per-person matrix loaded and 9 nicknames arrived (my fire-#3
fix confirmed working LIVE), 108 businesses / 28 clients, 63–64 DB calls, 0 slow (>3s), 0 bridge errors,
0 page/console errors, no NaN/undefined on any page in either language. The single "finding" — the
finance landing at 27 chars — is the legitimate "Loading the finance ledger…" state caught mid-load
(real-DB latency > the probe's 700ms settle; every Finance tab rendered fine once data arrived). Not a
defect. No new oversight commits this fire.

## Routine fire #12 (2026-09-10 16:12 UTC) — FIRST in-browser verification of the merged app in this container
Applied the fire-#11 fix in a NEW probe rather than editing the 176 shared globbed probes:
`scripts/qa/probe-fullwalk.mjs` (port 8790) uses PREDICATE route matchers and is run with the proxy
stripped (`env -u HTTPS_PROXY … node scripts/qa/probe-fullwalk.mjs`). It walks every page + every
Finance tab in English AND Arabic as the admin, failing on JS errors, blank views, or NaN/undefined.
**Result: ALL PASS — 56 checks.** This is the first time the merged app (13 oversight landings deep)
has actually been driven in a browser in a reprovisioned web container — every page renders clean in
both languages, no JS/console errors. Registered in battery-excluded.txt (special-run: needs the
proxy stripped, so it is not a standard -j battery probe).
MY OWN MISTAKE, caught and fixed same fire: the probe first flagged 4 "VAT on a Finance surface"
failures. That was wrong — a text-scan for the word "VAT", which is exactly the discredited approach
probe-no-vat-display was rewritten away from on 2026-08-23 (owner verbatim: "I dont care weither vat
shows or not, what i want is a clean cost, profit, and revenue"). The hits were the client's
VAT-registration NUMBER in js/62's link waterfall — a legitimate matching identifier, not VAT in a
money figure. Removed the text-scan; M1 stays guarded numerically by probe-no-vat-display (which
passes). Re-ran → ALL PASS. check-probe-integrity green.

## Routine fires #10–#11 (2026-09-10 12–14 UTC) — CRACKED the browser-battery blocker (root cause + fix)
No new app defects to fix (oversight idle ~4h after the 13th landing; 12th/13th batches — proposal
Remove + contract clause buttons ask in-page — parse clean, gates green). Spent the fires running
the browser blocker to ground with isolation experiments. RESULT: the 9-fire "browser hangs" is now
fully explained and has a proven fix — see the "BROWSER-BATTERY BLOCKER — ROOT CAUSE FOUND" section
below. In short: (1) chromium routes localhost through the egress proxy and hangs → strip the proxy
env; (2) the probes' `**host/**` route globs don't intercept in the installed Playwright (proven vs
both 1.52 and 1.55) and chromium can't reach the real CDN, so supabase-js never loads and the login
form never renders → the fix is predicate route matchers (proven: window.supabase loads, #cl_email
renders). The harness-wide conversion is flagged for Claude Code (100+ shared files, must be
browser-verified). This is the definitive answer to what's blocked the battery every fire.

## Routine fire #9 (2026-09-10 10:11 UTC) — my fire-#7 observation actioned; native-dialog work fully closed
Synced to `4ca9257` (10th + 11th landings). **My fire-#7 load-window observation was actioned**
(commit `a250d0d`): js/52 now exports `window.__accessKnown=settled` (was `known`), keeping
`__accessRoleKnown=known` separately — so my js/64 bounce now gates on `settled()` and no longer
fires during the role-known-but-matrix-not-loaded window at all (prevent, not restore-after — exactly
the recommendation). Verified sound. Third consecutive fire where a flag/observation of mine was
picked up and implemented by the core lane (editSupplier → confirms → this).
Also this landing: the dead/admin `confirm()` sites I noted in fire #5 are RESOLVED — `resetData` and
the go-live reset + three test suites were retired from the live app, and `v21WipeLocalData` now asks
in the page. Remaining raw confirm/prompt is down to 5, every one a comment or a documented guarded
fallback (`if(pfPrompt){…;return;} apply(prompt(…))`); the native-dialog refactor is fully closed.
All 11 touched files parse; check-structure / probe-integrity / decisions-wired green. Browser harness
still unusable in this container. Data unchanged (code-only landings).

## Routine fire #8 (2026-09-10 08:11 UTC) — quiet fire: no new code; extended cross-table data sweep clean
No new oversight commits (they've been idle ~2h; my fire-#7 load-window observation is not yet
actioned — `__accessKnown` still = `known()`, a nuanced call left for the core lane). Browser
harness still unusable in this container (8th consecutive fire; probe produces no output).
Used the fire for a DEEPER SQL data sweep beyond the finance-only checks of fires #1/#4 — all clean:
contacts 45 · 0 orphaned activities · 0 businesses with a funnel_id absent from funnels · every
invoice's client_group has a finance_client_link · 11 active app_users, all roles inside the valid
set. The only notable count — 20 live businesses with no funnel_id — is the known funnel-coverage
gap (CLAUDE.md: funnel data only partially filled), not an integrity defect. Finance invariants
from fire #4 still stand (code-only landings since).

## Routine fire #7 (2026-09-10 06:14 UTC) — 8th/9th landings verified; a load-window observation for the core lane
Synced to `06ed7c1` (8th + 9th landings: 44 dormant probes reinstated, "granted page survives the
load window", Today no longer counts a blank draft as a quote, Arabic audit/provider wording). All
16 touched files parse; check-structure / probe-integrity / decisions-wired green. My fire-#3 files
(js/56, js/54, js/64, js/35) were NOT touched — those fixes are intact.

The 8th landing (71c5109) is a direct follow-on to my fire-#3 page-matrix work: even with the matrix
now loading, there's a window between role-known and matrix-landed where js/52's `allowedPages()`
returns the floor list, so a team member granted Operations who opens /ops in that window would be
bounced. Their fix: a new `settled()` predicate (js/52:32 — true for admin / once matrix loaded /
20 s fail-safe) driving a `__pendingDeepPage` restore (js/52:168) that re-applies the deep-linked
page once settled.

OBSERVATION for the core lane (not shipped — cross-lane + can't browser-verify here): my js/64
bounce still gates on `window.__accessKnown()`, which js/52 line 79 still assigns to `known()`
(true the instant the role arrives), NOT the new `settled()`. So js/64 can still fire a premature
bounce during the load window, and the granted-page fix works by RESTORING the page afterwards
(`__pendingDeepPage`) rather than preventing the bounce. That's fine for the deep-link boot the new
probe tests, but gating js/64 on `settled()` (export it as `__accessKnown`, or have js/64 read it)
would prevent the bounce outright — simpler and also covers mid-window in-app navigation / reload,
which the restore path may not. Worth confirming probe-granted-page-survives-load exercises those
cases, not just the deep-link boot. Browser harness still unusable this container; data unchanged.

## Routine fire #6 (2026-09-10 04:11 UTC) — native-dialog refactor COMPLETE; my fire-#5 flag actioned
Synced to `0da10fd` (oversight's 7th landing — "the last browser boxes"). **The legacy `confirm()`
sites I flagged in fire #5 were actioned by the core lane** (commit `a9b8d1a`): core-05 booking/
invoice delete and core-06 bulk-archive/ingest-duplicate confirms are gone (now in-page). Second
consecutive fire where a fire-flag was picked up and fixed — the verify→flag→core-lane-fixes loop is
solid.
Enumerated what remains: exactly 7 raw `confirm(`/`prompt(` in the tree, and every one is a
non-issue — two are comments (js/16:474, core-01:281), three are documented fallbacks guarded behind
`pfConfirm`/`pfPrompt` (js/45:148 expConfirm, js/57:100, core-01:288 Lost-reason: `if(pfPrompt){…;
return;} apply(prompt(…))`), and two are dead/admin (`resetData`:468 wired to nothing, `v21WipeLocalData`
:1191 dev wipe). So the D1 native-dialog refactor is essentially COMPLETE — every user-reachable
alert/confirm/prompt is in-page (alert globally via js/63, confirm/prompt converted per-site over 7
landings), with native calls kept only as fallbacks.
7th-landing files parse; check-structure + check-decisions-wired green. Browser harness still
unusable in this container (probe produces no output). Data unchanged (code-only landings).

## Routine fire #5 (2026-09-10 02:11 UTC) — verified the alert()-override strategy; enumerated remaining confirm()
Synced to `c0d9b42` (oversight's 6th landing: `alert()` is now an in-page card app-wide via js/63's
`window.alert` override, plus `pfPrompt` in js/57, Lost-reason + quick-edit-name converted). All 20
newly-touched files parse; check-structure + check-decisions-wired green.
Verified the strategy is sound (browser-free): js/63 overrides `window.alert` ONLY (line 92) — correct,
because `confirm()` returns a boolean synchronously and can't be a transparent async card, so each
confirm() must be converted per-site (probe-alerts-in-page's own header confirms this: "moved into
js/57's box one by one across four landings").

FLAG for the core lane — enumeration of raw `confirm()` still in the tree after 6 landings (js/63's
alert-override does NOT cover confirm, so any *reachable* one still freezes the tab). Triaged:
- Intentional/dead/handled (NO action): js/45-expenses:148 (documented pfConfirm fallback);
  core-01 resetData:468 (wired to nothing); core-06 v21WipeLocalData:1189 (admin/dev wipe).
- **Verify reachability in-browser** (I can't — the harness doesn't run in this container): core-05
  `editBooking`:111 / `editInvoice`:138 delete callbacks (`confirm('Delete this booking/invoice?')`),
  reached only if the Bookings/Invoices pages expose the core-05 Edit path — but those pages read
  "🔒 read-only, create/edit disabled" live, so probably a later read-only layer wins and these are
  unreachable. Also core-06 invBulkAction:163 (bulk-archive) and invoice ingest-duplicate:291. If any
  IS reachable, convert to `askInPage`; if the pages are genuinely read-only, no action.
Data unchanged this fire (code-only landings) — the fire-#4 SQL invariant sweep still stands.
Browser harness still cannot run here (probe-events produces no output; /tmp flaky).

## Routine fire #4 (2026-09-10 00:11 UTC) — my fire-#3 flag was actioned; data still spotless
Synced to `b6eee20` (oversight's 5th 9-Sep landing). **The `editSupplier` native-dialog flag I
raised in fire #3 was picked up and fixed by the core lane** (commit `011ea6c` — the supplier/
airline editor now uses `toast(…,"err")` for empty-name and `askInPage(…)` for delete; `0e7d90f`
removed the dead js/10 evDelete copy). Confirmed: no native `confirm()`/`alert()` remain in
core-03's action paths. The verify→flag→core-lane-fixes loop is working as intended.
Verified the 4th/5th landings browser-free: all 20 newly-touched js/mjs files parse; check-structure
+ check-decisions-wired green. SQL data-invariant re-check: 46 invoices (profit=revenue−cost
throughout, zero M1 VAT breach, zero Takamol/Techtic leak, revenue_way all valid), 108 live
businesses (is_client consistent, stages inside the locked set) — nothing regressed.
Browser harness STILL cannot run in this reprovisioned container (probe-events produces no output
even with an internal 130s cap; /tmp itself is flaky) — accepted, not re-litigated each fire. The
full browser battery remains outstanding for a container that can sustain Chromium.

## Routine fire #3 (2026-09-09 22:11 UTC) — verified the oversight core refactor; one D1-extension found
Fast-forwarded to the oversight session's HEAD (`0bf8459`, 70 layers / 176 probes) — their big
9-Sep sweep landed a native-dialog→in-page-box refactor across core-01…core-10, js/76, new js/77
(share panel). Verified it browser-free (the container still cannot run a full app-boot probe — see
the reprovision note below; two experiments, probe-events and a minimal goto test with
background-networking disabled, both hang with zero output):
- Every one of the 24 files the 9 commits touched PARSES; check-structure / check-probe-integrity /
  check-decisions-wired all green on the merged tree.
- The refactor is SOUND: js/10 has two `window.evDelete` definitions; the LATER one (line 607, the
  in-page `pfConfirm` box) wins at load order (comment at line 312 documents the supersession), so
  the native-`confirm()` copy at line 125 is dead/superseded, not a live path — their
  probe-no-native-dialogs check 5 passes for the right reason.
- Live site serves the new HEAD (js/77 present on directksab2b.com).

FINDING (small, real, NOT yet fixed — flagged for the core lane, not shipped unverified):
**`editSupplier()` (core-03-reference-ops.js:215) — the Airlines / Suppliers / Providers editor —
still raises native `alert("Name required")` and `confirm("Delete this record?")` at line 247.**
Same tab-freeze class the owner hit in D1, but outside D1's stated scope (leads/requests/events/Won).
Natural D1 extension: swap to the existing `askInPage()` (core-01:458) + a toast, and extend
probe-no-native-dialogs to cover the supplier/airline delete + empty-name paths. Left for the core
lane because (a) core-03 is in the oversight session's active sweep and (b) a dialog change must be
browser-verified, which this container cannot do right now.

## Container reprovisioned 2026-09-09 ~20:12 UTC — recovery recipe (durable)
The web-session container was rebuilt mid-run: the working tree AND `/tmp/node_modules` were lost,
leaving only `.git` (origin intact). NOTHING was lost — all work was already pushed. Recovery that
worked, in order:
1. `git fetch origin claude/new-session-9fhlp1 && git checkout -B claude/new-session-9fhlp1 origin/claude/new-session-9fhlp1`
2. The QA harness deps are NOT in the repo — reinstall them:
   `cd /tmp && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright@1.55.0 @supabase/supabase-js`
   (Chromium build 1194 is pre-installed at /opt/pw-browsers; probes launch it by executablePath.)
3. Verify: check-structure / check-probe-integrity / check-decisions-wired — all green on the
   restored+merged tree (69 layers incl. the new js/76 archive layer, 173 probes). Live site
   serves the merged HEAD (js/76 present on directksab2b.com).

BROWSER-BATTERY BLOCKER — ROOT CAUSE FOUND 2026-09-10 (fire #11), supersedes the earlier
"CPU/SIGSTKFLT" guess which was WRONG. In these reprovisioned web-session containers the QA
browser probes cannot run, for TWO independent reasons, both now proven:
  (1) PROXY vs localhost. Chromium picks up the egress proxy (HTTPS_PROXY env) and routes even
      http://localhost through it, where it HANGS — so `page.goto(localhost-mock)` never resolves
      and the probe sits forever with no output (this is what looked like "hang/144"; the real 144s
      were long FOREGROUND `sleep`s, which this sandbox blocks — unrelated). FIX: run the probe with
      the proxy stripped — `env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy node …`
      (or launch chromium with `proxy:{server:'direct://'}`). Proven: goto-localhost then resolves
      in ~70 ms.
  (2) ROUTE GLOBS don't intercept + external CDN unreachable. Every probe stubs its externals with
      `page.route('**cdn.jsdelivr.net/**', …)` (and fonts, and the supabase.co host). Those GLOB
      patterns do NOT match in the installed Playwright — tested 1.52.0 AND 1.55.0, both give
      cdnHits=0; a PREDICATE matcher `page.route(u=>u.href.includes('cdn.jsdelivr.net'), …)` DOES
      intercept (cdnHits=1, window.supabase loads, #cl_email renders). The glob never actually
      intercepted in these PW versions; it only "worked" originally because the old (non-reprovisioned)
      container could REACH cdn.jsdelivr for real. Here chromium can't reach external HTTPS at all
      (proxy hangs it; direct → ERR_CERT_AUTHORITY_INVALID, since the proxy does TLS interception with
      a CA chromium lacks). So the un-intercepted supabase-js `<script>` never loads → the app can't
      init its client → the login form never renders → every probe times out on `#cl_email`.
  PROVEN FIX (diag2): predicate route matchers make the battery fully offline — all externals served
      from the Node-read local files, zero chromium external network.
HARNESS FIX for Claude Code / the owner (a browser CAN verify it there, chicken-and-egg here): convert
the probes' `page.route('**host/**', …)` globs to predicate matchers `page.route(u=>u.href.includes('host'), …)`
— or vendor supabase-js + the font CSS locally so no CDN interception is needed — and pin the Playwright
version. That one change unblocks all ~176 probes in a no-external-network container. NOT done from here:
it is a harness-wide edit (100+ files) on the shared scripts/qa tree the oversight session is actively
adding probes to, and it must be browser-verified, which this container cannot do. Until then, verification
each fire is static (parse, structure, probe-integrity, decisions) + SQL data invariants — all green.

## Round 69 — 2026-09-09 — heavy testing for real: the live app, the real database, an employee's session

The owner said the app "is not working properly". The harness is fake data, so this round drove
the LIVE code (commit 1257b5a, what Vercel serves) against the REAL database through a bridge —
every page and Finance tab in English and Arabic, then real writes (create a lead, log an
activity that moves its stage, edit, open the card, delete), first as the QA admin and then with
the same account switched to `team_member` — the role 7 of the 11 live accounts hold. Each write
was read back from the database by a separate request, not by trusting the screen.

### What is actually working (measured, not assumed)
- Every page and tab renders with real data in both languages; no JS errors; 67 database calls
  per session, none slower than 3 s; the server log for real users over 48 h shows zero failed
  requests except the two 401s below, zero sign-in failures, zero slow queries.
- Create / activity / stage move / edit / delete all reach the database within seconds, for the
  admin AND for the team member (the delete archives the row, as designed). The badge said
  "Synced Ns ago" and the database agreed.
- Importer preview, Expenses, Payment proofs, Individual bookings, Team & Access, Generator,
  New request form, Add event form, top search, Export → a real 6 KB CSV, and the phone-sized
  screen (no sideways scroll on Today/Leads/Clients/Finance/client card, in Arabic too).
- The full local battery: 113/113 green (one red under `-j` load was a starved boot, green alone).

### Three real defects, all invisible to an admin, all fixed in this round
1. **The per-person page matrix never loaded on a normal sign-in.** js/56 asked for it 1.2 s and
   5 s after the PAGE loaded — before anyone had typed a password — anonymous, refused (401,
   "permission denied for function my_page_access"; 31 of 39 calls in a day in the live log),
   swallowed, never retried. Whatever the owner sets in Team & Access for a person was not in
   effect until they happened to reload; js/52 silently used its built-in floor lists instead.
   js/54 did the same with nicknames. Fix: both wait for js/02's `__roleKnown` before asking, and
   the matrix retries on error; also re-fetched when a different account signs in without reload.
2. **"You do not have access to that page" stuck to pages the person IS allowed on.** js/64
   re-asserted the banner on every render for 8 s after a bounce — including the Leads or Finance
   they opened next — and never removed it, so on pages that redraw in place it sat there until
   the next full render. Screenshot: the banner above a team member's Finance dashboard. Pressing
   "New request" on a lead card (→ Operations) is enough to trigger it. Fix: the banner belongs to
   Today only and is removed when another page renders or the 8 s end.
3. **Every employee save fired a write to the shared settings row, refused 403 each time.** The
   database is right to refuse (policy `can_edit_page('settings')`); js/35 kept asking because
   the tab's settings drift from the row on every load. Fix: once refused, stop for the session.
Probe: `probe-employee-signin-shape.mjs` (9034) — seeds the QA account as team_member, sits 7 s
on the sign-in form, then checks: no anonymous calls before sign-in; matrix + nicknames arrive
after; bounce shows the banner on Today (control); Leads right after has none; banner gone by
9 s; exactly one refused settings write across the session. Sabotage: each fix removed → its
check red; restored byte-identical (md5). The mock now refuses app_settings writes for anyone
without `settings: editor` (mirrors the live policy) and answers team_nicknames with real rows.

### Live data cleaned (backed up first)
`app_settings.data` and `app_state.data.settings` both carried junk keys from earlier probes
against the live database — `probe: "manager"`, `rlsProbe: "manager"` — and `currentUser`
(the very leak js/02 says nothing writes any more). Because the two stores disagreed, EVERY
admin session rewrote the settings row on its first save. Removed from both (backups:
`app_settings_backup_20260909`, `app_state_backup_20260909`); after that an admin session
writes only the audit section, and no settings row at all.

### After the fix went live (fd0e5ae, confirmed served by directksab2b.com)
- Team member, real DB, typed sign-in: matrix loaded, no stray banner, 0 errors, all writes land.
- Manager (the one manager account's exact 10-page matrix), in Arabic: same — 0 findings.
- Database integrity sweep on the live tables: `is_client` vs `raw.isClient` 0 mismatches; stages
  all inside the locked set; 0 duplicate live names; 0 orphaned contacts; 0 client links to a
  missing company; 0 negative/null invoice totals; profit = revenue − cost on every costed row.

### SQL data-spotless sweep (2026-09-09, Supabase-side, no browser)
Ran when the sandbox's headless-Chromium was degraded (every probe exited 144, not OOM). Direct
SQL over the live tables: finance_invoices (46) — revenue/cost never negative, profit=revenue−cost
on every costed row, NO row where revenue equals total-incl-VAT while VAT>0 (M1 holds), zero
Takamol/Techtic leak, revenue_way always valid, month/quarter never null. promo_codes (200) — no
duplicate or blank codes. finance_client_links (26) — the 5 with confirmed_by=null are the owner's
alias-variant client_groups (created by the alias-grouping path, not auto-match); benign. Expense
capture (223 lines / 155 gates) keys on the Direct Payments transaction id, a separate keyspace
from invoice_no (cost join covered by the passing capture probes). No data defect found.

### Session-edge drive (two real browsers, one account, real DB) — one known limitation reconfirmed
- Wrong password → clear message. Restored session (reload at /finance with the token saved) →
  straight to Finance as admin in 14 ms, matrix + nicknames loaded, no re-login. Sign out in one
  browser → it shows the login form, the other is unaffected and its next edit still saves. Two
  people editing DIFFERENT leads at the same moment → both edits reached the server.
- **Two people editing the SAME lead, different fields, within a second → one field is silently
  overwritten and nobody is told.** This is the documented last-write-wins on the businesses row
  (CLAUDE.md's "two people editing the same section" note), reconfirmed against the real database —
  not a new regression. A second tab also does not see another tab's new/changed lead until it
  reloads (no background pull of others' rows after load). The safe fix (field-level
  read-merge-write on the core save path, or a background freshness pull) is a large change to
  js/02 and was left out of this loop deliberately. Two harmless enablers were kept: a live
  `trg_touch_updated_at` trigger (the column had a default but no trigger, so it never updated),
  and the QA mock now honours `?col=gt.<v>` / `?col=in.(...)` GET filters like real PostgREST.

### Noted, not changed
- `app_state.data.audit` is 800 entries / 151 KB and the whole section is sent on every save
  (131 KB per save). Bounded at 800, so not growing — but it is the biggest thing every save
  carries. A real table would make saves cheaper.
- The 24 snapshot tables have RLS on with no policy (unreachable by anyone through the API,
  which is fine for backups); Supabase advisors also flag `pg_net` in public and leaked-password
  protection off — none of it affects daily use.
- `probe-live2` still uploads a `live-check.pdf` into the REAL proposals bucket when run.

## 2026-09-07 · Watch cycle 40 — the number that decides which company record survives a merge

The dialog method found a second real defect, one file over from cycle 39's.

### "2 invoices, 0 SAR"

js/62's merge confirmation reads, for both companies:

> Everything on "Merge A" — contacts, activities, billing profiles, **invoice links (2 invoices, 20,000 SAR)**, transactions, documents — moves to "Merge B" **(1 invoices, 500 SAR)**.

That is the fact a person reads when deciding which of two company records to **keep** and which to **archive**. Nothing had ever checked it. It was computed by `bizFinance()`, which re-implemented `live()`'s three rules by hand — drop deleted, drop excluded, coerce money with a raw `+` — and got the third wrong. `FIN.rows` is only clean as a side effect of `live()` having run, because `live()` sanitises **in place**. The duplicate-companies card is reachable without ever opening Finance, and measured on that path the dialog said:

```
Merge A (2 invoices, 0 SAR)        ← holding 20,000
```

**The count is right and the money is zero**, which is worse than an obvious error: it reads as a coherent fact — *this record has invoices but no value* — at the moment someone chooses which record survives. Same hole as cycle 39's invoice modal, on a surface where the number decides an action that looks irreversible.

**Fixed by reading through the chokepoint** rather than by patching the third rule: `bizFinance` now uses `window.finLive()`, which applies all three rules in one place, so this surface cannot drift from every other total again. The hand-rolled loop stays only as a fallback for the case where the ledger layer never loaded — where there is nothing to read anyway.

### And a fail-open on the standing exclusion, on the same dialog

While building the guard, one run in three printed **`Merge B (2 invoices, 889,388 SAR)`** for a company whose own money is 500 — the rest being a standing-**excluded** partner's, summed in silently. `finExclusionCheck()` answers "not excluded" both when a client is not on the list *and* when the list has not loaded yet, so a total computed before `app_settings` lands quietly includes money the owner ruled out. Given that the Takamol incident was 6.7M SAR and 77% of displayed revenue, a merge decided on that number is not a small thing.

**The dialog now refuses rather than guessing:** if the settings blob has not landed at all (an empty `DB.settings`, distinguishable from a workspace that genuinely has no exclusions), the merge is declined in words — *"the exclusion list has not finished loading, so the invoice totals below cannot be checked against it and could include a client this workspace excludes."* M8 applied to a dialog rather than a tile.

New `probe-merge-dialog-money` (8719, 5 checks): both paths print the fixture's own figures; the count is right on the cold path too; a soft-deleted 999,999 reaches neither total; and the excluded client's money reaches neither. It waits for the exclusion list before opening the dialog and **fails with one honest line** if it never arrives, rather than cascading four failures that name the wrong cause.

**A probe-side error of my own, and it is cycle 28's lesson repeated.** The first version of the exclusion check hunted the literal `888,888` — and the excluded money never appears as itself, it is summed into the total (500 + 888,888 = 889,388). **The check passed while the leak it names was on screen.** It tests the total against the fixture now.

### The same fail-open, on the surface that WRITES — open for cycle 41

The battery caught a third instance, and it is the most serious of the three because it does not just display a number, it inserts rows. `probe-importer-scale-attacks` under six-way load:

```
✗ New = 1020, expected 1000
✗ Excluded by rule = 3, expected at least 20
✗ an excluded-client invoice was written
```

Twenty invoices belonging to a standing-excluded client were imported instead of held back, because the importer's exclusion check ran before `app_settings` landed and `finExclusionCheck()` answers "not excluded" for a list that has not loaded. **That is the shape of the original incident** — ten Takamol invoices entering `finance_invoices` — reached by a different road. Green when run alone, which is exactly why it has not been seen.

Not fixed this cycle, and deliberately not bodged at 11:35 with three hours already on the clock. It is written down with its evidence because the next cycle should start here. The question to settle first is whether the honest answer is the one this cycle applied to the merge dialog — **refuse while the list is unknown, rather than proceed as if there were no exclusions** — applied at the importer's own gate, where refusing costs a retry and proceeding costs a write. That is js/65 and js/41; js/65 is in this lane.

Also still timing out under load at 90 s: `probe-premortem-attacks`' check H. Third cycle running. Worth asking whether the commit it waits for is genuinely slow under contention or whether something in that flow stops making progress.

### Housekeeping

`probe-expense-report-capture`'s wait for the exclusion list sat seconds after sign-in and burned its 90-second budget while the page was still booting — reddening a probe whose exclusion-dependent check does not run for another minute and a half. **Wait for a precondition where it is needed, not at the top of the file.**

`sweep-buttons` crashed on a navigation race and appeared under RED while being excluded from the pass count — two statements that contradicted each other. A report cannot fail an assertion, but it can crash, and then it produced nothing; the runner says that on its own line now: *"reports that did not finish"*.

The cycle-39 delivery note in this file said "saved, not delivered", which was true when written and false by the time it landed. Corrected.

