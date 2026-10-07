-- TSK-05 — the flags and the order (§3.7; V400, OLD-WRK-040/041/043). Overdue: due before Riyadh today and not Done or
-- Cancelled. Stale: in progress — Blocked too — with nothing for `work.no_update_days`, judged on the day each entry
-- happened (a test clock moves the days). An Executive directive sorts first. Every value is made up.
-- Sabotages: supabase/tests/sabotage/stale-judged-on-the-logged-day.sql, the-directive-sorts-anywhere.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.own', test.person('Test Owner', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk') where id = current_setting('t.own')::uuid;
select set_config('v2.test_now', '2026-10-05 09:00:00+03', true);

select test.as_person(current_setting('t.own')::uuid);
select set_config('t.late', api.task_create(jsonb_build_object('title', 'Made-up overdue', 'due_on', '2026-10-04'))
  ->> 'id', true);
select set_config('t.fine', api.task_create(jsonb_build_object('title', 'Made-up due today', 'due_on', '2026-10-05'))
  ->> 'id', true);
select set_config('t.boss', api.task_create(jsonb_build_object('title', 'Made-up directive', 'due_on', '2026-12-31',
  'priority', 'executive_directive')) ->> 'id', true);
select test.eq((api.task(current_setting('t.late')::uuid) ->> 'overdue')::boolean, true, 'due yesterday: overdue');
select test.eq((api.task(current_setting('t.fine')::uuid) ->> 'overdue')::boolean, false, 'due today: not yet');
select test.eq(api.tasks() -> 'rows' -> 0 ->> 'id', current_setting('t.boss'), 'the Executive directive sorts first');
select test.eq(api.tasks('{"overdue": true}'::jsonb) -> 'rows' -> 0 ->> 'id', current_setting('t.late'),
  'and the overdue filter finds the late one');

-- stale: in progress with nothing for seven days, judged on happened_on
select api.task_status_set(current_setting('t.fine')::uuid, 'in_progress', '2026-10-05');
select set_config('v2.test_now', '2026-10-12 09:00:00+03', true);
select test.eq((api.task(current_setting('t.fine')::uuid) ->> 'stale')::boolean, false, 'seven days on: not yet stale');
select set_config('v2.test_now', '2026-10-13 09:00:00+03', true);
select test.eq((api.task(current_setting('t.fine')::uuid) ->> 'stale')::boolean, true, 'eight days on: stale');
select api.task_status_set(current_setting('t.fine')::uuid, 'in_progress', null, 'Made-up: waiting on the client');
select test.eq((api.task(current_setting('t.fine')::uuid) ->> 'stale')::boolean, false, 'a change today freshens it');
select set_config('v2.test_now', '2026-10-22 09:00:00+03', true);
select test.eq((api.task(current_setting('t.fine')::uuid) ->> 'stale')::boolean, true, 'Blocked is not spared stale');
select core.note_add('task', current_setting('t.fine')::uuid, 'update', 'Made-up: an update about last month', '2026-09-20');
select test.eq((api.task(current_setting('t.fine')::uuid) ->> 'stale')::boolean, true,
  'an update logged today about an old day does not freshen it');
select core.note_add('task', current_setting('t.fine')::uuid, 'update', 'Made-up: today''s update');
select test.eq((api.task(current_setting('t.fine')::uuid) ->> 'stale')::boolean, false, 'today''s update does');
select test.eq((api.tasks('{"meanings": ["done", "cancelled"]}'::jsonb) ->> 'total')::int, 0, 'nothing is closed yet');
