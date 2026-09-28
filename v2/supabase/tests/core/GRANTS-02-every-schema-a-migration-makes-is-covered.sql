-- GRANTS-02 — every schema the migrations create is one of v2's listed schemas, so no schema escapes the grants
-- snapshot (GRANTS-01) or the write refusals (WRITE-01).
-- Sabotage: supabase/tests/sabotage/unlisted-schema.sql.
do $$
declare
  stray text;
begin
  select string_agg(n.nspname, ', ' order by n.nspname) into stray
  from pg_namespace n
  where n.nspowner = current_user::regrole
    and n.nspname not like 'pg\_%'
    -- the platform's own schemas (Supabase's, and their stand-ins on plain Postgres)
    and n.nspname not in ('public', 'extensions', 'test', 'information_schema', 'auth', 'storage', 'graphql',
      'graphql_public', 'realtime', '_realtime', 'supabase_functions', 'supabase_migrations', 'vault', 'pgbouncer',
      'net', 'pgsodium', 'pgsodium_masks', 'cron', '_analytics')
    and not (n.nspname = any (test.v2_schemas()));
  perform test.ok(stray is null, format('schemas outside test.v2_schemas(): %s — add them there', stray));
end $$;
