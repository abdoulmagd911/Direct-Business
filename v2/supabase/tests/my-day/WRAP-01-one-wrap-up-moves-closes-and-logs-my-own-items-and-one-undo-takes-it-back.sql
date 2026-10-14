-- WRAP-01 — Wrap up v2 (Productivity Stage 1, V128): one door, one request for tasks and notes. Tomorrow moves a task to
-- the next working day; next week moves a note to the first working day of next week; drop cancels a task (its Cancelled
-- status — nothing is deleted); done completes one; every move is logged with where it came from and went to; one Undo
-- takes the whole wrap-up back. Another person's task, one I only help on, and someone else's note are refused. Days come
-- from the database's own clock. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-wrap-up-moves-someone-elses-task.sql,
-- supabase/tests/sabotage/a-wrap-up-leaves-no-trace.sql.
select set_config('t.today', core.riyadh_today()::text, true);
select set_config('t.am', test.person('Test Wrap Member', 'member')::text, true);
select set_config('t.am2', test.person('Test Wrap Colleague', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_wrap', 'Test Wrap Desk', 'فريق الختام');
update core.person set team_id = (select id from core.team where code = 'test_wrap')
where id in (current_setting('t.am')::uuid, current_setting('t.am2')::uuid);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.t1', api.task_create(jsonb_build_object('title', 'Made-up call back', 'due_on', current_setting('t.today')))
  ->> 'id', true);
select set_config('t.t2', api.task_create(jsonb_build_object('title', 'Made-up idle idea', 'due_on', current_setting('t.today')))
  ->> 'id', true);
select set_config('t.t3', api.task_create(jsonb_build_object('title', 'Made-up quick fix', 'due_on', current_setting('t.today')))
  ->> 'id', true);
select set_config('t.n1', api.note_capture('sticky', jsonb_build_object('title', 'Made-up thought')) ->> 'id', true);
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.other', api.task_create(jsonb_build_object('title', 'Made-up colleague''s', 'due_on', current_setting('t.today')))
  ->> 'id', true);
select api.task_helpers_set(current_setting('t.other')::uuid, array[current_setting('t.am')::uuid]);
select set_config('t.n2', api.note_capture('sticky', jsonb_build_object('title', 'Made-up colleague note')) ->> 'id', true);

-- only my own items
select test.as_person(current_setting('t.am')::uuid);
select test.raises($$select api.wrap_up(jsonb_build_array(jsonb_build_object('kind', 'task', 'id', current_setting('t.other'),
  'choice', 'tomorrow')))$$, '42501', 'a task I only help on is not mine to wrap up', 'wrap_up.not_yours');
select test.raises($$select api.wrap_up(jsonb_build_array(jsonb_build_object('kind', 'note', 'id', current_setting('t.n2'),
  'choice', 'done')))$$, 'P0002', 'nor a colleague''s private note', 'common.not_found');

select set_config('t.w', api.wrap_up(jsonb_build_array(
  jsonb_build_object('kind', 'task', 'id', current_setting('t.t1'), 'choice', 'tomorrow'),
  jsonb_build_object('kind', 'task', 'id', current_setting('t.t2'), 'choice', 'drop'),
  jsonb_build_object('kind', 'task', 'id', current_setting('t.t3'), 'choice', 'done'),
  jsonb_build_object('kind', 'note', 'id', current_setting('t.n1'), 'choice', 'next_week')))::text, true);

select test.as_owner();
select test.eq((select due_on from work.task where id = current_setting('t.t1')::uuid),
  core.next_working_day(current_setting('t.today')::date), 'tomorrow is the next working day');
select test.eq((select carried_to from my.note where id = current_setting('t.n1')::uuid),
  my.next_week_day(current_setting('t.today')::date), 'next week is the first working day of next week');
select test.eq((select s.key from work.task t join work.task_status s on s.id = t.status_id where t.id = current_setting('t.t2')::uuid),
  'cancelled', 'drop cancels the task');
