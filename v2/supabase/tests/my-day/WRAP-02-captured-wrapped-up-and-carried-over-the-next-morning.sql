-- WRAP-02 — the chain (Productivity Stage 1): a member captures a note and has a task due today, wraps up both to
-- tomorrow, and the next working morning My day shows them carried over — each with the day it came from and how often
-- it was carried — and the task in today's group. Days come from the database's own clock. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-next-morning-forgets-what-was-carried.sql.
select set_config('t.today', core.riyadh_today()::text, true);
select set_config('t.next', core.next_working_day(core.riyadh_today())::text, true);
select set_config('t.am', test.person('Test Chain Member', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_chain', 'Test Chain Desk', 'فريق السلسلة');
update core.person set team_id = (select id from core.team where code = 'test_chain') where id = current_setting('t.am')::uuid;

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up loose end')) ->> 'id', true);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up follow-up', 'due_on', current_setting('t.today')))
  ->> 'id', true);
select api.wrap_up(jsonb_build_array(
  jsonb_build_object('kind', 'note', 'id', current_setting('t.n'), 'choice', 'tomorrow'),
  jsonb_build_object('kind', 'task', 'id', current_setting('t.t'), 'choice', 'tomorrow')));

-- the next working morning
select set_config('v2.test_now', (current_setting('t.next')::date + time '08:00')::text || '+03', true);
select set_config('t.day', api.my_day('me')::text, true);
select test.eq((select jsonb_agg(jsonb_build_object('kind', x ->> 'kind', 'from', x ->> 'from', 'times', (x ->> 'times')::int)
                                 order by x ->> 'kind')
                from jsonb_array_elements(current_setting('t.day')::jsonb -> 'carried_over') x),
  jsonb_build_array(jsonb_build_object('kind', 'note', 'from', current_setting('t.today'), 'times', 1),
                    jsonb_build_object('kind', 'task', 'from', current_setting('t.today'), 'times', 1)),
  'the next morning shows both carried over, from the day before');
select test.eq((select x ->> 'group' from jsonb_array_elements(current_setting('t.day')::jsonb -> 'tasks') x
                where x ->> 'id' = current_setting('t.t')), 'today', 'the task stands in today''s group');
select test.eq((select (x ->> 'carried_over')::int from jsonb_array_elements(current_setting('t.day')::jsonb -> 'tasks') x
                where x ->> 'id' = current_setting('t.t')), 1, 'carried over once');
select test.ok(exists (select 1 from jsonb_array_elements(current_setting('t.day')::jsonb -> 'notes') x
                       where x ->> 'id' = current_setting('t.n')), 'and the note is on the day');
