-- Rollback of scripts/sql/phase3-r2-achievements.sql. Refuses if any proof file or moved-in achievement exists
-- (those are real work — take them out deliberately first; this never destroys them quietly).
do $g$ begin
  if exists (select 1 from storage.objects where bucket_id = 'proofs') then
    raise exception 'The proofs store holds files — remove them deliberately before rolling back'; end if;
  if exists (select 1 from public.report_entries where import_key is not null) then
    raise exception 'Achievements moved in from a browser exist — remove them deliberately before rolling back'; end if;
end $g$;
drop policy if exists proofs_read on storage.objects;
drop policy if exists proofs_write on storage.objects;
drop function if exists public.proof_entry_of(text);
delete from storage.buckets where id = 'proofs';
drop index if exists public.report_entries_import_key;
alter table public.report_entries drop column if exists import_key;
-- the levels go back to release 1: the Reports page leaves the grid of those this release gave it
update app_users set page_access = page_access - 'reports'
 where active and role in ('manager','team_member') and page_access is not null
   and page_access->>'reports' = case when role = 'manager' then 'full' else 'own' end;
create or replace function public.default_page_levels(r public.user_role)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case r
    when 'admin' then '{}'::jsonb
    -- R1 CHANGE: the manager keeps "documents" (live since Phase 1b, owner-approved); Tasks only —
    -- the Reports levels land with the report-registration release (today's Reports page lives in each browser)
    when 'manager' then '{"today":"full","leads":"full","clients":"full","finance":"full","offers":"full","documents":"full",
                          "events":"full","airlines":"full","settings":"full","activity":"full","archive":"full",
                          "tasks":"full"}'::jsonb
    when 'team_member' then '{"today":"full","leads":"full","clients":"full","finance":"full","tasks":"full"}'::jsonb
    else '{"today":"view"}'::jsonb
  end
$$;
