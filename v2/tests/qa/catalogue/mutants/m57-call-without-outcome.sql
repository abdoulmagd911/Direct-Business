-- Mutant m57-call-without-outcome: a call is logged without an outcome
CREATE OR REPLACE FUNCTION partner.outcome_of(p_type partner.activity_type, p_outcome text)
 RETURNS partner.activity_outcome
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  o partner.activity_outcome;
begin
  if p_outcome is null then
    if exists (select 1 from partner.activity_outcome x where x.activity_type_id = p_type.id and x.active
               and x.deleted_at is null) then
      null;
    end if;
    return null;
  end if;
  select * into o from partner.activity_outcome x
  where x.activity_type_id = p_type.id and x.active and x.deleted_at is null and (x.key = p_outcome or x.id::text = p_outcome);
  if o.id is null then
    raise exception using errcode = 'P0002', message = 'partner.unknown_outcome', detail = p_outcome;
  end if;
  return o;
end
$function$
;
