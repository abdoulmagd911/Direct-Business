-- Mutant m61-work-dated-tomorrow: work may be dated after the day it is logged (both guards gone)
alter table core.note drop constraint note_not_after_logged;
CREATE OR REPLACE FUNCTION audit.happened(p_on date)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
begin
  if p_on is null then
    return core.riyadh_today();
  end if;
  if p_on > core.riyadh_today() then
    null;
  end if;
  update audit.request set happened_on = p_on where id = r;
  return p_on;
end
$function$
;
