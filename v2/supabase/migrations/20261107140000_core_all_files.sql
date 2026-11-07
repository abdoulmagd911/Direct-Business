-- Phase 3 (lifecycle gaps) — generic files: the all-files listing (3.2).
--
-- What is new here:
--   * core.file_link carries the per-row label, link target and uploader display name, precomputed at write
--     time (a BEFORE INSERT trigger fills them from the record the file is linked to) and refreshed when the
--     record is renamed (an AFTER UPDATE trigger on each record table). A rename updates the stored label, so
--     the archive never reads a stale name, and the listing never has to join six record tables to name a row.
--   * core.all_files (wrapper api.all_files) lists core.file_link across entity tables — not just
--     partner.partner — with the filters the archive needs, visibility applied before paging and before the
--     total count. api.company_files is untouched.
--   * the real import_file kind, seeded here (Phase 4.5 stores an import's source file under it). Its
--     sensitivity is restricted, so an import source file starts restricted.
--   * file_download already refuses a file whose parent record the reader can no longer see: it asks
--     authz.file_visible, which asks core.file_visible_as, which asks authz.can_see_as on the linked record —
--     so a download URL made while the record was visible stops working once it is not. No change was needed
--     there; FLS-01 proves it (a helper taken off a task loses the download).
--
-- p_entity takes an entity table: work.task, perf.achievement, my.note, partner.partner, work.import_batch,
-- partner.campaign_code. Two spellings from the spec are accepted as aliases: my_note (the entity key),
-- campaign_code (the entity key) and finance.import_batch (the spec's name for the import batch, whose live
-- table is work.import_batch). Anything else is refused.
-- Forward-only (V103): nothing already on v2/main is edited here.

-- ================================================================ the stored per-row label
alter table core.file_link add column if not exists record_label text;
alter table core.file_link add column if not exists record_link text;
alter table core.file_link add column if not exists added_by_name text;

-- The label and link target for a record: a task's number and title, an achievement's number and title, a
-- note's title (or its first words), a partner's number and trade name, an import batch's file name, a
-- discount code's code. Null where the table is none of those.
create function core.file_record_label(p_table text, p_id uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case p_table
    when 'work.task' then
      (select pg_catalog.jsonb_build_object('label', t.number || ' · ' || t.title,
                                            'link', '/tasks/' || t.number)
       from work.task t where t.id = p_id)
    when 'perf.achievement' then
      (select pg_catalog.jsonb_build_object('label', a.number || ' · ' || a.title,
                                            'link', '/kpis/achievements/' || a.id::text)
       from perf.achievement a where a.id = p_id)
    when 'my.note' then
      (select pg_catalog.jsonb_build_object('label', pg_catalog.left(coalesce(n.title, n.body, ''::text), 120),
                                            'link', '/my-day/notes/' || n.id::text)
       from my.note n where n.id = p_id)
    when 'partner.partner' then
      (select pg_catalog.jsonb_build_object('label', p.number || ' · ' || p.trade_name_en,
                                            'link', '/partners/' || p.id::text)
       from partner.partner p where p.id = p_id)
    when 'work.import_batch' then
      (select pg_catalog.jsonb_build_object('label', b.file_name, 'link', '/finance')
       from work.import_batch b where b.id = p_id)
    when 'partner.campaign_code' then
      (select pg_catalog.jsonb_build_object('label', c.code_raw, 'link', '/codes')
       from partner.campaign_code c where c.id = p_id)
    else null end
$$;

-- The name a person is shown under, in English (the profile's display name, else nickname, else full name).
create function core.file_person_name(p_person uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(pr.display_name_en, p.nickname_en, p.full_name_en)
  from core.person p left join core.person_profile pr on pr.person_id = p.id
  where p.id = p_person
$$;

-- At write time: the label, the link and the uploader's name go on the link row. Also when a merge moves a
-- link to another record (entity_table / entity_id change), the label follows the new record.
create function core.file_link_label_fill() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  lab jsonb := core.file_record_label(new.entity_table, new.entity_id);
begin
  new.record_label := lab ->> 'label';
  new.record_link := lab ->> 'link';
  if tg_op = 'INSERT' then
    new.added_by_name := core.file_person_name(authz.me());
  end if;
  return new;
end
$$;
create trigger label_fill_insert before insert on core.file_link
  for each row execute function core.file_link_label_fill();
create trigger label_fill_on_move before update of entity_table, entity_id on core.file_link
  for each row execute function core.file_link_label_fill();

-- A rename updates the stored label: when a record's naming columns change, every live link to it is
-- re-labelled from the record as it now reads.
create function core.file_link_refresh_labels() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  tbl text := tg_table_schema || '.' || tg_table_name;
  lab jsonb := core.file_record_label(tbl, new.id);
begin
  update core.file_link l
  set record_label = lab ->> 'label', record_link = lab ->> 'link'
  where l.entity_table = tbl and l.entity_id = new.id and l.deleted_at is null;
  return new;
end
$$;
create trigger refresh_file_labels after update of number, title on work.task
  for each row execute function core.file_link_refresh_labels();
create trigger refresh_file_labels after update of number, title on perf.achievement
  for each row execute function core.file_link_refresh_labels();
create trigger refresh_file_labels after update of title, body on my.note
  for each row execute function core.file_link_refresh_labels();
create trigger refresh_file_labels after update of number, trade_name_en, trade_name_ar on partner.partner
  for each row execute function core.file_link_refresh_labels();
create trigger refresh_file_labels after update of file_name on work.import_batch
  for each row execute function core.file_link_refresh_labels();
create trigger refresh_file_labels after update of code_raw, name on partner.campaign_code
  for each row execute function core.file_link_refresh_labels();

-- Rows written before this build carry no stored label; label them from their records as they now read.
update core.file_link l
set record_label = (core.file_record_label(l.entity_table, l.entity_id) ->> 'label'),
    record_link = (core.file_record_label(l.entity_table, l.entity_id) ->> 'link'),
    added_by_name = coalesce(l.added_by_name, core.file_person_name(l.created_by))
where l.record_label is null;

-- ================================================================ the real import_file kind
insert into core.file_kind (key, name_en, name_ar, name_pattern_en, name_pattern_ar, sensitivity, review_required, sort)
values ('import_file', 'Import file', 'ملف الاستيراد', '{original}', '{original}', 'restricted', false, 85)
on conflict (key) do nothing;

-- ================================================================ the all-files listing
-- Every file link the reader may see, across record types: the filters the archive needs, the total count of
-- the filtered set (visibility applied before paging and before the count), and the live filter options — the
-- sides, purposes and statuses on the filtered set, and the people who uploaded them. Search looks at the
-- original name, the shown name in both languages, and the stored per-row record label. Sort: added date
-- (default, newest first), name, size.
create function core.all_files(
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
             f.id, f.original_name, f.mime, f.size_bytes, f.sensitivity, f.status, f.review_on,
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
                          b.added_at desc, b.id)
        from (select * from base
              order by case when p_sort = 'name' then pg_catalog.lower(original_name) end asc,
                       case when p_sort = 'size' then size_bytes end desc,
                       case when p_sort = 'added' then added_at end desc,
                       added_at desc, id
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
  p_limit int default 25, p_offset int default 0) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.all_files(p_entity, p_record, p_kind, p_uploader, p_from, p_to, p_purpose, p_side, p_status,
                             p_search, p_sort, p_limit, p_offset) $$;

revoke all on function core.file_record_label(text, uuid), core.file_person_name(uuid),
  core.file_link_label_fill(), core.file_link_refresh_labels() from public;
revoke all on function core.all_files(text, uuid, text, uuid, date, date, text, text, text, text, text, int, int),
  api.all_files(text, uuid, text, uuid, date, date, text, text, text, text, text, int, int) from public;
grant execute on function core.all_files(text, uuid, text, uuid, date, date, text, text, text, text, text, int, int),
  api.all_files(text, uuid, text, uuid, date, date, text, text, text, text, text, int, int) to authenticated;
