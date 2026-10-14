-- TSK-06 — the Tasks list is fast (W47, V635): a task's flags (overdue, stale, blocked …) are built for the tasks the list
-- shows, and for every task only when the list is filtered by a flag — never for all of them on every open. The count of
-- flag builds is the proof, not a clock. The flag filter still finds what it must. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-tasks-list-builds-every-flag.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.own', test.person('Test Owner', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk') where id = current_setting('t.own')::uuid;
select set_config('v2.test_now', '2026-10-05 09:00:00+03', true);

select test.as_person(current_setting('t.own')::uuid);
select set_config('t.late', api.task_create(jsonb_build_object('title', 'Made-up overdue', 'due_on', '2026-10-04'))
  ->> 'id', true);
select api.task_create(jsonb_build_object('title', 'Made-up due today', 'due_on', '2026-10-05'));
select api.task_create(jsonb_build_object('title', 'Made-up due later', 'due_on', '2026-12-31'));

-- count every flag build (the original keeps its name under a new one; a counting stand-in takes the old name)
select test.as_owner();
alter function work.task_flags(work.task) rename to task_flags_counted;
create function work.task_flags(t work.task) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform pg_catalog.set_config('made_up.flag_builds',
    (coalesce(nullif(pg_catalog.current_setting('made_up.flag_builds', true), ''), '0')::int + 1)::text, true);
  return work.task_flags_counted(t);
end
$$;

select test.as_person(current_setting('t.own')::uuid);
select set_config('made_up.flag_builds', '0', true);
select test.eq(jsonb_array_length(api.tasks() -> 'rows'), 3, 'the list shows the three tasks');
select test.eq(current_setting('made_up.flag_builds')::int, 3,
  'the list builds flags for the tasks it shows, once each, and for no other');

select set_config('made_up.flag_builds', '0', true);
select test.eq(api.tasks('{"overdue": true}'::jsonb) -> 'rows' -> 0 ->> 'id', current_setting('t.late'),
  'the overdue filter still finds the late one');
select test.eq(jsonb_array_length(api.tasks('{"overdue": true}'::jsonb) -> 'rows'), 1, 'and only that one');
select test.ok(current_setting('made_up.flag_builds')::int >= 3,
  'a flag filter judges every task it may see');
