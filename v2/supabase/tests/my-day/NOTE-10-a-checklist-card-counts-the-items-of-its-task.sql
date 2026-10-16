-- NOTE-10 — A checklist note's card counts the action items of the task it became (the Architect's ruling of 16 Oct,
-- V286): the note says how many of those items are done out of how many, read live from the task, so closing them on
-- the task moves the card (it kept saying 1/2). A note that made no task says nothing, and the card counts its own rows.
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-checklist-card-ignores-its-task-items.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id = current_setting('t.mgr')::uuid;

select test.as_person(current_setting('t.mgr')::uuid);
-- a checklist that has not been turned into anything says nothing about task items
select set_config('t.plain', api.note_capture('checklist', jsonb_build_object('title', 'Made-up plain list',
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up: one'), jsonb_build_object('text', 'Made-up: two'))))
  ->> 'id', true);
select test.ok(api.my_note(current_setting('t.plain')::uuid) -> 'task_items' is null
               or api.my_note(current_setting('t.plain')::uuid) ->> 'task_items' is null,
  'a note that made no task says nothing about task items');

-- a checklist of two rows, turned into a task with its rows as items
select set_config('t.n', api.note_capture('checklist', jsonb_build_object('title', 'Made-up launch list',
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up: book the venue'),
                             jsonb_build_object('text', 'Made-up: print the cards')))) ->> 'id', true);
select set_config('t.made', api.note_turn_into(current_setting('t.n')::uuid, 'task',
  jsonb_build_object('action_items', true))::text, true);
select test.eq((api.my_note(current_setting('t.n')::uuid) -> 'task_items' ->> 'total')::int, 2, 'two items made');
select test.eq((api.my_note(current_setting('t.n')::uuid) -> 'task_items' ->> 'done')::int, 0, 'none done yet');

-- one closed on the task: the card says 1 of 2
select api.action_item_done((current_setting('t.made')::jsonb -> 'action_item_ids' ->> 0)::uuid, true);
select test.eq((api.my_note(current_setting('t.n')::uuid) -> 'task_items' ->> 'done')::int, 1, 'one done');

-- both closed: 2 of 2, and the note's own rows are as they were
select api.action_item_done((current_setting('t.made')::jsonb -> 'action_item_ids' ->> 1)::uuid, true);
select test.eq((api.my_note(current_setting('t.n')::uuid) -> 'task_items' ->> 'done')::int, 2, 'both done');
select test.eq((api.my_note(current_setting('t.n')::uuid) -> 'task_items' ->> 'total')::int, 2, 'out of two');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n')::uuid) -> 'items'), 2, 'the note keeps its rows');
select test.as_owner();
