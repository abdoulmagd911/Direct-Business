-- LINK-01 — My day lists my open tasks (sweep 12 Oct, D3; P5-7 data). By Riyadh day: one overdue, one due today, one
-- later this week (to Saturday) — each in its group; a task due next week, a done task, a colleague's task and a
-- backfilled past task are not listed; the team and workspace tabs carry none. Every value is made up.
-- Sabotage: supabase/tests/sabotage/my-day-lists-no-tasks.sql.
select set_config('v2.test_now', '2026-10-12 09:00:00+03', true);   -- a Monday; the week ends Saturday 17 Oct
select set_config('t.am', test.person('Test Day Member', 'member')::text, true);
select set_config('t.am2', test.person('Test Day Colleague', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_day', 'Test Day Desk', 'فريق اليوم');
update core.person set team_id = (select id from core.team where code = 'test_day')
where id in (current_setting('t.am')::uuid, current_setting('t.am2')::uuid);

select test.as_person(current_setting('t.am')::uuid);
select api.task_create(jsonb_build_object('title', 'Made-up overdue', 'due_on', '2026-10-09'));
select api.task_create(jsonb_build_object('title', 'Made-up today', 'due_on', '2026-10-12'));
select api.task_create(jsonb_build_object('title', 'Made-up Thursday', 'due_on', '2026-10-15'));
select api.task_create(jsonb_build_object('title', 'Made-up next week', 'due_on', '2026-10-19'));
select set_config('t.done', api.task_create(jsonb_build_object('title', 'Made-up done', 'due_on', '2026-10-12')) ->> 'id', true);
select test.as_owner();
update work.task set closed_at = now() where id = current_setting('t.done')::uuid;
select test.as_person(current_setting('t.am2')::uuid);
select api.task_create(jsonb_build_object('title', 'Made-up colleague''s', 'due_on', '2026-10-12'));
select set_config('t.help', api.task_create(jsonb_build_object('title', 'Made-up I help on', 'due_on', '2026-10-14')) ->> 'id', true);
select api.task_helpers_set(current_setting('t.help')::uuid, array[current_setting('t.am')::uuid]);

select test.as_person(current_setting('t.am')::uuid);
select test.eq((select jsonb_object_agg(x ->> 'title', x ->> 'group') from jsonb_array_elements(api.my_day('me') -> 'tasks') x),
  '{"Made-up overdue": "overdue", "Made-up today": "today", "Made-up Thursday": "this_week",
    "Made-up I help on": "helping"}'::jsonb,
  'my open tasks to Saturday, each in its group, and apart the one I help on; next week, done and a colleague''s are not listed');
select test.eq(api.my_day('team') -> 'tasks', '[]'::jsonb, 'the team tab carries no tasks');
