-- Sabotage: a-definer-function-in-the-door
-- Breaks: sql:API-01
-- Expect: api functions that run as their owner
-- A function in the exposed api schema runs as its owner, past row-level security.
create or replace function api.me() returns jsonb
language sql stable security definer set search_path = ''
as $$ select core.me() $$;
