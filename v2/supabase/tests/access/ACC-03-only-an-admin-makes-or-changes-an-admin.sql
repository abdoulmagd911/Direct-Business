-- ACC-03 — only an admin makes an admin (plan P3-4, V97): a head — who has no level on Settings — can neither put an
-- e-mail on an admin's person nor give anyone the admin role; an admin can. The admin role has everything and its
-- starting levels are not edited.
-- Sabotage: supabase/tests/sabotage/anyone-makes-an-admin.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.admin_role', (select id from core.role where key = 'admin')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.person_email_add(%L, %L)', current_setting('t.admin'), 'made.up.head@example.test'),
  '42501', 'a head cannot put an e-mail on an admin''s person', 'access.needs_admin');
select test.raises(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.am1'),
  current_setting('t.admin_role'), 'made up'), '42501', 'nor make anyone an admin', 'access.needs_level');
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.admin'), 'tasks',
  'view', 'made up'), '42501', 'nor lower an admin''s level', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_role(current_setting('t.am1')::uuid, current_setting('t.admin_role')::uuid,
  'made up: a second admin');
select test.raises(format('select api.access_set_role_level(%L, %L, %L, %L)', current_setting('t.admin_role'), 'tasks',
  'view', 'made up'), 'P0001', 'the admin role''s levels are not edited', 'access.admin_role_has_everything');
select test.as_owner();
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'settings.org'), 'full'::core.level,
  'an admin made them an admin, with Full on Settings');
