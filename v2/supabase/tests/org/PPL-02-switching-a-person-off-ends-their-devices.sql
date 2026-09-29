-- PPL-02 — switching a person off (V74, V132): every device they are signed in on ends at once, logged in the sign-in
-- log, and their next request is refused; nobody switches themselves off; an admin only an admin; switching back on
-- lets them sign in again with a new code; only an admin undoes it (V128).
-- Sabotage: supabase/tests/sabotage/switching-off-leaves-devices-live.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.admin2', test.person('Test Second Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.head')::uuid, 'settings.org', 'full', 'made up: runs people');
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.sid', test.start_session(current_setting('t.uid')::uuid)::text, true);
select test.start_session(current_setting('t.uid')::uuid);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.off', api.person_switch(current_setting('t.am1')::uuid, false, 'made up: left')::text, true);
select test.eq((current_setting('t.off')::jsonb ->> 'devices_ended')::int, 2, 'switched off, both devices end at once');
select test.as_owner();
select test.eq((select count(*)::int from core.device_session where person_id = current_setting('t.am1')::uuid
                and signed_out_at is not null and sign_out_reason = 'switched_off'), 2, 'each device marked why');
select test.eq((select count(*)::int from core.sign_in_log where person_id = current_setting('t.am1')::uuid
                and result = 'signed_out' and detail = 'switched_off'), 2, 'and logged');
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(api.me() ->> 'status', 'switched_off', 'their next request is refused');

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.person_switch(%L, false, %L)', current_setting('t.head'), 'made up'), '42501',
  'nobody switches themselves off', 'access.not_your_own');
select test.raises(format('select api.person_switch(%L, false, %L)', current_setting('t.admin2'), 'made up'), '42501',
  'a head cannot switch an admin off', 'access.admins_only');
select test.raises(format('select api.person_switch(%L, true, null)', current_setting('t.am1')), 'P0001',
  'switching needs a reason', 'common.reason_required');
select test.raises(format('select api.undo(%L)', current_setting('t.off')::jsonb ->> 'request_id'), '42501',
  'only an admin undoes a switch', 'undo.not_allowed');
select api.person_switch(current_setting('t.am1')::uuid, true, 'made up: back');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(api.me() ->> 'status', 'ok', 'switched back on, a new sign-in works');
