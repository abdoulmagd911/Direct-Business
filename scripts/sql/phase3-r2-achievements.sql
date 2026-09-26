-- Phase 3 release 2 — achievements + proofs (2026-09-26). Builds on release 1, which already created the
-- tables (report_entries, evidence_files, reports, report_categories, periods, objectives, kpi_definitions),
-- their row rules, the month lock, the "credit is never decided by a helper" guard and the task → achievement
-- trigger. Held back in release 1 on purpose: the Reports page levels, because the Reports page still kept its
-- achievements in each browser. This release moves them into the database, so the levels land now.
--
--   1. Reports page levels (design 29a, as written): employees Own work, managers Full control. Nothing else in
--      anyone's grid changes (measured before/after on live). New people get the same through default_page_levels.
--      Quality / Strategy / Integrity get View (D3) when they are placed in those departments — nobody is yet.
--   2. report_entries.import_key — the browser record's own id, so moving a browser's achievements into the
--      database is safe to press twice (the second press adds nothing).
--   3. The private file store for proofs: bucket "proofs", objects at proofs/<achievement id>/<file>. Seen by
--      anyone who can see the Reports page; added only by someone who may edit that achievement; never
--      overwritten or deleted (a proof is removed by evidence_files.deleted_at, which keeps it in history).
-- Rollback: scripts/sql/phase3-r2-achievements.rollback.sql

-- 1. levels
create or replace function public.default_page_levels(r public.user_role)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case r
    when 'admin' then '{}'::jsonb
    when 'manager' then '{"today":"full","leads":"full","clients":"full","finance":"full","offers":"full","documents":"full",
                          "events":"full","airlines":"full","settings":"full","activity":"full","archive":"full",
                          "tasks":"full","reports":"full"}'::jsonb
    when 'team_member' then '{"today":"full","leads":"full","clients":"full","finance":"full","tasks":"full","reports":"own"}'::jsonb
    else '{"today":"view"}'::jsonb
  end
$$;
update app_users set page_access = page_access
     || jsonb_build_object('reports', case when role = 'manager' then 'full' else 'own' end)
 where active and role in ('manager','team_member') and page_access is not null and not (page_access ? 'reports');

-- 2. moving a browser's achievements in, once
alter table public.report_entries add column if not exists import_key text;
create unique index if not exists report_entries_import_key on public.report_entries (import_key) where import_key is not null;

-- 3. proofs
insert into storage.buckets (id, name, public, file_size_limit)
values ('proofs', 'proofs', false, 26214400)
on conflict (id) do nothing;

-- the achievement an object belongs to, read from its path (proofs/<uuid>/...); anything else → null
create or replace function public.proof_entry_of(object_name text) returns uuid
language plpgsql immutable set search_path to 'public' as $$
declare p text[] := string_to_array(object_name, '/');
begin
  if array_length(p, 1) < 3 or p[1] <> 'proofs' then return null; end if;
  return p[2]::uuid;
exception when others then return null;
end $$;

drop policy if exists proofs_read on storage.objects;
drop policy if exists proofs_write on storage.objects;
create policy proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and public.can_see_page('reports'));
create policy proofs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and public.proof_entry_of(name) is not null
              and (public.can_edit_page('reports')
                   or (public.can_work('reports') and public.can_edit_entry_id(public.proof_entry_of(name)))));

revoke all on function public.proof_entry_of(text) from public, anon;
grant execute on function public.proof_entry_of(text) to authenticated;
