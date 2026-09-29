-- ACC-03 — only an admin makes an admin (plan P3-4): even with Full on Organization & access, a non-admin cannot give
-- the admin role, nor change an admin's access or role; an admin can. The admin role has everything and its starting
-- levels are not edited. Sabotage: supabase/tests/sabotage/anyone-makes-an-admin.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.admin_role', (select id from core.role where key = 'admin')::text, true);

select set_config('t.role_member', (select id from core.role where key = 'member')::text, true);
select set_config('t.role_head', (select id from core.role where key = 'head')::text, true);
select set_config('t.role_viewer', (select id from core.role where key = 'viewer')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_level(current_setting('t.head')::uuid, 'settings.org', 'full', 'made up: runs access');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.am1'),
  current_setting('t.admin_role'), 'made up'), '42501', 'a head with Full on access cannot make an admin',
  'access.admins_only');
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.admin'), 'tasks',
  'view', 'made up'), '42501', 'nor lower an admin''s level', 'access.admins_only');
select test.raises(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.admin'),
  current_setting('t.role_member')::uuid, 'made up'), '42501', 'nor change an admin''s role',
  'access.admins_only');

select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_role(current_setting('t.am1')::uuid, current_setting('t.admin_role')::uuid,
  'made up: a second admin');
select test.raises(format('select api.access_set_role_level(%L, %L, %L, %L)', current_setting('t.admin_role'), 'tasks',
  'view', 'made up'), 'P0001', 'the admin role''s levels are not edited', 'access.admin_role_has_everything');
select test.as_owner();
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'settings.org'), 'full'::core.level,
  'an admin made them an admin');
