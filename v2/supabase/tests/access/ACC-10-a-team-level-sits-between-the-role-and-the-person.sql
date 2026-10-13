-- ACC-10 — access by team (V510): a person's level is their own override, else the highest level of their home team
-- and the teams they assist, else their role's, else none. A new joiner has the team's level the moment the team is
-- set; a retired team gives nothing. Only admins set a team level, with a reason, never on a Settings page; the matrix
-- and a person's access show it; clearing it is one request with its Undo. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-team-level-is-ignored.sql, a-team-level-beats-the-persons.sql,
-- the-lowest-team-level-wins.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_bd', 'Test Business Development', 'تطوير الأعمال للاختبار'),
       (test.department('commercial'), 'test_bs', 'Test Business Solutions', 'حلول الأعمال للاختبار'),
       (test.department('commercial'), 'test_other', 'Test Other Team', 'فريق آخر للاختبار');
select set_config('t.bd', (select id from core.team where code = 'test_bd')::text, true);
select set_config('t.bs', (select id from core.team where code = 'test_bs')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.m1', test.person('Test BD Member', 'member')::text, true);
select set_config('t.m2', test.person('Test Assisting Member', 'member')::text, true);
select set_config('t.m3', test.person('Test Other Member', 'member')::text, true);
select set_config('t.new', test.person('Test New Joiner', 'member')::text, true);
update core.person set team_id = current_setting('t.bd')::uuid where id = current_setting('t.m1')::uuid;
update core.person set team_id = (select id from core.team where code = 'test_other')
where id in (current_setting('t.m2')::uuid, current_setting('t.m3')::uuid);
insert into core.person_team_assist (person_id, team_id) values (current_setting('t.m2')::uuid, current_setting('t.bd')::uuid);
update core.role_page_level set level = 'none'
where page_key = 'pipeline' and role_id = (select id from core.role where key = 'member') and deleted_at is null;
select test.eq(authz.level_of(current_setting('t.m1')::uuid, 'pipeline'), 'none'::core.level,
  'a member starts at none on Pipeline here');

-- only an admin sets a team's level, with a reason, never on a Settings page
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.access_set_team_level(%L, %L, %L, %L)', current_setting('t.bd'), 'pipeline', 'own',
  'Made-up: their work'), '42501', 'a head does not set a team''s level', 'access.needs_level');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.access_set_team_level(%L, %L, %L, %L)', current_setting('t.bd'), 'pipeline', 'own',
  ' '), 'P0001', 'a reason is required', 'common.reason_required');
select test.raises(format('select api.access_set_team_level(%L, %L, %L, %L)', current_setting('t.bd'), 'settings.org',
  'full', 'Made-up: no'), 'P0001', 'Settings stays admins-only', 'access.settings_admins_only');
select set_config('t.set', api.access_set_team_level(current_setting('t.bd')::uuid, 'pipeline', 'own',
  'Made-up: the team works the pipeline') ->> 'request_id', true);
select test.as_owner();

select test.eq(authz.level_of(current_setting('t.m1')::uuid, 'pipeline'), 'own'::core.level, 'the home team''s level');
select test.eq(authz.level_of(current_setting('t.m2')::uuid, 'pipeline'), 'own'::core.level,
  'and a team the person assists');
select test.eq(authz.level_of(current_setting('t.m3')::uuid, 'pipeline'), 'none'::core.level, 'nobody else');
update core.person set team_id = current_setting('t.bd')::uuid where id = current_setting('t.new')::uuid;
select test.eq(authz.level_of(current_setting('t.new')::uuid, 'pipeline'), 'own'::core.level,
  'a new joiner has it the moment the team is set');

-- the highest of a person's teams wins; the person's own override beats them all
insert into core.team_page_level (team_id, page_key, level, reason)
values (current_setting('t.bs')::uuid, 'pipeline', 'full', 'Made-up: they lead it');
insert into core.person_team_assist (person_id, team_id) values (current_setting('t.m1')::uuid, current_setting('t.bs')::uuid);
select test.eq(authz.level_of(current_setting('t.m1')::uuid, 'pipeline'), 'full'::core.level,
  'the highest of a person''s teams');
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.m2')::uuid, 'pipeline', 'view', 'Made-up: reads only');
select test.eq(authz.level_of(current_setting('t.m2')::uuid, 'pipeline'), 'view'::core.level,
  'the person''s own override beats the team');
update core.team set active = false where id = current_setting('t.bs')::uuid;
select test.eq(authz.level_of(current_setting('t.m1')::uuid, 'pipeline'), 'own'::core.level, 'a retired team gives nothing');
update core.team set active = true where id = current_setting('t.bs')::uuid;

-- the matrix and a person's access show it; api.me() reads it
select test.as_person(current_setting('t.admin')::uuid);
select test.ok(api.access_matrix() -> 'team_levels' @> jsonb_build_array(jsonb_build_object('team_id', current_setting('t.bd'),
  'page', 'pipeline', 'level', 'own')), 'the matrix lists the team''s level');
select test.ok(api.access_of_person(current_setting('t.m1')::uuid) -> 'team_levels' @> jsonb_build_array(
  jsonb_build_object('team_id', current_setting('t.bd'), 'page', 'pipeline', 'level', 'own', 'home', true)),
  'a person''s access names the team that gives it');
select test.as_person(current_setting('t.new')::uuid);
select test.eq(api.me() -> 'levels' ->> 'pipeline', 'own', 'api.me() reads it');

-- clearing it: back to the role's; Undo brings it back
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.clr', api.access_clear_team_level(current_setting('t.bd')::uuid, 'pipeline', 'Made-up: moved on')
  ->> 'request_id', true);
select test.eq(api.access_of_person(current_setting('t.new')::uuid) -> 'levels' ->> 'pipeline', 'none',
  'cleared: the role''s level');
select test.runs(format('select api.undo(%L)', current_setting('t.clr')), 'Undo');
select test.as_owner();
select test.eq(authz.level_of(current_setting('t.new')::uuid, 'pipeline'), 'own'::core.level, 'brings it back');
