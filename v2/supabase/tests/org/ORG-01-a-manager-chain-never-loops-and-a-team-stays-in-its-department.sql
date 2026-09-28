-- ORG-01 — a manager chain never loops (A manages B manages A is refused), a person's team belongs to their department,
-- and staff always have a department (§3.1).
-- Sabotage: supabase/tests/sabotage/managers-may-loop.sql.
select set_config('t.a', test.person('Test A', 'member')::text, true);
select set_config('t.b', test.person('Test B', 'member')::text, true);
select set_config('t.c', test.person('Test C', 'member')::text, true);
update core.person set manager_id = current_setting('t.a')::uuid where id = current_setting('t.b')::uuid;
update core.person set manager_id = current_setting('t.b')::uuid where id = current_setting('t.c')::uuid;
select test.raises(format('update core.person set manager_id = %L where id = %L', current_setting('t.c'), current_setting('t.a')),
  'P0001', 'A under C under B under A is a loop', 'person.manager_cycle');
select test.raises(format('update core.person set manager_id = id where id = %L', current_setting('t.a')),
  'P0001', 'nobody manages themselves', 'person.manager_cycle');
insert into core.team (department_id, code, name_en) values (test.department('other_dept'), 'elsewhere', 'Elsewhere');
select test.raises(format('update core.person set team_id = (select id from core.team where code = %L) where id = %L',
  'elsewhere', current_setting('t.a')), 'P0001', 'a team of another department', 'person.team_outside_department');
select test.raises($$insert into core.person (full_name_en) values ('Test Nowhere')$$, '23514',
  'staff need a department');
