-- ACC-01 — a person's level on a page (§5, D2): the admin role has the page's top level (Own on My profile, the only
-- level it offers); else the person's override; else the role's starting level from the registry (§8); else none. A
-- Settings page is none or Full, Full for admins only, and no override gives anyone else a level there (V97). A
-- switched-off person, an unknown page and a retired page read none; authz.level() and api.me() give the same answer.
-- Sabotage: supabase/tests/sabotage/levels-ignore-overrides.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.off', test.person('Test Switched Off', 'member', 'commercial', false)::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am1')::uuid, 'finance', 'view', 'made up for a test'),
       (current_setting('t.off')::uuid, 'finance', 'full', 'made up for a test');

select test.eq(authz.level_of(current_setting('t.admin')::uuid, 'finance'), 'full'::core.level, 'an admin: the top level');
select test.eq(authz.level_of(current_setting('t.admin')::uuid, 'settings.profile'), 'own'::core.level,
  'on My profile an admin has Own, the only level it offers');
select test.eq(authz.level_of(current_setting('t.head')::uuid, 'activity'), 'view'::core.level,
  'a head of department starts at View on Activity');
select test.eq(authz.level_of(current_setting('t.head')::uuid, 'settings.org'), 'none'::core.level,
  'and has no level on a Settings page');
select test.eq(authz.level_of(current_setting('t.admin')::uuid, 'settings.org'), 'full'::core.level,
  'where an admin has Full');
select test.raises(format('insert into core.person_page_level (person_id, page_key, level, reason) values (%L, %L, %L, %L)',
  current_setting('t.head'), 'settings.partners', 'full', 'made up'), 'P0001', 'no override gives anyone else a level there',
  'access.settings_admins_only');
select test.raises($$update core.role_page_level set level = 'full' where page_key = 'settings.app'
  and role_id = (select id from core.role where key = 'head')$$, 'P0001', 'nor a role''s starting level',
  'access.settings_admins_only');
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'tasks'), 'own'::core.level,
  'a team member starts at Own on Tasks');
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'finance'), 'view'::core.level,
  'the person''s override wins over the role');
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'overview'), 'none'::core.level,
  'no starting level: none');
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'no.such.page'), 'none'::core.level, 'an unknown page: none');
select test.eq(authz.level_of(current_setting('t.off')::uuid, 'finance'), 'none'::core.level,
  'a switched-off person has none, whatever their overrides');
update core.page set active = false where key = 'pipeline';
select test.eq(authz.level_of(current_setting('t.admin')::uuid, 'pipeline'), 'none'::core.level, 'a retired page: none');
update core.page set active = true where key = 'pipeline';

select test.as_person(current_setting('t.am1')::uuid);
select test.eq(authz.level('finance'), 'view'::core.level, 'authz.level() answers for the signed-in person');
select set_config('t.me', api.me()::text, true);
select test.as_owner();
select test.eq(current_setting('t.me')::jsonb -> 'levels' ->> 'finance', 'view', 'api.me() gives the same answer');
select test.eq(current_setting('t.me')::jsonb -> 'levels' ->> 'settings.profile', 'own', 'My profile is always one''s own');
select test.eq((select count(*) from jsonb_object_keys(current_setting('t.me')::jsonb -> 'levels'))::int,
  (select count(*) from core.page where active)::int, 'api.me() names a level for every page');
