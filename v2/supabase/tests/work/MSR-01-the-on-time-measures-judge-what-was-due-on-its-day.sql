-- MSR-01 — the on-time measures (TECH-SPEC §3.8; V42, V400, M60): work.tasks_on_time, work.action_items_on_time and
-- work.meeting_notes_on_time. A task or an action item counts in the period of its due day once that day is over: on
-- time when done on or before it; a cancelled task, or one not yet due, is not judged. A meeting note is on time when
-- written within work.meeting_note_on_time_days of the meeting. Nothing due → "not measured", never 0. After go-live, an
-- entry logged late is never on time. Scopes: person, team, partner. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-late-task-counts-as-on-time.sql, a-cancelled-task-is-judged.sql,
-- nothing-due-measures-zero.sql, a-task-not-yet-due-is-judged.sql, a-late-follow-up-counts-as-on-time.sql,
-- a-meeting-note-is-on-time-whenever-written.sql, a-task-logged-late-counts-as-on-time.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.team', (select id from core.team where code = 'test_desk')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
update core.person set team_id = current_setting('t.team')::uuid
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);
select set_config('t.d0', core.riyadh_today()::text, true);

-- am1: T1 done a day early, T2 two days late, T3 still open, T4 cancelled, T5 not due yet; am2: T6 done on its day
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.T1', api.task_create(jsonb_build_object('title', 'Made-up T1', 'happened_on',
  current_setting('t.d0')::date - 40, 'due_on', current_setting('t.d0')::date - 30)) ->> 'id', true);
select set_config('t.T2', api.task_create(jsonb_build_object('title', 'Made-up T2', 'happened_on',
  current_setting('t.d0')::date - 40, 'due_on', current_setting('t.d0')::date - 30)) ->> 'id', true);
select set_config('t.T3', api.task_create(jsonb_build_object('title', 'Made-up T3', 'happened_on',
  current_setting('t.d0')::date - 40, 'due_on', current_setting('t.d0')::date - 29)) ->> 'id', true);
select set_config('t.T4', api.task_create(jsonb_build_object('title', 'Made-up T4', 'happened_on',
  current_setting('t.d0')::date - 40, 'due_on', current_setting('t.d0')::date - 30)) ->> 'id', true);
select set_config('t.T5', api.task_create(jsonb_build_object('title', 'Made-up T5', 'happened_on',
  current_setting('t.d0')::date - 2, 'due_on', current_setting('t.d0')::date + 5)) ->> 'id', true);
select api.task_status_set(current_setting('t.T1')::uuid, 'done', current_setting('t.d0')::date - 31);
select api.task_status_set(current_setting('t.T2')::uuid, 'done', current_setting('t.d0')::date - 28);
select api.task_status_set(current_setting('t.T4')::uuid, 'cancelled', current_setting('t.d0')::date - 35);
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.T6', api.task_create(jsonb_build_object('title', 'Made-up T6', 'happened_on',
  current_setting('t.d0')::date - 40, 'due_on', current_setting('t.d0')::date - 30)) ->> 'id', true);
select api.task_status_set(current_setting('t.T6')::uuid, 'done', current_setting('t.d0')::date - 30);

-- T3's follow-ups: A1 ticked a day early, A2 a day late, A3 (am2's) open, A4 not due yet
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.A1', api.action_item_add(current_setting('t.T3')::uuid, jsonb_build_object('text', 'Made-up A1',
  'owner_id', current_setting('t.am1'), 'due_on', current_setting('t.d0')::date - 30,
  'happened_on', current_setting('t.d0')::date - 40)) ->> 'id', true);
select set_config('t.A2', api.action_item_add(current_setting('t.T3')::uuid, jsonb_build_object('text', 'Made-up A2',
  'owner_id', current_setting('t.am1'), 'due_on', current_setting('t.d0')::date - 30,
  'happened_on', current_setting('t.d0')::date - 40)) ->> 'id', true);
select api.action_item_add(current_setting('t.T3')::uuid, jsonb_build_object('text', 'Made-up A3',
  'owner_id', current_setting('t.am2'), 'due_on', current_setting('t.d0')::date - 30,
  'happened_on', current_setting('t.d0')::date - 40));
select api.action_item_add(current_setting('t.T3')::uuid, jsonb_build_object('text', 'Made-up A4',
  'owner_id', current_setting('t.am1'), 'due_on', current_setting('t.d0')::date + 3,
  'happened_on', current_setting('t.d0')::date - 40));
