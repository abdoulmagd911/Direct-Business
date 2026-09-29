-- Mutant m34b-at-risk-without-reason-anywhere: at risk/lost needs no reason: function guard and table check both gone
CREATE OR REPLACE FUNCTION partner.side_status_set(p_id uuid, p_side text, p_status text, p_effective_on date DEFAULT NULL::date, p_reason_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    null;
  end if;
  req := audit.begin('ui', 'partner.status_set', pg_catalog.jsonb_build_object('side', p_side, 'status', p_status), p_note);
  insert into partner.side_status_change (partner_id, side, status, effective_on, reason_id, note)
  values (p_id, p_side, p_status, coalesce(p_effective_on, core.riyadh_today()), p_reason_id, p_note)
  returning id into sid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', sid, 'status', partner.status_of(p_id, p_side), 'request_id', req);
end
$function$
;

alter table partner.side_status_change drop constraint side_status_change_check;
