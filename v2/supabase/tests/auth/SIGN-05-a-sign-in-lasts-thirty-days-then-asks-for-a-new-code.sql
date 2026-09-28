-- SIGN-05 — a sign-in lasts 30 days from the moment the code was verified, ticked or not (unticked, it also ends with
-- the browser session, which the browser enforces); on day 31 api.me() answers 'session_expired' and authz.me() is
-- null, so the gate asks for a new code (§4 "Keeping people signed in", V59; the test clock of V105).
-- Sabotage: supabase/tests/sabotage/sessions-never-end.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.sid', test.start_session(current_setting('t.uid')::uuid, '2026-09-01 08:00:00+00')::text, true);
select set_config('v2.test_now', '2026-10-01 08:00:01+00', true);
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(api.me() ->> 'status', 'session_expired', 'day 30 and a second: a new code is needed');
select test.ok(authz.me() is null, 'and the old session can read and write nothing');
select test.as_owner();
select set_config('v2.test_now', '2026-09-30 08:00:00+00', true);
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(api.me() ->> 'status', 'ok', 'day 29: still signed in');
select test.eq((api.me() -> 'session' ->> 'ends_at')::timestamptz, '2026-10-01 08:00:00+00'::timestamptz,
  'the session says when it ends');
