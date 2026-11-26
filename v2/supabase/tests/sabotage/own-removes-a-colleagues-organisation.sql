-- Sabotage: own-removes-a-colleagues-organisation
-- Breaks: sql:OWN-01
-- Expect: a team member cannot remove it on a colleague's organisation
-- Removing an organisation asks for the page level alone: Own removes a colleague's.
CREATE OR REPLACE FUNCTION partner.partner_remove(p_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  req uuid;
  k int;
begin
  if not exists (select 1 from partner.partner where id = p_id and deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  -- Landing 55: Full on a side that is on, or Own and that side's owner (or the extra "Edit someone else's work").
  perform partner.require_level(p_id, null, 'own');
  req := audit.begin('ui', 'partner.removed', pg_catalog.jsonb_build_object('id', p_id), p_reason);
  update partner.partner set deleted_at = core.clock(), deleted_by = authz.me(), delete_reason = p_reason
    where id = p_id;
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$function$;
