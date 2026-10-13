-- P3-8c (part 1) · a client ID's lifecycle and what an identifier counts for (the Scout's review: V411, V421, V422,
-- V434; OLD-029). A Payments client ID gets a close date: closed, it still matches rows dated on or before it and only
-- later rows stop (V411). An organisation holds at most the setting partner.open_client_ids of each kind without a
-- close date — one prepaid and one postpaid by default, tender IDs unlimited and never collapsed (V422, V434); an ID
-- given a close date no longer counts, so its successor may be added before the day. Names only suggest a money match;
-- typed identifiers match (V421) — partner.money_match is the one answer the matcher (P4-3) asks. A merge that would
-- leave two open IDs of a limited kind closes the moved one with a note, and its Undo reopens it (OLD-029).
-- Forward-only.

alter table partner.identifier add column closed_on date;
alter table partner.identifier add constraint identifier_closed_client_id
  check (closed_on is null or kind = 'payments_client_id');
comment on column partner.identifier.closed_on is
  'A Payments client ID''s close date (V411): it still matches rows dated on or before it; later rows stop.';

-- ================================================================ how many may be open (V422, V434)
-- The limit for a kind of client ID: partner.open_client_ids, in force today; a kind left out is unlimited (tender, by
-- default).
create function partner.open_client_id_limit(p_subkind text) returns int
language sql stable security definer set search_path = ''
as $$
  select case when p_subkind is null then null
              else (core.setting_at('partner.open_client_ids', null, core.riyadh_today()) ->> p_subkind)::int end
$$;

-- Whether an organisation already holds as many client IDs of a kind without a close date as it may.
create function partner.client_id_at_limit(p_partner uuid, p_subkind text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select partner.open_client_id_limit(p_subkind) is not null
     and (select pg_catalog.count(*) from partner.identifier i
          where i.partner_id = p_partner and i.kind = 'payments_client_id' and i.subkind = p_subkind
            and i.closed_on is null and i.deleted_at is null) >= partner.open_client_id_limit(p_subkind)
$$;

-- Whatever writes it — adding, reopening, an Undo, a merge, an import — a client ID left without a close date beyond
-- its kind's limit is refused.
create function partner.open_client_id_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind = 'payments_client_id' and new.subkind is not null and new.closed_on is null and new.deleted_at is null
     and (tg_op = 'INSERT' or old.closed_on is not null or old.deleted_at is not null
          or old.subkind is distinct from new.subkind or old.partner_id <> new.partner_id) then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('partner.client_ids:' || new.partner_id::text));
    if partner.client_id_at_limit(new.partner_id, new.subkind) then
      raise exception using errcode = 'P0001', message = 'identifier.open_client_id_limit', detail = new.subkind;
    end if;
  end if;
  return new;
end
$$;
create trigger open_client_ids before insert or update on partner.identifier
  for each row execute function partner.open_client_id_guard();

-- ================================================================ what an identifier counts for (V411, V421)
-- For a money row of a day: 'match' — a typed identifier (a client ID up to its close date, a code within its dates, a
-- VAT, CR, email, phone or typed alias); 'suggest' — an official or trade name, which only suggests one in Needs a
-- decision; null — removed, closed before the day, or a code outside its dates.
create function partner.money_match(i partner.identifier, p_day date) returns text
language sql stable set search_path = ''
as $$
  select case when i.deleted_at is not null then null
              when i.closed_on is not null and p_day > i.closed_on then null
              when i.kind = 'discount_code'
                   and not pg_catalog.daterange(i.valid_from, i.valid_to, '[]') @> p_day then null
              when i.kind = 'name' and i.subkind is distinct from 'alias' then 'suggest'
              else 'match' end
$$;

revoke all on function partner.open_client_id_limit(text), partner.client_id_at_limit(uuid, text),
  partner.money_match(partner.identifier, date) from public;

