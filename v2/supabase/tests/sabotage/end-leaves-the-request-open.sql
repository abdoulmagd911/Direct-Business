-- Sabotage: end-leaves-the-request-open
-- Breaks: sql:AUD-04
-- Expect: the department and two teams are one request
-- audit.end() forgets to close the request, so later writes join a finished action.
create or replace function audit.end() returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  return nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
end
$$;
