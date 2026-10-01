-- ACCT-02 — the admin and test accounts are in no team (V179; the production finding W26): V444 says the owner's
-- admin account is never a team member. Marking a person as the admin or the test account takes them out of their
-- team and their manager's line in the same request; neither can be given a team or a manager while the account
-- stands; back as a team member, both can. Made up.
-- Sabotages: supabase/tests/sabotage/an-admin-account-keeps-its-team.sql,
--            supabase/tests/sabotage/an-admin-account-joins-a-team.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.own', test.person('Test Owner Account', 'admin')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'made_up_team', 'Made Up Team', 'فريق تجريبي');
select set_config('t.team', (select id::text from core.team where code = 'made_up_team'), true);
update core.person set team_id = current_setting('t.team')::uuid, manager_id = current_setting('t.mgr')::uuid
where id = current_setting('t.own')::uuid;

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.req', api.person_account_set(current_setting('t.own')::uuid, 'admin_account',
  'made up: the owner''s admin account') ->> 'request_id', true);
select test.as_owner();
select test.eq((select coalesce(team_id::text, 'none') || ' / ' || coalesce(manager_id::text, 'none')
                from core.person where id = current_setting('t.own')::uuid), 'none / none',
  'marking the admin account takes it out of its team and its manager''s line');
select test.eq((select count(*)::int from audit.change c where c.request_id = current_setting('t.req')::uuid
                and c.table_name = 'core.person'), 1, 'in the same request');

select set_config('t.v', (select version from core.person where id = current_setting('t.own')::uuid)::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_update(%L, %L, %s, %L)', current_setting('t.own'),
  json_build_object('team_id', current_setting('t.team')), current_setting('t.v'), 'made up'), 'P0001',
  'the admin account is given no team', 'person.account_in_no_team');
select test.raises(format('select api.person_update(%L, %L, %s, %L)', current_setting('t.own'),
  json_build_object('manager_id', current_setting('t.mgr')), current_setting('t.v'), 'made up'), 'P0001',
  'nor a manager', 'person.account_in_no_team');

select api.person_account_set(current_setting('t.own')::uuid, 'team_member', 'made up: a team member again');
select test.as_owner();
select set_config('t.v', (select version from core.person where id = current_setting('t.own')::uuid)::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select test.runs(format('select api.person_update(%L, %L, %s, %L)', current_setting('t.own'),
  json_build_object('team_id', current_setting('t.team'), 'manager_id', current_setting('t.mgr')),
  current_setting('t.v'), 'made up'), 'back as a team member, it takes a team and a manager');
