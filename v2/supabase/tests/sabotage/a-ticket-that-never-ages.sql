-- Sabotage: a-ticket-that-never-ages
-- Breaks: sql:UNDO-06
-- Expect: nor one older than a minute
-- A ticket never ages: one left over from an hour ago still opens a sign-in undo.
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
  where a.id = p_ticket and a.kind = p_kind and a.target = p_target and a.person_id = authz.me()
    and a.used_at is null
  for update;
  if t is null then
    return false;
  end if;
  update core.auth_ticket set used_at = pg_catalog.now() where id = t;
  return true;
end
$$;
