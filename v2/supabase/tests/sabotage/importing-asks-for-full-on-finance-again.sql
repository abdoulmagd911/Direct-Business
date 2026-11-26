-- Sabotage: importing-asks-for-full-on-finance-again
-- Breaks: sql:OWN-02
-- Expect: a team member set to Allowed on Import imports at Own
-- The import rule asks for Finance at Full again: with a team member at Own, "Allowed" on Import imports nothing.
CREATE OR REPLACE FUNCTION work.import_require()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require_capability('finance.import');
begin
  if not core.extra_access(me, 'finance.import') then
    raise exception using errcode = '42501', message = 'access.needs_capability',
      detail = pg_catalog.jsonb_build_object('capability', 'finance.import')::text;
  end if;
  -- Landing 51, 56: importing writes Finance, so it needs Finance at Own or above at every door — who imports is
  -- decided by the extra above, not by the level.
  perform authz.require('finance', 'full');
end
$function$;
