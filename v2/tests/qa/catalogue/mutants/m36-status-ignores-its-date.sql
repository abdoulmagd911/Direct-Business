-- Mutant m36-status-ignores-its-date: the status on a day ignores effective dates
CREATE OR REPLACE FUNCTION partner.status_of(p_partner uuid, p_side text, p_on date DEFAULT NULL::date)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.status from partner.side_status_change s
  where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null
  order by s.effective_on desc, s.created_at desc limit 1
$function$
;
