-- SIGN-08 — My profile → Devices: a person signs out one of their devices from another, or every other device; the
-- signed-out device is refused at once (before its access token expires) and its Supabase session is deleted, while
-- the device they used keeps working; nobody signs out someone else's device this way (§4, V74).
-- Sabotage: supabase/tests/sabotage/signing-out-leaves-the-device-live.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Other', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.uid2', test.sign_in(current_setting('t.am2')::uuid)::text, true);
select set_config('t.laptop', test.start_session(current_setting('t.uid')::uuid)::text, true);
select set_config('t.phone', test.start_session(current_setting('t.uid')::uuid)::text, true);
select set_config('t.tablet', test.start_session(current_setting('t.uid')::uuid)::text, true);
select set_config('t.other', test.start_session(current_setting('t.uid2')::uuid)::text, true);
select set_config('t.phone_id', (select id from core.device_session where auth_session_id = current_setting('t.phone')::uuid)::text, true);
select set_config('t.other_id', (select id from core.device_session where auth_session_id = current_setting('t.other')::uuid)::text, true);
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.laptop')::uuid);
select test.eq((select count(*) from api.my_devices())::int, 3, 'three devices listed');
select test.eq((select count(*) from api.my_devices() where this_device)::int, 1, 'one of them is this device');
select test.eq(api.device_sign_out(current_setting('t.phone_id')::uuid), 1, 'the phone is signed out from the laptop');
select test.raises(format('select api.device_sign_out(%L)', current_setting('t.other_id')),
  'P0002', 'someone else''s device is not mine to sign out', 'common.not_found');
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.phone')::uuid);
select test.eq(api.me(), '{"status": "signed_out", "reason": "person"}'::jsonb, 'the phone''s next request is refused');
select test.ok(authz.me() is null, 'and it can read or write nothing');
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.laptop')::uuid);
select test.eq(api.me() ->> 'status', 'ok', 'the laptop keeps working');
select test.eq(api.device_sign_out_others(), 1, 'sign out everywhere else: the tablet');
select test.eq((select count(*) from api.my_devices())::int, 1, 'only this device is left');
select test.as_owner();
select test.ok(not exists (select 1 from auth.sessions where id in (current_setting('t.phone')::uuid,
  current_setting('t.tablet')::uuid)), 'their Supabase sessions are gone');
select test.ok(exists (select 1 from auth.sessions where id = current_setting('t.other')::uuid),
  'the other person''s session is untouched');
select test.eq((select count(*) from core.sign_in_log where result = 'signed_out' and detail = 'person'
  and person_id = current_setting('t.am1')::uuid)::int, 2, 'both sign-outs are logged');
