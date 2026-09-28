-- SIGN-03 — after the code is verified, api.sign_in_complete() logs 'ok' and registers the device (the Supabase session
-- the code started), and api.me() then answers with that device; a switched-off person gets no device and the refusal
-- is logged; a session the flow never registered gets no person (§4 steps 3, 6, 8; V74).
-- Sabotage: supabase/tests/sabotage/sign-in-forgets-the-device.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.sid', gen_random_uuid()::text, true);
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(api.me(), '{"status": "signed_out", "reason": "unknown"}'::jsonb,
  'before the flow completes, the session is not a sign-in');
select test.ok(authz.me() is null, 'and it can read or write nothing');
select test.eq(api.sign_in_complete('email', 'Test browser on Test OS', 'test-agent'), 'ok', 'the flow completes');
select set_config('t.me', api.me()::text, true);
select test.eq((current_setting('t.me')::jsonb ->> 'status'), 'ok', 'now api.me() answers');
select test.ok((current_setting('t.me')::jsonb -> 'session' ->> 'device_id') is not null, 'with this device');
select test.eq(authz.me(), current_setting('t.am1')::uuid, 'and authz.me() names the person');
select test.as_owner();
select test.eq((select device_label from core.device_session where auth_session_id = current_setting('t.sid')::uuid),
  'Test browser on Test OS', 'the device is registered with its label');
select test.eq((select count(*) from core.sign_in_log where auth_session_id = current_setting('t.sid')::uuid
  and result = 'ok')::int, 1, 'one ok row for the sign-in');
update core.person set active = false where id = current_setting('t.am1')::uuid;
select set_config('t.sid2', gen_random_uuid()::text, true);
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid2')::uuid);
select test.eq(api.sign_in_complete('email'), 'switched_off', 'a switched-off person completes nothing');
select test.eq(api.me() ->> 'status', 'switched_off', 'and api.me() says so');
select test.as_owner();
select test.eq((select result from core.sign_in_log where auth_session_id = current_setting('t.sid2')::uuid),
  'switched_off', 'the refusal is logged with its session');
select test.ok(not exists (select 1 from core.device_session where auth_session_id = current_setting('t.sid2')::uuid),
  'and no device is registered');
