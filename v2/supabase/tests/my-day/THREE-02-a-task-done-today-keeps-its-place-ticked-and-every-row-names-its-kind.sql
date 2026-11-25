-- THREE-02 — Landing 53 (My day per the boards). Today's three reads as a day's list being worked down: a task I
-- finish today keeps the very place it had, with `done` true, and the other rows do not move ("7 of 9 done today");
-- the totals still count open tasks only (plus the done ones shown), so "N more in Tasks" stays true. The next day
-- the done task is gone and the group fills from the open tasks again. A task cancelled today leaves at once.
-- And every task row names its kind — the task's own type from the Settings list — in Today's three and in the
-- Today list: `type` (the key) and its name in both languages; null for a task with no type.
-- The clock is fixed; every value is made up.
-- Sabotages: supabase/tests/sabotage/a-done-task-leaves-the-three.sql, a-task-row-names-no-kind.sql.
select set_config('v2.test_now', '2026-11-18 10:00:00+03', true);
select set_config('t.a', test.person('Test Done Owner', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_done', 'Test Done Desk', 'فريق الاختبار');
update core.person set team_id = (select id from core.team where code = 'test_done') where id = current_setting('t.a')::uuid;

create function pg_temp.task(p_title text, p_due date, p_star boolean default false, p_type text default null) returns uuid
language plpgsql as $$
declare
  v_id uuid;
  me uuid := current_setting('t.a')::uuid;
begin
  perform test.as_person(me);
  v_id := (api.task_create(jsonb_build_object('title', p_title, 'owner_id', me, 'work_type', 'internal')
             || case when p_due is null then '{}'::jsonb else jsonb_build_object('due_on', p_due) end) ->> 'id')::uuid;
  perform test.act(me);
  update work.task set starred = p_star, type_id = (select id from work.task_type where key = p_type) where id = v_id;
  perform test.done();
  return v_id;
end $$;
grant execute on function pg_temp.task(text, date, boolean, text) to public;
create function pg_temp.titles(p jsonb, p_group text) returns text language sql as
$$ select coalesce(string_agg((x ->> 'title') || case when (x ->> 'done')::boolean then ' ✓' else '' end, ' | ' order by o), '')
   from jsonb_array_elements(p -> p_group) with ordinality t(x, o) $$;
grant execute on function pg_temp.titles(jsonb, text) to public;

select set_config('t.s1', pg_temp.task('Made-up star one', '2026-11-18', true, 'request')::text, true);
select pg_temp.task('Made-up star two', '2026-11-25', true);
select pg_temp.task('Made-up star three', null, true);
select set_config('t.q1', pg_temp.task('Made-up short one', '2026-11-18', false, 'follow_up')::text, true);
select set_config('t.q2', pg_temp.task('Made-up short two', '2026-11-19')::text, true);
select pg_temp.task('Made-up short three', '2026-11-20');
select pg_temp.task('Made-up rest one', '2026-11-30', false, 'meeting');
select pg_temp.task('Made-up rest two', null);
select pg_temp.task('Made-up rest three', null);
select set_config('t.r4', pg_temp.task('Made-up rest four', null)::text, true);

select test.as_person(current_setting('t.a')::uuid);
select set_config('t.before', (api.my_day('me') -> 'three')::text, true);
select test.eq(pg_temp.titles(current_setting('t.before')::jsonb, 'important'),
  'Made-up star one | Made-up star two | Made-up star three', 'before: Important, nothing ticked');
select test.eq(pg_temp.titles(current_setting('t.before')::jsonb, 'short'),
  'Made-up short one | Made-up short two | Made-up short three', 'before: Short, nothing ticked');
select test.eq(current_setting('t.before')::jsonb -> 'totals', '{"important": 3, "short": 3, "maintenance": 4}'::jsonb,
  'before: ten open tasks, one not shown');

-- every row names its kind, in both languages; a task with no type names none
select test.eq(current_setting('t.before')::jsonb #> '{important,0}' -> 'type', '"request"'::jsonb, 'a row carries its type key');
select test.eq(current_setting('t.before')::jsonb #>> '{important,0,type_en}',
  'Request', 'and the type''s English name');
select test.eq(current_setting('t.before')::jsonb #>> '{important,0,type_ar}',
  'طلب', 'and its Arabic name');
select test.eq(jsonb_typeof(current_setting('t.before')::jsonb #> '{important,1,type}'), 'null', 'a task with no type names none');
select test.eq((select x ->> 'type' from jsonb_array_elements(api.my_day('me') -> 'tasks') x where x ->> 'title' = 'Made-up short one'),
  'follow_up', 'the Today list''s rows name their kind too');
select test.eq((select x ->> 'type_en' from jsonb_array_elements(api.my_day('me') -> 'tasks') x where x ->> 'title' = 'Made-up short one'),
  'Follow-up', 'with its name');

-- two finished today: each keeps its place, ticked; nobody moves up; the fourth rest task is still "1 more"
select api.task_status_set(current_setting('t.s1')::uuid, 'done');
select api.task_status_set(current_setting('t.q2')::uuid, 'done');
select set_config('t.after', (api.my_day('me') -> 'three')::text, true);
select test.eq(pg_temp.titles(current_setting('t.after')::jsonb, 'important'),
  'Made-up star one ✓ | Made-up star two | Made-up star three', 'a task done today keeps its place in Important, ticked');
select test.eq(pg_temp.titles(current_setting('t.after')::jsonb, 'short'),
  'Made-up short one | Made-up short two ✓ | Made-up short three', 'and in Short — the rows around it do not move');
select test.eq(pg_temp.titles(current_setting('t.after')::jsonb, 'maintenance'),
  'Made-up rest one | Made-up rest two | Made-up rest three', 'Maintenance is as it was');
select test.eq(current_setting('t.after')::jsonb -> 'totals', '{"important": 3, "short": 3, "maintenance": 4}'::jsonb,
  'the totals count the open tasks and the done ones shown');
select test.ok((api.my_day('me') -> 'tasks')::text not like '%Made-up star one%', 'a done task is not in the Today list below');
select test.eq((api.my_day('me') -> 'three')::text, current_setting('t.after'), 'asked again, the answer is the same');

-- a done task that was NOT shown is counted nowhere
select api.task_status_set(current_setting('t.r4')::uuid, 'done');
select test.eq((api.my_day('me') -> 'three') -> 'totals', '{"important": 3, "short": 3, "maintenance": 3}'::jsonb,
  'a task done today that was not shown is not counted: "more in Tasks" counts open tasks only');

-- cancelled today: it leaves at once and the group fills from what is open
select api.task_status_set(current_setting('t.q1')::uuid, 'cancelled', null, 'made up: not needed');
select test.ok((api.my_day('me') -> 'three')::text not like '%Made-up short one%', 'a task cancelled today leaves the three');

-- the next day: yesterday's done tasks are gone, the groups hold open tasks only
select set_config('v2.test_now', '2026-11-19 09:00:00+03', true);
select test.as_person(current_setting('t.a')::uuid);
select test.ok((api.my_day('me') -> 'three')::text not like '%Made-up star one%'
               and (api.my_day('me') -> 'three')::text not like '%Made-up short two%', 'the next day a done task is gone');
select test.ok((api.my_day('me') -> 'three')::text not like '%"done": true%', 'and nothing is ticked');
