-- FIX-04 (F157): a discount code's files are the codes page's, not the client page's. The /codes page asked for the
-- code's files with entity 'campaign_code' and the code's identifier id — but 'campaign_code' is the short-trial
-- code table (partner.campaign_code), which never holds a discount-code identifier, so core.can_see_record raised
-- common.not_found for every code, every role, and retry could never recover. The upload was broken by the same
-- cause (core.file_begin starts with the same call).
--
-- The fix is the 'identifier' entity (the id IS a partner.identifier row) plus a codes-level carve-out in the two
-- shared gates, because the identifier's own rule keys on the CLIENTS page: row_level for a discount_code
-- identifier is the reader's level on the partner's client side, and may_write wants that level 'full' (or 'own'
-- plus owner). The person on /codes is there by their CODES level, not their clients level — so the identifier
-- rule would trade not_found for a needs_level refusal for any reader without a clients level, and would refuse
-- the upload to a Full-codes reader without a Full clients level. The carve-out below accepts the codes level
-- instead, for discount-code identifiers only:
--   * core.can_see_record: a discount_code identifier is visible to a reader with codes >= 'view'.
--   * core.may_write: a discount_code identifier is writable by a reader with codes = 'full' (the upload is
--     gated on Full in the UI).
-- Both are additive (an OR before the existing rule): every other entity, and every non-discount_code identifier,
-- behaves exactly as before, and the clients-level path for a code still applies. No signature changes, so the
-- grants and the generated types are untouched. Forward-only (V103): nothing already on v2/main is edited here.
-- Regression test: CODE-03 (supabase/tests/codes/).
-- Frontend: page.tsx and CodesScreen.tsx pass entity 'identifier' instead of 'campaign_code' for the code's files.

-- core.can_see_record as P3-6b wrote it (20260929062000), plus the discount-code carve-out.
create or replace function core.can_see_record(p_entity text, p_id uuid) returns core.entity
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  e core.entity;
  found boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into e from core.entity where key = p_entity and active;
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'history.unknown_entity', detail = p_entity;
  end if;
  execute pg_catalog.format('select exists (select 1 from %s t where t.id = $1)', pg_catalog.to_regclass(e.table_name))
    into found using p_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  -- A discount code's files are the codes page's (F157): a reader with the codes level sees the code even when
  -- they have no level on the partner the code belongs to. Added acceptance, not a replacement — the rule below
  -- still applies.
  if e.table_name = 'partner.identifier'
     and exists (select 1 from partner.identifier i where i.id = p_id and i.kind = 'discount_code')
     and authz.level_of(me, 'codes') >= 'view' then
    return e;
  end if;
  if not authz.can_see_as(me, e.table_name, p_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'view')::text;
  end if;
  return e;
end
$$;

-- core.may_write as 20260929090200 wrote it, plus the discount-code carve-out.
create or replace function core.may_write(p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  e core.entity;
  lv core.level;
begin
  select * into e from core.entity where table_name = p_table and active;
  if me is null or e.id is null then
    return false;
  end if;
  if authz.is_admin() then
    return true;
  end if;
  -- A discount code's files are the codes page's: only a Full codes reader may change them (the upload is gated
  -- on Full in the UI). Added acceptance, not a replacement — the rule below still applies.
  if p_table = 'partner.identifier'
     and exists (select 1 from partner.identifier i where i.id = p_id and i.kind = 'discount_code')
     and authz.level_of(me, 'codes') = 'full' then
    return true;
  end if;
  lv := case when e.page_key is null and e.level is null then 'own'::core.level
             else authz.record_level(me, p_table, p_id) end;
  return lv = 'full' or (lv >= 'own' and me = any (core.owners_of(p_table, p_id)));
end
$$;
