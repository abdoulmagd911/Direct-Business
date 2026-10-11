-- Sabotage: a-member-pins-an-invoice
-- Breaks: sql:MPN-01
-- Expect: a member cannot pin an invoice to an organisation
-- A member with Own on Finance pins an imported invoice to any organisation, moving its revenue and credit (QA-535).
create or replace function finance.match_pin_set(p_invoice uuid, p_partner uuid, p_kind text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'own');
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
