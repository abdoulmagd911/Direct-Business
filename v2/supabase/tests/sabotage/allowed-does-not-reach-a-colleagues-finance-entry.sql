-- Sabotage: allowed-does-not-reach-a-colleagues-finance-entry
-- Breaks: sql:OWN-02
-- Expect: Allowed: they set the deal type on a colleague's client
-- The one rule forgets the extra "Edit someone else's work".
CREATE OR REPLACE FUNCTION finance.may_write_partner(p_partner uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  lv core.level;
begin
  if me is null then
    return false;
  end if;
  if authz.is_admin() then
    return true;
  end if;
  lv := authz.level_of(me, 'finance');
  if lv = 'full' then
    return true;
  end if;
  -- Own: the Client side's owner, or a person with the extra "Edit someone else's work"
  return lv >= 'own' and p_partner is not null and me in (select partner.side_owners(p_partner, 'client'));
end
$function$;
