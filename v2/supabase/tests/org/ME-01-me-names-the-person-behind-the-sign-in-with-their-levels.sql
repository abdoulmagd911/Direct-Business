-- ME-01 — api.me() names the person behind the sign-in, their role, departments and profile, and their level on every
-- page: an admin role is full everywhere; else the person's override; else the role's default; else none (D2, A5).
-- Sabotage: supabase/tests/sabotage/me-ignores-overrides.sql.
select test.page('test.tasks');
select test.page('test.finance');
select test.page('test.reports');
insert into core.role_page_level (role_id, page_key, level)
values (test.role('member'), 'test.tasks', 'own'), (test.role('member'), 'test.finance', 'own');
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am1')::uuid, 'test.finance', 'view', 'made up for a test');
insert into core.person_profile (person_id, display_name_en, theme, badge_kind, badge_value)
values (current_setting('t.am1')::uuid, 'Test AM', 'direct', 'zodiac', 'leo');
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.me', api.me()::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.me_admin', api.me()::text, true);
do $$
declare
  me jsonb := current_setting('t.me')::jsonb;
  adm jsonb := current_setting('t.me_admin')::jsonb;
begin
  perform test.eq(me ->> 'status', 'ok', 'AM1 is signed in');
  perform test.eq((me -> 'person' ->> 'id')::uuid, current_setting('t.am1')::uuid, 'the person is AM1');
  perform test.eq(me -> 'person' -> 'role' ->> 'key', 'member', 'the role');
  perform test.eq(me -> 'levels' -> 'test.tasks', '"own"'::jsonb, 'the role''s default');
  perform test.eq(me -> 'levels' -> 'test.finance', '"view"'::jsonb, 'the person''s override wins');
  perform test.eq(me -> 'levels' -> 'test.reports', '"none"'::jsonb, 'else none');
  perform test.eq(me -> 'profile' ->> 'theme', 'direct', 'the profile comes with it');
  perform test.eq(jsonb_array_length(me -> 'departments'), 1, 'one department');
  perform test.ok(adm -> 'levels' @> '{"test.tasks": "full", "test.finance": "full", "test.reports": "full"}',
    'an admin role is full everywhere');
end $$;
