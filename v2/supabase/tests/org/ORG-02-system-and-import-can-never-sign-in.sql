-- ORG-02 — the System and Import persons exist, are kind 'system', cannot be allowed to sign in, and no sign-in can be
-- linked to them (V44: imports and jobs are never attributed to a real login, and never are one).
-- Sabotage: supabase/tests/sabotage/system-can-be-linked.sql.
select test.eq((select kind from core.person where id = core.system_person_id()), 'system', 'System exists');
select test.eq((select kind from core.person where id = core.import_person_id()), 'system', 'Import exists');
select test.raises(format('update core.person set can_sign_in = true where id = %L', core.system_person_id()), '23514',
  'System cannot be allowed to sign in');
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000beef', 'test.robot@example.test');
select test.raises(format('insert into core.person_auth (auth_user_id, person_id) values (%L, %L)',
  '00000000-0000-4000-8000-00000000beef', core.import_person_id()), 'P0001', 'no sign-in links to Import',
  'person_auth.not_staff');
