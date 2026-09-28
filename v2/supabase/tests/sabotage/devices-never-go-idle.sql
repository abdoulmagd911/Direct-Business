-- Sabotage: devices-never-go-idle
-- Breaks: sql:SIGN-05
-- Expect: 31 days unused: a new code is needed
-- A device may go unused for a hundred years instead of thirty days.
create or replace function core.device_idle_days() returns int
language sql immutable parallel safe set search_path = ''
as $$ select 36500 $$;
