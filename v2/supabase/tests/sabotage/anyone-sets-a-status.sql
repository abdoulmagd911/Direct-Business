-- Sabotage: anyone-sets-a-status
-- Breaks: sql:PST-01
-- Expect: a member who does not own the partner cannot set its status
-- Anyone who can edit a partner sets its status, owner or not.
create or replace function partner.status_set(p_id uuid, p_status text, p_effective_on date default null,
                                   p_reason_id uuid default null, p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  me uuid := authz.me();
  req uuid;
  sid uuid;
begin
  if p_status in ('at_risk', 'lost') and p_reason_id is null then
    raise exception using errcode = 'P0001', message = 'partner.status_reason_required';
  end if;
  req := audit.begin('ui', 'partner.status_set', pg_catalog.jsonb_build_object('status', p_status), p_note);
  insert into partner.status_change (partner_id, status, effective_on, reason_id, note)
  values (p_id, p_status, coalesce(p_effective_on, core.riyadh_today()), p_reason_id, p_note)
  returning id into sid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', sid, 'status', partner.status_of(p_id), 'request_id', req);
end
$$;
