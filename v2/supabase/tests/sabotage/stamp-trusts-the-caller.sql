-- Sabotage: stamp-trusts-the-caller
-- Breaks: sql:AUD-06
-- Expect: created_by is the request's person
-- Who and when are taken from whatever the caller sent (A14).
create or replace function audit.stamp() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, pg_catalog.now());
    new.created_by := coalesce(new.created_by, audit.actor());
  end if;
  return new;
end
$$;
