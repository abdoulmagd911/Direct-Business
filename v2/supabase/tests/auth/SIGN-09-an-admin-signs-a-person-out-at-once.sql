-- SIGN-09 — an admin signs a person out, from every device or one, and each is refused on its next request; a team
-- member cannot; each sign-out is logged with who did it (§4 "An admin can sign anyone out", V74).
-- Sabotage: supabase/tests/sabotage/anyone-signs-anyone-out.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Other', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.a', test.start_session(current_setting('t.uid')::uuid)::text, true);
select set_config('t.b', test.start_session(current_setting('t.uid')::uuid)::text, true);
select set_config('t.a_id', (select id from core.device_session where auth_session_id = current_setting('t.a')::uuid)::text, true);
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.person_sign_out(%L)', current_setting('t.am1')), '42501',
  'a team member cannot sign someone out', 'access.needs_capability');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select count(*) from api.person_devices(current_setting('t.am1')::uuid))::int, 2, 'the admin sees two devices');
select test.eq(api.person_sign_out(current_setting('t.am1')::uuid, current_setting('t.a_id')::uuid), 1, 'one device');
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.a')::uuid);
select test.eq(api.me(), '{"status": "signed_out", "reason": "admin"}'::jsonb, 'that device is refused at once');
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.b')::uuid);
select test.eq(api.me() ->> 'status', 'ok', 'the other still works');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq(api.person_sign_out(current_setting('t.am1')::uuid), 1, 'then every device');
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.b')::uuid);
select test.eq(api.me() ->> 'status', 'signed_out', 'the last one is refused too');
select test.as_owner();
select test.eq((select count(*) from core.sign_in_log where result = 'signed_out' and detail = 'admin'
  and person_id = current_setting('t.am1')::uuid)::int, 2, 'both sign-outs are logged');
select test.eq((select count(distinct signed_out_by) from core.device_session where person_id = current_setting('t.am1')::uuid
  and signed_out_by = current_setting('t.admin')::uuid)::int, 1, 'with the admin as who did it');
