-- ASK-01 — Ask and Need help (Phase 5). Who may ask; the asked person is told once; the answer closes the
-- question and is visible to the record's readers; a closed question cannot be re-answered; flagging sets the flag
-- and the manager's list shows it until acknowledged; acknowledgement clears the flag and tells the person who
-- flagged it; re-flagging is allowed after acknowledgement. Every value is made up.
-- Sabotages: supabase/tests/sabotage/an-escalation-follows-nobody.sql, an-escalation-to-someone-blind.sql.
-- Note: test.as_person sets the session role to authenticated, so every direct read of a table below is preceded
-- by test.as_owner (the ESC-01 pattern); api.* calls always run as the person named just before them.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_ask1', 'Test Ask Desk', 'فريق الأسئلة');
select set_config('t.mgr', test.person('Test Ask Manager', 'manager')::text, true);
select set_config('t.mem', test.person('Test Ask Member', 'member')::text, true);
select set_config('t.peer', test.person('Test Ask Peer', 'member')::text, true);
select set_config('t.viewer', test.person('Test Ask Viewer', 'viewer')::text, true);
select set_config('t.admin', test.person('Test Ask Admin', 'admin')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_ask1')
where id in (current_setting('t.mgr')::uuid, current_setting('t.mem')::uuid, current_setting('t.peer')::uuid);
-- the member reports to the manager: flagging with no person named tells the manager
update core.person set manager_id = current_setting('t.mgr')::uuid where id = current_setting('t.mem')::uuid;
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb((core.riyadh_today() - 30)::text), core.riyadh_today() - 30, 'made up: go-live',
        current_setting('t.admin')::uuid);
-- the new kinds (asked, escalation_acknowledged) entered the default after this test's clock, so the test turns them
-- on for its own department explicitly (a department row beats the global rows in core.setting_at)
insert into core.setting (key, department_id, value, valid_from, reason, created_by)
values ('notify.kinds_enabled', test.department('commercial'),
        (select default_value from core.setting_def where key = 'notify.kinds_enabled'),
        core.riyadh_today(), 'made up: the new ask kinds are on for this team',
        current_setting('t.admin')::uuid);

-- the member makes their own task and names the peer as a helper, so the peer may write on it
select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up stuck task',
  'work_type', 'internal')) ->> 'id', true);
select api.task_helpers_set(current_setting('t.t')::uuid, array[current_setting('t.peer')::uuid]);

-- who may ask: the member asks the peer a question about the task; a viewer may not ask
select set_config('t.q', api.comment_add('task', current_setting('t.t')::uuid,
  'Made-up: what did the client say?', current_setting('t.peer')::uuid)::text, true);
select test.eq(jsonb_array_length(api.open_asks() -> 'by_me'), 1, 'the question I asked is open');
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.comment_add(%L, %L, %L, %L)', 'task', current_setting('t.t'),
  'Made up', current_setting('t.peer')::uuid), '42501', 'a viewer asks nothing', 'access.needs_level');

-- the asked person is told once, and sees the open question
select test.as_person(current_setting('t.peer')::uuid);
select test.eq(jsonb_array_length(api.open_asks() -> 'to_me'), 1, 'the asked person sees the open question');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.peer')::uuid
                and kind = 'asked' and entity_id = current_setting('t.t')::uuid), 1, 'the asked person is told once');

-- a casual comment by the asked person does not close it; only an explicit reply does
select test.as_person(current_setting('t.peer')::uuid);
select api.comment_add('task', current_setting('t.t')::uuid, 'Made-up: looking into it');
select test.eq(jsonb_array_length(api.open_asks() -> 'to_me'), 1, 'a casual comment does not close the question');
select api.comment_answer((current_setting('t.q')::jsonb ->> 'id')::uuid, 'Made-up: the client said next week');
select test.eq(jsonb_array_length(api.open_asks() -> 'to_me'), 0, 'the answer closes the question');

