-- MSR-03 — a follow-up is on time only when it was also written down in time (owner 13 Nov, A-tasks): after go-live a
-- tick dated back to before the follow-up's due day, but logged weeks later, is not on time — as a task dated back
-- the same way is not (MSR-01). A tick dated back a day and logged at once stays on time. Before go-live nothing is
-- "logged late". Every value is made up.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.head')::uuid, current_setting('t.am1')::uuid);
select set_config('t.d0', core.riyadh_today()::text, true);

-- one task, three follow-ups of am1's due 30 days ago, a fourth due yesterday
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.T', api.task_create(jsonb_build_object('title', 'Made-up task', 'owner_id', current_setting('t.am1'),
  'happened_on', current_setting('t.d0')::date - 40)) ->> 'id', true);
select set_config('t.A1', api.action_item_add(current_setting('t.T')::uuid, jsonb_build_object('text', 'Made-up A1',
  'owner_id', current_setting('t.am1'), 'due_on', current_setting('t.d0')::date - 30,
  'happened_on', current_setting('t.d0')::date - 40)) ->> 'id', true);
select set_config('t.A2', api.action_item_add(current_setting('t.T')::uuid, jsonb_build_object('text', 'Made-up A2',
  'owner_id', current_setting('t.am1'), 'due_on', current_setting('t.d0')::date - 1,
  'happened_on', current_setting('t.d0')::date - 40)) ->> 'id', true);

-- A1 ticked today but dated a day before its due day, a month back; A2 ticked today, dated yesterday, its due day
select test.as_person(current_setting('t.am1')::uuid);
select api.action_item_done(current_setting('t.A1')::uuid, true, current_setting('t.d0')::date - 31);
select api.action_item_done(current_setting('t.A2')::uuid, true, current_setting('t.d0')::date - 1);
select test.as_owner();

-- before go-live both are on time
select test.eq(measure.work_action_items_on_time(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.d0')::date - 35, current_setting('t.d0')::date - 1)::text, '(1.0000,t,2)',
  'before go-live a tick dated back is taken at its word');

-- after go-live, the month-late tick dated back is not on time; the one logged a day after it happened still is
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('app.go_live_on', null, to_jsonb((current_setting('t.d0')::date - 60)::text), null,
  'Made-up: live two months ago');
select test.as_owner();
select test.eq(measure.work_action_items_on_time(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.d0')::date - 35, current_setting('t.d0')::date - 1)::text, '(0.5000,t,2)',
  'a follow-up ticked a month late but dated back is not on time');
select test.eq((select array_agg(i.entity_id) from measure.work_action_items_on_time_items(null, 'person',
                  current_setting('t.am1')::uuid, current_setting('t.d0')::date - 35, current_setting('t.d0')::date - 1) i
                where i.counted), array[current_setting('t.A2')::uuid], 'the drill-down names the one logged in time');
