-- NTF-03 — Follow on any record (V61): whoever may see a record may follow it and stop following it; following()
-- answers for the signed-in person; a record they cannot see, an unknown record type and a missing record are refused.
-- A Viewer (the read-only role, FIX-03 F137) may not start a follow at all, even on a record they can see.
-- Sabotage: supabase/tests/sabotage/anyone-follows-anything.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.dep', test.department('notify_three')::text, true);
insert into core.person_profile (person_id) values (current_setting('t.am2')::uuid);
select set_config('t.prof', (select id::text from core.person_profile where person_id = current_setting('t.am2')::uuid),
  true);

select test.as_person(current_setting('t.admin')::uuid);
select test.eq(api.follow('department', current_setting('t.dep')::uuid), true,
  'an admin, who sees Organization & access, follows a department');
select test.eq(api.following('department', current_setting('t.dep')::uuid), true, 'and is following it');
select api.follow('department', current_setting('t.dep')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from notify.follow where person_id = current_setting('t.admin')::uuid), 1,
  'following twice is one follow');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq(api.follow('department', current_setting('t.dep')::uuid, false), false, 'and stops following');
select test.eq(api.following('department', current_setting('t.dep')::uuid), false, 'no longer following');

-- a supplier the viewer can see (F137 is a supplier record): the follow is refused for the role, not the record
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Supplier", "sides": [{"side": "supplier_partner", "type": "supplier"}]}') ->> 'id', true);
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.follow(%L, %L)', 'partner', current_setting('t.p')), '42501',
  'a viewer cannot start a follow', 'follow.not_allowed');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.follow(%L, %L)', 'department', current_setting('t.dep')), '42501',
  'a member cannot follow a record they cannot see', 'access.needs_level');
select test.raises(format('select api.follow(%L, %L)', 'profile', current_setting('t.prof')), '42501',
  'nor someone else''s profile', 'access.needs_level');
select test.raises(format('select api.follow(%L, %L)', 'made_up', current_setting('t.dep')), 'P0002',
  'an unknown record type', 'history.unknown_entity');
select test.raises(format('select api.follow(%L, %L)', 'department', gen_random_uuid()), 'P0002',
  'a record that is not there', 'common.not_found');
