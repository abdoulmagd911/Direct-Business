-- FIX-31 — a partner can be removed (with a reason, to Recently Deleted, restorable) and archived / un-archived
-- (F098, F103, F130). Remove is a soft delete: the row stays, its linked records stay linked and were never deleted,
-- so restoring the partner restores the whole thing (cascade restore, D31). Archive is a flag, not a delete: an
-- archived partner is read-only (partner.writable already refuses it) and leaves the active list. The list gains an
-- archived_only filter — the archived view shows only archived partners — alongside the existing include_archived
-- (active + archived mixed), which other callers still use. One request, one Undo each.

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
    ), hit as (
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

-- Remove a partner (Full on the record's sides — partner.require_level, the gate partner.writable uses; the legacy
-- 'partners' page level is dead, so authz.require('partners', 'full') refuses everyone but an admin): a soft delete
-- with a reason, so it lands in Recently Deleted and restores. An archived partner can be removed too — the archived
-- view is where it is found. Linked records stay linked.
create function partner.partner_remove(p_id uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  req uuid;
  k int;
begin
  if not exists (select 1 from partner.partner where id = p_id and deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.require_level(p_id, null, 'full');
  req := audit.begin('ui', 'partner.removed', pg_catalog.jsonb_build_object('id', p_id), p_reason);
  update partner.partner set deleted_at = core.clock(), deleted_by = authz.me(), delete_reason = p_reason
    where id = p_id;
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- Archive a partner (Full on Partners): a flag, not a delete. partner.writable already refuses an archived partner,
-- so archiving one twice is refused with partner.archived.
create function partner.partner_archive(p_id uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  req uuid;
begin
  perform partner.writable(p_id);
  req := audit.begin('ui', 'partner.archived', pg_catalog.jsonb_build_object('id', p_id), p_reason);
  update partner.partner set archived_at = core.clock() where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('request_id', req);
end
$$;

-- Un-archive a partner (Full on the record's sides): clears the flag. A partner that is not archived is refused.
create function partner.partner_unarchive(p_id uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  req uuid;
begin
  if not exists (select 1 from partner.partner where id = p_id and deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.require_level(p_id, null, 'full');
  if not exists (select 1 from partner.partner where id = p_id and archived_at is not null) then
    raise exception using errcode = 'P0001', message = 'partner.not_archived';
  end if;
  req := audit.begin('ui', 'partner.unarchived', pg_catalog.jsonb_build_object('id', p_id), p_reason);
  update partner.partner set archived_at = null where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('request_id', req);
end
$$;

create function api.partner_remove(p_id uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.partner_remove(p_id, p_reason) $$;
create function api.partner_archive(p_id uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.partner_archive(p_id, p_reason) $$;
create function api.partner_unarchive(p_id uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.partner_unarchive(p_id, p_reason) $$;

grant execute on function api.partner_remove(uuid, text), api.partner_archive(uuid, text),
  api.partner_unarchive(uuid, text) to authenticated;
-- The api wrappers are security invoker, so the inner functions need their own execute grant (as partner_create has).
grant execute on function partner.partner_remove(uuid, text), partner.partner_archive(uuid, text),
  partner.partner_unarchive(uuid, text) to authenticated;
