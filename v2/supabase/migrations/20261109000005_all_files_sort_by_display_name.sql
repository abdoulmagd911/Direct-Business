-- FIX-08 F149 — Sort = Name sorts by the name the person actually sees (the displayed file name), not the hidden
-- stored upload name. The displayed name is computed per locale, so the listing takes a locale input
-- (p_locale, 'en' | 'ar', default 'en') and orders by lower(core.file_display_name(id, p_locale)).
-- English and Arabic readers then each see A–Z order in the names shown to them. The tie-break stays
-- added_at desc, seq desc; the other sorts are untouched.
--
-- Adding a parameter changes the function signature, and CREATE OR REPLACE with a different argument list
-- would leave the old 13-argument version standing beside the new one (an overload PostgREST would refuse
-- as ambiguous) — so both functions are dropped and recreated with the new signature. Forward-only: the
-- 20261107150300 definition is not edited; this file replaces it whole, with only the locale input, the
-- locale validation and the two name-sort keys changed.
drop function if exists api.all_files(text, uuid, text, uuid, date, date, text, text, text, text, text, int, int);
drop function if exists core.all_files(text, uuid, text, uuid, date, date, text, text, text, text, text, int, int);

create or replace function core.all_files(
  p_entity text default null, p_record uuid default null, p_kind text default null,
  p_uploader uuid default null, p_from date default null, p_to date default null,
  p_purpose text default null, p_side text default null, p_status text default null,
  p_search text default null, p_sort text default 'added',
  p_limit int default 25, p_offset int default 0, p_locale text default 'en') returns jsonb
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
  if p_locale not in ('en', 'ar') then
    raise exception using errcode = 'P0001', message = 'file.unknown_locale', detail = p_locale;
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
                 order by case when p_sort = 'name' then pg_catalog.lower(core.file_display_name(b.id, p_locale)) end asc,
                          case when p_sort = 'size' then b.size_bytes end desc,
                          case when p_sort = 'added' then b.added_at end desc,
                          b.added_at desc, b.seq desc)
        from (select * from base
              order by case when p_sort = 'name' then pg_catalog.lower(core.file_display_name(id, p_locale)) end asc,
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

create function api.all_files(
  p_entity text default null, p_record uuid default null, p_kind text default null,
  p_uploader uuid default null, p_from date default null, p_to date default null,
  p_purpose text default null, p_side text default null, p_status text default null,
  p_search text default null, p_sort text default 'added',
  p_limit int default 25, p_offset int default 0, p_locale text default 'en') returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.all_files(p_entity, p_record, p_kind, p_uploader, p_from, p_to, p_purpose, p_side, p_status,
                             p_search, p_sort, p_limit, p_offset, p_locale) $$;

revoke all on function core.all_files(text, uuid, text, uuid, date, date, text, text, text, text, text, int, int, text),
  api.all_files(text, uuid, text, uuid, date, date, text, text, text, text, text, int, int, text) from public;
grant execute on function core.all_files(text, uuid, text, uuid, date, date, text, text, text, text, text, int, int, text),
  api.all_files(text, uuid, text, uuid, date, date, text, text, text, text, text, int, int, text) to authenticated;
