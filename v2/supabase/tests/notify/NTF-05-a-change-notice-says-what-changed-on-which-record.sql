-- NTF-05 — the bell says "<who> changed <what> on <record>" (the Architect's order of 14 Oct, after the oversight read
-- "Admin account changed your Status change"). Someone else setting my task's status tells me about the TASK — not the
-- status change row the same request wrote — with the field that changed (`fields`, names only, no bookkeeping) and
-- the task's name; a person reads by their name. A reader who may not see the record now gets neither its name nor
-- what changed on it (QA-553). Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-change-notice-points-at-its-side-row.sql,
--            supabase/tests/sabotage/a-change-notice-tells-anyone-what-changed.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_bell5', 'Test Bell Five', 'فريق الجرس الخامس');
select set_config('t.am', test.person('Test Bell Owner', 'member')::text, true);
select set_config('t.far', test.person('Test Far Head', 'head', 'test_other_dept')::text, true);
select set_config('t.team', (select id from core.team where code = 'test_bell5')::text, true);
update core.person set team_id = current_setting('t.team')::uuid where id = current_setting('t.am')::uuid;

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.made', api.task_create(jsonb_build_object('title', 'Made-up visa follow-up',
  'owner_id', current_setting('t.am'), 'team_id', current_setting('t.team'),
  'due_on', (core.riyadh_today() + 5)::text))::text, true);
select set_config('t.t', current_setting('t.made')::jsonb ->> 'id', true);
select api.task_status_set(current_setting('t.t')::uuid, 'done');

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.bell', api.notifications()::text, true);
select set_config('t.n', (select x::text from jsonb_array_elements(current_setting('t.bell')::jsonb) x
                          where x ->> 'kind' = 'changed_by_other'), true);
select test.eq(current_setting('t.n')::jsonb ->> 'entity', 'task',
  'the status change tells me about the task, not its status change row');
select test.eq(current_setting('t.n')::jsonb ->> 'title',
  (current_setting('t.made')::jsonb ->> 'number') || ' · Made-up visa follow-up', 'named by its number and title');
select test.ok((current_setting('t.n')::jsonb -> 'fields') ? 'status_id', 'it says the status changed');
select test.ok(not ((current_setting('t.n')::jsonb -> 'fields') ?| array['version', 'updated_at', 'updated_by', 'closed_at', 'closed_by']),
  'and never the version or a time or "by whom" the system stamps');
select test.eq((select x -> 'fields' from jsonb_array_elements(current_setting('t.bell')::jsonb) x
                where x ->> 'kind' = 'assigned'), '[]'::jsonb, 'a notice that is not a change names no fields');

-- a reader who may not see the task now: a notice of the same change names nothing of it, and says nothing changed
select test.as_owner();
select test.ok(not authz.can_see_as(current_setting('t.far')::uuid, 'work.task', current_setting('t.t')::uuid),
  'the far head may not see the task');
insert into notify.notification (person_id, kind, actor_id, entity_table, entity_id, request_id, label_key)
values (current_setting('t.far')::uuid, 'followed_change', current_setting('t.admin')::uuid, 'work.task',
        current_setting('t.t')::uuid, (current_setting('t.n')::jsonb ->> 'request_id')::uuid, 'task.status_set');
select test.as_person(current_setting('t.far')::uuid);
select test.eq((select jsonb_build_object('title', x -> 'title', 'fields', x -> 'fields')
                from jsonb_array_elements(api.notifications()) x where x ->> 'entity_id' = current_setting('t.t')),
  jsonb_build_object('title', null, 'fields', '[]'::jsonb),
  'a reader who may not see the task gets neither its name nor what changed');

-- a person reads by their name
select test.as_owner();
insert into notify.notification (person_id, kind, actor_id, entity_table, entity_id, label_key)
values (current_setting('t.am')::uuid, 'changed_by_other', current_setting('t.admin')::uuid, 'core.person',
        current_setting('t.am')::uuid, 'person.updated');
select test.as_person(current_setting('t.am')::uuid);
select test.eq((select x ->> 'title' from jsonb_array_elements(api.notifications()) x
                where x ->> 'label_key' = 'person.updated'), 'Test Bell Owner', 'a person reads by their name');
