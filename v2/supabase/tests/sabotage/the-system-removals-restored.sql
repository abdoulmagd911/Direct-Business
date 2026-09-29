-- Sabotage: the-system-removals-restored
-- Breaks: sql:DEL-02
-- Expect: an admin cannot restore what the system removed
-- Restore asks nothing of who removed the row: an admin brings back what a migration took out.
create or replace function core.restore_needs(p_table text, p_id uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  i record;
begin
  if authz.me() is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_table = 'partner.identifier' then
    select x.partner_id, x.kind into i from partner.identifier x where x.id = p_id;
    perform partner.require_cap(i.partner_id,
                                case when i.kind in ('payments_client_id', 'discount_code') then 'client' end, 'identify');
  elsif p_table = 'partner.side_owner' then
    select x.side into i from partner.side_owner x where x.id = p_id;
    perform authz.require_capability(partner.side_page(i.side) || '.assign');
  elsif p_table = 'partner.credit_limit' then
    perform authz.require_capability('finance.credit_control');
  end if;
end
$$;
