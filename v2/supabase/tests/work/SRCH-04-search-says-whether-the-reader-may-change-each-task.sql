-- SRCH-04 — V662: the task rows search returns say whether the reader may change the task ('can_edit'), by the Tasks
-- page's own test, so the Turn into task picker can offer only tasks one may add to. The task's owner may; a colleague
-- who may only view it may not; each answer is the one the task's own page gives that reader. Every value is made up.
-- Sabotage: supabase/tests/sabotage/search-says-every-task-is-editable.sql.
select set_config('v2.test_now', '2026-11-01 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_canedit', 'Test Can Edit Desk', 'فريق التعديل');
select set_config('t.am', test.person('Test Can Edit Owner', 'member')::text, true);
select set_config('t.mate', test.person('Test Can Edit Viewer', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_canedit')
where id in (current_setting('t.am')::uuid, current_setting('t.mate')::uuid);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.task', api.task_create(jsonb_build_object('title', 'Made-up quernstone renewal')) ->> 'id', true);
select test.eq((select (x ->> 'can_edit')::boolean from jsonb_array_elements(api.search('quernstone') -> 'tasks') x
                where x ->> 'id' = current_setting('t.task')), true, 'the owner may change the task found');

select test.as_person(current_setting('t.mate')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(api.search('quernstone') -> 'tasks') x
                where x ->> 'id' = current_setting('t.task')), 1, 'the colleague finds the task');
select test.eq((select (x ->> 'can_edit')::boolean from jsonb_array_elements(api.search('quernstone') -> 'tasks') x
                where x ->> 'id' = current_setting('t.task')), false,
  'a colleague who may only view the task may not change it');
select test.eq((select (x ->> 'can_edit')::boolean from jsonb_array_elements(api.search('quernstone') -> 'tasks') x
                where x ->> 'id' = current_setting('t.task')),
  (api.task(current_setting('t.task')::uuid) ->> 'can_edit')::boolean, 'the same answer as the task''s own page');