select test.as_person(current_setting('t.am1')::uuid);
select api.action_item_done(current_setting('t.A1')::uuid, true, current_setting('t.d0')::date - 31);
select api.action_item_done(current_setting('t.A2')::uuid, true, current_setting('t.d0')::date - 29);

-- meetings: M1 written the same day, M2 three days after, M3 a meeting logged on an organisation the next day; a call
-- is not a meeting
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Meetings Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select api.task_add_meeting(current_setting('t.T5')::uuid, current_setting('t.d0')::date, 'Made-up meeting M1');
select api.task_add_meeting(current_setting('t.T3')::uuid, current_setting('t.d0')::date - 3, 'Made-up meeting M2');
select api.activity_log(current_setting('t.p')::uuid, 'meeting', 'meeting_held', current_setting('t.d0')::date - 1);
select api.activity_log(current_setting('t.p')::uuid, 'call', 'no_answer', current_setting('t.d0')::date - 1);
select test.as_owner();

-- tasks on time
select test.eq(measure.work_tasks_on_time(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.d0')::date - 35, current_setting('t.d0')::date - 25)::text, '(0.3333,t,3)',
  'am1: one of three on time — the late one and the open one are not, the cancelled one is not judged');
select test.eq((select array_agg(i.entity_id order by i.entity_id) from measure.work_tasks_on_time_items(null, 'person',
                  current_setting('t.am1')::uuid, current_setting('t.d0')::date - 35, current_setting('t.d0')::date - 25) i
                where i.counted), array[current_setting('t.T1')::uuid], 'the drill-down names the one on time');
select test.eq(measure.work_tasks_on_time(null, 'team', current_setting('t.team')::uuid,
  current_setting('t.d0')::date - 35, current_setting('t.d0')::date - 25)::text, '(0.5000,t,4)',
  'the team: am2''s task done on its day too, two of four');
select test.eq(measure.work_tasks_on_time(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.d0')::date - 29, current_setting('t.d0')::date - 25)::text, '(0.0000,t,1)',
  'a task counts in the period of its due day');
select test.eq(measure.work_tasks_on_time(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.d0')::date - 100, current_setting('t.d0')::date - 90)::text, '(,f,0)',
  'nothing due: not measured, never 0');
select test.eq(measure.work_tasks_on_time(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.d0')::date, current_setting('t.d0')::date + 10)::text, '(,f,0)',
  'a task not yet due is not judged: not measured');

-- action items on time
select test.eq(measure.work_action_items_on_time(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.d0')::date - 35, current_setting('t.d0')::date - 25)::text, '(0.5000,t,2)',
  'am1''s follow-ups: the one ticked early is on time, the one ticked late is not');
select test.eq(measure.work_action_items_on_time(null, 'team', current_setting('t.team')::uuid,
  current_setting('t.d0')::date - 35, current_setting('t.d0')::date + 10)::text, '(0.3333,t,3)',
  'the team: am2''s open one counts against it; one not yet due is not judged');

-- meeting notes on time
select test.eq(measure.work_meeting_notes_on_time(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.d0')::date - 10, current_setting('t.d0')::date)::text, '(0.6667,t,3)',
  'meeting notes: written the same day or the next are on time, three days after is not; a call is not a meeting');
select test.eq(measure.work_meeting_notes_on_time(null, 'partner', current_setting('t.p')::uuid,
  current_setting('t.d0')::date - 10, current_setting('t.d0')::date)::text, '(1.0000,t,1)',
  'the organisation''s: its meeting');
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('work.meeting_note_on_time_days', null, '3', null, 'Made-up: three days to write it up');
select test.as_owner();
select test.eq(measure.work_meeting_notes_on_time(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.d0')::date - 10, current_setting('t.d0')::date)::text, '(1.0000,t,3)',
  'with three days allowed, all three are on time');

-- after go-live, an entry logged late is never on time
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('app.go_live_on', null, to_jsonb((current_setting('t.d0')::date - 60)::text), null,
  'Made-up: live two months ago');
select test.as_owner();
select test.eq(measure.work_tasks_on_time(null, 'team', current_setting('t.team')::uuid,
  current_setting('t.d0')::date - 35, current_setting('t.d0')::date - 25)::text, '(0.0000,t,4)',
  'done "on time" but logged a month later: not on time');
select test.raises(format('select measure.work_tasks_on_time(null, %L, %L, %L, %L)', 'zone', current_setting('t.team'),
  current_setting('t.d0')::date - 35, current_setting('t.d0')::date - 25), 'P0001', 'an unknown scope is refused',
  'measure.unknown_scope');
