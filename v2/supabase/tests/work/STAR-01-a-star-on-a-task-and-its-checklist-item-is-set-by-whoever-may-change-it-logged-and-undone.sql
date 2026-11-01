-- STAR-01 — V661 (V514 (1)), checklist item star widened 1 Nov 2026 (owner decision): one optional importance star on a
-- task and on a task's checklist item. The task's star is set and cleared by whoever may change the task; the checklist
-- item's star is set and cleared by whoever may tick it — the task's editors, the item's owner, or its helpers. Someone
-- who may only see the task, or not even that, cannot star its item. Each change is one logged request
-- that Undo takes back (D7); setting the star it already has changes and logs nothing. The Today list's rows carry the
-- star, and a starred task of mine is on the list whatever its due day, undated included; an unstarred undated one is
-- not. Every value is made up.
-- Sabotages: supabase/tests/sabotage/anyone-stars-a-task.sql, supabase/tests/sabotage/starred-tasks-wait-for-a-due-day.sql.
select set_config('v2.test_now', '2026-11-01 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_star', 'Test Star Desk', 'فريق النجمة'),
       (test.department('test_star_far'), 'test_star_far', 'Test Star Far Desk', 'فريق النجمة البعيد');
select set_config('t.am', test.person('Test Star Owner', 'member')::text, true);
select set_config('t.far', test.person('Test Star Far', 'member', 'test_star_far')::text, true);
select set_config('t.item_owner', test.person('Test Star Item Owner', 'member')::text, true);
select set_config('t.item_help', test.person('Test Star Item Helper', 'member')::text, true);
select set_config('t.viewer', test.person('Test Star Viewer', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_star') where id = current_setting('t.am')::uuid;
update core.person set team_id = (select id from core.team where code = 'test_star_far') where id = current_setting('t.far')::uuid;
update core.person set team_id = (select id from core.team where code = 'test_star') where id in
  (current_setting('t.item_owner')::uuid, current_setting('t.item_help')::uuid, current_setting('t.viewer')::uuid);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.task', api.task_create(jsonb_build_object('title', 'Made-up star renewal', 'due_on', '2026-11-02'))
  ->> 'id', true);
select set_config('t.item', api.action_item_add(current_setting('t.task')::uuid,
  jsonb_build_object('text', 'Made-up star quote')) ->> 'id', true);
select test.as_owner();
select test.eq((select starred from work.task where id = current_setting('t.task')::uuid), false, 'a task starts unstarred');
select test.as_person(current_setting('t.am')::uuid);

-- the owner stars the task: one logged request, and the Today list's row says so
select set_config('t.r1', api.task_star(current_setting('t.task')::uuid, true) ->> 'request_id', true);
select test.as_owner();
select test.eq((select starred from work.task where id = current_setting('t.task')::uuid), true, 'the owner stars the task');
select test.as_person(current_setting('t.am')::uuid);
select test.as_owner();
select test.eq((select label_key from audit.request where id = current_setting('t.r1')::uuid), 'task.starred',
  'the star is one logged request');
select test.as_person(current_setting('t.am')::uuid);
select test.eq((select (x ->> 'starred')::boolean from jsonb_array_elements(api.my_day('me') -> 'tasks') x
                where x ->> 'id' = current_setting('t.task')), true, 'the Today list''s row carries the star');
select test.eq(api.task_star(current_setting('t.task')::uuid, true) -> 'request_id', 'null'::jsonb,
  'starring it again changes and logs nothing');

-- Undo takes the star back
select api.undo(current_setting('t.r1')::uuid);
select test.as_owner();
select test.eq((select starred from work.task where id = current_setting('t.task')::uuid), false, 'Undo takes the star back');
select test.as_person(current_setting('t.am')::uuid);

-- the checklist item: starred and unstarred, each logged
select set_config('t.r2', api.action_item_star(current_setting('t.item')::uuid, true) ->> 'request_id', true);
select test.as_owner();
select test.eq((select starred from work.action_item where id = current_setting('t.item')::uuid), true,
  'the owner stars the checklist item');
select test.as_person(current_setting('t.am')::uuid);
select test.as_owner();
select test.eq((select label_key from audit.request where id = current_setting('t.r2')::uuid), 'action_item.starred',
  'logged as the item''s star');
select test.as_person(current_setting('t.am')::uuid);
select api.action_item_star(current_setting('t.item')::uuid, false);
select test.as_owner();
select test.eq((select starred from work.action_item where id = current_setting('t.item')::uuid), false,
  'and clears it');
select test.as_person(current_setting('t.am')::uuid);

-- a checklist item's star follows the tick rule, not the task-edit rule: its owner and its helper may star it even
-- though neither may change the task, and each change is logged; the task's own star stays editors only
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.item2', api.action_item_add(current_setting('t.task')::uuid, jsonb_build_object('text',
  'Made-up star quote two', 'helper_ids', jsonb_build_array(current_setting('t.item_help')))) ->> 'id', true);