select test.eq((select count(*)::int from work.task where id = current_setting('t.t2')::uuid and deleted_at is null), 1,
  'and deletes nothing');
select test.eq((select s.key from work.task t join work.task_status s on s.id = t.status_id where t.id = current_setting('t.t3')::uuid),
  'done', 'done completes it');
select test.eq((select jsonb_object_agg(entity_id::text, jsonb_build_object('choice', choice, 'from', carried_from, 'to', carried_to))
                from my.carry where person_id = current_setting('t.am')::uuid),
  jsonb_build_object(
    current_setting('t.t1'), jsonb_build_object('choice', 'tomorrow', 'from', current_setting('t.today'),
                                                'to', core.next_working_day(current_setting('t.today')::date)),
    current_setting('t.t2'), jsonb_build_object('choice', 'drop', 'from', current_setting('t.today'), 'to', null),
    current_setting('t.t3'), jsonb_build_object('choice', 'done', 'from', current_setting('t.today'), 'to', null),
    current_setting('t.n1'), jsonb_build_object('choice', 'next_week', 'from', current_setting('t.today'),
                                                'to', my.next_week_day(current_setting('t.today')::date))),
  'every move is logged with where it came from and went to');
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (select id from my.carry where person_id = current_setting('t.am')::uuid)
                   or (c.action = 'update'
                       and c.row_id in (current_setting('t.t1')::uuid, current_setting('t.t2')::uuid,
                                        current_setting('t.t3')::uuid, current_setting('t.n1')::uuid))), 1,
  'the moves and their log are all one request');

-- one Undo takes it all back
select test.as_person(current_setting('t.am')::uuid);
select api.undo((current_setting('t.w')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select due_on::text || ':' || (closed_at is null) from work.task where id = current_setting('t.t1')::uuid),
  current_setting('t.today') || ':true', 'Undo puts the task back on today');
select test.eq((select count(*)::int from work.task where id in (current_setting('t.t2')::uuid, current_setting('t.t3')::uuid)
                and closed_at is null), 2, 'reopens the dropped and the done');
select test.eq((select carried_to from my.note where id = current_setting('t.n1')::uuid), null, 'brings the note back');
select test.eq((select count(*)::int from my.carry where person_id = current_setting('t.am')::uuid and deleted_at is null), 0,
  'and removes the log of the moves');

-- the days, for fixed weekdays
select test.eq(my.next_week_day(date '2026-10-13'), date '2026-10-18', 'a Tuesday: next week starts on the Sunday');
select test.eq(my.next_week_day(date '2026-10-15'), date '2026-10-25', 'a Thursday: Next week is the Sunday after Tomorrow');
select test.eq(my.next_week_day(date '2026-10-18'), date '2026-10-25', 'a Sunday: the Sunday after');
-- QA-566, every weekday Sun 11 – Sat 17 Oct 2026: Next week is the first working day of the week after the next working day
select test.eq(my.next_week_day(date '2026-10-11'), date '2026-10-18', 'a Sunday, 11 Oct: next week is Sunday 18');
select test.eq(my.next_week_day(date '2026-10-12'), date '2026-10-18', 'a Monday: next week is Sunday 18');
select test.eq(my.next_week_day(date '2026-10-14'), date '2026-10-18', 'a Wednesday: next week is Sunday 18');
select test.eq(my.next_week_day(date '2026-10-16'), date '2026-10-25', 'a Friday: Tomorrow is Sunday 18, next week Sunday 25');
select test.eq(my.next_week_day(date '2026-10-17'), date '2026-10-25', 'a Saturday: Tomorrow is Sunday 18, next week Sunday 25');
select test.ok(not exists (select 1 from generate_series(date '2026-10-11', date '2026-11-14', interval '1 day') g(d)
                           where my.next_week_day(g.d::date) <= core.next_working_day(g.d::date)),
  'Next week is later than Tomorrow on every day of five weeks');
