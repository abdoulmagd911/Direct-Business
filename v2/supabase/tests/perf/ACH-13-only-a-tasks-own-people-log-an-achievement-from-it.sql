-- ACH-13 — an achievement is logged from a task only by the task's own people (its owner, its creator or a helper),
-- or by someone with Full on KPIs (C-perf, 13 Nov). A colleague who can see the task is refused
-- (achievement.task_not_yours), and the task does not count as logged; a helper may log from it. Every value is made up.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('t.am3', test.person('Test Helping Manager', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_own_task', 'Test Own Task Desk', 'فريق مهمة خاصة');
update core.person set team_id = (select id from core.team where code = 'test_own_task')
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid, current_setting('t.am3')::uuid);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);

-- the first member's task, done, with the third member as a helper
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up shared task', 'work_type', 'internal'))
  ->> 'id', true);
select api.task_helpers_set(current_setting('t.t')::uuid, array[current_setting('t.am3')::uuid]);
select api.task_status_set(current_setting('t.t')::uuid, 'done');

-- a colleague who sees the task, but is not one of its people, is refused — and the task stays unlogged
select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'id', current_setting('t.t'), 'the colleague can see the task');
select test.raises(format($$select api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made up',
  'happened_on', '2026-09-23', 'source_task_id', %L))$$, current_setting('t.t')), 'P0001',
  'a colleague''s task is refused', 'achievement.task_not_yours');
select test.as_owner();
select test.eq((select count(*)::int from perf.achievement where source_task_id = current_setting('t.t')::uuid), 0,
  'the refused log linked nothing');

-- a helper may log from it
select test.as_person(current_setting('t.am3')::uuid);
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up helped work',
  'happened_on', '2026-09-21', 'source_task_id', current_setting('t.t'))) ->> 'id', true);
select test.as_owner();
select test.eq((select source_task_id from perf.achievement where id = current_setting('t.a')::uuid)::text,
  current_setting('t.t'), 'a helper logs from the task');

-- Full on KPIs (the head) may log from any task it sees, for its owner
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.b', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up logged for them',
  'happened_on', '2026-09-22', 'owner_id', current_setting('t.am1'), 'source_task_id', current_setting('t.t')))
  ->> 'id', true);
select test.as_owner();
select test.eq((select owner_id from perf.achievement where id = current_setting('t.b')::uuid)::text,
  current_setting('t.am1'), 'Full logs from the task for its owner');
