-- ASK-03 — a removed question frees its place (owner 13 Nov, A-tasks): removing an unanswered question no longer
-- keeps the person "already asked" on that record, so they may be asked again; the removed question is gone from the
-- open asks. Undoing the removal while a newer question to the same person is open is refused — one open question per
-- person per record, always. Every value is made up.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_ask3', 'Test Ask Again Desk', 'فريق السؤال مجددًا');
select set_config('t.mem', test.person('Test Ask Again Member', 'member')::text, true);
select set_config('t.peer', test.person('Test Ask Again Peer', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_ask3')
where id in (current_setting('t.mem')::uuid, current_setting('t.peer')::uuid);

select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up task with a question',
  'work_type', 'internal')) ->> 'id', true);
select api.task_helpers_set(current_setting('t.t')::uuid, array[current_setting('t.peer')::uuid]);
select set_config('t.q', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up: is the visa ready?',
  current_setting('t.peer')::uuid)::text, true);

-- the asker removes the question before it is answered
select set_config('t.rm', api.comment_remove((current_setting('t.q')::jsonb ->> 'id')::uuid, 'Made-up: asked by mistake')::text,
  true);
select test.eq(jsonb_array_length(api.open_asks() -> 'by_me'), 0, 'the removed question is no longer open');

-- the same person may be asked again on the same record
select test.runs(format('select api.comment_add(%L, %L, %L, %L)', 'task', current_setting('t.t'),
  'Made-up: is the visa ready now?', current_setting('t.peer')::uuid),
  'after removing the question, the same person may be asked again');
select test.eq(jsonb_array_length(api.open_asks() -> 'by_me'), 1, 'and the new question is the one open');

-- undoing the first removal now would make two open questions to one person: refused
select test.raises(format('select api.undo(%L)', current_setting('t.rm')::jsonb ->> 'request_id'), '23505',
  'the undo never opens a second question to the same person');
