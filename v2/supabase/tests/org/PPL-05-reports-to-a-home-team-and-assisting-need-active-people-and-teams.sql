-- PPL-05 — the active check on the people columns (OLD-006, V465). Reports-to is never someone who cannot work here (a
-- switched-off person, one whose leaving day has come); a home team is an active one; a person assists only an active
-- team that is not their home team, and only while they can work here; the test account is named owner or mentioned
-- by nobody. Every value is made up.
-- Sabotages: supabase/tests/sabotage/reports-to-a-switched-off-person.sql,
--            supabase/tests/sabotage/assisting-a-retired-team.sql, supabase/tests/sabotage/the-test-account-is-named.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار'),
       (test.department('commercial'), 'test_other', 'Test Other Desk', 'فريق آخر');
insert into core.team (department_id, code, name_en, name_ar, active)
values (test.department('commercial'), 'test_old', 'Test Old Desk', 'فريق قديم', false);
select set_config('t.desk', (select id::text from core.team where code = 'test_desk'), true);
select set_config('t.other', (select id::text from core.team where code = 'test_other'), true);
select set_config('t.old', (select id::text from core.team where code = 'test_old'), true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Member', 'member')::text, true);
select set_config('t.am2', test.person('Test Other Member', 'member')::text, true);
select set_config('t.off', test.person('Test Switched Off', 'member', 'commercial', false)::text, true);
select set_config('t.gone', test.person('Test Departed', 'member')::text, true);
select set_config('t.qa', test.person('Test QA Account', 'member')::text, true);
update core.person set left_on = core.riyadh_today() - 1 where id = current_setting('t.gone')::uuid;
update core.person set account = 'test_account' where id = current_setting('t.qa')::uuid;
update core.person set team_id = current_setting('t.desk')::uuid where id = current_setting('t.am1')::uuid;
select set_config('t.v', (select version from core.person where id = current_setting('t.am1')::uuid)::text, true);

-- reports-to and the home team
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_update(%L, %L::jsonb, %s, %L)', current_setting('t.am1'),
  jsonb_build_object('manager_id', current_setting('t.off')), current_setting('t.v'), 'made up'), 'P0001',
  'nobody reports to a switched-off person', 'person.manager_unavailable');
select test.raises(format('select api.person_update(%L, %L::jsonb, %s, %L)', current_setting('t.am1'),
  jsonb_build_object('manager_id', current_setting('t.gone')), current_setting('t.v'), 'made up'), 'P0001',
  'nor to one whose leaving day has come', 'person.manager_unavailable');
select test.raises(format('select api.person_update(%L, %L::jsonb, %s, %L)', current_setting('t.am1'),
  jsonb_build_object('team_id', current_setting('t.old')), current_setting('t.v'), 'made up'), 'P0001',
  'a home team is an active one', 'person.team_inactive');
select test.runs(format('select api.person_update(%L, %L::jsonb, %s, %L)', current_setting('t.am1'),
  jsonb_build_object('manager_id', current_setting('t.am2')), current_setting('t.v'), 'made up'),
  'reports-to someone who works here is kept');

-- assisting
select test.as_owner();
select test.raises(format('insert into core.person_team_assist (person_id, team_id) values (%L, %L)',
  current_setting('t.am1'), current_setting('t.old')), 'P0001', 'nobody assists a retired team',
  'person.assist_team_inactive');
select test.raises(format('insert into core.person_team_assist (person_id, team_id) values (%L, %L)',
  current_setting('t.am1'), current_setting('t.desk')), 'P0001', 'nor their own home team', 'person.assist_home_team');
select test.raises(format('insert into core.person_team_assist (person_id, team_id) values (%L, %L)',
  current_setting('t.off'), current_setting('t.other')), 'P0001', 'a switched-off person assists no team',
  'person.unavailable');
select test.runs(format('insert into core.person_team_assist (person_id, team_id) values (%L, %L)',
  current_setting('t.am1'), current_setting('t.other')), 'an active team besides their own is kept');

-- the test account is named by nobody
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Named Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am2'))))) ->> 'id', true);
select test.raises(format('select api.partner_owner_set(%L, %L, %L)', current_setting('t.p'), 'client',
  current_setting('t.qa')), 'P0001', 'the test account owns no organisation', 'person.unavailable');
select test.raises(format('select api.note_add(%L, %L, %L, %L, null, %L)', 'partner', current_setting('t.p'), 'comment',
  'Made-up note', array[current_setting('t.qa')::uuid]), 'P0001', 'and is mentioned by nobody', 'person.unavailable');
