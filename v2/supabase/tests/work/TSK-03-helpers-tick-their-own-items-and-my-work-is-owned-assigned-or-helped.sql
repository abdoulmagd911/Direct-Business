-- TSK-03 — helpers and the checklist (§3.7, §5; V438). A helper is told, adds notes and ticks only the action items they
-- own or help on; an item's owner ticks it, on the day it was done. My work is the tasks I own ∪ those where I own an
-- action item ∪ those I help on. A meeting adds its note and its assigned items in one request. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-helper-ticks-any-item.sql, my-work-forgets-the-helpers.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.own', test.person('Test Owner', 'member')::text, true);
select set_config('t.help', test.person('Test Helper', 'member')::text, true);
select set_config('t.item', test.person('Test Item Owner', 'member')::text, true);
select set_config('t.none', test.person('Test Bystander', 'member')::text, true);
select set_config('t.th', test.person('Test Task Helper', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.own')::uuid, current_setting('t.help')::uuid, current_setting('t.item')::uuid,
             current_setting('t.none')::uuid, current_setting('t.th')::uuid);

select test.as_person(current_setting('t.own')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up rollout plan',
  'helper_ids', jsonb_build_array(current_setting('t.help'), current_setting('t.th')))) ->> 'id', true);
select set_config('t.mine', api.action_item_add(current_setting('t.t')::uuid, jsonb_build_object('text', 'Made-up: draft',
  'happened_on', core.riyadh_today() - 2)) ->> 'id', true);
select set_config('t.helps', api.action_item_add(current_setting('t.t')::uuid, jsonb_build_object('text', 'Made-up: check',
  'helper_ids', jsonb_build_array(current_setting('t.help')))) ->> 'id', true);
select set_config('t.meet', api.task_add_meeting(current_setting('t.t')::uuid, core.riyadh_today(),
  'Made-up kick-off notes', jsonb_build_array(jsonb_build_object('text', 'Made-up: send the deck',
    'owner_id', current_setting('t.own'), 'due_on', core.riyadh_today() + 2),
  jsonb_build_object('text', 'Made-up: book the room', 'owner_id', current_setting('t.own'))))::text, true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.help')::uuid
                and kind = 'helper_added' and entity_id = current_setting('t.t')::uuid), 1, 'a helper is told once');
select test.eq((select count(*)::int from work.action_item
                where source_note_id = (current_setting('t.meet')::jsonb ->> 'note_id')::uuid), 2,
  'a meeting brings its assigned items');
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (select id from work.action_item
                                   where source_note_id = (current_setting('t.meet')::jsonb ->> 'note_id')::uuid)
                   or c.row_id = (current_setting('t.meet')::jsonb ->> 'note_id')::uuid), 1, 'in one request');
update work.action_item set owner_id = current_setting('t.item')::uuid where id = current_setting('t.mine')::uuid;

-- the helper ticks the item they help on, not another; the item's owner ticks theirs
select test.as_person(current_setting('t.help')::uuid);
select test.raises(format('select api.action_item_done(%L, true)', current_setting('t.mine')), '42501',
  'a helper does not tick an item that is not theirs', 'action_item.not_yours');
select test.runs(format('select api.action_item_done(%L, true)', current_setting('t.helps')),
  'a helper ticks the item they help on');
select test.runs(format('select core.note_add(%L, %L, %L, %L)', 'task', current_setting('t.t'), 'update',
  'Made-up: halfway there'), 'and adds a note to the task');
select test.as_person(current_setting('t.item')::uuid);
select test.runs(format('select api.action_item_done(%L, true, %L)', current_setting('t.mine'), core.riyadh_today() - 1),
  'an item''s owner ticks theirs');
select test.as_owner();
select test.eq((select done_on from work.action_item where id = current_setting('t.mine')::uuid), core.riyadh_today() - 1,
  'done on the day it was done');

-- my work: owned, an item owned, helping
select test.as_person(current_setting('t.own')::uuid);
select test.eq((api.tasks('{"scope": "my_work"}'::jsonb) ->> 'total')::int, 1, 'the owner''s work');
select test.as_person(current_setting('t.item')::uuid);
select test.eq((api.tasks('{"scope": "my_work"}'::jsonb) ->> 'total')::int, 1, 'an item''s owner''s work');
select test.eq((api.tasks('{"scope": "mine"}'::jsonb) ->> 'total')::int, 0, 'though not theirs to own');
select test.as_person(current_setting('t.help')::uuid);
select test.eq((api.tasks('{"scope": "my_work"}'::jsonb) ->> 'total')::int, 1, 'an item helper''s work');
select test.as_person(current_setting('t.th')::uuid);
select test.eq((api.tasks('{"scope": "my_work"}'::jsonb) ->> 'total')::int, 1, 'a helper''s work, on the task alone');
select test.as_person(current_setting('t.none')::uuid);
select test.eq((api.tasks('{"scope": "my_work"}'::jsonb) ->> 'total')::int, 0, 'nobody else''s');
select test.eq((api.tasks() ->> 'total')::int, 1, 'though the team sees it');
