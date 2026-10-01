-- TSK-01 — who creates, assigns and changes a task (§3.7, §5; V96, V465). Anyone with Own on Tasks makes their own
-- task; giving one to someone else needs the capability (tasks.assign), and the new owner is told once. The whole team of
-- the task's department reads it; only its owner, its creator or Full changes it; another department does not see it.
-- A switched-off person and the test account are never named. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-member-assigns-to-anyone.sql, a-task-seen-by-another-department.sql,
-- a-switched-off-person-owns-a-task.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار'),
       (test.department('test_other_dept'), 'test_far', 'Test Far', 'فريق بعيد');
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.far', test.person('Test Far Member', 'member', 'test_other_dept')::text, true);
select set_config('t.off', test.person('Test Switched Off', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid, current_setting('t.mgr')::uuid,
             current_setting('t.off')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_far') where id = current_setting('t.far')::uuid;
update core.person set active = false where id = current_setting('t.off')::uuid;

-- a member makes their own task
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.made', api.task_create(jsonb_build_object('title', 'Made-up internal checklist'))::text, true);
select set_config('t.t', current_setting('t.made')::jsonb ->> 'id', true);
select test.eq(current_setting('t.made')::jsonb ->> 'owner_id', current_setting('t.am1'), 'a task is its maker''s');
select test.ok(current_setting('t.made')::jsonb ->> 'number' ~ '^TSK-[0-9]{4}-[0-9]{4}$', 'numbered TSK-year-number');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'meaning', 'not_started', 'not started');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'work_type', 'internal', 'internal work without an organisation');
select test.raises(format('select api.task_create(%L::jsonb)', jsonb_build_object('title', 'Made up',
  'owner_id', current_setting('t.am2'))), '42501', 'a member does not give a task to someone else',
  'access.needs_capability');
select test.raises(format('select api.tasks_assign(array[%L]::uuid[], %L)', current_setting('t.t'), current_setting('t.am2')),
  '42501', 'nor reassign one', 'access.needs_capability');

-- the team reads it; only its owner, creator or Full changes it; another department does not see it
select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'title', 'Made-up internal checklist', 'a teammate reads it');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_edit')::boolean, false, 'and cannot change it');
select test.raises(format('select api.task_update(%L, %L::jsonb, 1)', current_setting('t.t'), '{"title": "Made up"}'),
  '42501', 'the door refuses them too', 'access.needs_level');
select test.as_person(current_setting('t.far')::uuid);
select test.raises(format('select api.task(%L)', current_setting('t.t')), 'P0002',
  'another department does not see it', 'common.not_found');
select test.eq((api.tasks() ->> 'total')::int, 0, 'nor list it');

-- a manager gives it to someone else, who is told once
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.asg', api.tasks_assign(array[current_setting('t.t')::uuid], current_setting('t.am2')::uuid)::text, true);
select test.as_owner();
select test.eq((select owner_id from work.task where id = current_setting('t.t')::uuid), current_setting('t.am2')::uuid,
  'a manager reassigns it');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and kind = 'assigned' and request_id = (current_setting('t.asg')::jsonb ->> 'request_id')::uuid), 1,
  'and the new owner is told once');
select test.eq((select team_id from work.task where id = current_setting('t.t')::uuid),
  (select id from core.team where code = 'test_desk'), 'the task keeps its team');

-- nobody switched off, nobody from the test account
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.tasks_assign(array[%L]::uuid[], %L)', current_setting('t.t'), current_setting('t.off')),
  'P0001', 'a switched-off person owns nothing', 'person.unavailable');
select test.as_owner();
update core.person set account = 'test_account', team_id = null where id = current_setting('t.am1')::uuid;
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.task_helpers_set(%L, array[%L]::uuid[])', current_setting('t.t'), current_setting('t.am1')),
  'P0001', 'nor does the test account', 'person.unavailable');
