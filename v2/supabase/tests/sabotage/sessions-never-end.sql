-- Sabotage: sessions-never-end
-- Breaks: sql:SIGN-05
-- Expect: day 30 and a second: a new code is needed
-- A sign-in lasts a hundred years instead of thirty days.
create or replace function core.sign_in_days() returns int
language sql immutable parallel safe set search_path = ''
as $$ select 36500 $$;
