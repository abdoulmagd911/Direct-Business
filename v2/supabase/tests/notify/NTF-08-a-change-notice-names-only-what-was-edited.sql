-- NTF-08 — QA-577: a change notice names only what someone edited, in fields the screen has words for. A notice of a
-- record someone added names no fields at all (it listed every column the insert wrote: id, person id, keys); an edit
-- names the fields it changed and never the row's id. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-change-notice-lists-what-an-insert-wrote.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_bell8', 'Test Bell Eight', 'فريق الجرس الثامن');
select set_config('t.am', test.person('Test Bell Eight Owner', 'member')::text, true);
select set_config('t.team', (select id from core.team where code = 'test_bell8')::text, true);
update core.person set team_id = current_setting('t.team')::uuid where id = current_setting('t.am')::uuid;

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.made', api.task_create(jsonb_build_object('title', 'Made-up permit renewal',
  'owner_id', current_setting('t.am'), 'team_id', current_setting('t.team'),
  'due_on', (core.riyadh_today() + 5)::text))::text, true);
select set_config('t.t', current_setting('t.made')::jsonb ->> 'id', true);
-- a notice of the request that added the task (as a follower would get)
select test.as_owner();
insert into notify.notification (person_id, kind, actor_id, entity_table, entity_id, request_id, label_key)
values (current_setting('t.am')::uuid, 'followed_change', current_setting('t.admin')::uuid, 'work.task',
        current_setting('t.t')::uuid, (current_setting('t.made')::jsonb ->> 'request_id')::uuid, 'task.created');
select test.as_person(current_setting('t.admin')::uuid);
select api.task_status_set(current_setting('t.t')::uuid, 'done');

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.bell', api.notifications()::text, true);
select test.eq((select x -> 'fields' from jsonb_array_elements(current_setting('t.bell')::jsonb) x
                where x ->> 'label_key' = 'task.created'), '[]'::jsonb,
  'a record someone added names no fields: not its id, keys or every column the insert wrote');
select set_config('t.edit', (select (x -> 'fields')::text from jsonb_array_elements(current_setting('t.bell')::jsonb) x
                             where x ->> 'kind' = 'changed_by_other'), true);
select test.ok(current_setting('t.edit')::jsonb ? 'status_id', 'an edit names the field it changed');
select test.ok(not (current_setting('t.edit')::jsonb ? 'id'), 'and never the row''s id');
