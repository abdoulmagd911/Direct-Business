-- golive-backup.sql (2026-09-27) — the helpers behind the "backup before a reset" (DECISIONS D9, the owner's order of
-- 26 Sep: "full backup first, kept outside the DB"). Used by the edge function supabase/functions/golive-backup, which
-- writes every public table to the PRIVATE storage bucket `golive-backups` (outside the database: storage, not a
-- table) and then proves each file restorable. Nothing here is callable by a signed-in person: service_role only.
--
--   golive_backup_tables()                  every public base table, by name
--   golive_backup_plan(t)                   {rows, bytes} — the caller cuts a big table into pieces from this
--   golive_backup_dump(t, off, lim)         rows off..off+lim (in physical order) as one JSON array (to_jsonb per row)
--   golive_backup_check(t, data, off, lim)  RESTORABLE?  the stored piece is put back through jsonb_populate_recordset
--                                           into the table's own row type — every value must fit its column — and must
--                                           equal the same rows of the live table, row for row (md5 over the sorted rows)
-- Measured the first time (2026-09-27): a 9 MB table in one piece ran past the statement timeout, and a file written
-- after a JavaScript JSON round trip failed the check on 8 tables (123.4500 came back as 123.45) — so the function now
-- stores the database's text byte for byte, and cuts tables into pieces.

insert into storage.buckets (id, name, public) values ('golive-backups', 'golive-backups', false)
  on conflict (id) do update set public = false;

create or replace function public.golive_backup_tables() returns setof text language sql stable security definer
set search_path to 'public' as $$
  select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' order by 1
$$;

create or replace function public.golive_backup_plan(t text) returns jsonb language plpgsql stable security definer
set search_path to 'public' as $$
declare n bigint;
begin
  if t not in (select public.golive_backup_tables()) then raise exception 'not a public table: %', t; end if;
  execute format('select count(*) from public.%I', t) into n;
  return jsonb_build_object('rows', n, 'bytes', pg_total_relation_size(('public.' || quote_ident(t))::regclass));
end $$;

drop function if exists public.golive_backup_dump(text);
create or replace function public.golive_backup_dump(t text, off bigint, lim bigint) returns jsonb language plpgsql stable
security definer set search_path to 'public' as $$
declare r jsonb;
begin
  if t not in (select public.golive_backup_tables()) then raise exception 'not a public table: %', t; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb)
                    from (select * from public.%I order by ctid offset $1 limit $2) x', t) using off, lim into r;
  return r;
end $$;

drop function if exists public.golive_backup_check(text, jsonb);
create or replace function public.golive_backup_check(t text, data jsonb, off bigint, lim bigint) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare f_n bigint; l_n bigint; f_md5 text; l_md5 text;
begin
  if t not in (select public.golive_backup_tables()) then raise exception 'not a public table: %', t; end if;
  execute format('select count(*), md5(coalesce(string_agg(to_jsonb(r)::text, E''\n'' order by to_jsonb(r)::text), ''''))
                    from jsonb_populate_recordset(null::public.%I, $1) r', t) using data into f_n, f_md5;
  execute format('select count(*), md5(coalesce(string_agg(to_jsonb(r)::text, E''\n'' order by to_jsonb(r)::text), ''''))
                    from (select * from public.%I order by ctid offset $1 limit $2) r', t) using off, lim into l_n, l_md5;
  return jsonb_build_object('table', t, 'off', off, 'file_rows', f_n, 'live_rows', l_n, 'md5', f_md5, 'same', f_n = l_n and f_md5 = l_md5);
end $$;

revoke all on function public.golive_backup_tables() from public, anon, authenticated;
revoke all on function public.golive_backup_plan(text) from public, anon, authenticated;
revoke all on function public.golive_backup_dump(text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.golive_backup_check(text, jsonb, bigint, bigint) from public, anon, authenticated;
grant execute on function public.golive_backup_tables() to service_role;
grant execute on function public.golive_backup_plan(text) to service_role;
grant execute on function public.golive_backup_dump(text, bigint, bigint) to service_role;
grant execute on function public.golive_backup_check(text, jsonb, bigint, bigint) to service_role;
