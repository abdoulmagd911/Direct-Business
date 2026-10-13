-- QA-57 — Undo asks the access the change needs today, not the access its author had (V97, V128, V133): an admin who
-- is made a member undoes neither their own Settings change nor their own change to a person's manager, even inside
-- the undo window. Written by the QA auditor to fail until it is fixed: on v2/main at d78f58f audit.undo_allowed
-- returns true for the actor's own change within the window before asking any access, so a demoted admin still takes
-- back an admin-only change (the oversight's review of #93, item a; restore is refused by core.can_see_record).
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-57. Made-up people only.
select set_config('t.a', test.person('Test Admin One', 'admin')::text, true);
select set_config('t.b', test.person('Test Admin Two', 'admin')::text, true);
select set_config('t.x', test.person('Test Member', 'member')::text, true);
select set_config('t.member_role', (select id::text from core.role where key = 'member'), true);
select set_config('t.xv', (select version::text from core.person where id = current_setting('t.x')::uuid), true);

select test.as_person(current_setting('t.a')::uuid);
select set_config('t.r_set', api.setting_set('work.no_update_days', null, '30', null, 'made up') ->> 'request_id',
  true);
select set_config('t.r_mgr', api.person_update(current_setting('t.x')::uuid,
  jsonb_build_object('manager_id', current_setting('t.a')), current_setting('t.xv')::int, 'made up')
  ->> 'request_id', true);

select test.as_person(current_setting('t.b')::uuid);
select api.access_set_person_role(current_setting('t.a')::uuid, current_setting('t.member_role')::uuid,
  'made up: moved to a member');

select test.as_person(current_setting('t.a')::uuid);
select test.ok(not authz.is_admin(), 'the first admin is a member now');
select test.raises(format('select api.undo(%L)', current_setting('t.r_set')), '42501',
  'a member takes back no Settings change, though they made it within the window');
select test.raises(format('select api.undo(%L)', current_setting('t.r_mgr')), '42501',
  'nor their change to a person''s manager');

select test.as_person(current_setting('t.b')::uuid);
select test.ok(api.undo(current_setting('t.r_mgr')::uuid) ->> 'request_id' is not null,
  'an admin still takes it back');
