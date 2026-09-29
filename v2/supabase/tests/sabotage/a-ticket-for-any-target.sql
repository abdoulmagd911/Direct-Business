-- Sabotage: a-ticket-for-any-target
-- Breaks: sql:UNDO-06
-- Expect: a ticket for another request opens nothing
-- The ticket is taken whatever it was issued for: one left for any request opens a sign-in undo.
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
  where a.id = p_ticket and a.kind = p_kind and a.person_id = authz.me()
    and a.used_at is null and a.issued_at > pg_catalog.now() - interval '1 minute'
  for update;
  if t is null then
    return false;
  end if;
  update core.auth_ticket set used_at = pg_catalog.now() where id = t;
  return true;
end
$$;
