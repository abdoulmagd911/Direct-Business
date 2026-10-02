-- Mutant m64-policy-without-review-date: a travel policy is registered without its review date
CREATE OR REPLACE FUNCTION core.file_begin(p_entity text, p_id uuid, p_kind text, p_purpose text, p_original_name text, p_size bigint, p_mime text, p_sensitivity text DEFAULT NULL::text, p_side text DEFAULT NULL::text, p_review_on date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  e core.entity;
  k core.file_kind;
  nm text := pg_catalog.btrim(p_original_name);
  v_side text := p_side;
  b text;
  cap bigint;
  types jsonb;
  fid uuid := pg_catalog.gen_random_uuid();
  pth text;
  sens text;
  req uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_purpose is null or p_purpose not in ('evidence', 'contract', 'agreement', 'attachment', 'iban_letter', 'render',
                                            'logo', 'avatar', 'travel_policy', 'tender') then
    raise exception using errcode = 'P0001', message = 'file.unknown_purpose', detail = p_purpose;
  end if;
  if p_purpose = 'avatar' and (p_entity is distinct from 'person' or p_id is distinct from me) then
    raise exception using errcode = '42501', message = 'file.avatar_is_your_own';
  end if;
  e := core.can_see_record(p_entity, p_id);
  if v_side is not null and e.table_name <> 'partner.partner' then
    raise exception using errcode = 'P0001', message = 'file.side_only_on_organisations';
  end if;
  if p_purpose = 'travel_policy' then
    v_side := coalesce(v_side, 'client');
    if e.table_name <> 'partner.partner' or v_side <> 'client' then
      raise exception using errcode = 'P0001', message = 'file.travel_policy_is_a_clients';
    end if;
  end if;
  if p_purpose = 'avatar' then
    if e.table_name <> 'core.person' or p_id <> me then
      raise exception using errcode = '42501', message = 'file.avatar_is_your_own';
    end if;
  elsif p_purpose = 'logo' then
    if e.table_name <> 'partner.partner' or v_side is not null then
      raise exception using errcode = 'P0001', message = 'file.logo_is_an_organisations';
    end if;
    perform partner.writable(p_id);
  elsif e.table_name = 'partner.partner' then
    perform partner.side_writable(p_id, v_side);
  elsif not core.may_write(e.table_name, p_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  select * into k from core.file_kind x where x.key = p_kind and x.active and x.deleted_at is null;
  if k.id is null then
    raise exception using errcode = 'P0002', message = 'file.unknown_kind', detail = p_kind;
  end if;
  if k.review_required and p_review_on is null then
    null;
  end if;
  if nm is null or nm = '' or pg_catalog.length(nm) > 255 or nm ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'file.name_invalid';
  end if;
  nm := pg_catalog.regexp_replace(nm, '[\\/]', '-', 'g');
  b := case when p_purpose in ('logo', 'avatar') then 'images' else 'files' end;
  cap := case when b = 'images' then 2097152
              else coalesce((core.setting_at('files.max_mb', null, core.riyadh_today()) #>> '{}')::bigint, 20) * 1048576 end;
  if p_size is null or p_size <= 0 or p_size > cap then
    raise exception using errcode = 'P0001', message = 'file.too_large', detail = (cap / 1048576)::text;
  end if;
  types := case p_purpose when 'logo' then '["image/png", "image/svg+xml"]'::jsonb
                          when 'avatar' then '["image/png", "image/jpeg", "image/webp"]'::jsonb
                          else core.setting_at('files.allowed_types', null, core.riyadh_today()) end;
  if not coalesce(types ? pg_catalog.lower(p_mime), false) then
    raise exception using errcode = 'P0001', message = 'file.type_not_allowed', detail = p_mime;
  end if;
  sens := case when p_purpose = 'iban_letter' then 'restricted' else coalesce(p_sensitivity, k.sensitivity) end;
  if sens not in ('normal', 'restricted') then
    raise exception using errcode = 'P0001', message = 'file.sensitivity_invalid', detail = sens;
  end if;
  pth := pg_catalog.to_char(core.riyadh_today(), 'YYYY/MM') || '/' || fid
         || case when core.file_ext(nm) <> '' then '.' || core.file_ext(nm) else '' end;
  req := audit.begin('ui', 'file.added', pg_catalog.jsonb_build_object('kind', k.key, 'purpose', p_purpose), null);
  insert into core.file (id, bucket, path, original_name, kind_id, mime, size_bytes, sensitivity, review_on)
  values (fid, b, pth, nm, k.id, pg_catalog.lower(p_mime), p_size, sens, p_review_on);
  insert into core.file_link (file_id, entity_table, entity_id, purpose, side)
  values (fid, e.table_name, p_id, p_purpose, v_side);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', fid, 'bucket', b, 'path', pth, 'request_id', req);
end
$function$
;