-- the answer is visible to the record's readers
select test.as_person(current_setting('t.mem')::uuid);
select test.eq(api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 0 ->> 'answer',
  'Made-up: the client said next week', 'the answer is visible to the record''s readers');

-- a closed question cannot be re-answered, only re-asked as a new question
select test.as_person(current_setting('t.peer')::uuid);
select test.raises(format('select api.comment_answer(%L, %L)',
  (current_setting('t.q')::jsonb ->> 'id')::uuid, 'Made-up: another answer'), 'P0001',
  'a closed question cannot be re-answered', 'comment.not_open');
select test.as_person(current_setting('t.mem')::uuid);
select test.runs(format('select api.comment_add(%L, %L, %L, %L)', 'task', current_setting('t.t'),
  'Made-up: and what about the date?', current_setting('t.peer')::uuid), 'it can be re-asked as a new question');

-- flagging: the member flags the task for help with no person named — the direct manager is told, the flag is set
select api.escalate('task', current_setting('t.t')::uuid, null, 'Made-up: the supplier stopped answering');
select test.as_owner();
select test.eq((select escalated from work.task where id = current_setting('t.t')::uuid), true,
  'flagging sets the flag');
select test.eq((select escalated_to from work.task where id = current_setting('t.t')::uuid)::text,
  current_setting('t.mgr'), 'flagged to the direct manager');
select test.eq((select escalated_by from work.task where id = current_setting('t.t')::uuid)::text,
  current_setting('t.mem'), 'flagged by the member');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.mgr')::uuid
                and kind = 'escalated' and entity_id = current_setting('t.t')::uuid), 1, 'the manager is told');
select test.eq((select count(*)::int from notify.follow where person_id = current_setting('t.mgr')::uuid
                and entity_table = 'work.task' and entity_id = current_setting('t.t')::uuid), 1,
  'and the manager follows it');

-- the manager's list shows it until acknowledged
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(jsonb_array_length(api.escalated_tasks()), 1, 'the manager''s list shows the flagged task');
select test.eq(api.escalated_tasks() -> 0 ->> 'id', current_setting('t.t'), 'the flagged task itself');
select test.eq(api.escalated_tasks() -> 0 ->> 'escalated', 'true', 'flagged on the row');

-- nobody else acknowledges it
select test.as_person(current_setting('t.peer')::uuid);
select test.raises(format('select api.escalate_acknowledge(%L)', current_setting('t.t')), '42501',
  'only the manager it was flagged to acknowledges it', 'access.needs_level');

-- the manager acknowledges: the flag clears, the list drops it, and the flagger is told
select test.as_person(current_setting('t.mgr')::uuid);
select api.escalate_acknowledge(current_setting('t.t')::uuid);
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(jsonb_array_length(api.escalated_tasks()), 0, 'the manager''s list drops it');
select test.as_owner();
select test.eq((select escalated from work.task where id = current_setting('t.t')::uuid), false,
  'acknowledgement clears the flag');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.mem')::uuid
                and kind = 'escalation_acknowledged' and entity_id = current_setting('t.t')::uuid), 1,
  'the person who flagged it is told');
select test.eq((select count(*)::int from core.note where entity_table = 'work.task'
                and entity_id = current_setting('t.t')::uuid and kind = 'escalation'
                and body = 'Acknowledged the need for help'), 1,
  'the acknowledgement is on its timeline');

-- acknowledging again raises
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.escalate_acknowledge(%L)', current_setting('t.t')), 'P0001',
  'a task that does not need help cannot be acknowledged', 'escalation.not_escalated');

-- re-flagging after acknowledgement is allowed
select test.as_person(current_setting('t.mem')::uuid);
select api.escalate('task', current_setting('t.t')::uuid, null, 'Made-up: still stuck');
select test.as_owner();
select test.eq((select escalated from work.task where id = current_setting('t.t')::uuid), true,
  're-flagging after acknowledgement is allowed');
