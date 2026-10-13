-- NOTE-09 — Turn into a task brings the note's checklist when asked (V605 (3), V186). Asked (`action_items`: true), one
-- request makes the task and turns each checklist row into one of its action items, in order — each with its text,
-- owner and due day, a ticked row as a done item, each showing the note it came from; one Undo takes it all back. The
-- task door's rules hold: a member gives no row to someone else without the assign capability, and then nothing is
-- made. Unasked, the task comes alone (V602); a task from one row brings no others. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-task-from-a-note-leaves-its-checklist.sql, a-checklist-row-loses-its-owner.sql,
-- a-ticked-row-becomes-an-open-item.sql, a-checklist-comes-unasked.sql, a-checklist-item-names-no-note.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.mgr')::uuid, current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);

-- a manager's checklist, asked: its three rows become the task's three action items
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.n', api.note_capture('checklist', jsonb_build_object('title', 'Made-up launch list',
  'happened_on', core.riyadh_today() - 1,
  'items', jsonb_build_array(
    jsonb_build_object('text', 'Made-up: book the venue', 'owner_id', current_setting('t.am2'),
                       'due_on', core.riyadh_today() + 4),
    jsonb_build_object('text', 'Made-up: print the cards', 'done', true),
    jsonb_build_object('text', 'Made-up: send the invites')))) ->> 'id', true);
select set_config('t.made', api.note_turn_into(current_setting('t.n')::uuid, 'task',
  jsonb_build_object('action_items', true))::text, true);
select set_config('t.t', current_setting('t.made')::jsonb ->> 'id', true);
select test.eq(current_setting('t.made')::jsonb ->> 'entity', 'task', 'the note is turned into a task');
select test.eq(jsonb_array_length(current_setting('t.made')::jsonb -> 'action_item_ids'), 3, 'three rows, three items');
select test.eq((select jsonb_agg(x ->> 'text' order by o) from jsonb_array_elements(api.task(current_setting('t.t')::uuid)
                  -> 'action_items') with ordinality e(x, o)),
  jsonb_build_array('Made-up: book the venue', 'Made-up: print the cards', 'Made-up: send the invites'),
  'each row an action item, in order');
select test.eq(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 0 ->> 'owner_id', current_setting('t.am2'),
  'with its owner');
select test.eq((api.task(current_setting('t.t')::uuid) -> 'action_items' -> 0 ->> 'due_on')::date,
  core.riyadh_today() + 4, 'and its due day');
select test.eq(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 2 ->> 'owner_id',
  api.task(current_setting('t.t')::uuid) ->> 'owner_id', 'a row with no owner is the task owner''s');
select test.ok(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 1 ->> 'done_on' is not null,
  'a ticked row is a done item');
select test.ok(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 2 ->> 'done_on' is null, 'the others open');
select test.eq(api.from_note('action_item', (current_setting('t.made')::jsonb -> 'action_item_ids' ->> 0)::uuid)
                 ->> 'id', current_setting('t.n'), 'an item shows the note it came from');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n')::uuid) -> 'links'), 4,
  'the note shows the task and its three items');
select test.as_owner();
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (select entity_id from my.note_link where note_id = current_setting('t.n')::uuid)),
  1, 'all in one request');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.made')::jsonb ->> 'request_id'), 'one Undo');
select test.raises(format('select api.task(%L)', current_setting('t.t')), 'P0002', 'takes the task back',
  'common.not_found');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n')::uuid) -> 'links'), 0, 'with every link');

-- unasked, the task comes alone (V602); one row as the task brings no others
select set_config('t.u', api.note_turn_into(current_setting('t.n')::uuid, 'task')::text, true);
select test.eq(current_setting('t.u')::jsonb -> 'action_item_ids', '[]'::jsonb, 'unasked, no action item');
select test.eq(coalesce(jsonb_array_length(api.task((current_setting('t.u')::jsonb ->> 'id')::uuid) -> 'action_items'),
                        0), 0, 'the task comes alone');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n')::uuid) -> 'links'), 1, 'one link, to the task');
select test.raises(format('select api.note_turn_into(%L, %L, %L::jsonb)', current_setting('t.n'), 'task',
  '{"item": 0, "action_items": true}'), 'P0001', 'one row as the task brings no others', 'common.invalid');
select test.raises(format('select api.note_turn_into(%L, %L, %L::jsonb)', current_setting('t.n'), 'task',
  '{"action_items": "yes"}'), 'P0001', 'asked with a yes or a no', 'common.invalid');

-- a member gives no row to someone else: refused, and nothing is made
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.n2', api.note_capture('checklist', jsonb_build_object('title', 'Made-up handover list',
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up: call back', 'owner_id', current_setting('t.am2')))))
  ->> 'id', true);
select test.raises(format('select api.note_turn_into(%L, %L, %L::jsonb)', current_setting('t.n2'), 'task',
  '{"action_items": true}'), '42501', 'a member does not give a row to someone else', 'access.needs_capability');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n2')::uuid) -> 'links'), 0, 'no link is left');
select test.as_owner();
select test.eq((select count(*)::int from work.task where title = 'Made-up handover list'), 0, 'and no task');
