-- TEAM-01 — departments and teams (§3.1, D11): Full makes and renames them, naming the version read; a team stays in its
-- department; retiring a team moves its people to another active team of the same department (or none) and ends its
-- helpers, in one request that one Undo takes back; a retired team is not retired or changed again.
-- Sabotage: supabase/tests/sabotage/retiring-a-team-strands-its-people.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('t.helper', test.person('Test Helper', 'member')::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.dep', api.department_save(null, 'teams_one', 'Teams One', null, current_setting('t.admin')::uuid,
  null, 'made up') ->> 'id', true);
select test.raises($$select api.department_save(null, 'teams_one', 'Teams Again')$$, '23505',
  'a department code is used once', 'org.code_taken');
select set_config('t.other_dep', api.department_save(null, 'teams_two', 'Teams Two') ->> 'id', true);
select set_config('t.t1', api.team_save(null, current_setting('t.dep')::uuid, 'north', 'North') ->> 'id', true);
select set_config('t.t2', api.team_save(null, current_setting('t.dep')::uuid, 'south', 'South') ->> 'id', true);
select set_config('t.t3', api.team_save(null, current_setting('t.other_dep')::uuid, 'east', 'East') ->> 'id', true);
select test.eq((api.team_save(current_setting('t.t1')::uuid, current_setting('t.dep')::uuid, 'north', 'North Desk',
  null, null, 1) ->> 'version')::int, 2, 'a team is renamed naming the version read');
select test.raises(format('select api.team_save(%L, %L, %L, %L, null, null, 2)', current_setting('t.t1'),
  current_setting('t.other_dep'), 'north', 'North Desk'), 'P0001', 'a team stays in its department',
  'team.department_fixed');

select test.as_owner();
update core.person set department_id = current_setting('t.dep')::uuid, team_id = current_setting('t.t1')::uuid
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);
insert into core.person_team_assist (person_id, team_id)
values (current_setting('t.helper')::uuid, current_setting('t.t1')::uuid);

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.team_retire(%L, %L, %L)', current_setting('t.t1'), current_setting('t.t3'),
  'made up'), 'P0001', 'people move only to an active team of the same department', 'team.move_to_invalid');
select set_config('t.ret', api.team_retire(current_setting('t.t1')::uuid, current_setting('t.t2')::uuid,
  'made up: merged into South')::text, true);
select test.eq((current_setting('t.ret')::jsonb ->> 'moved')::int, 2, 'retiring a team moves its two people');
select test.as_owner();
select test.eq((select count(*)::int from core.person where team_id = current_setting('t.t2')::uuid), 2,
  'to the team it merged into');
select test.eq((select active from core.team where id = current_setting('t.t1')::uuid), false, 'the team is retired');
select test.eq((select retired_into_team_id from core.team where id = current_setting('t.t1')::uuid),
  current_setting('t.t2')::uuid, 'naming where it went');
select test.eq((select count(*)::int from core.person_team_assist where team_id = current_setting('t.t1')::uuid
                and deleted_at is null), 0, 'its helpers stop helping it');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.team_retire(%L, null, %L)', current_setting('t.t1'), 'made up'), 'P0001',
  'a retired team is not retired again', 'team.retired');
select api.undo((current_setting('t.ret')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from core.person where team_id = current_setting('t.t1')::uuid), 2,
  'one Undo brings the people back');
select test.eq((select active from core.team where id = current_setting('t.t1')::uuid), true, 'and the team');
