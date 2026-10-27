-- SWITCH-01 — V656 (2): the owner-only "Sign in as test user" switch. Only an admin on the holder list switches, only to
-- a person marked TEST; never on to another while switched; no access change while switched; every request is logged
-- as the TEST user with the owner named; it ends with "Back to my account", a new device starts unswitched, and leaving
-- the list ends it at once. Every value is made up.
-- Sabotages: supabase/tests/sabotage/switch-allows-any-admin.sql, switch-reaches-a-real-person.sql,
-- switch-on-while-switched.sql, access-change-while-switched.sql, switch-survives-a-new-device.sql,
-- switch-writes-unnamed.sql.
select test.department('commercial');
select test.as_owner();
select core.test_users_seed();
select set_config('t.owner', test.person('Test Switch Owner', 'admin')::text, true);
select set_config('t.other', test.person('Test Other Admin', 'admin')::text, true);
select set_config('t.real', test.person('Test Real Colleague', 'member')::text, true);
insert into core.test_switch_holder (person_id, note) values (current_setting('t.owner')::uuid, 'made up: the owner');
select set_config('t.tadmin', core.test_id('person', 1)::text, true);
select set_config('t.tmember', core.test_id('person', 5)::text, true);
select test.eq((select count(*)::int from core.person where is_test), 6, 'the six TEST users are marked in the data');

-- another admin, not on the list
select test.as_person(current_setting('t.other')::uuid);
select test.raises(format('select api.test_switch_start(%L)', current_setting('t.tmember')), '42501',
  'an admin not on the list is refused', 'test_switch.not_allowed');

-- the owner, on one device
select test.as_owner();
select set_config('t.uid', test.sign_in(current_setting('t.owner')::uuid)::text, true);
select set_config('t.sid', test.start_session(current_setting('t.uid')::uuid)::text, true);
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.raises(format('select api.test_switch_start(%L)', current_setting('t.real')), '42501',
  'a person not marked TEST is refused', 'test_switch.not_a_test_user');

select api.test_switch_start(current_setting('t.tadmin')::uuid);
select test.eq(authz.me()::text, current_setting('t.tadmin'), 'switched, the session acts as TEST Admin');
select test.eq(api.me() -> 'person' ->> 'id', current_setting('t.tadmin'), 'and reads as them');
select test.eq(api.me() -> 'test_switch' ->> 'by_id', current_setting('t.owner'), 'naming who switched, for the banner');
select test.raises(format('select api.test_switch_start(%L)', current_setting('t.tmember')), 'P0001',
  'no switching on to another while switched', 'test_switch.already_switched');
select test.raises(format('select api.setting_set(%L, null, %L::jsonb, null, %L)', 'app.go_live_on', '"2026-10-18"',
  'made up'), '42501', 'no access change while switched, even as TEST Admin', 'test_switch.no_access_change');

-- a write while switched is the TEST user's, the owner named
select set_config('t.note', api.note_capture('sticky', jsonb_build_object('title', 'Made-up note while switched'))
  ->> 'id', true);
select test.as_owner();
select test.eq((select jsonb_build_object('actor', q.actor_id, 'by', q.switched_by) from my.note n
                join audit.change c on c.table_name = 'my.note' and c.row_id = n.id and c.action = 'insert'
                join audit.request q on q.id = c.request_id where n.id = current_setting('t.note')::uuid),
  jsonb_build_object('actor', current_setting('t.tadmin'), 'by', current_setting('t.owner')),
  'a write while switched is logged as the TEST user with the owner named');
select test.eq((select n.person_id::text from my.note n where n.id = current_setting('t.note')::uuid),
  current_setting('t.tadmin'), 'and is the TEST user''s');
select test.eq((select count(*)::int from audit.request q where q.label_key = 'test_switch.started'
                and q.actor_id = current_setting('t.tadmin')::uuid and q.switched_by = current_setting('t.owner')::uuid),
  1, 'the switch itself is logged the same way');

-- a new device starts unswitched
select set_config('t.sid2', test.start_session(current_setting('t.uid')::uuid)::text, true);
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid2')::uuid);
select test.eq(authz.me()::text, current_setting('t.owner'), 'a new device is the owner''s own, not switched');

-- back to my account
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(api.test_switch_end(), true, 'Back to my account ends the switch');
select test.eq(authz.me()::text, current_setting('t.owner'), 'and the session is the owner''s again');
select test.eq(api.me() -> 'test_switch', 'null'::jsonb, 'with no banner');
select test.as_owner();
select test.eq((select count(*)::int from audit.request q where q.label_key = 'test_switch.ended'
                and q.actor_id = current_setting('t.tadmin')::uuid and q.switched_by = current_setting('t.owner')::uuid),
  1, 'the end is logged as the TEST user with the owner named');

-- leaving the list ends a switch at once
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select api.test_switch_start(current_setting('t.tmember')::uuid);
select test.eq(authz.me()::text, current_setting('t.tmember'), 'switched again, to TEST Member');
select test.as_owner();
delete from core.test_switch_holder where person_id = current_setting('t.owner')::uuid;
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(authz.me()::text, current_setting('t.owner'), 'off the list, the switch has ended at once');
