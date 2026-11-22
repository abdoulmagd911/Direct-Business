-- CMT-03 — Landing 33 (B1, B2): one comment per record is THE DECISION (marking another moves the mark; unmarking
-- clears it; a viewer marks nothing); a comment links to the records it is about and a reader who may not see one is
-- told only that a record is linked; a mention on a task tells the person, makes them a HELPER (the task is under
-- their Helping, on the Tasks page and on My day) and never changes the Responsible. Every value is made up.
-- Sabotages: a-second-decision-stays-marked, a-viewer-marks-the-decision, a-mention-makes-no-helper,
-- a-mention-takes-the-task, a-hidden-link-names-its-record, a-mention-of-someone-who-cannot-see.
select set_config('v2.test_now', '2026-11-22 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_cmt3', 'Test Decision Desk', 'فريق القرار');
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
select set_config('t.view', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.blind', test.person('Test Outsider', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_cmt3')
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid, current_setting('t.view')::uuid,
             current_setting('t.blind')::uuid);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.blind')::uuid, 'tasks', 'none', 'made up: no tasks'),
       (current_setting('t.am2')::uuid, 'clients', 'none', 'made up: no partners');

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Decision Traders',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1')))))
  ->> 'id', true);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up decision task', 'work_type', 'internal',
  'due_on', '2026-11-24')) ->> 'id', true);

-- ------------------------------------------------------------------ the decision
select set_config('t.c1', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up: option A') ->> 'id', true);
select set_config('t.c2', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up: option B') ->> 'id', true);
select test.eq((api.comments('task', current_setting('t.t')::uuid) ->> 'can_decide')::boolean, true,
  'whoever may comment may mark the decision');
select api.comment_decide(current_setting('t.c1')::uuid, true);
select test.eq((select string_agg(c ->> 'body', ' | ' order by c ->> 'body') from jsonb_array_elements(
  api.comments('task', current_setting('t.t')::uuid) -> 'comments') c where (c ->> 'is_decision')::boolean),
  'Made-up: option A', 'the marked comment is the decision');
select test.eq(api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 0 ->> 'decided_by',
  current_setting('t.am1'), 'it says who marked it');
select api.comment_decide(current_setting('t.c2')::uuid, true);
select test.eq((select string_agg(c ->> 'body', ' | ' order by c ->> 'body') from jsonb_array_elements(
  api.comments('task', current_setting('t.t')::uuid) -> 'comments') c where (c ->> 'is_decision')::boolean),
  'Made-up: option B', 'marking another comment moves the mark: there is one decision');
select test.raises(format('select api.comment_decide(%L, true)', current_setting('t.c2')), 'P0001',
  'marking the decision again changes nothing', 'comment.decision_unchanged');
select test.as_person(current_setting('t.view')::uuid);
select test.eq((api.comments('task', current_setting('t.t')::uuid) ->> 'can_decide')::boolean, false,
  'a viewer is not offered the mark');
select test.raises(format('select api.comment_decide(%L, true)', current_setting('t.c1')), '42501',
  'a viewer marks no decision', 'access.needs_level');
select test.as_person(current_setting('t.am1')::uuid);
select api.comment_decide(current_setting('t.c2')::uuid, false);
select test.eq((select count(*)::int from jsonb_array_elements(
  api.comments('task', current_setting('t.t')::uuid) -> 'comments') c where (c ->> 'is_decision')::boolean), 0,
  'unmarking leaves no decision');
select test.as_owner();
select test.eq((select count(*)::int from audit.request r where r.label_key in
  ('comment.decision_marked', 'comment.decision_unmarked')), 3, 'every mark and unmark is logged');
select test.as_person(current_setting('t.am1')::uuid);

-- ------------------------------------------------------------------ links
select set_config('t.c3', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up: see the partner', null,
  jsonb_build_array(jsonb_build_object('kind', 'partner', 'id', current_setting('t.p')),
                    jsonb_build_object('kind', 'partner', 'id', current_setting('t.p')))) ->> 'id', true);
select set_config('t.l', (select c -> 'links' from jsonb_array_elements(
  api.comments('task', current_setting('t.t')::uuid) -> 'comments') c where c ->> 'id' = current_setting('t.c3'))::text, true);
select test.eq(jsonb_array_length(current_setting('t.l')::jsonb), 1, 'a record linked twice is kept once');
select test.eq(current_setting('t.l')::jsonb -> 0 ->> 'label', 'Made Up Decision Traders', 'the link names the record');
select test.eq(current_setting('t.l')::jsonb -> 0 ->> 'id', current_setting('t.p'), 'and carries its id, to open it');
select test.raises(format('select api.comment_add(%L, %L, %L, null, %L::jsonb)', 'task', current_setting('t.t'), 'Made up',
  jsonb_build_array(jsonb_build_object('kind', 'spaceship', 'id', current_setting('t.p')))), 'P0001',
  'an unknown kind of record is refused', 'comment.link_unknown');
-- a reader who may not see the partner is told a record is linked, and nothing about it
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.l2', (select c -> 'links' from jsonb_array_elements(
  api.comments('task', current_setting('t.t')::uuid) -> 'comments') c where c ->> 'id' = current_setting('t.c3'))::text, true);
