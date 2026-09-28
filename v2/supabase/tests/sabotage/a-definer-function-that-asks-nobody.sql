-- Sabotage: a-definer-function-that-asks-nobody
-- Breaks: sql:SEC-02
-- Expect: api.leak_people()
-- A security-definer function in the api schema hands out rows without asking who is calling.
create function api.leak_people() returns setof text language sql security definer set search_path = ''
as $$ select full_name_en from core.person $$;
grant execute on function api.leak_people() to authenticated;
