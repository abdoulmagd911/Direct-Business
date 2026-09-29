-- What a Supabase project already has, for the plain-Postgres runs of the SQL suite (the builders' containers have
-- Postgres but no Docker). Applied before the migrations, only on plain Postgres; CI also runs the suite on the real
-- Supabase stack, which needs none of this. Ported from scripts/qa/phase3/00a and 00c.
do $$
begin
  create role anon nologin noinherit;
exception when duplicate_object then null;
end $$;
do $$
begin
  create role authenticated nologin noinherit;
exception when duplicate_object then null;
end $$;
do $$
begin
  create role service_role nologin noinherit bypassrls;
exception when duplicate_object then null;
end $$;
do $$
begin
  create role authenticator login noinherit;
exception when duplicate_object then null;
end $$;
grant anon, authenticated, service_role to authenticator;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- auth: the users table (the columns v2 reads) and the claim readers, as Supabase defines them.
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  banned_until timestamptz,
  created_at timestamptz default now()
);
create table if not exists auth.sessions (
  id uuid primary key,
  user_id uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

-- storage: the two tables Storage policies are written on, row rules on as in Supabase.
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner uuid, created_at timestamptz default now(), unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
