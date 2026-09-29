-- ROLE-01 — roles (§3.1, D2, V97): only an admin makes and renames roles — a head is refused; a new role is never an
-- admin one; a rename names the version read; a role's key never changes; the admin role too is renamed by an admin.
-- Sabotage: supabase/tests/sabotage/anyone-saves-a-role.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.role_admin', (select id::text from core.role where key = 'admin'), true);
select set_config('t.admin_v', (select version::text from core.role where key = 'admin'), true);

select test.as_person(current_setting('t.head')::uuid);
select test.raises($$select api.role_save(null, 'made_up_role', 'Made up')$$, '42501', 'a head makes no role',
  'access.needs_level');
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r', api.role_save(null, 'coordinator', 'Coordinator', null, 45, null, 'made up') ->> 'id', true);
select test.as_owner();
select test.eq((select is_admin from core.role where id = current_setting('t.r')::uuid), false,
  'a new role is never an admin role');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((api.role_save(current_setting('t.r')::uuid, 'coordinator', 'Team coordinator', null, 45, 1)
                ->> 'version')::int, 2, 'a role is renamed naming the version read');
select test.raises(format('select api.role_save(%L, %L, %L, null, 45, 2)', current_setting('t.r'), 'renamed_key',
  'Team coordinator'), 'P0001', 'a role''s key never changes', 'role.key_fixed');
select test.raises($$select api.role_save(null, 'coordinator', 'Again')$$, '23505', 'a role key is used once',
  'org.code_taken');
select test.eq((api.role_save(current_setting('t.role_admin')::uuid, 'admin', 'Owner', null, 10,
  current_setting('t.admin_v')::int) ->> 'id'), current_setting('t.role_admin'), 'an admin renames the admin role');
