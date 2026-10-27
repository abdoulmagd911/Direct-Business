-- HIST-02 — B (26 Oct): a task's history tells its helpers being added and taken off, and the reader's own follow-ups
-- on it. A follow-up is private: it is in its author's history of the task and in nobody else's, admins included
-- (V454). Each change names its kind of record. Every value is made up.
-- Sabotage: supabase/tests/sabotage/history-shows-every-follow-up.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_hist2', 'Test History Two', 'فريق السجل ٢');
select set_config('t.own', test.person('Test History Owner', 'member')::text, true);
select set_config('t.mate', test.person('Test History Colleague', 'member')::text, true);
select set_config('t.admin', test.person('Test History Admin', 'admin')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_hist2')
where id in (current_setting('t.own')::uuid, current_setting('t.mate')::uuid);

select test.as_person(current_setting('t.own')::uuid);
select set_config('t.task', api.task_create(jsonb_build_object('title', 'Made-up task with helpers')) ->> 'id', true);
select api.task_helpers_set(current_setting('t.task')::uuid, array[current_setting('t.mate')::uuid]);
select api.task_helpers_set(current_setting('t.task')::uuid, array[]::uuid[]);
select api.note_capture('reminder', jsonb_build_object('title', 'Follow-up', 'visibility', 'private',
  'remind_at', '2026-11-03T09:00:00+03:00', 'about', jsonb_build_object('entity', 'task',
  'id', current_setting('t.task'))));

select test.eq((select jsonb_agg(x ->> 'action' order by (x ->> 'change_id')::bigint)
                from jsonb_array_elements(api.record_history('task', current_setting('t.task')::uuid)) x
                where x ->> 'entity' = 'task_helper'),
  '["insert", "remove"]'::jsonb, 'the helper was added and then taken off, each a line of the task''s history');
select test.eq((select x -> 'after' ->> 'person_id'
                from jsonb_array_elements(api.record_history('task', current_setting('t.task')::uuid)) x
                where x ->> 'entity' = 'task_helper' and x ->> 'action' = 'insert'),
  current_setting('t.mate'), 'naming who was added');
select test.eq((select count(*)::int
                from jsonb_array_elements(api.record_history('task', current_setting('t.task')::uuid)) x
                where x ->> 'entity' = 'reminder' and x ->> 'action' = 'insert'),
  1, 'its author sees the follow-up they set on the task');
select test.eq((select x -> 'after' ->> 'remind_at'
                from jsonb_array_elements(api.record_history('task', current_setting('t.task')::uuid)) x
                where x ->> 'entity' = 'reminder'),
  '2026-11-03T06:00:00+00:00', 'with its time');
select test.eq((select count(*)::int
                from jsonb_array_elements(api.record_history('task', current_setting('t.task')::uuid)) x
                where x ->> 'entity' = 'task'),
  1, 'and the task''s own line is still there');

select test.as_person(current_setting('t.mate')::uuid);
select test.eq((select count(*)::int
                from jsonb_array_elements(api.record_history('task', current_setting('t.task')::uuid)) x
                where x ->> 'entity' = 'reminder'),
  0, 'a colleague who sees the task does not see the owner''s follow-up');
select test.eq((select count(*)::int
                from jsonb_array_elements(api.record_history('task', current_setting('t.task')::uuid)) x
                where x ->> 'entity' = 'task_helper'),
  2, 'but does see the helpers come and go');

select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select count(*)::int
                from jsonb_array_elements(api.record_history('task', current_setting('t.task')::uuid)) x
                where x ->> 'entity' = 'reminder'),
  0, 'nor does an admin: a follow-up is private (V454)');
