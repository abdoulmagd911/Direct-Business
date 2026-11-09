-- ASK-02 — Ask twice (F005): a second open question to the same person on the same record is refused in words,
-- not with the database's own error. The guard is per asked person (another person may still be asked), and once
-- the first question is answered the same person may be asked again. Every value is made up.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_ask2', 'Test Ask Twice Desk', 'فريق الأسئلة مرتين');
select set_config('t.mgr', test.person('Test Ask Twice Manager', 'manager')::text, true);
select set_config('t.mem', test.person('Test Ask Twice Member', 'member')::text, true);
select set_config('t.peer', test.person('Test Ask Twice Peer', 'member')::text, true);
select set_config('t.peer2', test.person('Test Ask Twice Second Peer', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_ask2')
where id in (current_setting('t.mgr')::uuid, current_setting('t.mem')::uuid, current_setting('t.peer')::uuid,
             current_setting('t.peer2')::uuid);
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb((core.riyadh_today() - 30)::text), core.riyadh_today() - 30, 'made up: go-live',
        current_setting('t.mgr')::uuid);
insert into core.setting (key, department_id, value, valid_from, reason, created_by)
values ('notify.kinds_enabled', test.department('commercial'),
        (select default_value from core.setting_def where key = 'notify.kinds_enabled'),
        core.riyadh_today(), 'made up: the new ask kinds are on for this team',
        current_setting('t.mgr')::uuid);

-- the member makes their own task and names two peers as helpers, so both may write on it
select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up stuck task twice',
  'work_type', 'internal')) ->> 'id', true);
select api.task_helpers_set(current_setting('t.t')::uuid,
  array[current_setting('t.peer')::uuid, current_setting('t.peer2')::uuid]);

-- the member asks the peer a question about the task
select set_config('t.q', api.comment_add('task', current_setting('t.t')::uuid,
  'Made-up: what did the client say?', current_setting('t.peer')::uuid)::text, true);
select test.eq(jsonb_array_length(api.open_asks() -> 'by_me'), 1, 'the question I asked is open');

-- asking the same person again while it is still open is refused in words, and tells them only once
select test.raises(format('select api.comment_add(%L, %L, %L, %L)', 'task', current_setting('t.t'),
  'Made-up: and what about the date?', current_setting('t.peer')::uuid), 'P0001',
  'a second open question to the same person is refused', 'comment.already_asked');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.peer')::uuid
                and kind = 'asked' and entity_id = current_setting('t.t')::uuid), 1,
  'the refused second ask tells the asked person no second time');

-- the guard is per asked person: another person may still be asked on the same record
select test.as_person(current_setting('t.mem')::uuid);
select test.runs(format('select api.comment_add(%L, %L, %L, %L)', 'task', current_setting('t.t'),
  'Made-up: what did the supplier say?', current_setting('t.peer2')::uuid),
  'another person may still be asked');

-- once the first question is answered, the same person may be asked again
select test.as_person(current_setting('t.peer')::uuid);
select api.comment_answer((current_setting('t.q')::jsonb ->> 'id')::uuid, 'Made-up: the client said next week');
select test.as_person(current_setting('t.mem')::uuid);
select test.runs(format('select api.comment_add(%L, %L, %L, %L)', 'task', current_setting('t.t'),
  'Made-up: and what about the date?', current_setting('t.peer')::uuid),
  'after the answer, the same person may be asked again');
