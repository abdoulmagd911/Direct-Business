-- Fix for CI run #1561 (7 Nov 2026, commit 381b7f4): the "database from zero on the Supabase
-- stack" job failed on FLS-01 — "newest first by default — expected stored, got pending".
--
-- The cause is not the stack. audit.stamp() stamps every row with pg_catalog.now(), the transaction
-- time, so all files added in one transaction share the same created_at. The three file listings
-- broke that tie with the file id — a random uuid — so the first row among files added together
-- was a coin flip (FLS-01 fails about 1 run in 12 on plain Postgres too; the stack run just lost
-- the flip). The same flip hides in the per-record list and the partner list.
--
-- The fix: core.file gains a creation sequence (the repo already uses seq bigint generated always
-- as identity for this exact purpose — pipeline stages, task comments), and the three listings
-- break ties with it, newest first. Files added in one transaction now come back in the order
-- they were uploaded, on every database. No new function, no new grant, no entity change.
-- Forward-only (V103): nothing already on v2/main is edited here.

alter table core.file add column seq bigint generated always as identity;

comment on column core.file.seq is 'The order files were added, within one transaction — the tie-break for "newest first" (FLS-01).';

-- core.all_files: the archive listing. The base now carries f.seq; both the paged inner sort and
-- the outer sort break added_at ties with it, newest first.
create or replace function core.all_files(
  p_entity text default null, p_record uuid default null, p_kind text default null,
  p_uploader uuid default null, p_from date default null, p_to date default null,
  p_purpose text default null, p_side text default null, p_status text default null,
  p_search text default null, p_sort text default 'added',
  p_limit int default 25, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  v_entity text := case p_entity
    when 'my_note' then 'my.note'
    when 'campaign_code' then 'partner.campaign_code'
    when 'finance.import_batch' then 'work.import_batch'
    else p_entity end;
  v_search text := nullif(pg_catalog.btrim(coalesce(p_search, '')), ''::text);
  v_limit int := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if v_entity is not null and v_entity not in ('work.task', 'perf.achievement', 'my.note', 'partner.partner',
                                               'work.import_batch', 'partner.campaign_code') then
    raise exception using errcode = 'P0001', message = 'file.unknown_entity', detail = p_entity;
  end if;
  if p_kind is not null and not exists (select 1 from core.file_kind k
                                        where k.key = p_kind and k.active and k.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'file.unknown_kind', detail = p_kind;
  end if;
  if p_purpose is not null and p_purpose not in ('evidence', 'contract', 'agreement', 'attachment', 'iban_letter',
                                                 'render', 'logo', 'avatar', 'travel_policy', 'tender') then
    raise exception using errcode = 'P0001', message = 'file.unknown_purpose', detail = p_purpose;
  end if;
  if p_side is not null and p_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'file.unknown_side', detail = p_side;
  end if;
  if p_status is not null and p_status not in ('pending', 'stored') then
    raise exception using errcode = 'P0001', message = 'file.unknown_status', detail = p_status;
  end if;
  if p_sort not in ('added', 'name', 'size') then
    raise exception using errcode = 'P0001', message = 'file.unknown_sort', detail = p_sort;
  end if;
  return (
    with base as (
      select l.id as link_id, l.entity_table, l.entity_id, l.purpose, l.side,
             l.record_label, l.record_link, l.added_by_name,
             f.id, f.seq, f.original_name, f.mime, f.size_bytes, f.sensitivity, f.status, f.review_on,
             f.created_by as added_by, f.created_at as added_at,
             k.key as kind, k.name_en as kind_en, k.name_ar as kind_ar
      from core.file_link l
      join core.file f on f.id = l.file_id
      join core.file_kind k on k.id = f.kind_id
      where l.deleted_at is null and f.deleted_at is null
        and authz.file_visible(f.id)
        and (v_entity is null or l.entity_table = v_entity)
        and (p_record is null or l.entity_id = p_record)
        and (p_kind is null or k.key = p_kind)
        and (p_uploader is null or f.created_by = p_uploader)
        and (p_from is null or core.riyadh_day(f.created_at) >= p_from)
        and (p_to is null or core.riyadh_day(f.created_at) <= p_to)
        and (p_purpose is null or l.purpose = p_purpose)
        and (p_side is null or l.side = p_side)
        and (p_status is null or f.status = p_status)
        and (v_search is null
             or pg_catalog.strpos(pg_catalog.lower(f.original_name), pg_catalog.lower(v_search)) > 0
             or pg_catalog.strpos(pg_catalog.lower(coalesce(l.record_label, '')),
                                  pg_catalog.lower(v_search)) > 0
             or pg_catalog.strpos(pg_catalog.lower(core.file_display_name(f.id, 'en')),
                                  pg_catalog.lower(v_search)) > 0
             or pg_catalog.strpos(pg_catalog.lower(coalesce(core.file_display_name(f.id, 'ar'), '')),
                                  pg_catalog.lower(v_search)) > 0)
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*)::int from base),
      'rows', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                 'id', b.id, 'link_id', b.link_id,
                 'display_name', core.file_display_name(b.id, 'en'),
                 'display_name_ar', core.file_display_name(b.id, 'ar'),
                 'original_name', b.original_name,
                 'kind', b.kind, 'kind_en', b.kind_en, 'kind_ar', b.kind_ar,
                 'purpose', b.purpose, 'side', b.side,
                 'size', b.size_bytes, 'sensitivity', b.sensitivity, 'status', b.status,
                 'review_on', b.review_on,
                 'added_by', b.added_by,
                 'added_by_name', coalesce(b.added_by_name, core.file_person_name(b.added_by)),
                 'added_at', b.added_at,
                 'record_label', coalesce(b.record_label,
                   (core.file_record_label(b.entity_table, b.entity_id) ->> 'label')),
                 'record_link', coalesce(b.record_link,
                   (core.file_record_label(b.entity_table, b.entity_id) ->> 'link')),
                 'entity_table', b.entity_table, 'entity_id', b.entity_id)
                 order by case when p_sort = 'name' then pg_catalog.lower(b.original_name) end asc,
                          case when p_sort = 'size' then b.size_bytes end desc,
                          case when p_sort = 'added' then b.added_at end desc,
                          b.added_at desc, b.seq desc)
        from (select * from base
              order by case when p_sort = 'name' then pg_catalog.lower(original_name) end asc,
                       case when p_sort = 'size' then size_bytes end desc,
                       case when p_sort = 'added' then added_at end desc,
                       added_at desc, seq desc
              limit v_limit offset v_offset) b), '[]'::jsonb),
      'facets', pg_catalog.jsonb_build_object(
        'sides', coalesce((select pg_catalog.jsonb_agg(s.side order by s.side)
                                      from (select distinct side from base where side is not null) s), '[]'::jsonb),
        'purposes', coalesce((select pg_catalog.jsonb_agg(s.purpose order by s.purpose)
                                         from (select distinct purpose from base) s), '[]'::jsonb),
        'statuses', coalesce((select pg_catalog.jsonb_agg(s.status order by s.status)
                                         from (select distinct status from base) s), '[]'::jsonb)),
      'uploaders', coalesce((select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('id', u.added_by, 'name',
            coalesce(u.added_by_name, core.file_person_name(u.added_by)))
          order by coalesce(u.added_by_name, core.file_person_name(u.added_by)))
        from (select distinct added_by, added_by_name from base) u), '[]'::jsonb))
  );
