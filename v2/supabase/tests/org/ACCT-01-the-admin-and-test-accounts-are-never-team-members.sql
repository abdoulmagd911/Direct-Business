-- ACCT-01 — the owner's admin account and the test account are never team members (V444, V445): only an admin marks
-- a person as one, with a reason, logged; there is one of each; neither is anyone's manager (so neither is in a
-- reports-to picker), and a person with reports is not made one; core.is_team_member() answers no for both, and the
-- Organisation and the people list name each person's account. Made up.
-- Sabotages: supabase/tests/sabotage/the-admin-account-counts-as-a-team-member.sql,
--            supabase/tests/sabotage/anyone-marks-an-account.sql,
--            supabase/tests/sabotage/someone-reports-to-the-test-account.sql.
select set_config('t.sys', core.system_person_id()::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.own', test.person('Test Admin Account', 'admin')::text, true);
select set_config('t.try', test.person('Test Try Account', 'member')::text, true);
select set_config('t.m', test.person('Test Member', 'member')::text, true);
select set_config('t.boss', test.person('Test Boss', 'member')::text, true);
update core.person set manager_id = current_setting('t.boss')::uuid where id = current_setting('t.m')::uuid;

-- only an admin, with a reason, a known account, a person of staff
select test.as_person(current_setting('t.m')::uuid);
select test.raises(format('select api.person_account_set(%L, %L, %L)', current_setting('t.try'), 'test_account',
  'made up'), '42501', 'a team member marks no account', 'access.needs_admin');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_account_set(%L, %L, null)', current_setting('t.try'), 'test_account'),
  'P0001', 'a reason is required', 'common.reason_required');
select test.raises(format('select api.person_account_set(%L, %L, %L)', current_setting('t.try'), 'guest', 'made up'),
  'P0001', 'an account type the model knows', 'person.unknown_account');
select test.raises(format('select api.person_account_set(%L, %L, %L)', current_setting('t.sys'), 'test_account',
  'made up'), 'P0002', 'the System person is no account', 'common.not_found');

-- the admin account and the test account
select set_config('t.req', api.person_account_set(current_setting('t.own')::uuid, 'admin_account',
  'made up: the owner''s admin account') ->> 'request_id', true);
select api.person_account_set(current_setting('t.try')::uuid, 'test_account', 'made up: the test account');
select test.eq((select string_agg(x ->> 'account', ',' order by x ->> 'full_name_en') from
                jsonb_array_elements(api.org() -> 'people') x
                where x ->> 'id' in (current_setting('t.own'), current_setting('t.try'), current_setting('t.m'))),
  'admin_account,team_member,test_account', 'the Organisation names each account');
select test.eq((select x ->> 'account' from jsonb_array_elements(api.people()) x where x ->> 'id' = current_setting('t.try')),
  'test_account', 'and so does the people list');
select test.raises(format('select api.person_account_set(%L, %L, %L)', current_setting('t.m'), 'admin_account',
  'made up'), '23505', 'there is one admin account', 'person.account_taken');
select test.as_owner();
select test.eq(core.is_team_member(current_setting('t.own')::uuid), false, 'the admin account is no team member');
select test.eq(core.is_team_member(current_setting('t.try')::uuid), false, 'nor is the test account');
select test.eq(core.is_team_member(current_setting('t.m')::uuid), true, 'everyone else of staff is');
select test.eq(core.is_team_member(core.system_person_id()), false, 'and the System person is not');
select test.eq((select r.actor_id::text || ' · ' || r.label_key || ' · ' || r.reason from audit.request r
                where r.id = current_setting('t.req')::uuid),
  current_setting('t.admin') || ' · person.account_set · made up: the owner''s admin account',
  'logged as the admin''s, with the reason');

-- still people who sign in, hold levels and are told things (ACC-039): their kind stays staff
select test.as_person(current_setting('t.own')::uuid);
select test.eq(api.me() ->> 'status', 'ok', 'the admin account signs in like anyone');
select test.ok(jsonb_typeof(api.me() -> 'levels') = 'object', 'with its levels');
select test.as_owner();

-- nobody reports to either, and someone with reports is not made one
select set_config('t.mv', (select version from core.person where id = current_setting('t.m')::uuid)::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_update(%L, %L, %s, %L)', current_setting('t.m'),
  json_build_object('manager_id', current_setting('t.try')),
  current_setting('t.mv'), 'made up'),
  'P0001', 'the test account is nobody''s manager', 'person.manager_not_team_member');
select test.raises(format('select api.person_update(%L, %L, %s, %L)', current_setting('t.m'),
  json_build_object('manager_id', current_setting('t.own')),
  current_setting('t.mv'), 'made up'),
  'P0001', 'nor the admin account', 'person.manager_not_team_member');
select test.raises(format('select api.person_account_set(%L, %L, %L)', current_setting('t.boss'), 'test_account',
  'made up'), 'P0001', 'a person others report to is not made an account', 'person.has_reports');
select test.ok((api.person_account_set(current_setting('t.try')::uuid, 'team_member', 'made up: back') ->> 'account')
  = 'team_member', 'and an account is made a team member again the same way');
