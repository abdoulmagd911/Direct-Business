-- Landing 5, FIX-46 (F026): a record's file rows name their uploader, as /files already does. Both per-record
-- file reads gain the uploader's name: core.files (tasks, achievements, notes, the discussion stream) and
-- partner.company_files (the partner Files tab). The name is the stored link name where one was written at
-- upload time, else the uploader's English display name — the same expression api.all_files already uses
-- (20261107140000), so a row reads the same name on a record as it does on /files. English only, by design:
-- core.file_person_name is the English display name, and a person's name is never translated (FIX-33 U2).
-- Additive only: one new key in each answer; no key changes, no behaviour changes.
-- Forward-only: nothing already on v2/main is edited here.

-- core.files: the per-record files list (api.files reads it). Based on the CURRENT version
-- (20261107150300, the creation-order tie-break fix — order by created_at desc, seq desc).
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
      'review_due', f.review_on <= core.riyadh_today(), 'added_by', f.created_by,
      'added_by_name', coalesce(l.added_by_name, core.file_person_name(f.created_by)),
      'added_at', f.created_at,
      'version', f.version) order by f.created_at desc, f.seq desc)
    from core.file_link l join core.file f on f.id = l.file_id join core.file_kind k on k.id = f.kind_id
    where l.entity_table = e.table_name and l.entity_id = p_id and l.deleted_at is null and f.deleted_at is null
      and (p_side is null or l.side is null or l.side = p_side) and authz.file_visible(f.id)), '[]'::jsonb);
end
$$;

-- partner.company_files: the partner files list (api.company_files reads it). Based on the CURRENT version
-- (20261107150300, the creation-order tie-break fix — it checks only that a person is signed in and lets
-- authz.file_visible guard each row; the older 20261104110000 version's authz.require('partners', 'view')
-- is gone with the renamed page and must NOT come back).
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
             'added_by', f.created_by,
             'added_by_name', coalesce(l.added_by_name, core.file_person_name(f.created_by)),
             'added_at', f.created_at)
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
