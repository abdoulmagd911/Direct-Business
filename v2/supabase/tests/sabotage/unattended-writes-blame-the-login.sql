-- Sabotage: unattended-writes-blame-the-login
-- Breaks: sql:AUD-03
-- Expect: an automatic system request
-- A write with no request is pinned on whoever is signed in (the old QA-account attribution, D13, in reverse).
create or replace function audit.ensure_request() returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
begin
  if r is null then
    insert into audit.request (actor_id, kind, label_key)
    values (coalesce(authz.me(), core.system_person_id()), case when authz.me() is null then 'system' else 'ui' end, 'x')
    returning id into r;
    perform pg_catalog.set_config('app.request_id', r::text, true);
  end if;
  return r;
end
$$;