select test.eq(current_setting('t.l2')::jsonb -> 0, jsonb_build_object('kind', 'partner', 'hidden', true),
  'a reader who may not see the linked record gets no name and no id');
select test.raises(format('select api.comment_add(%L, %L, %L, null, %L::jsonb)', 'task', current_setting('t.t'), 'Made up',
  jsonb_build_array(jsonb_build_object('kind', 'partner', 'id', current_setting('t.p')))), 'P0001',
  'and cannot link what they cannot see', 'comment.link_cannot_see');

-- ------------------------------------------------------------------ a mention hands the task to help
select test.as_person(current_setting('t.am2')::uuid);
select test.eq((api.tasks(jsonb_build_object('scope', 'helping')) ->> 'total')::int, 0, 'before: nothing under Helping');
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.m', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up: @Second please look', null, null,
  array[current_setting('t.am2')::uuid, current_setting('t.am2')::uuid, current_setting('t.am1')::uuid])::text, true);
select test.eq((current_setting('t.m')::jsonb ->> 'helpers_added')::int, 1, 'one helper is added: named twice counts once, never the writer');
select test.as_owner();
select test.eq((select owner_id from work.task where id = current_setting('t.t')::uuid)::text, current_setting('t.am1'),
  'the Responsible is unchanged: a mention never takes the task');
select test.eq((select count(*)::int from work.task_helper where task_id = current_setting('t.t')::uuid
                and person_id = current_setting('t.am2')::uuid and deleted_at is null), 1, 'the person mentioned is a helper');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and kind = 'mentioned' and entity_id = current_setting('t.t')::uuid
                and request_id = (current_setting('t.m')::jsonb ->> 'request_id')::uuid), 1,
  'and is told once, as a mention');
select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.tasks(jsonb_build_object('scope', 'helping')) #>> '{rows,0,title}', 'Made-up decision task',
  'the task is under their Helping on the Tasks page');
select test.eq((select x ->> 'group' from jsonb_array_elements(api.my_day('me') -> 'tasks') x
                where x ->> 'title' = 'Made-up decision task'), 'helping', 'and under Helping on My day');
select test.eq((select c -> 'mentions' -> 0 ->> 'id' from jsonb_array_elements(
  api.comments('task', current_setting('t.t')::uuid) -> 'comments') c
  where c ->> 'id' = current_setting('t.m')::jsonb ->> 'id'), current_setting('t.am2'), 'the comment names who it mentions');
-- mentioned again: still one helper row, told again
select test.as_person(current_setting('t.am1')::uuid);
select test.eq((api.comment_add('task', current_setting('t.t')::uuid, 'Made-up: @Second once more', null, null,
  array[current_setting('t.am2')::uuid]) ->> 'helpers_added')::int, 0, 'a helper mentioned again is not added twice');
-- someone who cannot see the task is not mentioned, and is named in the refusal
select test.raises(format('select api.comment_add(%L, %L, %L, null, null, array[%L]::uuid[])', 'task', current_setting('t.t'),
  'Made up', current_setting('t.blind')), 'P0001', 'someone who cannot see the task is not mentioned',
  'comment.mention_cannot_see');
select test.as_owner();
select test.eq((select count(*)::int from work.task_helper where task_id = current_setting('t.t')::uuid
                and person_id = current_setting('t.blind')::uuid), 0, 'and is not made a helper');
