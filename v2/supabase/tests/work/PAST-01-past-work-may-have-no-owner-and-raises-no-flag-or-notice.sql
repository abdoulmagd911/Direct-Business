-- PAST-01 — past work (V491, V506). A task dated before go-live is past work: it may carry owner Unknown, which live
-- work never may; it raises no overdue flag and no notice; it sits under Past work and Needs an owner, never in My work;
-- a manager gives it an owner in one logged change, and Undo restores Unknown. Every value is made up.
-- Sabotages: supabase/tests/sabotage/live-work-without-an-owner.sql, past-work-flagged-overdue.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.mgr')::uuid, current_setting('t.am1')::uuid);
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb((core.riyadh_today() - 30)::text), core.riyadh_today() - 30, 'made up: go-live',
        current_setting('t.mgr')::uuid);

select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.task_create(%L::jsonb)', jsonb_build_object('title', 'Made up', 'owner_unknown', true)),
  'P0001', 'live work always has an owner', 'task.owner_required');
select set_config('t.made', api.task_create(jsonb_build_object('title', 'Made-up from March', 'owner_unknown', true,
  'happened_on', core.riyadh_today() - 200, 'due_on', core.riyadh_today() - 190))::text, true);
select set_config('t.t', current_setting('t.made')::jsonb ->> 'id', true);
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'owner_id', null, 'past work may be Unknown');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'past_work')::boolean, true, 'it is past work');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'overdue')::boolean, false,
  'past its due day, it is not overdue');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where request_id = (current_setting('t.made')::jsonb ->> 'request_id')::uuid), 0, 'and tells nobody');

select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((api.tasks() ->> 'total')::int, 0, 'it stays out of the live list');
select test.eq((api.tasks('{"past_work": true}'::jsonb) ->> 'total')::int, 1, 'under Past work');
select test.eq(api.tasks('{"needs_owner": true}'::jsonb) -> 'rows' -> 0 ->> 'id', current_setting('t.t'),
  'and under Needs an owner');

select set_config('t.asg', api.tasks_assign(array[current_setting('t.t')::uuid], current_setting('t.am1')::uuid)
  ->> 'request_id', true);
select test.as_owner();
select test.eq((select count(*)::int from audit.change where request_id = current_setting('t.asg')::uuid), 1,
  'giving it an owner is one logged change');
select test.eq((select count(*)::int from notify.notification where request_id = current_setting('t.asg')::uuid), 0,
  'still telling nobody');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq((api.tasks('{"scope": "my_work"}'::jsonb) ->> 'total')::int, 0, 'past work is never in My work');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.asg')), 'Undo');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'owner_id', null, 'restores Unknown');