-- ================================================================ closing and reopening a client ID
-- The Client side writable by the caller and clients.identify, as adding one; with a reason. A close date may be past
-- or to come. Reopening is refused while the kind is at its limit.
create function partner.client_id_close(p_id uuid, p_closed_on date, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  i partner.identifier;
  why text;
  req uuid;
begin
  select * into i from partner.identifier where id = p_id and deleted_at is null;
  if i.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.side_writable(i.partner_id, 'client');
  perform partner.require_cap(i.partner_id, 'client', 'identify');
  why := core.access_reason(p_reason);
  if i.kind <> 'payments_client_id' then
    raise exception using errcode = 'P0001', message = 'identifier.not_client_id';
  end if;
  if p_closed_on is null then
    raise exception using errcode = 'P0001', message = 'identifier.close_date_required';
  end if;
  req := audit.begin('ui', 'identifier.closed', pg_catalog.jsonb_build_object('value', i.value_raw, 'on', p_closed_on), why);
  update partner.identifier set closed_on = p_closed_on where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

create function partner.client_id_reopen(p_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  i partner.identifier;
  why text;
  req uuid;
begin
  select * into i from partner.identifier where id = p_id and deleted_at is null;
  if i.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.side_writable(i.partner_id, 'client');
  perform partner.require_cap(i.partner_id, 'client', 'identify');
  why := core.access_reason(p_reason);
  if i.closed_on is null then
    raise exception using errcode = 'P0001', message = 'identifier.not_closed';
  end if;
  req := audit.begin('ui', 'identifier.reopened', pg_catalog.jsonb_build_object('value', i.value_raw), why);
  update partner.identifier set closed_on = null where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- ================================================================ the card shows it
-- partner.partner_get as P3-8b-3 left it, each identifier with its close date, whether it is open today, and whether
-- it matches money or only suggests (V411, V421).
create or replace function partner.partner_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  p partner.partner;
  sees_client boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into p from partner.partner where id = p_id and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.require_level(p_id, null, 'view');
  sees_client := authz.level_of(me, 'clients') >= 'view';
  return pg_catalog.to_jsonb(p) - array['deleted_at', 'deleted_by', 'delete_reason'] || pg_catalog.jsonb_build_object(
    'sides', coalesce((select pg_catalog.jsonb_agg(partner.side_json(p.id, s.side) || pg_catalog.jsonb_build_object(
        'status_history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', c.id, 'status', c.status, 'effective_on', c.effective_on, 'reason_id', c.reason_id, 'note', c.note,
            'set_by', c.created_by, 'set_at', c.created_at) order by c.effective_on desc, c.created_at desc)
          from partner.side_status_change c where c.partner_id = p.id and c.side = s.side and c.deleted_at is null), '[]'::jsonb),
        'owners', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', m.id, 'person_id', m.person_id, 'from', m.effective_from, 'to', m.effective_to, 'reason', m.reason)
            order by m.effective_from desc)
          from partner.side_owner m where m.partner_id = p.id and m.side = s.side and m.deleted_at is null), '[]'::jsonb))
        order by s.side)
      from partner.partner_side s where s.partner_id = p.id and s.deleted_at is null
        and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb),
    'identifiers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'subkind', i.subkind, 'value', i.value_raw, 'valid_from', i.valid_from,
        'valid_to', i.valid_to, 'closed_on', i.closed_on,
        'open', i.kind <> 'payments_client_id' or i.closed_on is null or i.closed_on >= core.riyadh_today(),
        'money', case when i.kind = 'name' and i.subkind is distinct from 'alias' then 'suggest' else 'match' end,
        'source', i.source, 'reason', i.reason, 'added_by', i.created_by, 'added_at', i.created_at)
        order by i.kind, i.created_at)
      from partner.identifier i where i.partner_id = p.id and i.deleted_at is null
        and (sees_client or i.kind not in ('payments_client_id', 'discount_code'))), '[]'::jsonb),
    'owner_id', partner.owner_seen_by(p.id, me),
    'contacts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) - array['deleted_at', 'deleted_by',
        'delete_reason', 'created_by', 'updated_by'] order by c.is_primary desc, c.name_en)
      from partner.contact c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb),
    'credit_limits', case when sees_client and authz.level_of(me, 'finance') >= 'view' then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', c.id, 'amount_sar', c.amount_sar, 'prepaid_only', c.amount_sar = 0, 'effective_from', c.effective_from,
          'approved_by', c.approved_by, 'reason', c.reason) order by c.effective_from desc)
        from partner.credit_limit c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb) end,
    'references', partner.references(p.id),
    'last_activity_on', partner.last_activity_on(p.id),
    'stale_on', partner.stale_on(p.id),
    'next_step', (select pg_catalog.jsonb_build_object('note_id', n.id, 'text', n.next_step, 'on', n.next_step_on)
                  from core.note n
                  where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'activity'
                    and n.deleted_at is null and n.next_step_on >= core.riyadh_today()
                  order by n.next_step_on, n.logged_at limit 1),
    'flags', partner.flags(p.id, me),
    'counts', pg_catalog.jsonb_build_object(
      'contracts', (select pg_catalog.count(*) from partner.contract c where c.partner_id = p.id and c.deleted_at is null
                      and partner.sees_side(me, p.id, c.side)),
      'files', (select pg_catalog.count(*) from core.file_link l join core.file f on f.id = l.file_id
                where l.entity_table = 'partner.partner' and l.entity_id = p.id and l.deleted_at is null
                  and f.deleted_at is null and l.purpose <> 'logo' and authz.file_visible(f.id)),
      'notes', (select pg_catalog.count(*) from core.note n
                where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.deleted_at is null)));
end
$$;

