-- NOTE-08 — Finish meeting's points (V433; TECH-SPEC §3.3a; WRK-023). One request logs the meeting and turns each point
-- into an action item — on the task the author names, or on a new task made from the note — each with its owner and due
-- day, a ticked point as a done item, each showing the note it came from; one Undo takes it all back. The task door's
-- rules hold: a member without the assign capability cannot give a point to someone else, and then nothing is logged.
-- A meeting with no points makes no task. Every value is made up.
-- Sabotages: supabase/tests/sabotage/finish-meeting-forgets-the-owners.sql, finish-meeting-leaves-ticked-points-open.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.mgr')::uuid, current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Review Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);

-- a manager's meeting with three points: two owned, one ticked — a new task holds them
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.m', api.note_capture('meeting', jsonb_build_object('title', 'Made-up review with the client',
  'meeting_partner_id', current_setting('t.p'), 'meeting_on', core.riyadh_today(),
  'items', jsonb_build_array(
    jsonb_build_object('text', 'Made-up: send the rates', 'owner_id', current_setting('t.am2'),
                       'due_on', core.riyadh_today() + 3),
    jsonb_build_object('text', 'Made-up: book the hall', 'owner_id', current_setting('t.mgr')),
    jsonb_build_object('text', 'Made-up: agree the date', 'done', true)))) ->> 'id', true);
select set_config('t.f', api.note_finish_meeting(current_setting('t.m')::uuid)::text, true);
select set_config('t.t', current_setting('t.f')::jsonb ->> 'task_id', true);
select test.eq((current_setting('t.f')::jsonb ->> 'task_made')::boolean, true, 'a new task holds the points');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'title', 'Made-up review with the client', 'titled by the note');
select test.eq((select jsonb_agg(x ->> 'text' order by o) from jsonb_array_elements(api.task(current_setting('t.t')::uuid)
                  -> 'action_items') with ordinality e(x, o)),
  jsonb_build_array('Made-up: send the rates', 'Made-up: book the hall', 'Made-up: agree the date'),
  'each point an action item, in order');
select test.ok(api.task(current_setting('t.t')::uuid) ->> 'owner_id' <> current_setting('t.am2'),
  'the task''s owner is someone else');
select test.eq(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 0 ->> 'owner_id', current_setting('t.am2'),
  'with its owner');
select test.eq((api.task(current_setting('t.t')::uuid) -> 'action_items' -> 0 ->> 'due_on')::date, core.riyadh_today() + 3,
  'and its due day');
select test.eq(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 1 ->> 'owner_id', current_setting('t.mgr'),
  'each point its own owner');
select test.eq(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 2 ->> 'owner_id',
  api.task(current_setting('t.t')::uuid) ->> 'owner_id', 'a point with no owner is the task owner''s');
select test.ok(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 2 ->> 'done_on' is not null,
  'a ticked point is a done item');
select test.ok(api.task(current_setting('t.t')::uuid) -> 'action_items' -> 0 ->> 'done_on' is null, 'the others open');
select test.eq(api.from_note('action_item', (current_setting('t.f')::jsonb -> 'action_item_ids' ->> 1)::uuid) ->> 'id',
  current_setting('t.m'), 'an item shows the note it came from');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.m')::uuid) -> 'links'), 5,
  'the note shows the meeting, the task and the three items');
select test.as_owner();
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (select entity_id from my.note_link where note_id = current_setting('t.m')::uuid)),
  1, 'all in one request');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.f')::jsonb ->> 'request_id'), 'one Undo');
select test.raises(format('select api.task(%L)', current_setting('t.t')), 'P0002', 'takes the task back',
  'common.not_found');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.m')::uuid) -> 'links'), 0, 'with every link');
select test.eq(api.my_note(current_setting('t.m')::uuid) ->> 'finished_at', null, 'and the finish');

-- a member gives no point to someone else: refused, and nothing is logged
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.m2', api.note_capture('meeting', jsonb_build_object('title', 'Made-up catch-up',
  'meeting_partner_id', current_setting('t.p'), 'meeting_on', core.riyadh_today(),
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up: call back', 'owner_id', current_setting('t.am2')))))
  ->> 'id', true);
select test.raises(format('select api.note_finish_meeting(%L)', current_setting('t.m2')), '42501',
  'a member does not give a point to someone else', 'access.needs_capability');
select test.eq(api.my_note(current_setting('t.m2')::uuid) ->> 'finished_at', null, 'the meeting stays open');
select test.as_owner();
select test.eq((select count(*)::int from core.note where entity_id = current_setting('t.p')::uuid and kind = 'activity'
                and deleted_at is null), 0, 'and nothing is logged');

-- on a task the author names: no new task
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.own', api.task_create(jsonb_build_object('title', 'Made-up account plan',
  'partner_id', current_setting('t.p'))) ->> 'id', true);
select set_config('t.m3', api.note_capture('meeting', jsonb_build_object('title', 'Made-up planning',
  'meeting_partner_id', current_setting('t.p'), 'meeting_on', core.riyadh_today(),
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up: draft the plan')))) ->> 'id', true);
select set_config('t.f3', api.note_finish_meeting(current_setting('t.m3')::uuid,
  jsonb_build_object('task_id', current_setting('t.own')))::text, true);
select test.eq((current_setting('t.f3')::jsonb ->> 'task_made')::boolean, false, 'no new task');
select test.eq(api.task(current_setting('t.own')::uuid) -> 'action_items' -> 0 ->> 'text', 'Made-up: draft the plan',
  'the point lands on the named task');

-- no points, no task
select set_config('t.m4', api.note_capture('meeting', jsonb_build_object('title', 'Made-up coffee',
  'meeting_partner_id', current_setting('t.p'), 'meeting_on', core.riyadh_today())) ->> 'id', true);
select set_config('t.f4', api.note_finish_meeting(current_setting('t.m4')::uuid)::text, true);
select test.eq(current_setting('t.f4')::jsonb ->> 'task_id', null, 'a meeting with no points makes no task');
