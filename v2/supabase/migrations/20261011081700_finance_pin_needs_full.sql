-- QA-535 (the Architect's ruling of 11 Oct, V622 (3)): a pin moves an invoice's revenue and credit to an organisation,
-- so it is a money edit like typing an invoice: setting or clearing a pin needs Full on Finance. A member (Own) cannot.
-- A decision pin still needs the Client side's identify capability too. Forward-only.

create or replace function finance.match_pin_set(p_invoice uuid, p_partner uuid, p_kind text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  u record;
  req uuid;
  pid uuid;
begin
  if p_kind not in ('entry', 'decision') then
    raise exception using errcode = 'P0001', message = 'match.unknown_pin_kind', detail = coalesce(p_kind, '');
  end if;
  if p_kind = 'decision' then
    perform authz.require_capability('clients.identify');
  end if;
  if nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if not exists (select 1 from finance.invoice i where i.id = p_invoice and i.deleted_at is null)
     or not exists (select 1 from partner.partner x where x.id = p_partner and x.archived_at is null and x.merged_into_id is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into u from finance.partner_match_unpinned(p_invoice);
  if u.state = 'matched' then
    raise exception using errcode = 'P0001', message = 'match.already_matched';
  end if;
  if p_kind = 'entry' and u.state not in ('none', 'unknown_client_id') then
    raise exception using errcode = 'P0001', message = 'match.entry_pin_needs_no_match', detail = u.state;
  end if;
  if exists (select 1 from partner.match_pin p where p.source_table = 'finance.invoice' and p.source_id = p_invoice
             and p.deleted_at is null) then
    raise exception using errcode = '23505', message = 'match.already_pinned';
  end if;
  req := audit.begin('ui', 'match.pinned', pg_catalog.jsonb_build_object('kind', p_kind), p_reason);
  insert into partner.match_pin (source_table, source_id, partner_id, kind, reason, created_by)
  values ('finance.invoice', p_invoice, p_partner, p_kind, pg_catalog.btrim(p_reason), me)
  returning id into pid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'version', 1, 'request_id', req);
end
$$;

create or replace function finance.match_pin_clear(p_id uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  p partner.match_pin;
  req uuid;
begin
  select * into p from partner.match_pin x where x.id = p_id and x.deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p.kind = 'decision' then
    perform authz.require_capability('clients.identify');
  end if;
  req := audit.begin('ui', 'match.unpinned', pg_catalog.jsonb_build_object('kind', p.kind), p_reason);
  update partner.match_pin x
  set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = coalesce(nullif(pg_catalog.btrim(p_reason), ''), 'unpinned')
  where x.id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;
