-- THREE-01 — Today's three (Landing 34b), as My day's read answers it under `three`: picked from ALL my own open
-- tasks — Important = starred; Short = not starred and due today or within the next two days; Maintenance = the rest
-- (overdue, later, or with no due day). At most three each, in one fixed order (due day, no due day last, then
-- number), with the totals. A task I only help on, another person's task, a done, a cancelled or a removed task is
-- never there — and a task whose status says cancelled is not current even when its closed stamp is empty. Asked twice,
-- the answer is the same. The clock is fixed; every value is made up.
-- Sabotages: supabase/tests/sabotage/an-overdue-task-is-short.sql, an-undated-task-is-in-no-group.sql,
-- a-cancelled-task-is-current.sql, a-helped-task-is-in-my-three.sql, todays-three-holds-four.sql.
select set_config('v2.test_now', '2026-11-18 10:00:00+03', true);
select set_config('t.a', test.person('Test Three Owner', 'member')::text, true);
select set_config('t.b', test.person('Test Three Other', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_three', 'Test Three Desk', 'فريق الاختبار');
update core.person set team_id = (select id from core.team where code = 'test_three')
where id in (current_setting('t.a')::uuid, current_setting('t.b')::uuid);

create function pg_temp.task(p_owner uuid, p_title text, p_due date, p_star boolean default false) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  perform test.as_person(p_owner);
  v_id := (api.task_create(jsonb_build_object('title', p_title, 'owner_id', p_owner, 'work_type', 'internal')
             || case when p_due is null then '{}'::jsonb else jsonb_build_object('due_on', p_due) end) ->> 'id')::uuid;
  if p_due is not null and p_due < '2026-11-18'::date then
    -- an overdue day cannot be typed at creation: set as the test's owner
    perform test.act(p_owner);
    update work.task set due_on = p_due where id = v_id;
    perform test.done();
  end if;
  if p_star then
    perform test.act(p_owner);
    update work.task set starred = true where id = v_id;
    perform test.done();
  end if;
  return v_id;
end $$;
grant execute on function pg_temp.task(uuid, text, date, boolean) to public;
create function pg_temp.titles(p jsonb, p_group text) returns text language sql as
$$ select coalesce(string_agg(x ->> 'title', ' | ' order by o), '') from jsonb_array_elements(p -> p_group) with ordinality t(x, o) $$;
grant execute on function pg_temp.titles(jsonb, text) to public;

-- nothing yet: three empty groups, never a missing key
select test.as_person(current_setting('t.a')::uuid);
select test.eq(api.my_day('me') -> 'three',
  '{"important": [], "short": [], "maintenance": [], "totals": {"important": 0, "short": 0, "maintenance": 0}}'::jsonb,
  'with no tasks the three groups are empty');

select pg_temp.task(current_setting('t.a')::uuid, 'Made-up overdue 2025', '2025-01-13');
select pg_temp.task(current_setting('t.a')::uuid, 'Made-up overdue yesterday', '2026-11-17');
select pg_temp.task(current_setting('t.a')::uuid, 'Made-up due today', '2026-11-18');
select pg_temp.task(current_setting('t.a')::uuid, 'Made-up due in two days', '2026-11-20');
select pg_temp.task(current_setting('t.a')::uuid, 'Made-up due in three days', '2026-11-21');
select pg_temp.task(current_setting('t.a')::uuid, 'Made-up no due day one', null);
select pg_temp.task(current_setting('t.a')::uuid, 'Made-up no due day two', null);
select pg_temp.task(current_setting('t.a')::uuid, 'Made-up starred no day', null, true);
select pg_temp.task(current_setting('t.a')::uuid, 'Made-up starred overdue', '2025-07-15', true);
select set_config('t.cancel', pg_temp.task(current_setting('t.a')::uuid, 'Made-up cancelled', '2026-11-18')::text, true);
select set_config('t.done', pg_temp.task(current_setting('t.a')::uuid, 'Made-up done', '2026-11-18')::text, true);
select set_config('t.gone', pg_temp.task(current_setting('t.a')::uuid, 'Made-up removed', '2026-11-19')::text, true);
select set_config('t.help', pg_temp.task(current_setting('t.b')::uuid, 'Made-up helped only', '2026-11-18')::text, true);
select pg_temp.task(current_setting('t.b')::uuid, 'Made-up someone else', '2026-11-18', true);

-- a helper on another person's task; a done task; a removed task; a task whose STATUS is cancelled with no closed stamp
select test.act(current_setting('t.b')::uuid);
insert into work.task_helper (task_id, person_id, created_by)
values (current_setting('t.help')::uuid, current_setting('t.a')::uuid, current_setting('t.b')::uuid);
select test.done();
select test.as_person(current_setting('t.a')::uuid);
select api.task_status_set(current_setting('t.done')::uuid, 'done');
select test.act(current_setting('t.a')::uuid);
update work.task set deleted_at = core.clock(), deleted_by = current_setting('t.a')::uuid, delete_reason = 'made-up removal'
where id = current_setting('t.gone')::uuid;
update work.task set status_id = (select id from work.task_status where key = 'cancelled'), closed_at = null,
       cancelled_reason = 'made up: cancelled with no closed stamp'
where id = current_setting('t.cancel')::uuid;
select test.done();

select test.as_person(current_setting('t.a')::uuid);
select set_config('t.three', (api.my_day('me') -> 'three')::text, true);
select test.ok(current_setting('t.three') not like '%Made-up cancelled%', 'a task whose status is cancelled is not current');
select test.ok(current_setting('t.three') not like '%Made-up done%' and current_setting('t.three') not like '%Made-up removed%',
  'a done or a removed task is not current');
select test.ok(current_setting('t.three') not like '%Made-up helped only%' and current_setting('t.three') not like '%Made-up someone else%',
  'a task I only help on, or someone else''s, is never in my three');
select test.eq(pg_temp.titles(current_setting('t.three')::jsonb, 'important'),
  'Made-up starred overdue | Made-up starred no day', 'Important is my starred tasks, the dated one first');
select test.eq(pg_temp.titles(current_setting('t.three')::jsonb, 'short'),
  'Made-up due today | Made-up due in two days', 'Short is due today or within the next two days — never an overdue task');
select test.eq(pg_temp.titles(current_setting('t.three')::jsonb, 'maintenance'),
  'Made-up overdue 2025 | Made-up overdue yesterday | Made-up due in three days',
  'Maintenance is the rest of my own open tasks, the oldest due day first, at most three');
select test.eq(current_setting('t.three')::jsonb -> 'totals', '{"important": 2, "short": 2, "maintenance": 5}'::jsonb,
  'the totals count every own open task once: the two with no due day are in Maintenance');
select test.eq((api.my_day('me') -> 'three')::text, current_setting('t.three'), 'asked again, the answer is the same');
-- the Today list below it holds no cancelled task either
select test.ok((api.my_day('me') -> 'tasks')::text not like '%Made-up cancelled%', 'the Today list shows no cancelled task as current');
select test.ok((api.my_day('me') -> 'tasks')::text like '%Made-up helped only%', 'and still lists the task I help on');

-- the other scopes carry no three
select test.eq(jsonb_typeof(api.my_day('team') -> 'three'), 'null', 'My team has no Today''s three');
