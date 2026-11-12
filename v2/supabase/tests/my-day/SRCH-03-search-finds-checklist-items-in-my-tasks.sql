-- SRCH-03 — V660 (the owner's productivity list): search finds one's own tasks, and the items inside their
-- checklists. A task is found by an item of its checklist, and each hit found by an item alone names that item.
-- A hit found by its title names none. Someone who may not see the task finds nothing of it. A checklist note
-- shared with the reader is NOT in search (Landing 15, F-B3-03: the 'notes' key is gone) — its items are
-- found nowhere. Every value is made up.
-- Sabotage: supabase/tests/sabotage/search-skips-task-checklists.sql.
select set_config('v2.test_now', '2026-10-31 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_items', 'Test Items Desk', 'فريق البنود'),
       (test.department('test_items_far'), 'test_items_far', 'Test Items Far Desk', 'فريق البنود البعيد');
select set_config('t.am', test.person('Test Items Member', 'member')::text, true);
select set_config('t.named', test.person('Test Items Named', 'member')::text, true);
select set_config('t.far', test.person('Test Items Far', 'member', 'test_items_far')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_items')
where id in (current_setting('t.am')::uuid, current_setting('t.named')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_items_far')
where id = current_setting('t.far')::uuid;

-- a task with a checklist, and a checklist note shared with one colleague by name
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.task', api.task_create(jsonb_build_object('title', 'Made-up hornwort renewal'))::text, true);
select api.action_item_add((current_setting('t.task')::jsonb ->> 'id')::uuid,
  jsonb_build_object('text', 'Made-up first step'));
select api.action_item_add((current_setting('t.task')::jsonb ->> 'id')::uuid,
  jsonb_build_object('text', 'Made-up bryophyte quote from the supplier'));
select set_config('t.note', api.note_capture('checklist', jsonb_build_object(
  'title', 'Made-up trip list', 'visibility', 'person', 'shared_with', current_setting('t.named'),
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up passports'),
                             jsonb_build_object('text', 'Made-up liverwort visa letter'))))
  ->> 'id', true);

select test.eq((select x ->> 'item' from jsonb_array_elements(api.search('bryophyte') -> 'tasks') x
                where x ->> 'id' = current_setting('t.task')::jsonb ->> 'id'),
  'Made-up bryophyte quote from the supplier', 'the task is found by an item of its checklist, naming it');
select test.eq((select count(*)::int from jsonb_array_elements(api.search('hornwort') -> 'tasks') x
                where x ->> 'id' = current_setting('t.task')::jsonb ->> 'id' and x -> 'item' = 'null'::jsonb), 1,
  'found by its title, it names no item');
select test.ok(api.search('liverwort') -> 'notes' is null,
  'the shared note is not in search, by its title or any of its items');

-- the colleague it is shared with finds no note either
select test.as_person(current_setting('t.named')::uuid);
select test.ok(api.search('liverwort') -> 'notes' is null,
  'the colleague it is shared with finds no note in search');

-- someone of another department finds neither
select test.as_person(current_setting('t.far')::uuid);
select test.eq(api.search('bryophyte') -> 'tasks', '[]'::jsonb, 'another department''s member does not find the task');
select test.ok(api.search('liverwort') -> 'notes' is null, 'nor any note');
