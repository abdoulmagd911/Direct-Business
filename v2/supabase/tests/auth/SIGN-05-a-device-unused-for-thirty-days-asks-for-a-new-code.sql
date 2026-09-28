-- SIGN-05 — a device stays signed in until it is signed out, but one unused for 30 days asks for a new code: a device
-- last seen 29 days ago still answers, one last seen 31 days ago does not (and its next touch signs it out as
-- "inactive" and deletes its Supabase session); a visit moves last seen at most once an hour (§4, V74; the test clock
-- of V105).
-- Sabotage: supabase/tests/sabotage/devices-never-go-idle.sql.
select set_config('v2.test_now', '2026-10-01 08:00:00+00', true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.idle', test.start_session(current_setting('t.uid')::uuid, '2026-06-01 08:00:00+00', '2026-08-31 08:00:00+00')::text, true);
select set_config('t.used', test.start_session(current_setting('t.uid')::uuid, '2026-06-01 08:00:00+00', '2026-09-02 08:00:00+00')::text, true);
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.idle')::uuid);
select test.eq(api.me(), '{"status": "signed_out", "reason": "inactive"}'::jsonb,
  '31 days unused: a new code is needed');
select test.ok(authz.me() is null, 'and the idle device can read and write nothing');
select test.eq(api.device_touch(), 'signed_out', 'its next touch signs it out');
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.used')::uuid);
select test.eq(api.me() ->> 'status', 'ok', '29 days unused: still signed in, months after signing in');
select test.eq(api.device_touch(), 'ok', 'a touch keeps it');
select test.as_owner();
select test.eq((select sign_out_reason from core.device_session where auth_session_id = current_setting('t.idle')::uuid),
  'inactive', 'the idle device is marked inactive');
select test.ok(not exists (select 1 from auth.sessions where id = current_setting('t.idle')::uuid),
  'and its Supabase session is gone');
select test.eq((select last_seen_at from core.device_session where auth_session_id = current_setting('t.used')::uuid),
  '2026-10-01 08:00:00+00'::timestamptz, 'the touch moved last seen to now');
select set_config('v2.test_now', '2026-10-01 08:30:00+00', true);
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.used')::uuid);
select api.device_touch();
select test.as_owner();
select test.eq((select last_seen_at from core.device_session where auth_session_id = current_setting('t.used')::uuid),
  '2026-10-01 08:00:00+00'::timestamptz, 'half an hour later it did not move again');
