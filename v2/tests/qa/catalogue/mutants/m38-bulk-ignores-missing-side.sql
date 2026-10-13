-- Mutant m38-bulk-ignores-missing-side: bulk assign takes an organisation without the side on
CREATE OR REPLACE FUNCTION partner.bulk_assign(p_ids uuid[], p_side text, p_owner uuid, p_priority uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require(partner.side_page(p_side), 'full');
  pid uuid;
  req uuid;
  n int := 0;
begin
  perform authz.require_capability(partner.side_page(p_side) || '.assign');
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_priority is not null and not exists (select 1 from work.priority x where x.id = p_priority and x.active) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'partner.bulk_assigned',
                     pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids), 'side', p_side), p_reason);
  foreach pid in array p_ids loop
    perform partner.writable(pid);
    if not partner.side_on(pid, p_side) then
      continue;
    end if;
    if p_owner is not null then
      perform partner.side_owner_set_inner(pid, p_side, p_owner, core.riyadh_today(), p_reason);
    end if;
    if p_priority is not null then
      update partner.partner set priority_id = p_priority where id = pid;
    end if;
    if partner.status_of(pid, p_side) is null then
      insert into partner.side_status_change (partner_id, side, status, effective_on)
      values (pid, p_side, 'prospect', core.riyadh_today());
    end if;
    n := n + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', n, 'request_id', req);
end
$function$
;
