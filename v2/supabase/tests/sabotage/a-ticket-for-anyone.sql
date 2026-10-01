-- Sabotage: a-ticket-for-anyone
-- Breaks: sql:UNDO-06
-- Expect: nor one issued for someone else
-- A ticket serves whoever names it, not the person it was issued for.
create or replace function core.auth_ticket_take(p_ticket uuid, p_kind text, p_target text) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t uuid;
begin
  if p_ticket is null then
    return false;
  end if;
  select a.id into t from core.auth_ticket a
  where a.id = p_ticket and a.kind = p_kind and a.target = p_target
    and a.used_at is null and a.issued_at > pg_catalog.now() - interval '1 minute'
  for update;
  if t is null then
    return false;
  end if;
  update core.auth_ticket set used_at = pg_catalog.now() where id = t;
  return true;
end
$$;
