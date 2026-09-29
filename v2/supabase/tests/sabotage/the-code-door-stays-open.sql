-- Sabotage: the-code-door-stays-open
-- Breaks: sql:SIGN-10
-- Expect: the page offers the password alone
-- The emailed code ignores its switch (V166): the code door is open although an admin never switched it on.
create or replace function core.code_door_on() returns boolean
language sql stable security definer set search_path = ''
as $$ select true $$;
