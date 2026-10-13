-- LEAVE-02 — switching off (V463; OLD-004, OLD-005). Switching off someone who holds open work is refused — through
-- Switch off, through a leaving day on their record, or through a removal — unless the same request names who takes
-- it; with the name it succeeds, the count on the request, and one Undo restores it. A department's head goes only once
-- a new head is chosen. A leaving day still to come is accepted; a person whose leaving day has come is not switched
-- back on; the work goes only to someone who can work here, never back to the leaver; only Organization & access ·
-- Full marks someone as left, never on a day still to come. Every value is made up.
-- Sabotages: supabase/tests/sabotage/switching-off-strands-the-work.sql,
--            supabase/tests/sabotage/a-head-is-switched-off-without-a-successor.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Holder', 'member')::text, true);
select set_config('t.am2', test.person('Test Taker', 'member')::text, true);
select set_config('t.off', test.person('Test Switched Off', 'member', 'commercial', false)::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.head')::uuid, current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);
update core.department set head_person_id = current_setting('t.head')::uuid where code = 'commercial';
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up held task')) ->> 'id', true);

-- holding work: refused by every door
select test.as_owner();
select set_config('t.v', (select version from core.person where id = current_setting('t.am1')::uuid)::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_switch(%L, false, %L)', current_setting('t.am1'), 'made up: off'),
  'P0001', 'switching off someone who holds an open task is refused', 'person.open_work');
select test.raises(format('select api.person_update(%L, %L::jsonb, %s, %L)', current_setting('t.am1'),
  jsonb_build_object('left_on', core.riyadh_today()), current_setting('t.v'), 'made up: left'),
  'P0001', 'so is a leaving day of today on their record', 'person.open_work');
select test.runs(format('select api.person_update(%L, %L::jsonb, %s, %L)', current_setting('t.am1'),
  jsonb_build_object('left_on', core.riyadh_today() + 14), current_setting('t.v'), 'made up: resigned'),
  'a leaving day still to come is accepted');
select test.as_owner();
select test.raises(format('update core.person set deleted_at = now() where id = %L', current_setting('t.am1')),
  'P0001', 'and so is removing them', 'person.open_work');
update core.person set left_on = null where id = current_setting('t.am1')::uuid;

-- the hand-over: to someone who can work here, never to the leaver
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_switch(%L, false, %L, %L)', current_setting('t.am1'), 'made up: off',
  current_setting('t.off')), 'P0001', 'never to someone switched off', 'person.unavailable');
select test.raises(format('select api.person_switch(%L, false, %L, %L)', current_setting('t.am1'), 'made up: off',
  current_setting('t.am1')), 'P0001', 'nor back to the person going', 'person.hand_over_to_self');
select test.raises(format('select api.person_switch(%L, true, %L, %L)', current_setting('t.am1'), 'made up: on',
  current_setting('t.am2')), 'P0001', 'a hand-over goes with switching off only', 'person.reassign_needs_off');
select set_config('t.r', api.person_switch(current_setting('t.am1')::uuid, false, 'made up: off',
  current_setting('t.am2')::uuid)::text, true);
select test.eq((current_setting('t.r')::jsonb -> 'handed_over' ->> 'tasks')::int, 1,
  'named in the same request, the switch-off hands the task over');
select test.as_owner();
select test.eq((select (t.owner_id, p.can_sign_in)::text from work.task t, core.person p
                where t.id = current_setting('t.t')::uuid and p.id = current_setting('t.am1')::uuid),
  (current_setting('t.am2')::uuid, false)::text, 'the task with its new owner, the person off');
select test.eq((select label_args ->> 'count' from audit.request
                where id = (current_setting('t.r')::jsonb ->> 'request_id')::uuid), '1', 'the count on the request');
select set_config('t.k', core.auth_ticket_issue('undo', current_setting('t.r')::jsonb ->> 'request_id',
                                                current_setting('t.admin')::uuid)::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.undo_ticketed((current_setting('t.r')::jsonb ->> 'request_id')::uuid, current_setting('t.k')::uuid);
select test.as_owner();
select test.eq((select (t.owner_id, p.can_sign_in)::text from work.task t, core.person p
                where t.id = current_setting('t.t')::uuid and p.id = current_setting('t.am1')::uuid),
  (current_setting('t.am1')::uuid, true)::text, 'one Undo: the task theirs again, the person back on');

-- a head goes only once a new head is chosen
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_switch(%L, false, %L)', current_setting('t.head'), 'made up: off'),
  'P0001', 'a department''s head is not switched off', 'person.head_needs_successor');
select test.raises(format('select api.person_leave(%L, %L, null, %L)', current_setting('t.head'), 'made up: left',
  current_setting('t.am2')), 'P0001', 'nor marked as left', 'person.head_needs_successor');
select test.eq(api.person_open_work(current_setting('t.head')::uuid) -> 'heads' -> 0 ->> 'id',
  test.department('commercial')::text, 'the dialog names the department they head');
select test.as_owner();
select set_config('t.dep', (select row_to_json(d)::text from core.department d where d.code = 'commercial'), true);
select test.as_person(current_setting('t.admin')::uuid);
select api.department_save((d ->> 'id')::uuid, d ->> 'code', d ->> 'name_en', d ->> 'name_ar',
                           current_setting('t.am2')::uuid, (d ->> 'version')::int, 'made up: new head')
from (select current_setting('t.dep')::jsonb as d) x;
select test.runs(format('select api.person_switch(%L, false, %L)', current_setting('t.head'), 'made up: off'),
  'with a new head chosen, they are switched off');

-- a leaving day that has come keeps them off; marking as left is Full's, and never ahead of time
select test.raises(format('select api.person_leave(%L, %L, %L)', current_setting('t.off'), 'made up: leaving',
  core.riyadh_today() + 1), 'P0001', 'never a leaving day still to come', 'person.left_on_future');
select test.raises(format('select api.person_leave(%L, null)', current_setting('t.off')), 'P0001',
  'leaving needs a reason', 'common.reason_required');
select api.person_leave(current_setting('t.off')::uuid, 'made up: left last week', core.riyadh_today() - 3);
select test.raises(format('select api.person_switch(%L, true, %L)', current_setting('t.off'), 'made up: on'),
  'P0001', 'a person whose leaving day has come is not switched back on', 'person.has_left');
select test.raises(format('select api.person_leave(%L, %L)', current_setting('t.off'), 'made up: again'),
  'P0001', 'nor marked as left twice', 'person.already_left');
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.person_leave(%L, %L)', current_setting('t.am1'), 'made up'),
  '42501', 'a member marks nobody as left', 'access.needs_level');
select test.raises(format('select api.person_open_work(%L)', current_setting('t.am1')),
  '42501', 'nor reads what they hold', 'access.needs_level');
