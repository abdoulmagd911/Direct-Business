-- ACC-07 — reading access (§5, P3-5's screens): the matrix of roles × pages and capabilities is on Settings →
-- Organization & access, so for admins (V97); a person's own access is theirs to read, anyone else's is an admin's.
-- Sabotage: supabase/tests/sabotage/the-matrix-is-open-to-all.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am1')::uuid, 'finance', 'view', 'made up for a test');

select test.as_person(current_setting('t.am1')::uuid);
select test.raises($$select api.access_matrix()$$, '42501', 'a team member cannot read the matrix', 'access.needs_level');
select test.raises(format('select api.access_of_person(%L)', current_setting('t.head')), '42501',
  'nor someone else''s access', 'access.needs_level');
select set_config('t.mine', api.access_of_person(current_setting('t.am1')::uuid)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select test.raises($$select api.access_matrix()$$, '42501', 'nor can a head', 'access.needs_level');
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.matrix', api.access_matrix()::text, true);
select set_config('t.theirs', api.access_of_person(current_setting('t.am1')::uuid)::text, true);
select test.as_owner();
select test.eq(current_setting('t.mine')::jsonb -> 'levels' ->> 'finance', 'view', 'one''s own access, with its override');
select test.eq(jsonb_array_length(current_setting('t.matrix')::jsonb -> 'roles'), 5, 'the five roles');
select test.eq(jsonb_array_length(current_setting('t.matrix')::jsonb -> 'pages'),
  (select count(*) from core.page where active)::int, 'every page');
select test.eq(jsonb_array_length(current_setting('t.matrix')::jsonb -> 'role_levels'),
  (select count(*) from core.role_page_level where deleted_at is null)::int, 'every role''s starting levels');
select test.eq(current_setting('t.theirs')::jsonb -> 'level_overrides' -> 0 ->> 'reason', 'made up for a test',
  'an admin sees another person''s overrides and why');
