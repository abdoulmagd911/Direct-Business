-- NOTE-07 — Turn into a task and Turn into an action item (V433; TECH-SPEC §3.3a). One request makes the task through
-- its own door — titled by the note, carrying its words, dated (and numbered in the year of) the day the note was
-- captured — and the link; whoever the note mentions and may see the task is mentioned on it, the others are named back
-- and never told. An action item lands on a task its author may change, its text the note's first words, its helpers the
-- mentioned who may see the task. One checklist row becomes a task or an item of its own. The note's chip names the task
-- or the item; the record shows the note it came from; one Undo takes back both. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-task-from-a-note-drops-its-mentions.sql,
-- a-task-from-a-note-names-nobody-back.sql, a-task-from-a-note-is-dated-today.sql,
-- an-action-item-from-a-note-has-no-helpers.sql, a-chip-names-no-task.sql, a-checklist-row-gives-the-whole-note.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار'),
       (test.department('test_other_dept'), 'test_far', 'Test Far', 'فريق بعيد');
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
select set_config('t.far', test.person('Test Far Member', 'member', 'test_other_dept')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_far') where id = current_setting('t.far')::uuid;

-- a shared note, mentioning a teammate and someone from another department, turned into a task
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up follow-up list',
  'body', 'Made-up: send the new rates', 'visibility', 'workspace', 'happened_on', core.riyadh_today() - 2),
  array[current_setting('t.am2')::uuid, current_setting('t.far')::uuid]) ->> 'id', true);
select set_config('t.made', api.note_turn_into(current_setting('t.n')::uuid, 'task',
  jsonb_build_object('due_on', core.riyadh_today() + 5))::text, true);
select set_config('t.t', current_setting('t.made')::jsonb ->> 'id', true);
select test.eq(current_setting('t.made')::jsonb ->> 'entity', 'task', 'the note is turned into a task');
select test.eq(current_setting('t.made')::jsonb -> 'mentions_left_out', jsonb_build_array(current_setting('t.far')),
  'the one who cannot see the task is named back');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'title', 'Made-up follow-up list', 'titled by the note');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'notes', E'Made-up follow-up list\nMade-up: send the new rates',
  'carrying its words');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'owner_id', current_setting('t.am1'), 'its author''s task');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'happened_on')::date, core.riyadh_today() - 2,
  'dated the day the note was captured');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'due_on')::date, core.riyadh_today() + 5,
  'with what the author chose');
select test.eq(api.from_note('task', current_setting('t.t')::uuid) ->> 'id', current_setting('t.n'),
  'the task shows the note it came from');
select test.eq(api.my_note(current_setting('t.n')::uuid) -> 'links' -> 0 ->> 'entity', 'task',
  'the note shows what it turned into');
select test.eq(api.my_note(current_setting('t.n')::uuid) -> 'links' -> 0 ->> 'number',
  current_setting('t.made')::jsonb ->> 'number', 'its chip names the task by number');
select test.eq(api.my_note(current_setting('t.n')::uuid) -> 'links' -> 0 ->> 'title', 'Made-up follow-up list',
  'and title');
select test.as_owner();
select test.eq((select array_agg(m.person_id) from core.mention m join core.note c on c.id = m.note_id
                where c.entity_table = 'work.task' and c.entity_id = current_setting('t.t')::uuid),
  array[current_setting('t.am2')::uuid], 'the teammate is mentioned on the task');
select test.eq((select count(*)::int from notify.notification where kind = 'mentioned'
                and person_id = current_setting('t.far')::uuid), 0, 'the other department is never told');
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (current_setting('t.t')::uuid, (select id from my.note_link
                                                                    where note_id = current_setting('t.n')::uuid))),
  1, 'the task and the link are one request');
select test.eq((select q.label_key from audit.request q
                where q.id = (current_setting('t.made')::jsonb ->> 'request_id')::uuid), 'task.created',
  'logged in the words of the task');

-- the other department sees the shared note, not the task: no chip
select test.as_person(current_setting('t.far')::uuid);
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n')::uuid) -> 'links'), 0,
  'someone who cannot see the task sees the note without its chip');

-- a note from an earlier year makes a task numbered in that year
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.old', api.note_capture('sticky', jsonb_build_object('body', E'\n  Made-up: last year''s visit\nmore',
  'happened_on', make_date(extract(year from core.riyadh_today())::int - 1, 12, 20))) ->> 'id', true);
select set_config('t.oldmade', api.note_turn_into(current_setting('t.old')::uuid, 'task')::text, true);
select test.ok(current_setting('t.oldmade')::jsonb ->> 'number'
                 like 'TSK-' || (extract(year from core.riyadh_today())::int - 1) || '-%',
  'a task from last year''s note is numbered in last year');
