-- rls-matrix.sql — the real write policies, exercised as every role, with no session and
-- no password (Spec 7a, 2026-08-21).
--
-- How this works: every RLS policy in this app keys off auth.uid(), and auth.uid() just
-- reads the 'sub' claim off two Postgres session settings (request.jwt.claim.sub, falling
-- back to request.jwt.claims). Both are ordinary session config — set_config(..., true)
-- sets them for the rest of the CURRENT TRANSACTION ONLY. So this script does the whole
-- thing inside one BEGIN ... ROLLBACK: impersonate a real user's uid, actually attempt the
-- write, read whether it landed, then throw the entire transaction away. Nothing here is
-- reachable from outside a database console with owner/service credentials — it does not
-- touch auth, does not need anyone's password, and commits nothing, ever.
--
-- Setting the JWT claim is necessary but NOT sufficient. This session connects as
-- `postgres`, which (like `service_role`) has BYPASSRLS — table owners ignore RLS by
-- default, claim or no claim (verified: rolbypassrls=true for postgres/service_role, false
-- for authenticated/anon). So every check also does `SET LOCAL ROLE authenticated` before
-- the write attempt, and `RESET ROLE` straight after so the next test's setup step — which
-- runs as postgres — isn't itself blocked by RLS on app_users. A version of this script
-- that sets the claim but skips the role switch would run every check as postgres
-- regardless of claim and pass 100% of the time for the wrong reason — worse than not
-- testing at all, because it reads as proof.
--
-- What "write" means here: every write policy below is `FOR ALL` with USING and WITH CHECK
-- set to the exact same role/page condition — there is no per-row ownership filter, so a
-- denied role never gets an exception, it just matches zero rows (RLS filters the row out
-- of USING before the write is even attempted). This script tests that with a no-op
-- self-update (`UPDATE t SET id = id WHERE id = (SELECT id FROM t LIMIT 1)`) and checks
-- ROW_COUNT, not for a thrown error — checking only for an exception would have reported
-- every denial as a false pass.
--
-- Two governance mechanisms are live in this schema, not one, and this script tests both
-- correctly instead of assuming they match:
--   • businesses, app_offers, app_requests, activities — gated on app_role(), i.e. the
--     `role` enum column on app_users directly.
--   • app_settings, finance_expenses, finance_invoices — gated on can_edit_page(), i.e. the
--     per-user `page_access` JSONB column, which is a SEPARATE field from `role`.
-- A role can be an editor of a page without that being derivable from the `role` enum at
-- all — confirmed live: every real team_member account today has page_access.finance =
-- 'editor', so team_member DOES pass finance_expenses/finance_invoices writes.
-- (scripts/qa/emp-rig.mjs's DB_EXPECT table currently says team_member's
-- finance_expenses/finance_invoices should be 0 — that was true under an older access
-- model and is stale against the live page_access data checked here on 2026-08-21.
-- Recommend updating that file's DB_EXPECT to match, or treating this script as the new
-- source of truth for the finance/settings columns specifically.)
--
-- bd, operations and viewer currently have ZERO active real users (verified against
-- app_users on 2026-08-21 — every active account today is admin, manager, or team_member).
-- "No new accounts" is honoured literally: for the four role-gated tables, this script
-- temporarily UPDATEs one real existing team_member's `role` column (never creates a row,
-- never touches auth.users, and it's inside the same transaction this whole script
-- ROLLBACKs) so those three roles' policies can still be exercised for real. For the three
-- page_access-gated tables, there is no live page_access value for those roles to test
-- honestly — fabricating one would test an invented number, not reality — so those nine
-- cells come back N/A rather than a guessed pass/fail. When a real bd/operations/viewer
-- account exists, re-run this section against it for real coverage.
--
-- Output is a plain SELECT resultset (not RAISE NOTICE, which several SQL runners —
-- including this project's own MCP tooling — never surface), so this works the same from
-- psql, the Supabase SQL editor, or any programmatic runner: run the whole file, read the
-- last resultset. Nothing commits — the results live in a TEMP table inside the same
-- transaction the script rolls back.

BEGIN;

CREATE TEMP TABLE rls_matrix_results (
  seq int generated always as identity,
  role_label text,
  tbl text,
  expected boolean,
  actual boolean,
  pass boolean,
  note text
) ON COMMIT DROP;

DO $rls$
DECLARE
  -- one real existing user per role that actually has one today
  admin_id       uuid := '98456801-18c4-4edb-a119-e56d55098a1e'; -- aboelmagd@directksa.com
  manager_id     uuid := '06bb5086-9c8c-4a1b-9452-eb0b14c24fa9'; -- osharafi@direct-visa.net
  team_member_id uuid := '72ac82c2-ad36-4206-9246-1666ab901954'; -- a.hassan@directksa.net
  -- an existing team_member, temporarily role-flipped (never a new account, never committed)
  flip_id        uuid := '1259675c-eb49-4376-a5e5-641183e26ceb'; -- abdulaziz.alreshody@directksa.com
  flip_original  text;

  ROLE_TABLES text[] := ARRAY['businesses','app_offers','app_requests','activities'];
  PAGE_TABLES text[] := ARRAY['app_settings','finance_expenses','finance_invoices'];

  rec record;
  role_rec record;
  tbl text;
  expected boolean;
  actual boolean;
  n int;
BEGIN
  SELECT role INTO flip_original FROM app_users WHERE id = flip_id;

  -- ---------- pass 1: real accounts (admin, manager, team_member) — all 7 tables ----------
  FOR rec IN
    SELECT * FROM (VALUES
      ('admin',       admin_id),
      ('manager',     manager_id),
      ('team_member', team_member_id)
    ) AS t(role_label, uid_val)
  LOOP
    FOREACH tbl IN ARRAY (ROLE_TABLES || PAGE_TABLES) LOOP
      IF tbl = ANY(ROLE_TABLES) THEN
        -- live policy: businesses/app_offers/app_requests/activities all allow
        -- admin/manager/team_member (bd and operations differ per-table, tested in pass 2)
        expected := rec.role_label IN ('admin','manager','team_member');
      ELSE
        -- COALESCE matters: page_access has no 'settings' key at all for team_member, so
        -- the ->> lookup is SQL NULL, and NULL = 'editor' is NULL, not false, which would
        -- silently poison this OR into NULL too. can_edit_page() itself wraps in
        -- coalesce(..., false) for exactly this reason — mirrored here on purpose, found
        -- by this script itself failing that comparison on its first run (2026-08-21).
        expected := (
          rec.role_label = 'admin'
          OR COALESCE((SELECT (page_access->>CASE WHEN tbl = 'app_settings' THEN 'settings' ELSE 'finance' END) = 'editor'
              FROM app_users WHERE id = rec.uid_val), false)
        );
      END IF;

      PERFORM set_config('request.jwt.claim.sub', rec.uid_val::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', rec.uid_val)::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      BEGIN
        EXECUTE format('UPDATE %I SET id = id WHERE id = (SELECT id FROM %I LIMIT 1)', tbl, tbl);
        GET DIAGNOSTICS n = ROW_COUNT;
        actual := (n > 0);
      EXCEPTION WHEN OTHERS THEN
        actual := false;
      END;
      EXECUTE 'RESET ROLE';

      INSERT INTO rls_matrix_results (role_label, tbl, expected, actual, pass, note)
      VALUES (rec.role_label, tbl, expected, actual, actual = expected, 'real account');
    END LOOP;
  END LOOP;

  -- ---------- pass 2: bd / operations / viewer — role-gated tables via temp role-flip ----------
  FOR role_rec IN SELECT unnest(ARRAY['bd','operations','viewer']) AS role_label LOOP
    UPDATE app_users SET role = role_rec.role_label::user_role WHERE id = flip_id;

    FOREACH tbl IN ARRAY ROLE_TABLES LOOP
      expected := CASE
        WHEN tbl = 'businesses'   THEN role_rec.role_label = 'bd'
        WHEN tbl = 'app_offers'   THEN role_rec.role_label = 'bd'
        WHEN tbl = 'app_requests' THEN role_rec.role_label IN ('bd','operations')
        WHEN tbl = 'activities'   THEN role_rec.role_label IN ('bd','operations')
      END;

      PERFORM set_config('request.jwt.claim.sub', flip_id::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', flip_id)::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      BEGIN
        EXECUTE format('UPDATE %I SET id = id WHERE id = (SELECT id FROM %I LIMIT 1)', tbl, tbl);
        GET DIAGNOSTICS n = ROW_COUNT;
        actual := (n > 0);
      EXCEPTION WHEN OTHERS THEN
        actual := false;
      END;
      EXECUTE 'RESET ROLE';

      INSERT INTO rls_matrix_results (role_label, tbl, expected, actual, pass, note)
      VALUES (role_rec.role_label, tbl, expected, actual, actual = expected, 'temp role-flip on an existing account, rolled back');
    END LOOP;

    -- page_access-gated tables: no live data for this role exists to test honestly
    FOREACH tbl IN ARRAY PAGE_TABLES LOOP
      INSERT INTO rls_matrix_results (role_label, tbl, expected, actual, pass, note)
      VALUES (role_rec.role_label, tbl, null, null, null, 'N/A — no real account with this role has a page_access value; not guessed');
    END LOOP;
  END LOOP;

  UPDATE app_users SET role = flip_original::user_role WHERE id = flip_id;
END;
$rls$;

SELECT role_label, tbl, expected, actual,
       CASE WHEN pass IS NULL THEN 'N/A' WHEN pass THEN 'PASS' ELSE 'FAIL' END AS result,
       note
FROM rls_matrix_results
ORDER BY seq;

ROLLBACK;