end
$$;

-- core.files: the per-record files list (api.files reads it). Same tie-break fix.
create or replace function core.files(p_entity text, p_id uuid, p_side text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  keep boolean := coalesce((core.setting_at('core.file_keep_original_name', null, core.riyadh_today()) #>> '{}')::boolean, true);
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', f.id, 'link_id', l.id, 'kind', k.key, 'kind_en', k.name_en, 'kind_ar', k.name_ar, 'purpose', l.purpose,
      'side', l.side, 'display_name_en', core.file_display_name(f.id, 'en'),
      'display_name_ar', core.file_display_name(f.id, 'ar'),
      'original_name', case when keep then f.original_name end, 'mime', f.mime, 'size_bytes', f.size_bytes,
      'sensitivity', f.sensitivity, 'status', f.status, 'review_on', f.review_on,
      'review_due', f.review_on <= core.riyadh_today(), 'added_by', f.created_by, 'added_at', f.created_at,
      'version', f.version) order by f.created_at desc, f.seq desc)
    from core.file_link l join core.file f on f.id = l.file_id join core.file_kind k on k.id = f.kind_id
    where l.entity_table = e.table_name and l.entity_id = p_id and l.deleted_at is null and f.deleted_at is null
      and (p_side is null or l.side is null or l.side = p_side) and authz.file_visible(f.id)), '[]'::jsonb);
end
$$;

-- partner.company_files: the partner files list (api.company_files reads it). Same tie-break fix.
-- Based on the CURRENT version (20261104234000, the page-gate fix — it checks only that a person
-- is signed in and lets authz.file_visible guard each row; the older 20261104110000 version's
-- authz.require('partners', 'view') is gone with the renamed page and must NOT come back).
create or replace function partner.company_files(p_partner uuid default null, p_kind text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if authz.me() is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', f.id, 'link_id', l.id, 'partner_id', p.id, 'partner_name', p.trade_name_en,
             'partner_name_ar', p.trade_name_ar, 'kind', k.key, 'kind_en', k.name_en, 'kind_ar', k.name_ar,
             'purpose', l.purpose, 'side', l.side,
             'display_name_en', core.file_display_name(f.id, 'en'),
             'display_name_ar', core.file_display_name(f.id, 'ar'),
             'original_name', f.original_name, 'mime', f.mime, 'size_bytes', f.size_bytes,
             'sensitivity', f.sensitivity, 'status', f.status,
             'added_by', f.created_by, 'added_at', f.created_at)
             order by p.trade_name_en, f.created_at desc, f.seq desc)
    from core.file_link l
    join core.file f on f.id = l.file_id
    join core.file_kind k on k.id = f.kind_id
    join partner.partner p on p.id = l.entity_id
    where l.entity_table = 'partner.partner' and l.deleted_at is null and f.deleted_at is null
      and p.deleted_at is null and authz.file_visible(f.id)
      and (p_partner is null or l.entity_id = p_partner)
      and (p_kind is null or k.key = p_kind)), '[]'::jsonb);
end
$$;
