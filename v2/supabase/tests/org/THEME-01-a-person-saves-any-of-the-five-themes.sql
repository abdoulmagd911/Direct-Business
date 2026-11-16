-- THEME-01 — Landing 31: a person saves any of the five themes to their own profile — Light, Dark, Direct,
-- Turquoise (opt-in) and System (follows the device) — and a name that is not a theme is refused by the table itself.
-- A profile saved while Colorful was offered keeps its stored value (V636: it reads as Light in the app).
select set_config('t.p', test.person('Test Theme Person', 'member')::text, true);
select test.as_person(current_setting('t.p')::uuid);
select api.profile_update('{"theme": "light"}', null, 1);
select test.eq(api.me() -> 'profile' ->> 'theme', 'light', 'Light is saved');
select api.profile_update(jsonb_build_object('theme', 'dark'), (api.me() -> 'profile' ->> 'version')::int);
select test.eq(api.me() -> 'profile' ->> 'theme', 'dark', 'Dark is saved');
select api.profile_update(jsonb_build_object('theme', 'direct'), (api.me() -> 'profile' ->> 'version')::int);
select test.eq(api.me() -> 'profile' ->> 'theme', 'direct', 'Direct is saved');
select api.profile_update(jsonb_build_object('theme', 'turquoise'), (api.me() -> 'profile' ->> 'version')::int);
select test.eq(api.me() -> 'profile' ->> 'theme', 'turquoise', 'Turquoise is saved');
select api.profile_update(jsonb_build_object('theme', 'system'), (api.me() -> 'profile' ->> 'version')::int);
select test.eq(api.me() -> 'profile' ->> 'theme', 'system', 'System is saved');
select test.raises(
  format('select api.profile_update(%L::jsonb, %s)', '{"theme": "neon"}', (api.me() -> 'profile' ->> 'version')),
  '23514', 'a name that is not a theme is refused');
select test.as_owner();
select test.eq(
  (select count(*)::int from pg_catalog.pg_constraint con
   join pg_catalog.pg_class cl on cl.oid = con.conrelid
   join pg_catalog.pg_namespace n on n.oid = cl.relnamespace
   where n.nspname = 'core' and cl.relname = 'person_profile' and con.contype = 'c'
     and pg_catalog.pg_get_constraintdef(con.oid) like '%theme%'),
  1, 'one check holds the theme names');
