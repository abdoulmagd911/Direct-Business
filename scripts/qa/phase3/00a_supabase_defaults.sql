-- mirrors the LIVE default privileges measured 2026-09-25 (pg_default_acl on public):
-- new tables, sequences and functions are granted to anon and authenticated
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
-- live Supabase: signed-in callers can reach auth.uid()
create schema if not exists auth;
grant usage on schema auth to anon, authenticated;