select test.eq(api.task((current_setting('t.oldmade')::jsonb ->> 'id')::uuid) ->> 'title', 'Made-up: last year''s visit',
  'an untitled note gives its first line');

-- an action item: on a task the author may change, its helpers the mentioned who may see it
select set_config('t.n2', api.note_capture('checklist', jsonb_build_object('items',
  jsonb_build_array(jsonb_build_object('text', 'Made-up: call the hotel'),
                    jsonb_build_object('text', 'Made-up: book the hall', 'due_on', core.riyadh_today() + 3)),
  'visibility', 'workspace'), array[current_setting('t.am2')::uuid, current_setting('t.far')::uuid]) ->> 'id', true);
select test.raises(format('select api.note_turn_into(%L, %L)', current_setting('t.n2'), 'action_item'), 'P0001',
  'an action item needs its task', 'note.turn_into_needs_task');
select set_config('t.ai', api.note_turn_into(current_setting('t.n2')::uuid, 'action_item',
  jsonb_build_object('task_id', current_setting('t.t')))::text, true);
select test.eq(current_setting('t.ai')::jsonb -> 'mentions_left_out', jsonb_build_array(current_setting('t.far')),
  'the one who cannot see the task is named back');
select test.eq(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 0 ->> 'text', 'Made-up: call the hotel',
  'the item is the note''s first words');
select test.eq(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 0 -> 'helpers',
  jsonb_build_array(current_setting('t.am2')), 'helped by the teammate it mentions');
select test.eq(api.my_note(current_setting('t.n2')::uuid) -> 'links' -> 0 ->> 'entity', 'action_item',
  'the note shows the item');
select test.eq(api.my_note(current_setting('t.n2')::uuid) -> 'links' -> 0 ->> 'number',
  current_setting('t.made')::jsonb ->> 'number', 'naming its task');
select test.eq(api.from_note('action_item', (current_setting('t.ai')::jsonb ->> 'id')::uuid) ->> 'id',
  current_setting('t.n2'), 'the item shows the note it came from');
select test.as_owner();
select test.eq((select q.label_key from audit.request q
                where q.id = (current_setting('t.ai')::jsonb ->> 'request_id')::uuid), 'action_item.added',
  'logged in the words of the item');

-- a teammate's note does not reach a task they may not change
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.n3', api.note_capture('sticky', jsonb_build_object('title', 'Made-up idea')) ->> 'id', true);
select test.raises(format('select api.note_turn_into(%L, %L, %L::jsonb)', current_setting('t.n3'), 'action_item',
  jsonb_build_object('task_id', current_setting('t.t'))), '42501', 'not on someone else''s task', 'access.needs_level');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n3')::uuid) -> 'links'), 0, 'and leaves no link');

-- one Undo takes each conversion back
select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.ai')::jsonb ->> 'request_id'), 'the item is undone');
select test.eq(jsonb_array_length(api.task(current_setting('t.t')::uuid) -> 'action_items'), 0, 'the item is gone');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n2')::uuid) -> 'links'), 0, 'and so is its chip');
select test.runs(format('select api.undo(%L)', current_setting('t.made')::jsonb ->> 'request_id'), 'the task is undone');
select test.raises(format('select api.task(%L)', current_setting('t.t')), 'P0002', 'the task is gone', 'common.not_found');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n')::uuid) -> 'links'), 0, 'and so is the link');

-- one checklist row becomes a task of its own: titled by the row, with the row's due day
select set_config('t.row', api.note_turn_into(current_setting('t.n2')::uuid, 'task', '{"item": 1}'::jsonb) ->> 'id', true);
select test.eq(api.task(current_setting('t.row')::uuid) ->> 'title', 'Made-up: book the hall',
  'a row becomes a task titled by the row');
select test.eq((api.task(current_setting('t.row')::uuid) ->> 'due_on')::date, core.riyadh_today() + 3,
  'due when the row is due');
select test.eq(api.my_note(current_setting('t.n2')::uuid) -> 'links' -> 0 ->> 'id', current_setting('t.row'),
  'and the note shows it');
select test.raises(format('select api.note_turn_into(%L, %L, %L::jsonb)', current_setting('t.n2'), 'task',
  '{"item": 2}'), 'P0001', 'a row that is not there', 'note.item_not_found');

-- what is not there yet
select test.raises(format('select api.note_turn_into(%L, %L)', current_setting('t.n'), 'achievement'), 'P0001',
  'an achievement arrives with achievements', 'note.turn_into_not_yet');