select test.as_owner();
update work.action_item set owner_id = current_setting('t.item_owner')::uuid where id = current_setting('t.item2')::uuid;
select test.as_person(current_setting('t.item_owner')::uuid);
select set_config('t.r3', api.action_item_star(current_setting('t.item2')::uuid, true) ->> 'request_id', true);
select test.as_owner();
select test.eq((select starred from work.action_item where id = current_setting('t.item2')::uuid), true,
  'the item''s owner stars it, though they may not change the task');
select test.as_person(current_setting('t.item_owner')::uuid);
select test.as_owner();
select test.eq((select label_key from audit.request where id = current_setting('t.r3')::uuid), 'action_item.starred',
  'logged as the item''s star');
select test.as_person(current_setting('t.item_help')::uuid);
select set_config('t.r4', api.action_item_star(current_setting('t.item2')::uuid, false) ->> 'request_id', true);
select test.as_owner();
select test.eq((select starred from work.action_item where id = current_setting('t.item2')::uuid), false,
  'its helper clears it');
select test.as_person(current_setting('t.item_help')::uuid);
select test.as_owner();
select test.eq((select label_key from audit.request where id = current_setting('t.r4')::uuid), 'action_item.unstarred',
  'logged as the item''s unstar');
select test.as_person(current_setting('t.item_help')::uuid);
select api.action_item_star(current_setting('t.item2')::uuid, true);
select test.as_owner();
select test.eq((select starred from work.action_item where id = current_setting('t.item2')::uuid), true,
  'its helper stars it again');
select test.as_person(current_setting('t.item_help')::uuid);
select test.eq(api.action_item_star(current_setting('t.item2')::uuid, true) -> 'request_id', 'null'::jsonb,
  'starring it again changes and logs nothing');
select test.as_person(current_setting('t.item_owner')::uuid);
select test.raises(format('select api.task_star(%L, true)', current_setting('t.task')), '42501',
  'the item''s owner still cannot star the task itself', 'access.needs_level');

-- someone who may see the task but may not tick its item cannot star the item, or the task either
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.action_item_star(%L, true)', current_setting('t.item2')), '42501',
  'a teammate who may only see the task cannot star its item', 'access.needs_level');
select test.raises(format('select api.task_star(%L, true)', current_setting('t.task')), '42501',
  'nor the task itself', 'access.needs_level');
select test.as_owner();
select test.eq((select starred from work.action_item where id = current_setting('t.item2')::uuid), true,
  'the item is unchanged');
select test.as_person(current_setting('t.am')::uuid);

-- someone who may not even see the task cannot star it or its item
select test.as_person(current_setting('t.far')::uuid);
select test.raises(format('select api.task_star(%L, true)', current_setting('t.task')), 'P0002',
  'someone who may not change the task cannot star it', 'common.not_found');
select test.raises(format('select api.action_item_star(%L, true)', current_setting('t.item')), 'P0002',
  'nor its checklist item', 'common.not_found');
select test.as_owner();
select test.eq((select starred from work.task where id = current_setting('t.task')::uuid), false, 'the task is unchanged');
select test.as_person(current_setting('t.am')::uuid);

-- a starred task is on the Today list whatever its due day; an unstarred undated one is not (the Architect, 1 Nov)
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.undated', api.task_create(jsonb_build_object('title', 'Made-up star undated')) ->> 'id', true);
select set_config('t.far', api.task_create(jsonb_build_object('title', 'Made-up star far', 'due_on', '2026-11-21'))
  ->> 'id', true);
select set_config('t.plain', api.task_create(jsonb_build_object('title', 'Made-up plain undated')) ->> 'id', true);
select api.task_star(current_setting('t.undated')::uuid, true);
select api.task_star(current_setting('t.far')::uuid, true);
select test.eq((select jsonb_agg(x ->> 'id' order by x ->> 'id') from jsonb_array_elements(api.my_day('me') -> 'tasks') x
                where x ->> 'id' in (current_setting('t.undated'), current_setting('t.far'), current_setting('t.plain'))),
  (select jsonb_agg(i order by i) from unnest(array[current_setting('t.undated'), current_setting('t.far')]) i),
  'a starred task is on the Today list undated or due in 20 days; an unstarred undated one is not');
