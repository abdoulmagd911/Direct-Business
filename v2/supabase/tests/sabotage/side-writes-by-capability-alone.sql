-- Sabotage: side-writes-by-capability-alone
-- Breaks: sql:SIDE-02
-- Expect: the Clients capability sets no Client status without the Clients page
-- A side is written with its capability alone: the organisation as a whole, not that side's page (V147).
create or replace function partner.side_status_set(p_id uuid, p_side text, p_status text, p_effective_on date default null,
                                                   p_reason_id uuid default null, p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  me uuid := authz.me();
  req uuid;
  sid uuid;
begin
  if not (me in (select partner.side_owners(p_id, p_side))) then
    perform authz.require_capability(partner.side_page(p_side) || '.assign');
  end if;
  if p_status in ('at_risk', 'lost') and p_reason_id is null then
    raise exception using errcode = 'P0001', message = 'partner.status_reason_required';
  end if;
  req := audit.begin('ui', 'partner.status_set', pg_catalog.jsonb_build_object('side', p_side, 'status', p_status), p_note);
  insert into partner.side_status_change (partner_id, side, status, effective_on, reason_id, note)
  values (p_id, p_side, p_status, coalesce(p_effective_on, core.riyadh_today()), p_reason_id, p_note)
  returning id into sid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', sid, 'status', partner.status_of(p_id, p_side), 'request_id', req);
end
$$;
