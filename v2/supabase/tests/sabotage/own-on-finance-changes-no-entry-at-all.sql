-- Sabotage: own-on-finance-changes-no-entry-at-all
-- Breaks: sql:OWN-02
-- Expect: finance.own_clients_only
-- The one rule asks for Full again: a team member cannot type an invoice even for their own client.
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
  return false;
end
$function$;
