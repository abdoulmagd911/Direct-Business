-- FIX-45 (Landing 5): SQL hygiene in partner.partners_list (diagnosis-fix45.md §5 item 6). This is hygiene, not
-- the cure — at ~38 rows the list query is milliseconds either way; it matters when the list grows, and it removes
-- the one genuine double-work in the query. Copied whole from Landing 3's 20261109000030 (FIX-31: archived_only
-- filter; FIX-01 created_at row field), with two changes only:
-- 1. `hit as materialized` — the total count and the rows no longer each recompute the lateral per-row work.
-- 2. The text search is served by trigram indexes over the folded names/number instead of a bare leading-wildcard
--    LIKE no index can serve (pg_trgm is already in the database, 20261002040000, with schema extensions — so the
--    opclass is qualified as extensions.gin_trgm_ops, as the migration runner's search_path does not include it).
-- No behaviour change: same rows, same order (trade name, id), same total.
-- Rebased 9 Nov 2026: the 5764f84 base (20260929090200) would have clobbered FIX-31's archived_only filter and
-- FIX-01's created_at row field — the merge keeps both (FIX31-01 failed on exactly this before the rebuild).
create index if not exists partner_trade_name_en_trgm
  on partner.partner using gin (norm.fold(trade_name_en) extensions.gin_trgm_ops);
create index if not exists partner_trade_name_ar_trgm
  on partner.partner using gin (norm.fold(trade_name_ar) extensions.gin_trgm_ops);
create index if not exists partner_number_trgm
  on partner.partner using gin (norm.fold(number) extensions.gin_trgm_ops);

-- The list, as Landing 3's 20261109000021 wrote it (FIX-01 created_at tie-break), plus archived_only.
-- Rebased 9 Nov 2026: the 5764f84 base would have clobbered the created_at row field — the merge keeps it.
create or replace function partner.partners_list(p_filters jsonb default '{}', p_limit int default 100, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  f jsonb := coalesce(p_filters, '{}');
  v_side text := f ->> 'side';
  me uuid;
  q text := norm.fold(f ->> 'q');
begin
  if v_side is not null and v_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = v_side;
  end if;
  if v_side is not null then
    me := authz.require(partner.side_page(v_side), 'view');
  else
    me := authz.me();
    if me is null then
      raise exception using errcode = '42501', message = 'auth.no_active_person';
    end if;
  end if;
  return (
    with base as (
      select p.*, sd.type_key, sd.tier_id as side_tier_id, sd.status, sd.owner_id
      from partner.partner p
      left join lateral (select t.key as type_key, s.tier_id, partner.status_of(p.id, s.side) as status,
                                (select x from partner.side_owners(p.id, s.side) x limit 1) as owner_id
                         from partner.partner_side s join partner.side_type t on t.id = s.type_id
                         where s.partner_id = p.id and s.side = v_side and s.deleted_at is null) sd on v_side is not null
      where p.deleted_at is null
        and case
              when coalesce((f ->> 'archived_only')::boolean, false) then p.archived_at is not null
              when coalesce((f ->> 'include_archived')::boolean, false) then true
              else p.archived_at is null
            end
        and case when v_side is not null then partner.side_on(p.id, v_side)
                 else partner.level_of(me, p.id) >= 'view' end
    ), hit as materialized (
      select b.* from base b
      where (q is null or norm.fold(b.trade_name_en) like '%' || q || '%' or norm.fold(b.trade_name_ar) like '%' || q || '%'
             or norm.fold(b.number) like '%' || q || '%')
        and (f -> 'types' is null or b.type_key in (select x from pg_catalog.jsonb_array_elements_text(f -> 'types') x))
        and (f -> 'tiers' is null or b.side_tier_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'tiers') x))
        and (f -> 'owners' is null or b.owner_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'owners') x))
        and (f -> 'statuses' is null or coalesce(b.status, 'none') in (select x from pg_catalog.jsonb_array_elements_text(f -> 'statuses') x))
        and (f -> 'priorities' is null or b.priority_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'priorities') x))
        and (f ->> 'key_partner' is null or b.key_partner = (f ->> 'key_partner')::boolean)
        and (f ->> 'stale' is null or (partner.stale_on(b.id) <= core.riyadh_today()) = (f ->> 'stale')::boolean)
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*) from hit),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', h.id, 'number', h.number, 'trade_name_en', h.trade_name_en, 'trade_name_ar', h.trade_name_ar,
          'type', h.type_key, 'status', h.status, 'owner_id', h.owner_id,
          'sides', coalesce((select pg_catalog.jsonb_agg(partner.side_json(h.id, s.side) order by s.side)
                             from partner.partner_side s where s.partner_id = h.id and s.deleted_at is null
                               and partner.side_on(h.id, s.side)
                               and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb),
          'priority_id', h.priority_id, 'key_partner', h.key_partner, 'logo_file_id', h.logo_file_id,
          'last_activity_on', partner.last_activity_on(h.id), 'flags', partner.flags(h.id, me, v_side),
          'archived', h.archived_at is not null, 'version', h.version, 'created_at', h.created_at)
          order by pg_catalog.lower(h.trade_name_en), h.id)
        from (select * from hit order by pg_catalog.lower(hit.trade_name_en), hit.id
              limit greatest(1, least(coalesce(p_limit, 100), 500)) offset greatest(coalesce(p_offset, 0), 0)) h), '[]'::jsonb)));
end
$$;
