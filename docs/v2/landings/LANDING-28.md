# Landing 28 — the broken-pages fix (Discount Codes detail, Activity · Settings tab)

15 Nov 2026 · base `0537d608` (Landing 27, live) · target `v2/main`

## What was broken

1. **Discount Codes (`/codes`) — a code's detail failed on and off.** The list always loaded; a detail sometimes
   failed two times and then loaded, and one retry took about two minutes.
2. **Activity (`/activity`) — the Settings tab failed every time for a test user** with the full-page error
   "Something went wrong — This page could not be drawn". The other three tabs loaded.

## Why

- **Codes.** `finance.codes_list`, `finance.codes_detail` and `finance.codes_by_company` had no `jit = off`. They
  read `finance.money_row`, whose expressions Postgres compiles ("JIT") on every execution — seconds of compiling for
  milliseconds of work. The signed-in role's statement limit is 8 seconds, so a slow compile was cancelled and the page
  drew a failed state within seconds. Confirmed read-only on the live database before the fix: none of the three
  functions carried the setting, and the newest migration there was Landing 27's.
- **Activity.** `core.settings_log` begins with `authz.require_admin()`, which refuses every session that is signed in
  as a test user (`42501 test_switch.no_access_change`), whatever the test user's role. The page offered the Settings
  tab by role and awaited its three reads together with no catch, so that one refusal took the whole page down.

## What changed

| Area | Change | File |
| --- | --- | --- |
| Database (config only) | `jit = off` on the three codes functions — one forward-only migration, no redefinition | `v2/supabase/migrations/20261115100000_codes_reads_no_jit.sql` |
| Codes page | a failed detail shows the error's kind and code beside Try again (for example `Unavailable · 57014`); never the error's free text | `v2/src/app/(app)/codes/page.tsx`, `v2/src/modules/codes/screens/CodesScreen.tsx` |
| Shared read helper | `readAgain` moved out of the codes page so both pages use one copy; it now hands back what ended the read; `failureRef` turns that into the kind · code line | `v2/src/core/db/read-again.ts` |
| Activity page | while signed in as a test user, `?tab=settings` lands on the default tab (Who and Since kept) and `settings_log` is never called; each read is caught on its own, so a failed read shows a failed state with Try again instead of the full-page error | `v2/src/app/(app)/activity/page.tsx` |
| Activity screen | the Settings tab is not drawn for a switched session; a failed tab read keeps the tab row and says what failed | `v2/src/modules/settings/screens/ActivityScreen.tsx` |

Not changed, on purpose: `authz.require_admin()` is not relaxed; no rewrite of `codes_detail` (the Fix23-style
rewrite waits for timing to prove it is needed); no figure, wording, period or filter; no new catalog words (the
error line is a code, not a sentence); `database.types.ts` is unchanged (the generator's check passes with no diff).

**"Per partner" on the codes page is empty by design.** It lists promo attributions only, and the live database holds
none (counted read-only on 15 Nov: 0 attributions, 0 code uses, 15 codes). Not a defect.

## Tests added

- SQL: `JIT-05` — the three codes functions keep `jit = off`
  (`v2/supabase/tests/codes/JIT-05-the-discount-codes-reads-run-with-jit-off.sql`).
- Unit: `a-switched-session-is-not-offered-the-settings-log` (8 tests — the switched case the older one-round test
  mocks away: the redirect, no `settings_log` call, no Settings tab, the real admin still reads it, and one failing
  read never takes the page down) and `a-failed-codes-detail-says-what-failed` (7 tests).
- Browser: `landing-28-codes-detail-and-switched-activity.spec.ts` — a code detail opens and a failed one says what
  failed; a switched session lands on the default tab, the other tabs load, and the admin's own account still reads
  the settings log.
- Sabotage: `v2/tests/sabotage/landing-28.mjs` (9 plants). The older plant `activity-reads-the-organisation-first`
  follows the page's new text (`v2/tests/sabotage/server-read-retry.mjs`).

## Verification (this landing's head)

| Check | Result |
| --- | --- |
| Base copy equals `0537d608` before editing | yes — a fresh copy, nothing modified |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm format:check` | exit 0 |
| `node scripts/checks/run.mjs` | 19 green |
| `node scripts/db/gen-types.mjs --check` (Supabase CLI 2.118.0) | exit 0, no diff |
| Unit tests (vitest) | 1,082 passed in 184 files (1,067 at Landing 27; +15, none loosened) |
| SQL suite, a fresh `v2_test` from zero | 352 passed, 0 failed (351 at Landing 27 + JIT-05) |
| The same suite on a clean local Supabase stack, as CI runs it | 352 passed, 0 failed |
| `pnpm build` | exit 0 |
| Browser tests: the new codes + activity spec and the 15 specs that open Activity | 79 passed, 0 failed, 1 skipped (a skip written in an older spec) |
| Sabotage singles | 10 of 10 red as required: the 9 new plants and the updated `activity-reads-the-organisation-first`; the tree was restored each time and built again afterwards |

Where it was run: a cloud container, local Postgres 16 for the plain SQL suite (CI uses Postgres 17) and the local
Supabase stack (Postgres 17) for the rest. Not run here: the whole browser suite (133 specs) and the whole sabotage
set (about 1,300 plants) — CI runs both on the push.

## Still to do after it is live

- Open a code's detail several times as TEST Admin, English and Arabic: it should load first time. If one still
  fails, the failed state now shows the kind and code — that line decides whether the `codes_detail` rewrite is needed.
- Open Activity as TEST Admin: no Settings tab, and `/activity?tab=settings` lands on the default tab.
- Open Activity → Settings as the real Admin (not switched): the settings log loads. This was not proven live before
  the landing; it is proven on the local stack by the browser test.

## Rules for the next change

`CREATE OR REPLACE FUNCTION` silently drops a function's `jit = off`. A migration that redefines one of the three
codes functions must repeat its `ALTER FUNCTION … SET jit = off` in the same file; `JIT-05` goes red if it does not.

## Follow-up after CI run 1608 (test only, no product code)

CI on `735e02b` was red in one job: `app-settings.alone.spec.ts` "People and Teams tables fit their box in Arabic"
(1280 px and 1440 px). Cause: the new browser spec left one made-up person marked TEST; a TEST row gains the
"Sign in as test user" control on the People list, which widens that table for the spec that measures it last.
The spec now removes the mark and the holder row when it ends, pass or fail. Every other job was green, and the
production job had applied this landing's migration.
