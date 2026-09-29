-- ORGR-01 — reading the organisation (§3.1, §8, V132): the structure — departments, teams, roles and people by name —
-- for every signed-in person (pickers and hover cards, names read live); the people list with roles, allowed emails and
-- last sign-in for admins only (Settings → Organization & access — V97); the sign-in log of oneself always, of anyone
-- for an admin.
-- Sabotage: supabase/tests/sabotage/the-people-list-is-open.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.gone', test.person('Test Switched Off', 'member', 'commercial', false)::text, true);
update core.person set active = false where id = current_setting('t.gone')::uuid;
select test.sign_in(current_setting('t.am1')::uuid);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.org', api.org()::text, true);
select test.ok(exists (select 1 from jsonb_array_elements(current_setting('t.org')::jsonb -> 'people') p
                       where p ->> 'id' = current_setting('t.head')), 'a member sees the people by name');
select test.ok(not exists (select 1 from jsonb_array_elements(current_setting('t.org')::jsonb -> 'people') p
                           where p ->> 'id' = current_setting('t.gone')), 'but not someone who has left');
select test.ok(jsonb_array_length(current_setting('t.org')::jsonb -> 'roles') >= 5, 'and the roles');
select test.ok(not (current_setting('t.org')::jsonb -> 'people' -> 0 ? 'emails'), 'but no emails');
select test.raises('select api.people()', '42501', 'a member cannot open the people list', 'access.needs_level');
select test.ok(jsonb_array_length(api.sign_in_log(current_setting('t.am1')::uuid)) >= 1,
  'a person reads their own sign-ins');
select test.raises(format('select api.sign_in_log(%L)', current_setting('t.head')), '42501',
  'not someone else''s', 'access.needs_level');

select test.as_person(current_setting('t.head')::uuid);
select test.raises('select api.people()', '42501', 'nor can a head', 'access.needs_level');
select test.as_person(current_setting('t.admin')::uuid);
select test.ok(exists (select 1 from jsonb_array_elements(api.people()) p
                       where p ->> 'id' = current_setting('t.am1') and jsonb_array_length(p -> 'emails') >= 1
                         and p -> 'role' ->> 'key' = 'member'),
  'an admin sees the people list with roles and emails');
select test.ok(jsonb_array_length(api.sign_in_log(current_setting('t.am1')::uuid)) >= 1,
  'and anyone''s sign-in log');
