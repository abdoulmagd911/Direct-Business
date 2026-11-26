-- Sabotage: own-does-not-change-its-own-organisation
-- Breaks: sql:OWN-01
-- Expect: its owner changes its details
-- The one rule asks for Full again, as before Landing 55: an owner at Own cannot change their own organisation.
CREATE OR REPLACE FUNCTION partner.may_change(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
begin
  if me is null then
    return false;
  end if;
  if authz.is_admin() then
    return true;
  end if;
  -- a side that is on: Full on its page, or Own and its owner — or the extra "Edit someone else's work"
  if exists (select 1 from partner.partner_side s
             where s.partner_id = p_id and s.deleted_at is null and partner.side_on(p_id, s.side)
               and (authz.level_of(me, partner.side_page(s.side)) = 'full'
                    )) then
    return true;
  end if;
  -- no side on at all: as before, Full on either page
  return not exists (select 1 from partner.partner_side s
                     where s.partner_id = p_id and s.deleted_at is null and partner.side_on(p_id, s.side))
     and greatest(authz.level_of(me, 'clients'), authz.level_of(me, 'suppliers_partners')) = 'full';
end
$function$;
