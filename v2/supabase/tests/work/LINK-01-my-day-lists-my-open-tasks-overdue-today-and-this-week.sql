-- LINK-01 — My day lists my open tasks (D3; Productivity Stage 1). By Riyadh day: one overdue, one due today, one due
-- within the next 7 days — each in its group (overdue, today, next) — and apart the one I help on; a task due in 8 days,
-- a done task and a colleague's task are not listed; each row carries its client and how often it was carried over; the
-- team tab carries none. Days come from the database's own clock (QA-554). Every value is made up.
-- Sabotage: supabase/tests/sabotage/my-day-lists-no-tasks.sql.
select set_config('t.today', core.riyadh_today()::text, true);
select set_config('t.am', test.person('Test Day Member', 'member')::text, true);
select set_config('t.am2', test.person('Test Day Colleague', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_day', 'Test Day Desk', 'فريق اليوم');
update core.person set team_id = (select id from core.team where code = 'test_day')
where id in (current_setting('t.am')::uuid, current_setting('t.am2')::uuid);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Day Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select api.task_create(jsonb_build_object('title', 'Made-up overdue', 'due_on', (current_setting('t.today')::date - 3)::text));
select api.task_create(jsonb_build_object('title', 'Made-up today', 'due_on', current_setting('t.today'), 'work_type', 'client',
  'partner_id', current_setting('t.p')));
select api.task_create(jsonb_build_object('title', 'Made-up in a week', 'due_on', (current_setting('t.today')::date + 7)::text));
select api.task_create(jsonb_build_object('title', 'Made-up in eight days', 'due_on', (current_setting('t.today')::date + 8)::text));
select set_config('t.done', api.task_create(jsonb_build_object('title', 'Made-up done', 'due_on', current_setting('t.today')))
  ->> 'id', true);
select test.as_owner();
update work.task set closed_at = now() where id = current_setting('t.done')::uuid;
select test.as_person(current_setting('t.am2')::uuid);
select api.task_create(jsonb_build_object('title', 'Made-up colleague''s', 'due_on', current_setting('t.today')));
select set_config('t.help', api.task_create(jsonb_build_object('title', 'Made-up I help on',
  'due_on', (current_setting('t.today')::date + 2)::text)) ->> 'id', true);
select api.task_helpers_set(current_setting('t.help')::uuid, array[current_setting('t.am')::uuid]);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.day', api.my_day('me')::text, true);
select test.eq((select jsonb_object_agg(x ->> 'title', x ->> 'group') from jsonb_array_elements(current_setting('t.day')::jsonb -> 'tasks') x),
  '{"Made-up overdue": "overdue", "Made-up today": "today", "Made-up in a week": "next", "Made-up I help on": "helping"}'::jsonb,
  'my open tasks by group — overdue, today, next 7 days — and apart the one I help on; 8 days out, done and a colleague''s are not listed');
select test.eq((select x ->> 'client' from jsonb_array_elements(current_setting('t.day')::jsonb -> 'tasks') x
                where x ->> 'title' = 'Made-up today'), 'Made Up Day Co', 'a row carries its client');
select test.eq((select (x ->> 'carried_over')::int from jsonb_array_elements(current_setting('t.day')::jsonb -> 'tasks') x
                where x ->> 'title' = 'Made-up today'), 0, 'and how often it was carried over');
select test.eq(api.my_day('team') -> 'tasks', '[]'::jsonb, 'the team tab carries no tasks');
