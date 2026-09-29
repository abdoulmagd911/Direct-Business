-- Sabotage: end-tells-nobody
-- Breaks: sql:NTF-01
-- Expect: the owner of both records is told once for the request
-- Closing a request tells nobody: owners and followers never hear of a change by someone else.
create or replace function audit.end() returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  depth int := coalesce(nullif(pg_catalog.current_setting('app.request_depth', true), '')::int, 0);
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
begin
  if depth > 1 then
    perform pg_catalog.set_config('app.request_depth', (depth - 1)::text, true);
  else
    perform pg_catalog.set_config('app.request_depth', '0', true);
    perform pg_catalog.set_config('app.request_id', '', true);
  end if;
  return r;
end
$$;
