-- TSK-06 — a task stays where the people on it can see it (owner 13 Nov, A-tasks). Giving a task to someone who
-- cannot see it is refused in words, and the task stays with its owner; a task is made in, or moved into, only a team
-- of a department its maker or editor works in — an admin works in every department. Every value is made up.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار'),
       (test.department('commercial'), 'test_desk2', 'Test Second Desk', 'فريق الاختبار الثاني'),
       (test.department('test_other_dept'), 'test_far', 'Test Far', 'فريق بعيد');
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.far', test.person('Test Far Member', 'member', 'test_other_dept')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.mgr')::uuid, current_setting('t.am1')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_far') where id = current_setting('t.far')::uuid;
select set_config('t.desk2', (select id::text from core.team where code = 'test_desk2'), true);
select set_config('t.farteam', (select id::text from core.team where code = 'test_far'), true);

-- a manager's task is not given to someone in another department, who could neither list nor open it
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up handover')) ->> 'id', true);
select test.raises(format('select api.tasks_assign(array[%L]::uuid[], %L)', current_setting('t.t'), current_setting('t.far')),
  'P0001', 'someone who cannot see the task is not given it', 'task.owner_cannot_see');
select test.as_owner();
select test.eq((select owner_id from work.task where id = current_setting('t.t')::uuid), current_setting('t.mgr')::uuid,
  'the task stays with its owner');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.far')::uuid
                and entity_id = current_setting('t.t')::uuid), 0, 'and nobody is told of a task they cannot see');
-- a teammate who sees it is given it
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.tasks_assign(array[%L]::uuid[], %L)', current_setting('t.t'), current_setting('t.am1')),
  'a teammate who sees the task is given it');

-- a member's own task is not moved into another department's team, nor made there
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.own', api.task_create(jsonb_build_object('title', 'Made-up own work')) ->> 'id', true);
select test.raises(format('select api.task_update(%L, %L::jsonb, 1)', current_setting('t.own'),
  jsonb_build_object('team_id', current_setting('t.farteam'))), 'P0001',
  'a task is not moved into another department''s team', 'task.team_out_of_reach');
select test.raises(format('select api.task_create(%L::jsonb)', jsonb_build_object('title', 'Made up',
  'team_id', current_setting('t.farteam'))), 'P0001', 'nor made in one', 'task.team_out_of_reach');
-- another team of their own department is fine
select test.runs(format('select api.task_update(%L, %L::jsonb, 1)', current_setting('t.own'),
  jsonb_build_object('team_id', current_setting('t.desk2'))), 'a task moves to another team of its department');
select test.runs(format('select api.task_create(%L::jsonb)', jsonb_build_object('title', 'Made-up desk work',
  'team_id', current_setting('t.desk2'))), 'and is made in one');
select test.eq((api.tasks(jsonb_build_object('scope', 'mine')) ->> 'total')::int, 3,
  'the member still lists every task of theirs');

-- an admin works in every department
select test.as_person(current_setting('t.admin')::uuid);
select test.runs(format('select api.task_update(%L, %L::jsonb, 2)', current_setting('t.own'),
  jsonb_build_object('team_id', current_setting('t.farteam'))), 'an admin moves a task into any department''s team');