-- ================================================================ a merge keeps the limit (OLD-029)
-- partner.partner_merge as P3-8b-2 left it: a moved client ID that would be one too many of its kind on the kept
-- organisation arrives closed today with a note; Undo of the merge brings back the merged organisation's own, open.
create or replace function partner.partner_merge(p_kept uuid, p_merged uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  kept partner.partner := partner.writable(p_kept);
  gone partner.partner := partner.writable(p_merged);
  me uuid := partner.require_cap(p_kept, null, 'merge');
  why text := core.access_reason(p_reason);
  i partner.identifier;
  s partner.partner_side;
  st text;
  shut boolean;
  req uuid;
begin
  if p_kept = p_merged then
    raise exception using errcode = 'P0001', message = 'partner.merge_itself';
  end if;
  req := audit.begin('ui', 'partner.merged', pg_catalog.jsonb_build_object('kept', kept.number, 'merged', gone.number), why);
  insert into partner.merge (kept_id, merged_id, reason, request_id) values (p_kept, p_merged, why, req);
  for s in select * from partner.partner_side x where x.partner_id = p_merged and x.deleted_at is null loop
    continue when exists (select 1 from partner.partner_side y where y.partner_id = p_kept and y.side = s.side
                          and y.deleted_at is null);
    insert into partner.partner_side (partner_id, side, type_id, tier_id, field_values, since, until)
    values (p_kept, s.side, s.type_id, s.tier_id, s.field_values, s.since, s.until);
    perform partner.side_owner_set_inner(p_kept, s.side, (select x from partner.side_owners(p_merged, s.side) x limit 1),
                                         core.riyadh_today(), why);
    st := partner.status_of(p_merged, s.side);
    if st is not null then
      insert into partner.side_status_change (partner_id, side, status, effective_on, reason_id, note)
      select p_kept, s.side, c.status, core.riyadh_today(), c.reason_id, 'merged from ' || gone.number
      from partner.side_status_change c where c.partner_id = p_merged and c.side = s.side and c.deleted_at is null
        and c.effective_on <= core.riyadh_today()
      order by c.effective_on desc, c.created_at desc limit 1;
    end if;
  end loop;
  for i in select * from partner.identifier x where x.partner_id = p_merged and x.deleted_at is null order by x.created_at loop
    update partner.identifier set deleted_at = core.clock(), deleted_by = me,
                                  delete_reason = 'merged into ' || kept.number
    where id = i.id;
    if not exists (select 1 from partner.identifier x where x.partner_id = p_kept and x.kind = i.kind
                   and x.value_key = i.value_key and x.deleted_at is null) then
      shut := i.kind = 'payments_client_id' and i.closed_on is null and partner.client_id_at_limit(p_kept, i.subkind);
      insert into partner.identifier (partner_id, kind, subkind, value_raw, value_key, norm_version, reason, source,
                                      valid_from, valid_to, note, closed_on)
      values (p_kept, i.kind, case when i.kind = 'name' then 'alias' else i.subkind end, i.value_raw, i.value_key,
              i.norm_version, why, 'merge', i.valid_from, i.valid_to,
              case when shut then pg_catalog.concat_ws(' · ', i.note, 'closed on merging into ' || kept.number) else i.note end,
              case when shut then core.riyadh_today() else i.closed_on end);
    end if;
  end loop;
  update partner.contact set partner_id = p_kept, is_primary = false where partner_id = p_merged and deleted_at is null;
  update partner.contract set partner_id = p_kept where partner_id = p_merged and deleted_at is null;
  update partner.reference set partner_id = p_kept where partner_id = p_merged and deleted_at is null;
  update core.note set entity_id = p_kept
  where entity_table = 'partner.partner' and entity_id = p_merged and deleted_at is null;
  if kept.logo_file_id is null and gone.logo_file_id is not null then
    update partner.partner set logo_file_id = gone.logo_file_id where id = p_kept;
  end if;
  update core.file_link l set entity_id = p_kept
  where l.entity_table = 'partner.partner' and l.entity_id = p_merged and l.deleted_at is null
    and (l.purpose <> 'logo' or (kept.logo_file_id is null and l.file_id = gone.logo_file_id))
    and not exists (select 1 from core.file_link x where x.file_id = l.file_id and x.entity_table = 'partner.partner'
                    and x.entity_id = p_kept and x.purpose = l.purpose and x.deleted_at is null);
  update partner.partner set archived_at = core.clock(), merged_into_id = p_kept where id = p_merged;
  perform audit.end();
  return pg_catalog.jsonb_build_object('kept', p_kept, 'merged', p_merged, 'request_id', req);
end
$$;

-- ================================================================ the doors (V124)
grant execute on function partner.client_id_close(uuid, date, text), partner.client_id_reopen(uuid, text)
  to authenticated;
create function api.client_id_close(p_id uuid, p_closed_on date, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.client_id_close(p_id, p_closed_on, p_reason) $$;
create function api.client_id_reopen(p_id uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.client_id_reopen(p_id, p_reason) $$;
grant execute on function api.client_id_close(uuid, date, text), api.client_id_reopen(uuid, text) to authenticated;
